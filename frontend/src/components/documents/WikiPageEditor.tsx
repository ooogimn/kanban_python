import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ReactQuill, { Quill } from 'react-quill';
import { Maximize2, Minimize2 } from 'lucide-react';
import 'react-quill/dist/quill.snow.css';
import QuillResizeImage from 'quill-resize-image';
import './quillVideoAudio'; // регистрация видео/аудио блоков
import { documentsApi } from '../../api/documents';
import { WikiPage } from '../../types';
import { useNetworkStatus } from '../NetworkStatus';
import toast from 'react-hot-toast';

Quill.register('modules/resize', QuillResizeImage);

interface WikiPageEditorProps {
  /** Не задан для личных записок (/documents). */
  projectId?: number;
  page?: WikiPage;
  rootPage?: WikiPage;
  parentId?: number;
  onSave?: (page: WikiPage) => void;
  onCancel?: () => void;
}

const toolbarOptions = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  ['code', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link', 'image'],
  ['video', 'audio'],
  ['clean'],
];

const formats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'code', 'code-block',
  'list', 'bullet', 'link', 'image', 'video', 'audio',
];

export default function WikiPageEditor({
  projectId,
  page,
  rootPage,
  parentId,
  onSave,
  onCancel,
}: WikiPageEditorProps) {
  const queryClient = useQueryClient();
  const isOffline = useNetworkStatus();
  const quillRef = useRef<ReactQuill>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState(page?.title || '');
  const [content, setContent] = useState(page?.content || '');
  const [isPublished, setIsPublished] = useState(page?.is_published ?? true);
  const [order, setOrder] = useState(page?.order || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const treeQueryKey = projectId != null ? ['wiki-tree', projectId] : ['wiki-tree', 'personal'];
  const listQueryKey = projectId != null ? ['wiki-pages', projectId] : ['wiki-pages', 'personal'];

  const createMutation = useMutation({
    mutationFn: (data: Partial<WikiPage>) =>
      documentsApi.createWikiPage(data),
    onSuccess: (newPage) => {
      queryClient.invalidateQueries({ queryKey: listQueryKey });
      queryClient.invalidateQueries({ queryKey: treeQueryKey });
      toast.success('Страница создана');
      onSave?.(newPage);
    },
    onError: () => {
      toast.error('Ошибка при создании страницы');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WikiPage> }) =>
      documentsApi.updateWikiPage(id, data),
    onSuccess: (updatedPage) => {
      queryClient.invalidateQueries({ queryKey: listQueryKey });
      queryClient.invalidateQueries({ queryKey: treeQueryKey });
      toast.success('Страница обновлена');
      onSave?.(updatedPage);
    },
    onError: () => {
      toast.error('Ошибка при обновлении страницы');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Введите заголовок');
      return;
    }
    // Берём контент из DOM редактора, чтобы сохранить размеры изображений (quill-resize-image)
    const editor = quillRef.current?.getEditor?.();
    const contentToSave = editor?.root?.innerHTML != null ? editor.root.innerHTML : content;

    const data: Partial<WikiPage> = {
      title: title.trim(),
      content: contentToSave.trim(),
      is_published: isPublished,
      order,
    };
    if (projectId != null) data.project = projectId;

    if (parentId) {
      data.parent = parentId;
    }

    if (page) {
      updateMutation.mutate({ id: page.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const getFileUrl = useCallback(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    return apiUrl.replace(/\/api\/v1\/?$/, '');
  }, []);

  const onImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) {
        toast.error('Выберите файл изображения');
        return;
      }
      e.target.value = '';
      try {
        const workitemId = page?.workitem ?? rootPage?.workitem;
        const projectIdVal = projectId ?? page?.project ?? rootPage?.project;
        const entityId = workitemId ?? projectIdVal ?? 0;
        if (!entityId) {
          toast.error('Привяжите запись к проекту или задаче для загрузки изображений');
          return;
        }
        const entityType = workitemId != null ? 'workitem' : 'project';
        const attachment = await documentsApi.uploadFile(
          entityType,
          entityId,
          file,
          false
        );
        const baseOrigin = getFileUrl();
        const url = attachment.file_url || `${baseOrigin}/api/v1/documents/attachments/${attachment.id}/preview/`;
        const quill = quillRef.current?.getEditor();
        const range = quill?.getSelection(true);
        if (quill && range) {
          quill.insertEmbed(range.index, 'image', url);
          quill.setSelection(range.index + 1, 0);
        }
        toast.success('Изображение добавлено');
      } catch (err: unknown) {
        let msg = 'Ошибка загрузки изображения';
        if (err && typeof err === 'object' && 'response' in err) {
          const data = (err as { response?: { data?: unknown } }).response?.data;
          if (data && typeof data === 'object') {
            const d = data as Record<string, unknown>;
            if (typeof d.detail === 'string') msg = d.detail;
            else if (Array.isArray(d.file) && d.file[0]) msg = String(d.file[0]);
          }
        }
        toast.error(msg);
      }
    },
    [projectId, page?.workitem, page?.project, rootPage?.workitem, rootPage?.project, getFileUrl]
  );

  const onVideoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('video/')) {
        toast.error('Выберите файл видео');
        return;
      }
      e.target.value = '';
      const workitemId = page?.workitem ?? rootPage?.workitem;
      const projectIdVal = projectId ?? page?.project ?? rootPage?.project;
      const entityId = workitemId ?? projectIdVal ?? 0;
      if (!entityId) {
        toast.error('Привяжите запись к проекту или задаче для загрузки видео');
        return;
      }
      const entityType = workitemId != null ? 'workitem' : 'project';
      try {
        const attachment = await documentsApi.uploadFile(
          entityType,
          entityId,
          file,
          false
        );
        const baseOrigin = getFileUrl();
        const url = attachment.file_url || `${baseOrigin}/api/v1/documents/attachments/${attachment.id}/preview/`;
        const quill = quillRef.current?.getEditor();
        const range = quill?.getSelection(true);
        if (quill && range) {
          quill.insertEmbed(range.index, 'video', url);
          quill.setSelection(range.index + 1, 0);
        }
        toast.success('Видео добавлено');
      } catch (err: unknown) {
        toast.error('Ошибка загрузки видео');
      }
    },
    [projectId, page?.workitem, page?.project, rootPage?.workitem, rootPage?.project, getFileUrl]
  );

  const onAudioChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('audio/')) {
        toast.error('Выберите файл аудио');
        return;
      }
      e.target.value = '';
      const workitemId = page?.workitem ?? rootPage?.workitem;
      const projectIdVal = projectId ?? page?.project ?? rootPage?.project;
      const entityId = workitemId ?? projectIdVal ?? 0;
      if (!entityId) {
        toast.error('Привяжите запись к проекту или задаче для загрузки аудио');
        return;
      }
      const entityType = workitemId != null ? 'workitem' : 'project';
      try {
        const attachment = await documentsApi.uploadFile(
          entityType,
          entityId,
          file,
          false
        );
        const baseOrigin = getFileUrl();
        const url = attachment.file_url || `${baseOrigin}/api/v1/documents/attachments/${attachment.id}/preview/`;
        const quill = quillRef.current?.getEditor();
        const range = quill?.getSelection(true);
        if (quill && range) {
          quill.insertEmbed(range.index, 'audio', url);
          quill.setSelection(range.index + 1, 0);
        }
        toast.success('Аудио добавлено');
      } catch (err: unknown) {
        toast.error('Ошибка загрузки аудио');
      }
    },
    [projectId, page?.workitem, page?.project, rootPage?.workitem, rootPage?.project, getFileUrl]
  );

  const modules = useMemo(
    () => ({
      toolbar: {
        container: toolbarOptions,
        handlers: {
          image: () => { },
          video: () => { },
          audio: () => { },
        },
      },
      resize: {
        locale: {},
      },
    }),
    []
  );

  const toggleFullscreen = useCallback(() => {
    if (!fullscreenRef.current) return;
    if (!document.fullscreenElement) {
      fullscreenRef.current.requestFullscreen().catch(() => {
        toast.error('Полноэкранный режим недоступен');
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Обработчики панели подключаем после монтирования редактора (повторяем, пока редактор не готов)
  useEffect(() => {
    let mounted = true;
    const tryAttach = () => {
      if (!mounted) return;
      const editor = quillRef.current?.getEditor?.();
      if (!editor) return false;
      const toolbar = editor.getModule?.('toolbar');
      if (!toolbar || !toolbar.handlers) return false;

      toolbar.addHandler('image', () => {
        fileInputRef.current?.click();
      });
      toolbar.addHandler('video', () => {
        const range = editor.getSelection(true);
        if (!range) return;
        const url = window.prompt(
          'Введите ссылку на видео (YouTube, Vimeo или URL). Оставьте пустым — откроется выбор файла с компьютера.'
        );
        if (url === null) return;
        if (url.trim()) {
          editor.insertEmbed(range.index, 'video', url.trim());
          editor.setSelection(range.index + 1, 0);
        } else {
          videoInputRef.current?.click();
        }
      });
      toolbar.addHandler('audio', () => {
        const range = editor.getSelection(true);
        if (!range) return;
        const url = window.prompt(
          'Введите ссылку на аудио. Оставьте пустым — откроется выбор файла с компьютера.'
        );
        if (url === null) return;
        if (url.trim()) {
          editor.insertEmbed(range.index, 'audio', url.trim());
          editor.setSelection(range.index + 1, 0);
        } else {
          audioInputRef.current?.click();
        }
      });
      return true;
    };

    const id = setInterval(() => {
      if (tryAttach()) clearInterval(id);
    }, 200);
    const stop = setTimeout(() => clearInterval(id), 3000);
    return () => {
      mounted = false;
      clearInterval(id);
      clearTimeout(stop);
    };
  }, []);

  return (
    <div
      ref={fullscreenRef}
      className="relative bg-white dark:bg-slate-900 rounded-lg"
      style={isFullscreen ? { minHeight: '100vh', padding: '1rem' } : undefined}
    >
      <div className="absolute top-0 right-0 z-10 flex gap-1 p-1">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-imperial-gold rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
          title={isFullscreen ? 'Выйти с полного экрана (обратно)' : 'На всю страницу'}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
          Заголовок *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder:text-gray-500 dark:placeholder:text-slate-400"
          placeholder="Введите заголовок страницы"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
          Содержание
        </label>
        <div className="wiki-editor-wrapper rounded-lg border border-gray-300 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-800">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            placeholder="Текст, изображения, видео и аудио..."
            className="wiki-quill-editor"
            style={{ minHeight: 280 }}
          />
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          Панель: заголовки, форматирование, цвет текста и фона, код и блок кода, список, ссылка, изображение, видео, аудио. Ниже — загрузка с компьютера.
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onImageChange}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={onVideoChange}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={onAudioChange}
          />
          <button type="button" onClick={handleImageUpload} className="text-sm text-primary-600 hover:text-primary-700 dark:text-imperial-gold dark:hover:text-amber-400">
            Загрузить изображение с компьютера
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-imperial-gold dark:hover:text-amber-400"
          >
            Загрузить видео с компьютера
          </button>
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-imperial-gold dark:hover:text-amber-400"
          >
            Загрузить аудио с компьютера
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700 dark:text-slate-200">Опубликовано</span>
        </label>

        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700 dark:text-slate-200">Порядок:</label>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="w-20 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            min="0"
          />
        </div>
      </div>

      <div className="flex justify-start space-x-2 pt-4 border-t border-gray-200 dark:border-slate-600">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 text-xs text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 rounded hover:bg-gray-200 dark:hover:bg-slate-600"
          >
            Отмена
          </button>
        )}
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending || isOffline}
          className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending || updateMutation.isPending
            ? 'Сохранение...'
            : page
              ? 'Сохранить'
              : 'Создать'}
        </button>
      </div>
    </form>
    </div>
  );
}
