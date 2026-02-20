import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../../api/documents';
import { Comment } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useNetworkStatus } from '../NetworkStatus';
import toast from 'react-hot-toast';

interface CommentThreadProps {
  entityType: 'workitem' | 'attachment' | 'project';
  entityId: number;
}

export default function CommentThread({ entityType, entityId }: CommentThreadProps) {
  const { user } = useAuthStore();
  const isOffline = useNetworkStatus();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => documentsApi.getComments(entityType, entityId),
    enabled: entityId > 0, // Запрос выполняется только если entityId валиден
  });

  const createMutation = useMutation({
    mutationFn: (content: string) =>
      documentsApi.createComment(entityType, entityId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      setNewComment('');
      toast.success('Комментарий добавлен');
    },
    onError: () => {
      toast.error('Ошибка при добавлении комментария');
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId: number }) =>
      documentsApi.createComment(entityType, entityId, content, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      setReplyingTo(null);
      setReplyContent('');
      toast.success('Ответ добавлен');
    },
    onError: () => {
      toast.error('Ошибка при добавлении ответа');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      documentsApi.updateComment(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      setEditingId(null);
      setEditContent('');
      toast.success('Комментарий обновлен');
    },
    onError: () => {
      toast.error('Ошибка при обновлении комментария');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentsApi.deleteComment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      toast.success('Комментарий удален');
    },
    onError: () => {
      toast.error('Ошибка при удалении комментария');
    },
  });

  const createTaskFromCommentMutation = useMutation({
    mutationFn: (commentId: number) => documentsApi.createTaskFromComment(commentId),
    onSuccess: (task) => {
      toast.success('Задача создана');
      if (task.id) {
        navigate(`/tasks?highlight=${task.id}`);
      }
    },
    onError: () => toast.error('Ошибка при создании задачи из комментария'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      createMutation.mutate(newComment.trim());
    }
  };

  const handleReply = (parentId: number) => {
    if (replyContent.trim()) {
      replyMutation.mutate({ content: replyContent.trim(), parentId });
    }
  };

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleUpdate = (id: number) => {
    if (editContent.trim()) {
      updateMutation.mutate({ id, content: editContent.trim() });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Удалить комментарий?')) {
      deleteMutation.mutate(id);
    }
  };

  const renderComment = (comment: Comment, level: number = 0) => {
    const isAuthor = comment.author.id === user?.id;
    const isEditing = editingId === comment.id;

    return (
      <div key={comment.id} className={`${level > 0 ? 'ml-8 mt-2' : ''}`}>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {comment.author.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">
                    {comment.author.username || comment.author.email}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.created_at).toLocaleString('ru-RU')}
                  </span>
                  {comment.is_edited && (
                    <span className="text-xs text-gray-400">(отредактировано)</span>
                  )}
                </div>
                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      rows={3}
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdate(comment.id)}
                        disabled={isOffline}
                        className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditContent('');
                        }}
                        className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-gray-700 whitespace-pre-wrap">{comment.content}</div>
                )}
                {!isEditing && (
                  <div className="mt-2 flex items-center flex-wrap gap-x-4 gap-y-1">
                    <button
                      onClick={() => {
                        setReplyingTo(comment.id);
                        setReplyContent('');
                      }}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      Ответить
                    </button>
                    <button
                      onClick={() => createTaskFromCommentMutation.mutate(comment.id)}
                      disabled={createTaskFromCommentMutation.isPending || isOffline}
                      className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
                      title="Создать задачу из этого комментария"
                    >
                      {createTaskFromCommentMutation.isPending ? '…' : '+ Создать задачу'}
                    </button>
                    {isAuthor && (
                      <>
                        <button
                          onClick={() => handleEdit(comment)}
                          className="text-sm text-gray-600 hover:text-gray-700"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Форма ответа */}
          {replyingTo === comment.id && (
            <div className="mt-4 ml-11 space-y-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Напишите ответ..."
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={2}
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => handleReply(comment.id)}
                  disabled={isOffline}
                  className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                >
                  Отправить
                </button>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Вложенные комментарии (ответы) */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-4 space-y-2">
              {comment.replies.map((reply) => renderComment(reply, level + 1))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500">Загрузка комментариев...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Форма создания комментария */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Напишите комментарий..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          rows={3}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!newComment.trim() || createMutation.isPending || isOffline}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </form>

      {/* Список комментариев */}
      {comments && comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment) => renderComment(comment))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Нет комментариев. Будьте первым!
        </div>
      )}
    </div>
  );
}
