"""
Views for Mind Maps API.
"""
from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.models import WorkspaceMember
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

    @action(detail=True, methods=['post'])
    def export_to_file(self, request, pk=None):
        """
        Экспорт карты в JSON файл и прикрепление его как Attachment к проекту/задаче (Task 4.2).
        """
        mindmap = self.get_object()
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
        filename = f"{mindmap.title}.json"
        
        # Создаем Attachment
        attachment = Attachment.objects.create(
            filename=filename,
            size=len(content.encode('utf-8')),
            mime_type='application/json',
            uploaded_by=request.user,
            project=mindmap.project,
            # Привязываем к самой карте как к источнику
            content_type=ContentType.objects.get_for_model(MindMap),
            object_id=mindmap.id,
            is_public=False
        )
        attachment.file.save(filename, ContentFile(content))
        
        # Если привязана к задаче, это будет видно через generic relation или project
        
        from apps.documents.serializers import AttachmentSerializer
        return Response(
            AttachmentSerializer(attachment, context={'request': request}).data, 
            status=status.HTTP_201_CREATED
        )
