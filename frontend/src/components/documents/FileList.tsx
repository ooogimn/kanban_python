import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../../api/documents';
import { Attachment } from '../../types';
import toast from 'react-hot-toast';
import FilePreview from './FilePreview';
import FileUploader from './FileUploader';

interface FileListProps {
  entityType?: 'project' | 'workitem' | 'card' | 'schedule';
  entityId?: number;
  projectId?: number;
  onFileClick?: (file: Attachment) => void;
  showUploader?: boolean;
}

export default function FileList({
  entityType,
  entityId,
  projectId,
  onFileClick: _onFileClick,
  showUploader = true,
}: FileListProps) {
  void _onFileClick;
  const queryClient = useQueryClient();
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);

  // Параметры запроса
  const params: any = {};
  if (entityType && entityId) {
    params.entity_type = entityType;
    params.entity_id = entityId;
  }
  if (projectId) {
    params.project = projectId;
  }

  const { data: files, isLoading } = useQuery({
    queryKey: ['attachments', params],
    queryFn: () => documentsApi.getFiles(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentsApi.deleteFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
      toast.success('Файл удален');
    },
    onError: () => {
      toast.error('Ошибка при удалении файла');
    },
  });

  const downloadFile = async (file: Attachment) => {
    try {
      const blob = await documentsApi.downloadFile(file.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Ошибка при скачивании файла');
    }
  };

  const getFileIcon = (fileType: string, mimeType: string) => {
    if (fileType === 'image') return '🖼️';
    if (fileType === 'video') return '🎥';
    if (fileType === 'audio') return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (fileType === 'archive') return '📦';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500">Загрузка файлов...</div>;
  }

  return (
    <div className="space-y-4">
      {showUploader && entityType && entityId && (
        <FileUploader
          entityType={entityType}
          entityId={entityId}
          onUploadSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['attachments'] });
          }}
        />
      )}

      {files?.results && files.results.length > 0 ? (
        <div className="space-y-2">
          {files.results.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="flex items-center space-x-3 flex-1">
                <div className="text-2xl">{getFileIcon(file.file_type, file.mime_type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{file.filename}</div>
                  <div className="text-sm text-gray-500">
                    {formatFileSize(file.size)} • {new Date(file.created_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {file.can_preview && (
                  <button
                    onClick={() => setPreviewFile(file)}
                    className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded"
                    title="Просмотр"
                  >
                    👁️
                  </button>
                )}
                <button
                  onClick={() => downloadFile(file)}
                  className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                  title="Скачать"
                >
                  ⬇️
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Удалить файл "${file.filename}"?`)) {
                      deleteMutation.mutate(file.id);
                    }
                  }}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  title="Удалить"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg">
          Нет файлов
        </div>
      )}

      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
