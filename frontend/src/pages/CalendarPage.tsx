import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarApi, type CalendarFeedItem } from '../api/calendar';
import { todoApi } from '../api/todo';
import { workspaceApi } from '../api/workspace';
import { CalendarEvent } from '../types';
import type { KanbanItem } from '../types';
import CalendarEventModal from '../components/CalendarEventModal';
import { TaskDetailModal } from './KanbanPage';
import toast from 'react-hot-toast';
import 'moment/locale/ru';

moment.locale('ru');
const localizer = momentLocalizer(moment);

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

interface BigCalendarEvent {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource: CalendarFeedItem | CalendarEvent;
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [slotStart, setSlotStart] = useState<Date | undefined>();
  const [slotEnd, setSlotEnd] = useState<Date | undefined>();
  const [selectedTaskItem, setSelectedTaskItem] = useState<KanbanItem | null>(null);
  const [selectedTaskProjectId, setSelectedTaskProjectId] = useState<number>(0);
  const [taskDetailTab, setTaskDetailTab] = useState<'details' | 'subtasks' | 'files' | 'wiki' | 'comments'>('details');
  const projectFromUrl = searchParams.get('project');
  const [projectFilter, setProjectFilter] = useState<number | ''>(() => {
    if (!projectFromUrl) return '';
    const n = parseInt(projectFromUrl, 10);
    return Number.isNaN(n) ? '' : n;
  });

  // Синхронизация фильтра с URL (можно делиться ссылкой с применённым фильтром)
  useEffect(() => {
    const urlProject = searchParams.get('project');
    const next = urlProject ? parseInt(urlProject, 10) : '';
    const nextVal = Number.isNaN(next) ? '' : next;
    if (nextVal !== projectFilter) {
      setProjectFilter(nextVal);
    }
  }, [searchParams]);

