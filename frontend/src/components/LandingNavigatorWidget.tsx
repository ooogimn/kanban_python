import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { marketingApi } from '../api/marketing';

const QUICK_LINKS = [
  { label: 'Учебная панель', path: '/landing', hash: 'training-panel' },
  { label: 'Тарифы', path: '/landing', hash: 'pricing' },
  { label: 'Услуги', path: '/landing', hash: 'reviews' },
  { label: 'Отзывы', path: '/landing', hash: 'products-network' },
  { label: 'Порталы', path: '/landing', hash: 'blog-preview' },
  { label: 'FAQ', path: '/landing', hash: 'faq' },
  { label: 'Регистрация', path: '/register' },
];

export default function LandingNavigatorWidget() {
  const [open, setOpen] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', contact: '', message: '' });
  const [reviewForm, setReviewForm] = useState({
    review_type: 'private' as 'private' | 'company',
    author: '',
    company: '',
    text: '',
    avatar_or_logo: '',
  });
  const location = useLocation();
  const navigate = useNavigate();

  const leadMutation = useMutation({
    mutationFn: () => marketingApi.submitLead({ ...leadForm, source: 'landing_widget' }),
    onSuccess: () => {
      toast.success('Заявка отправлена');
      setLeadForm({ name: '', contact: '', message: '' });
      setShowLeadForm(false);
    },
    onError: () => toast.error('Не удалось отправить заявку'),
  });

  const reviewMutation = useMutation({
    mutationFn: () => marketingApi.submitReview(reviewForm),
    onSuccess: () => {
      toast.success('Отзыв отправлен на модерацию');
      setReviewForm({ review_type: 'private', author: '', company: '', text: '', avatar_or_logo: '' });
      setShowReviewForm(false);
    },
    onError: () => toast.error('Не удалось отправить отзыв'),
  });

  const goTo = (path: string, hash?: string) => {
    setOpen(false);
    if (!hash) {
      navigate(path);
      return;
    }
    if (location.pathname !== path) {
      navigate(`${path}#${hash}`);
      // Даем роуту время смонтироваться, затем прокручиваем к секции.
      window.setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      return;
    }
    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[70] w-14 h-14 rounded-full bg-fuchsia-500 text-white shadow-lg hover:bg-fuchsia-400 transition-colors flex items-center justify-center overflow-hidden active:scale-95"
        title="Навигатор по лендингу"
        aria-label="Открыть навигатор лендинга"
      >
        <img src="/CHAT_BOT_AI.png" alt="Навигатор" className="w-full h-full object-cover" />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[70] w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-fuchsia-400/40 bg-slate-900/95 backdrop-blur-md shadow-[0_0_42px_rgba(217,70,239,0.3)] hover:shadow-[0_0_60px_rgba(217,70,239,0.42)] transition-all duration-300 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <div>
              <p className="text-white font-semibold">Навигатор по платформе</p>
              <p className="text-slate-400 text-xs">Быстрые переходы по учебному лендингу</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>
          <div className="p-3 space-y-2 max-h-[70vh] overflow-auto">
            {QUICK_LINKS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => goTo(item.path, item.hash)}
                className="block w-full text-left rounded-lg px-3 py-2 text-sm text-slate-200 border border-white/10 hover:border-fuchsia-300/50 hover:text-white hover:bg-white/5 transition-colors"
              >
                {item.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                setShowLeadForm((v) => !v);
                setShowReviewForm(false);
              }}
              className="block w-full text-left rounded-lg px-3 py-2 text-sm text-slate-100 border border-red-400/40 bg-red-500/15 hover:bg-red-500/25 transition-colors"
            >
              Оставить заявку
            </button>
            {showLeadForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!leadForm.name.trim() || !leadForm.contact.trim()) {
                    toast.error('Введите имя и контакт');
                    return;
                  }
                  leadMutation.mutate();
                }}
                className="rounded-lg border border-red-400/35 bg-slate-800/80 p-3 space-y-2 shadow-[0_0_22px_rgba(239,68,68,0.2)]"
              >
                <input value={leadForm.name} onChange={(e) => setLeadForm((p) => ({ ...p, name: e.target.value }))} className="w-full rounded border border-red-400/45 bg-slate-900 px-2 py-1.5 text-xs text-white transition-all focus:outline-none focus:ring-2 focus:ring-red-400/40 focus:shadow-[0_0_18px_rgba(248,113,113,0.4)]" placeholder="Ваше имя" />
                <input value={leadForm.contact} onChange={(e) => setLeadForm((p) => ({ ...p, contact: e.target.value }))} className="w-full rounded border border-red-400/45 bg-slate-900 px-2 py-1.5 text-xs text-white transition-all focus:outline-none focus:ring-2 focus:ring-red-400/40 focus:shadow-[0_0_18px_rgba(248,113,113,0.4)]" placeholder="Телефон / email / telegram" />
                <textarea value={leadForm.message} onChange={(e) => setLeadForm((p) => ({ ...p, message: e.target.value }))} className="w-full rounded border border-red-400/45 bg-slate-900 px-2 py-1.5 text-xs text-white transition-all focus:outline-none focus:ring-2 focus:ring-red-400/40 focus:shadow-[0_0_18px_rgba(248,113,113,0.4)]" rows={3} placeholder="Коротко о задаче" />
                <button type="submit" disabled={leadMutation.isPending} className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-500 disabled:opacity-50">
                  {leadMutation.isPending ? 'Отправка...' : 'Отправить заявку'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                setShowReviewForm((v) => !v);
                setShowLeadForm(false);
              }}
              className="block w-full text-left rounded-lg px-3 py-2 text-sm text-slate-100 border border-cyan-400/40 bg-cyan-500/15 hover:bg-cyan-500/25 transition-colors"
            >
              Оставить отзыв
            </button>
            {showReviewForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reviewForm.text.trim()) {
                    toast.error('Введите текст отзыва');
                    return;
                  }
                  if (reviewForm.review_type === 'private' && !reviewForm.author.trim()) {
                    toast.error('Введите автора');
                    return;
                  }
                  if (reviewForm.review_type === 'company' && !reviewForm.company.trim()) {
                    toast.error('Введите компанию');
                    return;
                  }
                  reviewMutation.mutate();
                }}
                className="rounded-lg border border-cyan-400/35 bg-slate-800/80 p-3 space-y-2 shadow-[0_0_22px_rgba(34,211,238,0.2)]"
              >
                <select value={reviewForm.review_type} onChange={(e) => setReviewForm((p) => ({ ...p, review_type: e.target.value as 'private' | 'company' }))} className="w-full rounded border border-cyan-400/45 bg-slate-900 px-2 py-1.5 text-xs text-white transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:shadow-[0_0_18px_rgba(34,211,238,0.4)]">
                  <option value="private">Частный отзыв</option>
                  <option value="company">Отзыв компании</option>
                </select>
                {reviewForm.review_type === 'private' ? (
                  <input value={reviewForm.author} onChange={(e) => setReviewForm((p) => ({ ...p, author: e.target.value }))} className="w-full rounded border border-cyan-400/45 bg-slate-900 px-2 py-1.5 text-xs text-white transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:shadow-[0_0_18px_rgba(34,211,238,0.4)]" placeholder="Ваше имя" />
                ) : (
                  <input value={reviewForm.company} onChange={(e) => setReviewForm((p) => ({ ...p, company: e.target.value }))} className="w-full rounded border border-cyan-400/45 bg-slate-900 px-2 py-1.5 text-xs text-white transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:shadow-[0_0_18px_rgba(34,211,238,0.4)]" placeholder="Название компании" />
                )}
                <input value={reviewForm.avatar_or_logo} onChange={(e) => setReviewForm((p) => ({ ...p, avatar_or_logo: e.target.value }))} className="w-full rounded border border-cyan-400/45 bg-slate-900 px-2 py-1.5 text-xs text-white transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:shadow-[0_0_18px_rgba(34,211,238,0.4)]" placeholder="URL фото/лого (необязательно)" />
                <textarea value={reviewForm.text} onChange={(e) => setReviewForm((p) => ({ ...p, text: e.target.value }))} className="w-full rounded border border-cyan-400/45 bg-slate-900 px-2 py-1.5 text-xs text-white transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:shadow-[0_0_18px_rgba(34,211,238,0.4)]" rows={3} placeholder="Ваш отзыв" />
                <button type="submit" disabled={reviewMutation.isPending} className="px-3 py-1.5 rounded bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500 disabled:opacity-50">
                  {reviewMutation.isPending ? 'Отправка...' : 'Отправить на модерацию'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
