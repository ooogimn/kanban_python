import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { marketingApi } from '../api/marketing';
import { authApi } from '../api/auth';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';

type Mode = 'menu' | 'review' | 'support' | 'login' | 'register' | 'pay';
type ChatRole = 'user' | 'bot';
type ChatMessage = { id: string; role: ChatRole; text: string };
const CHAT_SESSION_KEY = 'landing_ai_chat_session_id';

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 outline-none"
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 outline-none"
    />
  );
}

export default function LandingAiAssistantWidget() {
  const navigate = useNavigate();
  const { user, setUser, login } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('menu');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>(() => localStorage.getItem(CHAT_SESSION_KEY) || '');
  const [reviewType, setReviewType] = useState<'private' | 'company'>('private');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [reviewForm, setReviewForm] = useState({
    author: '',
    company: '',
    text: '',
    avatar_or_logo: '',
  });
  const [supportForm, setSupportForm] = useState({
    name: user?.username || '',
    contact: '',
    message: '',
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    telegram_contact: '',
  });
  const { data: historyMessages = [] } = useQuery({
    queryKey: ['landing-widget', 'chat-history', sessionId],
    queryFn: () => marketingApi.getChatHistory(sessionId),
    enabled: open && Boolean(sessionId),
    staleTime: 5000,
  });

  const canPay = useMemo(() => Boolean(user), [user]);
  const pushMessage = (role: ChatRole, text: string) => {
    setChatMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, text },
    ]);
  };

  useEffect(() => {
    if (!open) return;
    if (!sessionId) {
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setSessionId(id);
      localStorage.setItem(CHAT_SESSION_KEY, id);
    }
    setChatMessages((prev) =>
      prev.length
        ? prev
        : [
            {
              id: 'welcome-msg',
              role: 'bot',
              text: 'Привет! Я AI-ассистент лендинга. Могу ответить по дежурным фразам и сразу открыть нужную форму: отзыв, поддержка, вход, регистрация или оплата.',
            },
          ],
    );
  }, [open, sessionId]);

  useEffect(() => {
    if (!open || !historyMessages.length) return;
    setChatMessages(
      historyMessages.map((msg) => ({
        id: msg.id,
        role: msg.role === 'assistant' ? 'bot' : 'user',
        text: msg.message,
      })),
    );
  }, [open, historyMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const detectMode = (text: string): Mode | null => {
    const t = text.toLowerCase();
    if (t.includes('отзыв')) return 'review';
    if (t.includes('поддерж') || t.includes('помощ')) return 'support';
    if (t.includes('вход') || t.includes('логин')) return 'login';
    if (t.includes('регист')) return 'register';
    if (t.includes('оплат') || t.includes('тариф') || t.includes('подписк')) return 'pay';
    return null;
  };

  const handleChatSend = () => {
    const text = chatInput.trim();
    if (!text) return;
    pushMessage('user', text);
    const suggestedMode = detectMode(text);
    if (suggestedMode) setMode(suggestedMode);
    chatMutation.mutate(text);
    setChatInput('');
  };

  const openMode = (nextMode: Mode, prompt: string) => {
    setMode(nextMode);
    pushMessage('bot', prompt);
  };

  const chatMutation = useMutation({
    mutationFn: (text: string) => marketingApi.chat({ message: text, session_id: sessionId || undefined }),
    onSuccess: (data) => {
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
        localStorage.setItem(CHAT_SESSION_KEY, data.session_id);
      }
      pushMessage('bot', data.assistant_message || 'Принял ваш вопрос.');
    },
    onError: () => {
      pushMessage('bot', 'Сервис AI временно недоступен. Попробуйте еще раз.');
    },
  });

  const submitReview = useMutation({
    mutationFn: () =>
      marketingApi.submitReview({
        review_type: reviewType,
        author: reviewType === 'private' ? reviewForm.author.trim() : undefined,
        company: reviewType === 'company' ? reviewForm.company.trim() : undefined,
        text: reviewForm.text.trim(),
        avatar_or_logo: reviewForm.avatar_or_logo.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Отзыв отправлен на модерацию');
      setReviewForm({ author: '', company: '', text: '', avatar_or_logo: '' });
      setMode('menu');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Не удалось отправить отзыв';
      toast.error(msg);
    },
  });

  const submitSupport = useMutation({
    mutationFn: () =>
      marketingApi.submitLead({
        name: supportForm.name.trim(),
        contact: supportForm.contact.trim(),
        message: supportForm.message.trim(),
        source: 'landing_chat_support',
      }),
    onSuccess: () => {
      toast.success('Сообщение в поддержку отправлено');
      setSupportForm((prev) => ({ ...prev, message: '', contact: '' }));
      setMode('menu');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Не удалось отправить сообщение';
      toast.error(msg);
    },
  });

  const loginMutation = useMutation({
    mutationFn: async () => login(loginForm.username.trim(), loginForm.password),
    onSuccess: () => {
      toast.success('Вход выполнен');
      setMode('menu');
      setOpen(false);
      navigate('/dashboard');
    },
    onError: () => toast.error('Ошибка входа. Проверьте логин и пароль'),
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const response = await authApi.register({
        username: registerForm.username.trim(),
        email: registerForm.email.trim(),
        password: registerForm.password,
        telegram_contact: registerForm.telegram_contact.trim(),
      });
      apiClient.setTokens({ access: response.access, refresh: response.refresh });
      setUser(response.user);
    },
    onSuccess: () => {
      toast.success('Регистрация успешна');
      setMode('menu');
      setOpen(false);
      navigate('/dashboard');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Ошибка регистрации';
      toast.error(msg);
    },
  });

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[70] w-16 h-16 rounded-full border-2 border-cyan-300/80 bg-slate-900 shadow-[0_0_28px_rgba(34,211,238,0.55)] hover:shadow-[0_0_42px_rgba(34,211,238,0.75)] flex items-center justify-center overflow-hidden"
        title="AI-помощник"
        aria-label="Открыть AI-помощника"
        animate={{
          y: [0, -6, 0],
          scale: [1, 1.06, 1],
          rotate: [0, 2, -2, 0],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <motion.img
          src="/CHAT_BOT_AI.png"
          alt="AI chat"
          className="w-full h-full object-cover"
          animate={{ rotate: [0, 5, 0, -5, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'linear' }}
        />
      </motion.button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[70] w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-cyan-400/40 bg-slate-950/95 backdrop-blur p-3 shadow-[0_0_36px_rgba(34,211,238,0.35)]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold">AI-помощник AntExpress</h3>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2 h-[240px] overflow-y-auto space-y-2">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[86%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-100 border border-slate-700'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="mt-2 flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
              className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 outline-none"
              placeholder="Напишите вопрос..."
            />
            <button
              type="button"
              onClick={handleChatSend}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white hover:bg-cyan-500"
            >
              Отправить
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => openMode('review', 'Открываю форму отзыва. Заполните поля ниже.')} className="rounded-lg bg-slate-800 text-white px-3 py-2 text-sm hover:bg-slate-700">Отзыв</button>
            <button type="button" onClick={() => openMode('support', 'Открываю форму поддержки. Напишите ваш вопрос.')} className="rounded-lg bg-slate-800 text-white px-3 py-2 text-sm hover:bg-slate-700">Поддержка</button>
            <button type="button" onClick={() => openMode('login', 'Открываю форму входа.')} className="rounded-lg bg-slate-800 text-white px-3 py-2 text-sm hover:bg-slate-700">Вход</button>
            <button type="button" onClick={() => openMode('register', 'Открываю форму регистрации.')} className="rounded-lg bg-slate-800 text-white px-3 py-2 text-sm hover:bg-slate-700">Регистрация</button>
            <button type="button" onClick={() => openMode('pay', canPay ? 'Вы можете перейти к оплате/выбору тарифа.' : 'Для оплаты нужно войти или зарегистрироваться.')} className="col-span-2 rounded-lg bg-red-600 text-white px-3 py-2 text-sm hover:bg-red-500">Оплатить / выбрать тариф</button>
          </div>

          {mode !== 'menu' && (
            <button type="button" onClick={() => setMode('menu')} className="mt-2 text-xs text-cyan-300 hover:text-cyan-200">
              ← Свернуть форму
            </button>
          )}

          {mode === 'review' && (
            <div className="space-y-2 mt-2 rounded-lg border border-slate-700 p-2">
              <div className="flex gap-2 text-sm text-slate-300">
                <label className="inline-flex items-center gap-1">
                  <input type="radio" checked={reviewType === 'private'} onChange={() => setReviewType('private')} />
                  Частный
                </label>
                <label className="inline-flex items-center gap-1">
                  <input type="radio" checked={reviewType === 'company'} onChange={() => setReviewType('company')} />
                  Компания
                </label>
              </div>
              {reviewType === 'private' ? (
                <Input placeholder="Ваше имя" value={reviewForm.author} onChange={(e) => setReviewForm((p) => ({ ...p, author: e.target.value }))} />
              ) : (
                <Input placeholder="Название компании" value={reviewForm.company} onChange={(e) => setReviewForm((p) => ({ ...p, company: e.target.value }))} />
              )}
              <Input placeholder="URL аватара/логотипа (опционально)" value={reviewForm.avatar_or_logo} onChange={(e) => setReviewForm((p) => ({ ...p, avatar_or_logo: e.target.value }))} />
              <Textarea rows={4} placeholder="Ваш отзыв" value={reviewForm.text} onChange={(e) => setReviewForm((p) => ({ ...p, text: e.target.value }))} />
              <button
                type="button"
                onClick={() => submitReview.mutate()}
                disabled={submitReview.isPending}
                className="w-full rounded-lg bg-cyan-600 text-white px-3 py-2 text-sm hover:bg-cyan-500 disabled:opacity-50"
              >
                {submitReview.isPending ? 'Отправка...' : 'Отправить отзыв'}
              </button>
            </div>
          )}

          {mode === 'support' && (
            <div className="space-y-2 mt-2 rounded-lg border border-slate-700 p-2">
              <Input placeholder="Имя" value={supportForm.name} onChange={(e) => setSupportForm((p) => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Контакт: email / телефон / telegram" value={supportForm.contact} onChange={(e) => setSupportForm((p) => ({ ...p, contact: e.target.value }))} />
              <Textarea rows={4} placeholder="Опишите ваш вопрос" value={supportForm.message} onChange={(e) => setSupportForm((p) => ({ ...p, message: e.target.value }))} />
              <button
                type="button"
                onClick={() => submitSupport.mutate()}
                disabled={submitSupport.isPending}
                className="w-full rounded-lg bg-cyan-600 text-white px-3 py-2 text-sm hover:bg-cyan-500 disabled:opacity-50"
              >
                {submitSupport.isPending ? 'Отправка...' : 'Написать в поддержку'}
              </button>
            </div>
          )}

          {mode === 'login' && (
            <div className="space-y-2 mt-2 rounded-lg border border-slate-700 p-2">
              <Input placeholder="Логин" value={loginForm.username} onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))} />
              <Input type="password" placeholder="Пароль" value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} />
              <button
                type="button"
                onClick={() => loginMutation.mutate()}
                disabled={loginMutation.isPending}
                className="w-full rounded-lg bg-cyan-600 text-white px-3 py-2 text-sm hover:bg-cyan-500 disabled:opacity-50"
              >
                {loginMutation.isPending ? 'Вход...' : 'Войти'}
              </button>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-2 mt-2 rounded-lg border border-slate-700 p-2">
              <Input placeholder="Логин" value={registerForm.username} onChange={(e) => setRegisterForm((p) => ({ ...p, username: e.target.value }))} />
              <Input placeholder="Email" value={registerForm.email} onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))} />
              <Input type="password" placeholder="Пароль" value={registerForm.password} onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))} />
              <Input placeholder="Telegram контакт (@username или +7...)" value={registerForm.telegram_contact} onChange={(e) => setRegisterForm((p) => ({ ...p, telegram_contact: e.target.value }))} />
              <button
                type="button"
                onClick={() => registerMutation.mutate()}
                disabled={registerMutation.isPending}
                className="w-full rounded-lg bg-cyan-600 text-white px-3 py-2 text-sm hover:bg-cyan-500 disabled:opacity-50"
              >
                {registerMutation.isPending ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </div>
          )}

          {mode === 'pay' && (
            <div className="space-y-3 text-sm mt-2 rounded-lg border border-slate-700 p-2">
              {canPay ? (
                <>
                  <p className="text-slate-300">Вы зарегистрированы. Перейдите к выбору тарифа и оплате ЮKassa.</p>
                  <Link
                    to="/account/upgrade"
                    onClick={() => setOpen(false)}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-500"
                  >
                    Оплатить и выбрать тариф
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-slate-300">Для оплаты нужно войти или зарегистрироваться.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setMode('login')} className="rounded-lg bg-slate-800 text-white px-3 py-2 hover:bg-slate-700">Вход</button>
                    <button type="button" onClick={() => setMode('register')} className="rounded-lg bg-slate-800 text-white px-3 py-2 hover:bg-slate-700">Регистрация</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
