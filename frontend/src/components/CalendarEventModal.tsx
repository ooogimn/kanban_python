import { useState, useEffect } from 'react';
import { CalendarEvent } from '../types';
import { useNetworkStatus } from './NetworkStatus';

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  defaultStart?: Date;
  defaultEnd?: Date;
  onSave: (data: Partial<CalendarEvent> & { title: string; start_date: string; end_date: string }) => void;
  onDelete?: (id: number) => void;
  isSubmitting: boolean;
}

export default function CalendarEventModal({
  isOpen,
  onClose,
  event,
  defaultStart,
  defaultEnd,
  onSave,
  onDelete,
  isSubmitting,
}: CalendarEventModalProps) {
  const isOffline = useNetworkStatus();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      const s = new Date(event.start_date);
      const e = new Date(event.end_date);
      setStartDate(s.toISOString().slice(0, 10));
      setStartTime(s.toTimeString().slice(0, 5));
      setEndDate(e.toISOString().slice(0, 10));
      setEndTime(e.toTimeString().slice(0, 5));
      setAllDay(event.all_day);
    } else if (defaultStart && defaultEnd) {
      setStartDate(defaultStart.toISOString().slice(0, 10));
      setStartTime(defaultStart.toTimeString().slice(0, 5));
      setEndDate(defaultEnd.toISOString().slice(0, 10));
      setEndTime(defaultEnd.toTimeString().slice(0, 5));
      setTitle('');
      setDescription('');
      setAllDay(false);
    }
  }, [event, defaultStart, defaultEnd]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const start = allDay
      ? `${startDate}T00:00:00`
      : `${startDate}T${startTime}:00`;
    const end = allDay
      ? `${endDate}T23:59:59`
      : `${endDate}T${endTime}:00`;
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      start_date: start,
      end_date: end,
      all_day: allDay,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">
            {event ? 'Редактировать событие' : 'Новое событие'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Название *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl text-slate-900 bg-white"
              placeholder="Событие"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl text-slate-900 bg-white"
              placeholder="Описание"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="allDay" className="text-sm text-slate-700">Весь день</label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Начало</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-white"
                />
                {!allDay && (
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-white"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Окончание</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-white"
                />
                {!allDay && (
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-white"
                  />
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-between gap-3 pt-4">
            <div>
              {event && onDelete && (
                <button
                  type="button"
                  onClick={() => event.id && onDelete(event.id)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl"
                >
                  Удалить
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || isOffline}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
