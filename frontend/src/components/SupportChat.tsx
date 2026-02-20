/**
 * Форма обратной связи в правой панели (когда не на странице проекта).
 */
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function SupportChat() {
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Введите сообщение');
      return;
    }
    // Заглушка: в будущем — отправка на API или email
    toast.success('Сообщение отправлено. Мы ответим в ближайшее время.');
    setTopic('');
    setMessage('');
  };

  return (
    <div className="p-4 flex flex-col h-full">
      <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Обратная связь</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Опишите вопрос или предложение — мы ответим на указанную при входе почту.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 flex-1 min-h-0">
        <div>
          <label htmlFor="support-topic" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Тема
          </label>
          <input
            id="support-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Например: тарифы, баг, идея"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
          />
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <label htmlFor="support-message" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Сообщение *
          </label>
          <textarea
            id="support-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ваше сообщение…"
            rows={5}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm resize-none"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-imperial-gold text-white font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Отправить
        </button>
      </form>
    </div>
  );
}
