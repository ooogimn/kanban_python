import { useState, useCallback } from 'react';
import { documentsApi } from '../../api/documents';
import { Attachment } from '../../types';
import toast from 'react-hot-toast';

interface FileUploaderProps {
  entityType: 'project' | 'workitem' | 'card' | 'schedule';
  entityId: number;
  onUploadSuccess?: (attachment: Attachment) => void;
  onUploadError?: (error: Error) => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number; // в байтах
  isPublic?: boolean;
}

export default function FileUploader({
  entityType,
  entityId,
  onUploadSuccess,
  onUploadError,
  multiple = false,
  accept,
  maxSize = 100 * 1024 * 1024, // 100MB по умолчанию
  isPublic = false,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);

      // Проверка размера файлов
      for (const file of fileArray) {
        if (file.size > maxSize) {
          toast.error(`Файл "${file.name}" слишком большой. Максимальный размер: ${(maxSize / 1024 / 1024).toFixed(0)}MB`);
          return;
        }
      }

      setUploading(true);
      setProgress(0);

      try {
        const uploadPromises = fileArray.map((file) =>
          documentsApi.uploadFile(
            entityType,
            entityId,
            file,
            isPublic,
            (uploadProgress) => {
              // Обновляем общий прогресс
              setProgress(uploadProgress);
            }
          )
        );

        const results = await Promise.all(uploadPromises);

        results.forEach((attachment) => {
          toast.success(`Файл "${attachment.filename}" загружен`);
          onUploadSuccess?.(attachment);
        });
      } catch (error: any) {
        const errorMessage = error.response?.data?.detail || error.message || 'Ошибка при загрузке файла';
        toast.error(errorMessage);
        onUploadError?.(error);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [entityType, entityId, isPublic, maxSize, onUploadSuccess, onUploadError]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e.target.files);
      // Сбрасываем input, чтобы можно было загрузить тот же файл снова
      e.target.value = '';
    },
    [handleFileSelect]
  );

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <input
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleFileInputChange}
          disabled={uploading}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer block"
        >
          {uploading ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Загрузка... {progress}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-4xl">📎</div>
              <div className="text-sm font-medium text-gray-700">
                Перетащите файлы сюда или нажмите для выбора
              </div>
              <div className="text-xs text-gray-500">
                Максимальный размер: {(maxSize / 1024 / 1024).toFixed(0)}MB
              </div>
            </div>
          )}
        </label>
      </div>
    </div>
  );
}
