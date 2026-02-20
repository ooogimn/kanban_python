"""
AI Marketplace & Workspace Agents API (SaaS Sprint 3).
"""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.services import SubscriptionService
from apps.core.models import WorkspaceMember, Workspace

from django.db.models import Count, Sum, Q

from apps.ai.models import AiAgent, WorkspaceAgent, ChatMessage
from apps.ai.serializers import AiAgentSerializer, WorkspaceAgentSerializer, ChatMessageSerializer


def _user_workspace_ids(user):
    """Список id workspace, к которым у пользователя есть доступ."""
    if not user or not getattr(user, 'pk', None):
        return []
    ids = list(
        WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
    )
    if getattr(user, 'is_staff', False) and not ids:
        ids = list(Workspace.objects.values_list('id', flat=True))
    return ids


def _get_workspace_or_400(request, allow_query=True):
    """
    Возвращает (workspace, None) или (None, Response).
    workspace_id берётся из query_params или из data (для POST).
    """
    workspace_id = None
    if allow_query:
        workspace_id = request.query_params.get('workspace_id')
    if workspace_id is None and request.data:
        workspace_id = request.data.get('workspace_id')
    if workspace_id is None:
        return None, Response(
            {'detail': 'Обязательный параметр: workspace_id.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        workspace_id = int(workspace_id)
    except (TypeError, ValueError):
        return None, Response(
            {'detail': 'workspace_id должен быть числом.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    workspace_ids = _user_workspace_ids(request.user)
    if workspace_id not in workspace_ids:
        return None, Response(
            {'detail': 'Нет доступа к этому workspace.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    workspace = Workspace.objects.filter(pk=workspace_id).first()
    if not workspace:
        return None, Response(
            {'detail': 'Workspace не найден.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    return workspace, None


class AiMarketplaceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Каталог ИИ-агентов (Marketplace).
    GET /api/v1/ai/marketplace/ — список, GET .../marketplace/<id>/ — один.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AiAgentSerializer
    queryset = AiAgent.objects.filter(is_active=True).order_by('role', 'name')


class WorkspaceAgentViewSet(viewsets.GenericViewSet):
    """
    Нанятые агенты в workspace и чат.
    list: GET ?workspace_id=X
    hire: POST /hire/ { "agent_id": <id>, "workspace_id": <id> }
    chat: POST /<pk>/chat/ { "message": "..." }
    """
    permission_classes = [IsAuthenticated]
    serializer_class = WorkspaceAgentSerializer
    queryset = WorkspaceAgent.objects.all()

    def get_queryset(self):
        qs = WorkspaceAgent.objects.select_related('agent', 'workspace').filter(
            workspace_id__in=_user_workspace_ids(self.request.user)
        )
        return qs.order_by('agent__name')

    def list(self, request, *args, **kwargs):
        workspace, err = _get_workspace_or_400(request, allow_query=True)
        if err is not None:
            return err
        qs = (
            self.get_queryset()
            .filter(workspace_id=workspace.id)
            .annotate(message_count=Count('messages'))
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='hire')
    def hire(self, request):
        """
        Нанять агента в workspace. Проверка лимита max_ai_agents.
        Body: { "agent_id": <id>, "workspace_id": <id> }
        """
        workspace, err = _get_workspace_or_400(request, allow_query=False)
        if err is not None:
            return err
        agent_id = request.data.get('agent_id')
        if agent_id is None:
            return Response(
                {'detail': 'Обязательное поле: agent_id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            agent_id = int(agent_id)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'agent_id должен быть числом.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        agent = AiAgent.objects.filter(pk=agent_id, is_active=True).first()
        if not agent:
            return Response(
                {'detail': 'Агент не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if WorkspaceAgent.objects.filter(workspace=workspace, agent=agent).exists():
            return Response(
                {'detail': 'Этот агент уже нанят в данном workspace.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not SubscriptionService.check_limit(request.user, 'max_ai_agents'):
            return Response(
                {
                    'code': 'LIMIT_REACHED',
                    'detail': 'Достигнут лимит ИИ-агентов на вашем тарифе. Улучшите план.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        wa = WorkspaceAgent.objects.create(workspace=workspace, agent=agent, is_active=True)
        serializer = self.get_serializer(wa)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='messages')
    def messages(self, request, pk=None):
        """История сообщений чата с агентом. GET .../workspace-agents/<id>/messages/"""
        workspace_agent = self.get_object()
        qs = ChatMessage.objects.filter(workspace_agent=workspace_agent).order_by('created_at')
        serializer = ChatMessageSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='chat')
    def chat(self, request, pk=None):
        """
        Отправить сообщение агенту (заглушка LLM: эхо).
        Body: { "message": "текст" }
        """
        workspace_agent = self.get_object()
        if not workspace_agent.is_active:
            return Response(
                {'detail': 'Агент отключён в этом workspace.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        message = (request.data or {}).get('message')
        if not message or not str(message).strip():
            return Response(
                {'detail': 'Обязательное поле: message (непустая строка).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        message = str(message).strip()
        user_msg = ChatMessage.objects.create(
            workspace_agent=workspace_agent,
            user=request.user,
            role=ChatMessage.ROLE_USER,
            content=message,
        )
        agent_name = workspace_agent.agent.name
        stub_reply = (
            f'Я {agent_name}, получил ваш вопрос: «{message[:200]}{"…" if len(message) > 200 else ""}». '
            '(LLM integration pending)'
        )
        assistant_msg = ChatMessage.objects.create(
            workspace_agent=workspace_agent,
            user=request.user,
            role=ChatMessage.ROLE_ASSISTANT,
            content=stub_reply,
        )
        return Response(
            {
                'user_message': ChatMessageSerializer(user_msg).data,
                'assistant_message': ChatMessageSerializer(assistant_msg).data,
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class TeamComparisonView(APIView):
    """
    Сравнение продуктивности и затрат: люди vs ИИ-сотрудники.
    GET /api/v1/ai/team-comparison/?workspace_id=X
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace, err = _get_workspace_or_400(request, allow_query=True)
        if err is not None:
            return err
        from apps.hr.models import Contact
        from apps.todo.models import Project, WorkItem
        from apps.timetracking.models import TimeLog
        from apps.finance.models import Transaction
        from apps.core.models import ProjectMember

        project_ids = list(Project.objects.filter(workspace_id=workspace.id).values_list('id', flat=True))
        if not project_ids:
            return Response({
                'humans': [],
                'ai': [],
            })

        # Люди: контакты SYSTEM с user в этом workspace
        contacts = Contact.objects.filter(
            workspace_id=workspace.id,
            super_group=Contact.SUPER_GROUP_SYSTEM,
        ).exclude(user__isnull=True).select_related('user')

        humans = []
        for contact in contacts:
            user = contact.user
            # Часы: TimeLog по проектам workspace
            hours_agg = TimeLog.objects.filter(
                user=user,
                workitem__project_id__in=project_ids,
            ).aggregate(total=Sum('duration_minutes'))
            total_minutes = hours_agg['total'] or 0
            total_hours = round(total_minutes / 60, 2)

            # Выплаты: SPEND с payroll_contact
            payroll_agg = Transaction.objects.filter(
                type=Transaction.TYPE_SPEND,
                payroll_contact=contact,
            ).aggregate(total=Sum('amount'))
            payroll_total = str(payroll_agg['total'] or 0)

            # Задачи: ответственный через ProjectMember (contact или user)
            pm_ids = list(
                ProjectMember.objects.filter(
                    project_id__in=project_ids,
                ).filter(Q(contact=contact) | Q(user=user)).values_list('id', flat=True)
            )
            tasks_count = WorkItem.objects.filter(responsible_id__in=pm_ids).count() if pm_ids else 0

            name = f"{contact.first_name or ''} {contact.last_name or ''}".strip() or getattr(user, 'username', str(contact.id))
            humans.append({
                'contact_id': contact.id,
                'name': name or f'Контакт {contact.id}',
                'total_hours': total_hours,
                'payroll_total': payroll_total,
                'tasks_count': tasks_count,
            })

        # ИИ: нанятые агенты с сообщениями и затратами
        ai_agents = (
            WorkspaceAgent.objects.filter(workspace_id=workspace.id)
            .annotate(message_count=Count('messages'))
            .select_related('agent')
        )
        ai_list = []
        for wa in ai_agents:
            cost = wa.agent.monthly_cost
            ai_list.append({
                'workspace_agent_id': wa.id,
                'name': wa.agent.name,
                'role': wa.agent.role,
                'message_count': wa.message_count,
                'monthly_cost': str(cost) if cost is not None else '0',
            })

        return Response({
            'humans': humans,
            'ai': ai_list,
        })
