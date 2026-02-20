import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Attachment } from '../../types';
import { documentsApi } from '../../api/documents';
import CommentThread from './CommentThread';
import toast from 'react-hot-toast';

interface FilePreviewProps {
  file: Attachment;
  onClose: () => void;
}

export default function FilePreview({ file, onClose }: FilePreviewProps) {
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'inline' | 'google' | 'download'>('inline');
  /** Blob URL для медиа (изображение, видео, аудио, PDF) — загружаем через API с Bearer, чтобы просмотр работал всегда */
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);

  const mime = file.mime_type || '';
  const isImageByMime = mime.startsWith('image/');
  const isVideoByMime = mime.startsWith('video/');
  const isAudioByMime = mime.startsWith('audio/');
  const isPdfByMime = mime === 'application/pdf';
  const isImage = file.file_type === 'image' || isImageByMime;
  const isVideo = file.file_type === 'video' || isVideoByMime;
  const isAudio = file.file_type === 'audio' || isAudioByMime;
  const isPdf = isPdfByMime;
  const isViewableMedia = isImage || isVideo || isAudio || isPdf;

  const { data: comments } = useQuery({
    queryKey: ['comments', 'attachment', file.id],
    queryFn: () => documentsApi.getComments('attachment', file.id),
    enabled: file.id > 0,
  });
  const commentsCount = Array.isArray(comments) ? comments.length : 0;

  useEffect(() => {
    if (file.google_preview_url) {
      setPreviewUrl(file.google_preview_url);
      setPreviewType('google');
      setMediaBlobUrl(null);
      setMediaLoading(false);
      return;
    }
    if (isViewableMedia) {
      setPreviewUrl(null);
      setPreviewType('inline');
      setMediaBlobUrl(null);
      setMediaLoading(true);
      documentsApi
        .downloadFile(file.id)
        .then((blob) => {
          setMediaBlobUrl(URL.createObjectURL(blob));
        })
        .catch(() => setPreviewType('download'))
        .finally(() => setMediaLoading(false));
      return;
    }
    if (file.preview_url) {
      setPreviewUrl(file.preview_url);
      setPreviewType('inline');
      setMediaBlobUrl(null);
    } else {
      setPreviewType('download');
      setMediaBlobUrl(null);
    }
    setMediaLoading(false);
  }, [file]);

  useEffect(() => {
    return () => {
      if (mediaBlobUrl) URL.revokeObjectURL(mediaBlobUrl);
    };
  }, [file.id, mediaBlobUrl]);

  const downloadFile = async () => {
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
      toast.success('Файл скачан');
    } catch (error) {
      toast.error('Ошибка при скачивании файла');
    }
  };

  const renderPreview = () => {
    if (previewType === 'google' && previewUrl) {
      return (
        <iframe
          src={previewUrl}
          className="w-full h-full border-0"
          title={file.filename}
        />
      );
    }

    if (mediaLoading && isViewableMedia) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
          Загрузка…
        </div>
      );
    }

    if (previewType === 'inline' && mediaBlobUrl) {
      if (isImage) {
        return (
          <img
            src={mediaBlobUrl}
            alt={file.filename}
            className="max-w-full max-h-full object-contain mx-auto"
          />
        );
      }
      if (isVideo) {
        return (
          <video
            src={mediaBlobUrl}
            controls
            className="max-w-full max-h-full mx-auto"
          />
        );
      }
      if (isAudio) {
        return (
          <audio
            src={mediaBlobUrl}
            controls
            className="w-full"
          />
        );
      }
      if (isPdf) {
        return (
          <iframe
            src={mediaBlobUrl}
            className="w-full h-full min-h-[70vh] border-0"
            title={file.filename}
          />
        );
      }
    }

    if (previewType === 'inline' && previewUrl && !mediaBlobUrl) {
      if (isImage) {
        return (
          <img
            src={previewUrl}
            alt={file.filename}
            className="max-w-full max-h-full object-contain mx-auto"
          />
        );
      }
      if (isVideo) {
        return (
          <video src={previewUrl} controls className="max-w-full max-h-full mx-auto" />
        );
      }
      if (isAudio) {
        return (
          <audio src={previewUrl} controls className="w-full" />
        );
      }
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-6xl mb-4">📄</div>
        <div className="text-lg font-medium text-gray-900 mb-2">{file.filename}</div>
        <div className="text-sm text-gray-500 mb-4">
          Просмотр в браузере недоступен. Скачайте файл кнопкой «⬇️ Скачать» выше.
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900 truncate max-w-md">
              {file.filename}
            </h2>
            <span className="text-xs text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={downloadFile}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
              title="Скачать"
            >
              ⬇️ Скачать
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Просмотр файла */}
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <div className="min-h-[200px] flex items-center justify-center bg-gray-50 rounded-lg">
            {renderPreview()}
          </div>
        </div>

        {/* Комментарии — сворачиваемый блок */}
        <div className="border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => setCommentsExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span>
              {commentsExpanded ? '▼' : '▶'} Комментарии
              {commentsCount > 0 && (
                <span className="ml-2 text-gray-500 font-normal">
                  ({commentsCount})
                </span>
              )}
            </span>
          </button>
          {commentsExpanded && (
            <div className="px-4 pb-4 pt-0 max-h-[40vh] overflow-y-auto">
              <CommentThread
                entityType="attachment"
                entityId={file.id}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
