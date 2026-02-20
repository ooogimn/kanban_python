"""
Serializers for CRM app.
"""
from rest_framework import serializers
from .models import Company, Customer


class CompanySerializer(serializers.ModelSerializer):
    """Сериализатор для Company (контрагент)."""

    logo_url = serializers.SerializerMethodField(read_only=True)
    files = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Company
        fields = [
            'id', 'name', 'short_name', 'type', 'logo', 'logo_url',
            'inn', 'kpp', 'ogrn', 'legal_address', 'actual_address',
            'bank_name', 'bank_bik', 'bank_account', 'bank_corr_account',
            'email', 'phone', 'website',
            'description', 'is_active',
            'files',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            'logo': {'write_only': True, 'required': False},
        }

    def get_logo_url(self, obj):
        """Полный URL логотипа для фронтенда."""
        if obj.logo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url
        return None

    def get_files(self, obj):
        """Список привязанных файлов (read_only, минимальная информация)."""
        files_qs = obj.files.all()[:50]
        return [
            {
                'id': f.id,
                'filename': f.filename,
                'file_type': f.file_type,
                'size': f.size,
                'created_at': f.created_at.isoformat() if f.created_at else None,
            }
            for f in files_qs
        ]

    def validate_logo(self, value):
        """Ограничение: изображения до 5 МБ."""
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Размер файла не должен превышать 5 МБ.')
        return value


class CustomerSerializer(serializers.ModelSerializer):
    """Сериализатор для Customer (CRM-Lite)."""
    
    workspace_name = serializers.CharField(
        source='workspace.name',
        read_only=True
    )
    projects_count = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'contact_email', 'telegram_username',
            'status', 'notes', 'workspace', 'workspace_name',
            'projects_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_projects_count(self, obj):
        """Количество проектов клиента."""
        return obj.projects.count()
