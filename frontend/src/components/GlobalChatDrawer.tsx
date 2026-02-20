/**
 * Глобальная правая панель: на маршруте /projects/:id — чат проекта, иначе — форма обратной связи.
 * Лепесток для открытия/закрытия — справа по центру панели (вкладка на правом краю экрана).
 */
import { useLocation } from 'react-router-dom';
import { CommentThread } from './documents';
import SupportChat from './SupportChat';
import { useRightDrawerStore } from '../store/rightDrawerStore';
import { X, MessageCircle } from 'lucide-react';

const PROJECT_ID_REGEX = /^\/projects\/(\d+)/;

export default function GlobalChatDrawer() {
  const location = useLocation();
  const { open, closeDrawer, toggleDrawer } = useRightDrawerStore();
  const projectMatch = location.pathname.match(PROJECT_ID_REGEX);
  const projectId = projectMatch ? parseInt(projectMatch[1], 10) : null;
  const isProjectChat = projectId != null;

  return (
    <>
      {/* Обёртка: при свёрнутом состоянии не перехватывает клики (pointer-events-none) и уходит на задний план (z-30) */}
      <div
        className={`fixed right-0 top-0 bottom-0 flex flex-row transition-all duration-300 ${
          open ? 'z-50' : 'z-30 pointer-events-none'
        }`}
      >
        {/* Контент панели (уезжает вправо при закрытии) */}
        <div
          className={`w-[252px] max-w-[90vw] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-xl flex flex-col transition-transform duration-300 ease-out shrink-0 ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">
              {isProjectChat ? 'Чат проекта' : 'Поддержка'}
            </h3>
            <button
              type="button"
              onClick={closeDrawer}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Закрыть"
            >
              <X className="w-5 h-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {isProjectChat ? (
              <div className="p-4">
                <CommentThread entityType="project" entityId={projectId} />
              </div>
            ) : (
              <SupportChat />
            )}
          </div>
        </div>

      </div>

      {/* Лепесток: при свёрнутом состоянии поверх контента (z-50), кликабелен */}
      <button
        type="button"
        onClick={toggleDrawer}
        className={`fixed right-0 top-1/2 -translate-y-1/2 h-12 w-6 rounded-l-full flex items-center justify-center cursor-pointer border-l border-y border-slate-700 z-50 pointer-events-auto transition-colors ${
          open
            ? 'bg-imperial-gold/90 text-white hover:bg-imperial-gold'
            : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
        title={open ? 'Свернуть чат' : 'Открыть чат / поддержку'}
        aria-label={open ? 'Свернуть панель чата' : 'Открыть панель чата'}
      >
        <MessageCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
      </button>

      {/* Оверлей на мобильных */}
      {open && (
        <button
          type="button"
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          aria-label="Закрыть панель"
          onClick={closeDrawer}
        />
      )}
    </>
  );
}