  const setProjectFilterAndUrl = (value: number | '') => {
    setProjectFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value === '') {
      next.delete('project');
    } else {
      next.set('project', String(value));
    }
    setSearchParams(next, { replace: true });
  };

  const startStr = moment(currentDate).startOf('month').format('YYYY-MM-DD');
  const endStr = moment(currentDate).endOf('month').format('YYYY-MM-DD');

  const { data: currentWorkspace } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => todoApi.getProjects(),
  });

  const { data: feedItems, isLoading } = useQuery({
    queryKey: ['calendar-feed', startStr, endStr, projectFilter],
    queryFn: () => calendarApi.getFeed(startStr, endStr, { projectId: projectFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<CalendarEvent> & { title: string; start_date: string; end_date: string }) =>
      calendarApi.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-feed'] });
      toast.success('Событие создано');
      setModalOpen(false);
    },
    onError: () => toast.error('Ошибка при создании события'),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<CalendarEvent> & { title: string; start_date: string; end_date: string };
    }) => calendarApi.updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-feed'] });
      toast.success('Событие обновлено');
      setModalOpen(false);
    },
    onError: () => toast.error('Ошибка при обновлении события'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => calendarApi.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-feed'] });
      toast.success('Событие удалено');
      setModalOpen(false);
    },
    onError: () => toast.error('Ошибка при удалении события'),
  });

  const updateTaskDateMutation = useMutation({
    mutationFn: ({ workitemId, due_date }: { workitemId: number; due_date: string }) =>
      todoApi.updateTask(workitemId, { due_date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-feed'] });
      toast.success('Дата задачи обновлена');
    },
    onError: () => toast.error('Ошибка при обновлении даты задачи'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (workitemId: number) => todoApi.deleteTask(workitemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-feed'] });
      setSelectedTaskItem(null);
      toast.success('Задача удалена');
    },
    onError: () => toast.error('Ошибка при удалении задачи'),
  });

  const feedList = feedItems ?? [];
  const calendarEvents: BigCalendarEvent[] = feedList.map((item) => ({
    id: item.id,
    title: item.title,
    start: new Date(item.start),
    end: new Date(item.end),
    allDay: item.allDay,
    resource: item,
  }));

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    setSelectedEvent(null);
    setSlotStart(start);
    setSlotEnd(end);
    setModalOpen(true);
  };

  const handleSelectEvent = (ev: BigCalendarEvent) => {
    const res = ev.resource as CalendarFeedItem & CalendarEvent;
    if (res?.is_task && res?.workitem_id) {
      todoApi
        .getTask(res.workitem_id)
        .then((task) => {
          setSelectedTaskItem({ id: task.id, title: task.title, sort_order: 0 });
          setSelectedTaskProjectId(task.project);
        })
        .catch(() => toast.error('Не удалось загрузить задачу'));
      return;
    }
    if (res?.event_id != null) {
      calendarApi.getEvent(res.event_id).then((event) => {
        setSelectedEvent(event);
        setSlotStart(undefined);
        setSlotEnd(undefined);
        setModalOpen(true);
      }).catch(() => toast.error('Не удалось загрузить событие'));
      return;
    }
    setSelectedEvent(ev.resource as CalendarEvent);
    setSlotStart(undefined);
    setSlotEnd(undefined);
    setModalOpen(true);
  };

  const handleEventDrop = ({ event, start }: { event: BigCalendarEvent; start: Date }) => {
    const res = event.resource as CalendarFeedItem;
    if (res?.is_task && res?.workitem_id) {
      updateTaskDateMutation.mutate({
        workitemId: res.workitem_id,
        due_date: moment(start).format('YYYY-MM-DD'),
      });
      return;
    }
    if (res?.event_id != null) {
      updateMutation.mutate({
        id: res.event_id,
        data: {
          title: event.title,
          start_date: moment(start).toISOString(),
          end_date: moment(event.end).toISOString(),
        },
      });
    }
  };

  const eventStyleGetter = (event: BigCalendarEvent) => {
    const res = event.resource as CalendarFeedItem;
    const color = res?.color;
    if (color) {
      return { style: { backgroundColor: color, borderLeftWidth: 4, borderLeftColor: color } };
    }
    return {};
  };

  const handleSave = (data: Partial<CalendarEvent> & { title: string; start_date: string; end_date: string }) => {
    if (selectedEvent?.id) {
      updateMutation.mutate({ id: selectedEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Удалить событие?')) deleteMutation.mutate(id);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-500 dark:text-slate-400">
        Загрузка календаря…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Календарь</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">События и расписание. Клик по ячейке — создать, по событию — редактировать.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Проект:</label>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilterAndUrl(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm w-full sm:w-48 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Все события</option>
            {projects?.results?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 min-h-[640px]">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          view={view}
          onView={setView}
          date={currentDate}
          onNavigate={setCurrentDate}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          eventPropGetter={eventStyleGetter}
          selectable
          resizable={false}
          draggableAccessor={() => true}
          messages={{
            next: 'Следующий',
            previous: 'Предыдущий',
            today: 'Сегодня',
            month: 'Месяц',
            week: 'Неделя',
            day: 'День',
            agenda: 'Повестка',
            date: 'Дата',
            time: 'Время',
            event: 'Событие',
            noEventsInRange: 'Нет событий в этом диапазоне',
          }}
        />
      </div>

      <CalendarEventModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        event={selectedEvent}
        defaultStart={slotStart}
        defaultEnd={slotEnd}
        onSave={handleSave}
        onDelete={selectedEvent?.id ? handleDelete : undefined}
        isSubmitting={isSubmitting}
      />

      {selectedTaskItem && selectedTaskProjectId > 0 && (
        <TaskDetailModal
          item={selectedTaskItem}
          projectId={selectedTaskProjectId}
          projects={projects?.results ?? []}
          workspaceId={currentWorkspace?.id}
          onClose={() => { setSelectedTaskItem(null); setSelectedTaskProjectId(0); }}
          activeTab={taskDetailTab}
          onTabChange={setTaskDetailTab}
          onTaskUpdate={(data) => {
            if (!selectedTaskItem) return;
            todoApi
              .updateTask(selectedTaskItem.id, data as Parameters<typeof todoApi.updateTask>[1])
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['calendar-feed'] });
                queryClient.invalidateQueries({ queryKey: ['task', selectedTaskItem.id] });
                setSelectedTaskItem({ ...selectedTaskItem, ...data });
                toast.success('Задача обновлена');
              })
              .catch(() => toast.error('Ошибка при обновлении задачи'));
          }}
          onDeleteTask={() => {
            if (selectedTaskItem && window.confirm('Удалить задачу?')) {
              deleteTaskMutation.mutate(selectedTaskItem.id);
              setSelectedTaskItem(null);
              setSelectedTaskProjectId(0);
            }
          }}
        />
      )}
    </div>
  );
}
