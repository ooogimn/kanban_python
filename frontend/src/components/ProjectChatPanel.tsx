import { useState } from 'react';
import { CommentThread } from './documents';

interface ProjectChatPanelProps {
  projectId: number;
}

export default function ProjectChatPanel({ projectId }: ProjectChatPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Кнопка-вкладка справа (видна когда панель свёрнута) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-10 h-24 bg-slate-800 text-white rounded-l-xl shadow-lg hover:bg-slate-700 transition-colors"
          title="Открыть чат проекта"
        >
          <span className="text-lg" aria-hidden>💬</span>
        </button>
      )}

      {/* Скрывающийся правый сайдбар — чат проекта */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-[360px] max-w-[90vw] bg-white border-l border-slate-200 shadow-xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-800">Чат проекта</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            title="Свернуть"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <CommentThread entityType="project" entityId={projectId} />
        </div>
      </div>

      {/* Оверлей при открытой панели (на мобильных — закрыть по клику) */}
      {open && (
        <button
          type="button"
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          aria-label="Закрыть панель"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
