"""
Billing API — InvoiceViewSet for PDF generation.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import FileResponse

from apps.auth.permissions import IsDirectorOrManager
from .models import Invoice
from .serializers import InvoiceSerializer, InvoiceCreateSerializer
from .services import InvoiceGenerator, PDFRenderer
from apps.todo.models import Project
from apps.core.models import WorkspaceMember


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet для счетов.
    
    - list/retrieve: стандартно
    - create: генерирует черновик по project_id, date_start, date_end
    - generate_pdf (action): рендерит PDF и сохраняет в модель
    - download (action): отдаёт PDF файл
    - mark_as_sent (action): меняет статус на SENT
    """

    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsDirectorOrManager]

    def get_queryset(self):
        """Только счета по проектам из workspace пользователя."""
        user = self.request.user
        workspace_ids = WorkspaceMember.objects.filter(
            user=user
        ).values_list('workspace_id', flat=True)
        project_ids = Project.objects.filter(
            workspace_id__in=workspace_ids
        ).values_list('id', flat=True)
        return Invoice.objects.filter(
            project_id__in=project_ids
        ).select_related('project', 'customer').order_by('-date_issue', '-created_at')

    def _has_project_access(self, project):
        return WorkspaceMember.objects.filter(
            user=self.request.user,
            workspace=project.workspace,
        ).exists()

    def create(self, request, *args, **kwargs):
        """
        POST /api/v1/billing/invoices/
        
        Body: { project_id, date_start, date_end }
        Создаёт черновик счёта.
        """
        ser = InvoiceCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            project = Project.objects.get(pk=data['project_id'])
        except Project.DoesNotExist:
            return Response(
                {'error': 'Проект не найден'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not self._has_project_access(project):
            return Response(
                {'error': 'Нет доступа к проекту'},
                status=status.HTTP_403_FORBIDDEN,
            )

        invoice = InvoiceGenerator.generate_draft(
            project_id=data['project_id'],
            date_start=data['date_start'],
            date_end=data['date_end'],
            created_by=request.user,
        )

        if invoice is None:
            return Response(
                {'error': 'Нет невыставленных таймлогов за указанный период.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(invoice)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def generate_pdf(self, request, pk=None):
        """
        POST /api/v1/billing/invoices/{id}/generate_pdf/
        
        Рендерит PDF и сохраняет в invoice.pdf_file.
        """
        invoice = self.get_object()
        try:
            PDFRenderer.render_and_save(invoice)
            serializer = self.get_serializer(invoice)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Ошибка генерации PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """
        GET /api/v1/billing/invoices/{id}/download/
        
        Отдаёт PDF файл (application/pdf).
        Если PDF ещё не сгенерирован — генерирует и отдаёт.
        """
        invoice = self.get_object()
        if not invoice.pdf_file:
            try:
                PDFRenderer.render_and_save(invoice)
                invoice.refresh_from_db()
            except Exception as e:
                return Response(
                    {'error': f'Ошибка генерации PDF: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        if invoice.pdf_file:
            filename = f"{invoice.number.replace('/', '-')}.pdf"
            return FileResponse(
                invoice.pdf_file.open('rb'),
                as_attachment=True,
                filename=filename,
                content_type='application/pdf',
            )

        return Response(
            {'error': 'PDF не найден'},
            status=status.HTTP_404_NOT_FOUND,
        )

    @action(detail=True, methods=['post'])
    def mark_as_sent(self, request, pk=None):
        """
        POST /api/v1/billing/invoices/{id}/mark_as_sent/
        
        Меняет статус на SENT.
        """
        invoice = self.get_object()
        invoice.status = Invoice.STATUS_SENT
        invoice.save(update_fields=['status', 'updated_at'])
        serializer = self.get_serializer(invoice)
        return Response(serializer.data)
