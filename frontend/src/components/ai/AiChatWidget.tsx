import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '../../api/workspace';
import { aiApi, type WorkspaceAgentDto, type ChatMessageDto } from '../../api/ai';

const ROLE_USER = 'user';

export default function AiChatWidget() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedWorkspaceAgent, setSelectedWorkspaceAgent] = useState<WorkspaceAgentDto | null>(null);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: currentWorkspace } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const workspaceId = currentWorkspace?.id ?? 0;

  const { data: hired = [] } = useQuery({
    queryKey: ['ai-workspace-agents', workspaceId],
    queryFn: () => aiApi.getWorkspaceAgents(workspaceId),
    enabled: workspaceId > 0 && open,
  });
  const hiredList = hired as WorkspaceAgentDto[];

  const workspaceAgentId = selectedWorkspaceAgent?.id ?? 0;
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['ai-chat-messages', workspaceAgentId],
    queryFn: () => aiApi.getMessages(workspaceAgentId),
    enabled: workspaceAgentId > 0,
  });
  const messageList = messages as ChatMessageDto[];

  const chatMutation = useMutation({
    mutationFn: (text: string) => aiApi.chat(workspaceAgentId, text),
    onSuccess: () => {
      refetchMessages();
      setInputValue('');
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageList.length]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || chatMutation.isPending || workspaceAgentId <= 0) return;
    chatMutation.mutate(text);
  };

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-imperial-gold text-imperial-bg shadow-lg hover:bg-amber-500 transition-colors flex items-center justify-center overflow-hidden active:scale-95"
        title="Чат с ИИ-агентами"
        aria-label="Открыть чат с ИИ"
      >
        <img
          src="/CHAT_BOT_AI.png"
          alt="Чат-бот"
          className="w-full h-full object-cover"
          aria-hidden
        />
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[60] w-[400px] max-w-[calc(100vw-3rem)] max-h-[560px] rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-imperial-surface shadow-2xl flex flex-col overflow-hidden"
          aria-label="Панель чата с ИИ"
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-imperial-bg/50">
            <span className="font-semibold text-slate-900 dark:text-white">Чат с ИИ</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          {workspaceId <= 0 ? (
            <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
              Выберите рабочее пространство, чтобы видеть нанятых агентов.
            </div>
          ) : hiredList.length === 0 ? (
            <div className="p-4 flex flex-col gap-3 text-sm">
              <p className="text-slate-600 dark:text-slate-300">Нет нанятых агентов.</p>
              <Link
                to="/ai/marketplace"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 transition-colors"
              >
                Перейти в Маркетплейс
              </Link>
            </div>
          ) : (
            <>
              {/* Agent selector */}
              <div className="p-2 border-b border-slate-100 dark:border-white/5">
                <label className="sr-only" htmlFor="ai-agent-select">
                  Выберите агента
                </label>
                <select
                  id="ai-agent-select"
                  value={selectedWorkspaceAgent?.id ?? ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const wa = hiredList.find((w) => w.id === id) ?? null;
                    setSelectedWorkspaceAgent(wa);
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-imperial-bg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-imperial-gold"
                >
                  <option value="">— Выберите агента —</option>
                  {hiredList.map((wa) => (
                    <option key={wa.id} value={wa.id}>
                      {wa.agent.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[320px]">
                {!selectedWorkspaceAgent && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Выберите агента выше.</p>
                )}
                {selectedWorkspaceAgent && messageList.length === 0 && !chatMutation.isPending && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Напишите сообщение, чтобы начать.</p>
                )}
                {messageList.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === ROLE_USER ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === ROLE_USER
                          ? 'bg-imperial-gold text-imperial-bg'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200'
                        }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.role === ROLE_USER ? 'text-imperial-bg/80' : 'text-slate-500 dark:text-slate-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-4 py-2 bg-slate-100 dark:bg-white/10 text-slate-500 text-sm">
                      …
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {selectedWorkspaceAgent && (
                <div className="p-3 border-t border-slate-200 dark:border-white/10 flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Сообщение…"
                    className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-imperial-bg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-imperial-gold"
                    disabled={chatMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!inputValue.trim() || chatMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors"
                  >
                    Отправить
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
