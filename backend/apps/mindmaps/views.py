"""
Views for Mind Maps API.
"""
import json

from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.models import WorkspaceMember
from apps.billing.services import QuotaService
from .models import MindMap
from .serializers import MindMapSerializer
from .permissions import CanAccessMindMap


class MindMapViewSet(viewsets.ModelViewSet):
    """
    CRUD для ментальных карт. Фильтры: project_id, related_workitem_id, workspace_id.
    """
    serializer_class = MindMapSerializer
    permission_classes = [CanAccessMindMap]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'related_workitem', 'workspace', 'is_personal']
    ordering_fields = ['created_at', 'updated_at', 'title']
    ordering = ['-updated_at']

    def get_parser_classes(self):
        if self.action in {'import_data', 'upload_map_image'}:
            return [MultiPartParser, FormParser, JSONParser]
        return super().get_parser_classes()

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return MindMap.objects.none()
        qs = MindMap.objects.select_related('owner', 'workspace', 'project', 'related_workitem')
        # Личные — только свои
        personal = Q(owner=user, is_personal=True)
        # Привязанные к workspace — участник пространства
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        )
        by_workspace = Q(workspace_id__in=workspace_ids, is_personal=False)
        by_project_workspace = Q(project__workspace_id__in=workspace_ids, is_personal=False)
        by_workitem_workspace = Q(related_workitem__project__workspace_id__in=workspace_ids, is_personal=False)
        return qs.filter(
            personal | by_workspace | by_project_workspace | by_workitem_workspace
        ).distinct()

    def perform_create(self, serializer):
        workspace = serializer.validated_data.get('workspace')
        project = serializer.validated_data.get('project')
        related_workitem = serializer.validated_data.get('related_workitem')
        workspace_id = None
        if workspace is not None:
            workspace_id = workspace.id
        elif project is not None:
            workspace_id = project.workspace_id
        elif related_workitem is not None and related_workitem.project_id:
            workspace_id = related_workitem.project.workspace_id

        current_maps = MindMap.objects.filter(
            Q(workspace_id=workspace_id)
            | Q(project__workspace_id=workspace_id)
            | Q(related_workitem__project__workspace_id=workspace_id)
        ).distinct().count() if workspace_id else MindMap.objects.filter(owner=self.request.user).count()

        QuotaService.assert_new_resources_allowed(
            self.request.user,
            workspace_id=workspace_id,
            source='mindmaps.create',
        )
        QuotaService.assert_quota(
            self.request.user,
            ('max_mindmaps', 'max_mindmap_maps'),
            current_usage=current_maps,
            workspace_id=workspace_id,
            source='mindmaps.create',
        )
        serializer.save()

    @action(detail=True, methods=['post'])
    def export_to_file(self, request, pk=None):
        """
        Экспорт карты в JSON файл и прикрепление его как Attachment к проекту/задаче (Task 4.2).
        """
        mindmap = self.get_object()
        workspace_id = (
            mindmap.workspace_id
            or (mindmap.project.workspace_id if mindmap.project_id else None)
            or (
                mindmap.related_workitem.project.workspace_id
                if mindmap.related_workitem_id and mindmap.related_workitem and mindmap.related_workitem.project_id
                else None
            )
        )
        QuotaService.assert_feature(
            request.user,
            ('mindmap_export', 'mindmap_premium_actions'),
            detail='Эта функция — достояние Империи. Доступно в тарифе БАЗА.',
            workspace_id=workspace_id,
            source='mindmaps.export_to_file',
        )
        data = {
            'title': mindmap.title,
            'nodes': mindmap.nodes,
            'edges': mindmap.edges,
            'exported_at': str(request.user),
            'version': '1.0',
        }
        import json
        from django.core.files.base import ContentFile
        from apps.documents.models import Attachment
        from django.contrib.contenttypes.models import ContentType
        
        content = json.dumps(data, indent=2, ensure_ascii=False)
        content_bytes = content.encode('utf-8')
        QuotaService.reserve_storage_bytes(
            request.user,
            len(content_bytes),
            workspace_id=workspace_id,
            source='mindmaps.export_to_file',
        )
        filename = f"{mindmap.title}.json"
        try:
            # Создаем Attachment
            attachment = Attachment.objects.create(
                filename=filename,
                size=len(content_bytes),
                mime_type='application/json',
                uploaded_by=request.user,
                project=mindmap.project,
                # Привязываем к самой карте как к источнику
                content_type=ContentType.objects.get_for_model(MindMap),
                object_id=mindmap.id,
                is_public=False
            )
            attachment.file.save(filename, ContentFile(content))
        except Exception:
            QuotaService.release_storage_bytes(
                request.user,
                len(content_bytes),
                workspace_id=workspace_id,
            )
            raise
        
        # Если привязана к задаче, это будет видно через generic relation или project
        
        from apps.documents.serializers import AttachmentSerializer
        return Response(
            AttachmentSerializer(attachment, context={'request': request}).data, 
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'], url_path='import_data')
    def import_data(self, request, pk=None):
        """
        Импорт mindmap-данных (nodes/edges) из JSON payload или файла.
        """
        mindmap = self.get_object()
        workspace_id = (
            mindmap.workspace_id
            or (mindmap.project.workspace_id if mindmap.project_id else None)
            or (
                mindmap.related_workitem.project.workspace_id
                if mindmap.related_workitem_id and mindmap.related_workitem and mindmap.related_workitem.project_id
                else None
            )
        )
        QuotaService.assert_feature(
            request.user,
            ('mindmap_advanced_features', 'mindmap_premium_actions'),
            detail='Эта функция — достояние Империи. Доступно в тарифе БАЗА.',
            workspace_id=workspace_id,
            source='mindmaps.import_data',
        )
        QuotaService.assert_new_resources_allowed(
            request.user,
            workspace_id=workspace_id,
            source='mindmaps.import_data',
        )

        payload = None
        upload = request.FILES.get('file')
        if upload:
            try:
                payload = json.loads(upload.read().decode('utf-8'))
            except Exception:
                return Response({'detail': 'Некорректный JSON файл.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            raw = request.data.get('data') if hasattr(request, 'data') else None
            if isinstance(raw, str):
                try:
                    payload = json.loads(raw)
                except Exception:
                    return Response({'detail': 'Некорректный JSON payload.'}, status=status.HTTP_400_BAD_REQUEST)
            elif isinstance(raw, dict):
                payload = raw
            elif isinstance(request.data, dict):
                payload = request.data

        if not isinstance(payload, dict):
            return Response({'detail': 'Ожидается JSON объект mindmap.'}, status=status.HTTP_400_BAD_REQUEST)

        nodes = payload.get('nodes')
        edges = payload.get('edges')
        if not isinstance(nodes, list) or not isinstance(edges, list):
            return Response({'detail': 'В import_data обязательны массивы nodes и edges.'}, status=status.HTTP_400_BAD_REQUEST)

        mindmap.nodes = nodes
        mindmap.edges = edges
        title = payload.get('title')
        if isinstance(title, str) and title.strip():
            mindmap.title = title.strip()[:255]
            mindmap.save(update_fields=['title', 'nodes', 'edges', 'updated_at'])
        else:
            mindmap.save(update_fields=['nodes', 'edges', 'updated_at'])

        return Response(MindMapSerializer(mindmap, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='upload_map_image')
    def upload_map_image(self, request, pk=None):
        """
        Серверная загрузка изображения для карты (фон/ресурс карты).
        """
        mindmap = self.get_object()
        workspace_id = (
            mindmap.workspace_id
            or (mindmap.project.workspace_id if mindmap.project_id else None)
            or (
                mindmap.related_workitem.project.workspace_id
                if mindmap.related_workitem_id and mindmap.related_workitem and mindmap.related_workitem.project_id
                else None
            )
        )
        QuotaService.assert_feature(
            request.user,
            ('mindmap_advanced_features', 'mindmap_premium_actions'),
            detail='Эта функция — достояние Империи. Доступно в тарифе БАЗА.',
            workspace_id=workspace_id,
            source='mindmaps.upload_map_image',
        )
        QuotaService.assert_new_resources_allowed(
            request.user,
            workspace_id=workspace_id,
            source='mindmaps.upload_map_image',
        )

        image_file = request.FILES.get('file')
        if not image_file:
            return Response({'detail': 'Файл не передан.'}, status=status.HTTP_400_BAD_REQUEST)
        if not str(getattr(image_file, 'content_type', '')).startswith('image/'):
            return Response({'detail': 'Допустима только загрузка изображений.'}, status=status.HTTP_400_BAD_REQUEST)

        size_bytes = int(getattr(image_file, 'size', 0) or 0)
        QuotaService.reserve_storage_bytes(
            request.user,
            size_bytes,
            workspace_id=workspace_id,
            source='mindmaps.upload_map_image',
        )
        try:
            from apps.documents.models import Attachment
            from django.contrib.contenttypes.models import ContentType
            attachment = Attachment.objects.create(
                file=image_file,
                filename=image_file.name,
                size=size_bytes,
                mime_type=image_file.content_type or 'application/octet-stream',
                uploaded_by=request.user,
                project=mindmap.project,
                content_type=ContentType.objects.get_for_model(MindMap),
                object_id=mindmap.id,
                is_public=False,
            )
        except Exception:
            QuotaService.release_storage_bytes(
                request.user,
                size_bytes,
                workspace_id=workspace_id,
            )
            raise

        image_url = request.build_absolute_uri(attachment.file.url) if attachment.file else None
        return Response(
            {
                'id': attachment.id,
                'image_url': image_url,
                'filename': attachment.filename,
                'size': attachment.size,
            },
            status=status.HTTP_201_CREATED,
        )
