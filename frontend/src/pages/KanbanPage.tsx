import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { kanbanApi, BoardFull } from '../api/kanban';
import { todoApi } from '../api/todo';
import { timetrackingApi } from '../api/timetracking';
import { workspaceApi } from '../api/workspace';
import { documentsApi } from '../api/documents';
import { KanbanItem, Column, Project, WorkItem } from '../types';
import { FileList, CommentThread, CreateNoteModal, AttachNoteModal } from '../components/documents';
import TaskForm from '../components/TaskForm';
import { ChecklistBlock } from '../components/todo/Checklist';
import { useKanbanWebSocket } from '../hooks/useWebSocket';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, GripVertical, Lock, Maximize2, Minimize2, LayoutGrid, List } from 'lucide-react';
import { downloadCsv } from '../utils/exportCsv';

/** ID виртуальной колонки «Нераспределённые» (задачи этого спринта без колонки). */
const UNPLACED_COLUMN_ID = -1;

const STATUS_LABELS: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочный',
};

export default function KanbanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  const boardId = searchParams.get('board') || undefined;
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<KanbanItem | null>(null);
  const [itemModalTab, setItemModalTab] = useState<'details' | 'subtasks' | 'files' | 'wiki' | 'comments'>('details');
  const [boardCreateOpen, setBoardCreateOpen] = useState(false);
  const [boardEditOpen, setBoardEditOpen] = useState(false);
  const [columnCreateOpen, setColumnCreateOpen] = useState(false);
  const [columnEditId, setColumnEditId] = useState<number | null>(null);
  const [taskCreateColumnId, setTaskCreateColumnId] = useState<number | null>(null);
  /** Меню «+ Задача» в колонке: открыть создание новой или выбор существующей для добавления в колонку */
  const [addTaskMenuFor, setAddTaskMenuFor] = useState<{ columnId: number; boardId: number } | null>(null);
  const [taskSearch, setTaskSearch] = useState(() => searchParams.get('search') || '');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>(() => searchParams.get('status') || '');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>(() => searchParams.get('priority') || '');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<number | ''>(() => {
    try {
      const a = searchParams?.get?.('assigned_to');
      if (a == null || a === '') return '';
      const n = Number(a);
      return Number.isNaN(n) ? '' : n;
    } catch {
      return '';
    }
  });
  const [isTaskDragging, setIsTaskDragging] = useState(false);
  const [exportLoading, setExportLoading] = useState<'jpg' | 'pdf' | 'excel' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [listAccordionOpen, setListAccordionOpen] = useState<Set<number>>(new Set());
  const [boardsListSearch, setBoardsListSearch] = useState('');
  const [boardsListViewMode, setBoardsListViewMode] = useState<'list' | 'grid'>('list');
  const [boardsListFullscreen, setBoardsListFullscreen] = useState(false);
  const [boardsListExportLoading, setBoardsListExportLoading] = useState<'jpg' | 'pdf' | null>(null);
  const columnsScrollRef = useRef<HTMLDivElement | null>(null);
  const columnsScrollTopRef = useRef<HTMLDivElement | null>(null);
  const kanbanFullscreenRef = useRef<HTMLDivElement | null>(null);
  const boardsListRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncRef = useRef(false);
  const [columnsScrollWidth, setColumnsScrollWidth] = useState(0);

  useKanbanWebSocket(boardId ?? null);

  const { data: currentWorkspace } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const { data: members } = useQuery({
    queryKey: ['workspace-members', currentWorkspace?.id],
    queryFn: () => workspaceApi.getWorkspaceMembers(currentWorkspace!.id),
    enabled: !!currentWorkspace?.id,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects', currentWorkspace?.id],
    queryFn: () => todoApi.getProjects({ workspace_id: currentWorkspace!.id }),
    enabled: !!currentWorkspace?.id,
  });

  // Синхронизация фильтров канбана с URL (при открытой доске)
  useEffect(() => {
    if (!boardId) return;
    const next: Record<string, string> = { project: projectId || '', board: boardId };
    if (taskSearch.trim()) next.search = taskSearch.trim();
    if (taskStatusFilter) next.status = taskStatusFilter;
    if (taskPriorityFilter) next.priority = taskPriorityFilter;
    if (taskAssigneeFilter) next.assigned_to = String(taskAssigneeFilter);
    const current = Object.fromEntries([...searchParams.entries()]);
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    setSearchParams(next, { replace: true });
  }, [boardId, projectId, taskSearch, taskStatusFilter, taskPriorityFilter, taskAssigneeFilter, searchParams, setSearchParams]);

  const { data: boards } = useQuery({
    queryKey: ['kanban-boards', currentWorkspace?.id, projectId],
    queryFn: () =>
      kanbanApi.getBoards({
        workspace_id: currentWorkspace!.id,
        project: projectId ? Number(projectId) : undefined,
      }),
    enabled: !!currentWorkspace?.id && !boardId,
  });

  const { data: boardData, isLoading, isFetching } = useQuery({
    queryKey: ['kanban-board-full', boardId],
    queryFn: () => kanbanApi.getBoardFull(Number(boardId!)),
    enabled: !!boardId,
    // Сохраняем предыдущие данные во время обновления, чтобы доска не исчезала
    placeholderData: (previousData) => previousData,
  });

  /** Задачи проекта для меню «Добавить существующую» (фильтруем по спринту на клиенте). */
  const { data: projectTasksResponse } = useQuery({
    queryKey: ['todo-tasks', addTaskMenuFor?.boardId, boardData?.project],
    queryFn: () => todoApi.getTasks({ project: boardData!.project }),
    enabled: !!addTaskMenuFor && !!boardData?.project,
  });

  const createBoardMutation = useMutation({
    mutationFn: (data: { name: string; project: number }) => kanbanApi.createBoard(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
      setSearchParams({ project: String(data.project), board: String(data.id) });
      setBoardCreateOpen(false);
      toast.success('Спринт создан');
    },
    onError: () => toast.error('Ошибка при создании спринта'),
  });

  const updateBoardMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string } }) => kanbanApi.updateBoard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
      setBoardEditOpen(false);
      toast.success('Спринт обновлён');
    },
    onError: () => toast.error('Ошибка при обновлении спринта'),
  });

  const deleteBoardMutation = useMutation({
    mutationFn: (id: number) => kanbanApi.deleteBoard(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board-full', String(id)] });
      setSearchParams(projectId ? { project: projectId } : {});
      toast.success('Спринт удалён');
    },
    onError: (err: { response?: { data?: { detail?: string }; status?: number } }) => {
      const msg = err?.response?.data?.detail ?? err?.response?.data ?? 'Ошибка при удалении спринта';
      toast.error(typeof msg === 'string' ? msg : 'Ошибка при удалении спринта');
    },
  });

  const createColumnMutation = useMutation({
    mutationFn: (data: { board: number; name: string; position: number }) => kanbanApi.createColumn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
      setColumnCreateOpen(false);
      toast.success('Колонка создана');
    },
    onError: () => toast.error('Ошибка при создании колонки'),
  });

  const updateColumnMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Column> }) => kanbanApi.updateColumn(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
      setColumnEditId(null);
      toast.success('Колонка обновлена');
    },
    onError: () => toast.error('Ошибка при обновлении колонки'),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (id: number) => kanbanApi.deleteColumn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
      setColumnEditId(null);
      toast.success('Колонка удалена');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Ошибка при удалении колонки');
    },
  });

  // Удаление задачи через todoApi
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => todoApi.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
      setSelectedItem(null);
      toast.success('Задача удалена');
    },
    onError: () => toast.error('Ошибка при удалении задачи'),
  });

  // Создание задачи через todoApi (задача автоматически попадёт в kanban_column через сигнал)
  const createTaskMutation = useMutation({
    mutationFn: (data: Partial<WorkItem>) => todoApi.createTask(data),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['kanban-board-full', boardId] });
      setTaskCreateColumnId(null);
      toast.success('Задача создана');
    },
    onError: () => toast.error('Ошибка при создании задачи'),
  });

  // Завершение задачи (если не через перемещение в колонку «Готово»)
  const completeTaskMutation = useMutation({
    mutationFn: (id: number) => todoApi.completeTask(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      if (boardId != null) queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
      toast.success('Задача завершена');
    },
    onError: () => toast.error('Ошибка при завершении задачи'),
  });

  // Перемещение задачи через kanbanApi.moveTask
  const moveTaskMutation = useMutation({
    mutationFn: ({ workitemId, targetColumnId, newOrder }: { workitemId: number; targetColumnId: number; newOrder: number }) =>
      kanbanApi.moveTask(workitemId, targetColumnId, newOrder),
    onMutate: async ({ workitemId, targetColumnId, newOrder }) => {
      if (!boardId) return undefined;
      await queryClient.cancelQueries({ queryKey: ['kanban-board-full', boardId] });
      const previous = queryClient.getQueryData<BoardFull>(['kanban-board-full', boardId]);
      if (!previous) return undefined;

      // Собираем «отображаемые» колонки (реальные + виртуальная «Другие задачи»)
      const displayCols = (previous.columns || []).map((col) => ({
        ...col,
        items: Array.isArray(col.items) ? col.items.slice() : [],
      }));
      if (previous.unplaced_items?.length) {
        displayCols.unshift({
          id: UNPLACED_COLUMN_ID,
          name: 'Нераспределённые',
          order: -1,
          items: previous.unplaced_items.slice(),
          system_type: 'other',
        } as Column & { items: KanbanItem[] });
      }

      let item: KanbanItem | undefined;
      let sourceColIndex = -1;
      let itemIndexInSource = -1;
      for (let i = 0; i < displayCols.length; i++) {
        const idx = displayCols[i].items!.findIndex((it) => it.id === workitemId);
        if (idx !== -1) {
          item = displayCols[i].items![idx];
          sourceColIndex = i;
          itemIndexInSource = idx;
          break;
        }
      }
      if (!item) return { previous };

      displayCols[sourceColIndex].items!.splice(itemIndexInSource, 1);

      const destColIndex = displayCols.findIndex((c) => c.id === targetColumnId);
      if (destColIndex === -1) return { previous };
      const updatedItem = { ...item, sort_order: newOrder };
      displayCols[destColIndex].items!.splice(newOrder, 0, updatedItem);

      const fromUnplaced = displayCols[sourceColIndex]?.id === UNPLACED_COLUMN_ID;
      const realColumns = displayCols.filter((c) => c.id !== UNPLACED_COLUMN_ID);
      queryClient.setQueryData<BoardFull>(['kanban-board-full', boardId], {
        ...previous,
        columns: realColumns,
        ...(fromUnplaced && {
          unplaced_items: (previous.unplaced_items || []).filter((it) => it.id !== workitemId),
        }),
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && boardId) {
        queryClient.setQueryData(['kanban-board-full', boardId], context.previous);
      }
      toast.error('Ошибка при перемещении задачи');
    },
    onSuccess: (_data, { workitemId }) => {
      queryClient.invalidateQueries({ queryKey: ['task', workitemId] });
      toast.success('Задача перемещена');
    },
    onSettled: (_data, _err, { workitemId }) => {
      if (boardId) {
        queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
      }
      if (workitemId) {
        queryClient.invalidateQueries({ queryKey: ['task', workitemId] });
      }
    },
  });

  // Колонки доски + виртуальная «Другие задачи» — всегда вызываем до любого return (правило хуков)
  const columns = useMemo(() => {
    if (!boardData) return [];
    const cols = [...(boardData.columns || [])].sort((a, b) => a.order - b.order);
    const unplaced = boardData.unplaced_items;
    if (unplaced?.length) {
      cols.unshift({
        id: UNPLACED_COLUMN_ID,
        name: 'Нераспределённые',
        order: -1,
        items: unplaced,
        system_type: 'other',
      } as Column);
    }
    return cols;
  }, [boardData]);

  // Ширина контента для верхней полосы прокрутки (после объявления columns)
  const updateColumnsScrollWidth = useCallback(() => {
    const el = columnsScrollRef.current;
    if (el) setColumnsScrollWidth(el.scrollWidth);
  }, []);
  useEffect(() => {
    const t = setTimeout(updateColumnsScrollWidth, 50);
    return () => clearTimeout(t);
  }, [columns, boardData, updateColumnsScrollWidth]);

  const filteredItemsByColumn = useMemo(() => {
    const result: Record<number, KanbanItem[]> = {};
    const itemsByColumn = columns.reduce((acc, col) => {
      acc[col.id] = (col.items || []).sort((a, b) => a.sort_order - b.sort_order);
      return acc;
    }, {} as Record<number, KanbanItem[]>);
    const filterItem = (item: KanbanItem) => {
      const q = taskSearch.trim().toLowerCase();
      if (q && !item.title?.toLowerCase().includes(q)) return false;
      if (taskStatusFilter && (item.status || '') !== taskStatusFilter) return false;
      if (taskPriorityFilter && (item.priority || '') !== taskPriorityFilter) return false;
      if (taskAssigneeFilter) {
        const a = (item as KanbanItem & { assigned_to?: number | number[] }).assigned_to;
        const ids = a == null ? [] : Array.isArray(a) ? a : [a];
        if (!ids.includes(taskAssigneeFilter)) return false;
      }
      return true;
    };
    columns.forEach((col) => {
      result[col.id] = (itemsByColumn[col.id] || []).filter(filterItem);
    });
    return result;
  }, [columns, taskSearch, taskStatusFilter, taskPriorityFilter, taskAssigneeFilter]);

  const exportOptions = { pixelRatio: 2, cacheBust: true };
  const handleExportPdf = useCallback(async () => {
    const el = columnsScrollRef.current;
    if (!el) return;
    setExportLoading('pdf');
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
      const dataUrl = await toPng(el, exportOptions);
      const img = new Image();
      img.onload = () => {
        const pdf = new jsPDF({
          orientation: img.width > img.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [img.width, img.height],
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
        pdf.save(`${(boardData?.name || 'kanban').replace(/[^\w\s-]/g, '')}-${Date.now()}.pdf`);
        toast.success('Сохранено в PDF');
      };
      img.onerror = () => setExportLoading(null);
      img.src = dataUrl;
    } catch (err) {
      console.error('Export PDF failed', err);
      toast.error('Не удалось сохранить PDF');
    } finally {
      setExportLoading(null);
    }
  }, [boardData?.name]);

  const handleExportJpg = useCallback(async () => {
    const el = columnsScrollRef.current;
    if (!el) return;
    setExportLoading('jpg');
    try {
      const { toJpeg } = await import('html-to-image');
      const dataUrl = await toJpeg(el, { ...exportOptions, quality: 0.95 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${(boardData?.name || 'kanban').replace(/[^\w\s-]/g, '')}-${Date.now()}.jpg`;
      a.click();
      toast.success('Сохранено в JPG');
    } catch (err) {
      console.error('Export JPG failed', err);
      toast.error('Не удалось сохранить JPG');
    } finally {
      setExportLoading(null);
    }
  }, [boardData?.name]);

  const handleExportExcel = useCallback(() => {
    const priorityLabel: Record<string, string> = {
      low: 'Низкий',
      medium: 'Средний',
      high: 'Высокий',
      urgent: 'Срочный',
    };
    const cols = [...columns];
    const itemsPerColumn = cols.map((c) => filteredItemsByColumn[c.id] || []);
    const rows: (string | number)[][] = [['Колонка', 'Задача', 'Приоритет', 'Период', 'Ответственный']];
    for (let cIdx = 0; cIdx < cols.length; cIdx++) {
      const colName = cols[cIdx].name ?? '';
      for (const item of itemsPerColumn[cIdx]) {
        const start = item.start_date ?? '';
        const end = item.due_date ?? '';
        rows.push([
          colName,
          item.title ?? '',
          item.priority ? (priorityLabel[item.priority] ?? item.priority) : '',
          start && end ? `${start} - ${end}` : start || end || '',
          item.responsible_name ?? '',
        ]);
      }
    }
    const fileName = `${(boardData?.name || 'kanban').replace(/[^\w\s-]/g, '')}-${Date.now()}.csv`;
    downloadCsv(fileName, rows);
    toast.success('Файл сохранён');
  }, [columns, filteredItemsByColumn, boardData?.name]);

  const handleFullscreen = useCallback(() => {
    const el = kanbanFullscreenRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => toast.error('Полный экран недоступен'));
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false));
    }
  }, []);

  const boardsListExportOptions = { pixelRatio: 2, cacheBust: true };
  const handleBoardsListFullscreen = useCallback(() => {
    const el = boardsListRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setBoardsListFullscreen(true)).catch(() => toast.error('Полный экран недоступен'));
    } else {
      document.exitFullscreen?.().then(() => setBoardsListFullscreen(false));
    }
  }, []);
  const handleBoardsListExportJpg = useCallback(async () => {
    const el = boardsListRef.current;
    if (!el) return;
    setBoardsListExportLoading('jpg');
    try {
      const { toJpeg } = await import('html-to-image');
      const dataUrl = await toJpeg(el, { ...boardsListExportOptions, quality: 0.95 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `sprints-${Date.now()}.jpg`;
      a.click();
      toast.success('Сохранено в JPG');
    } catch (err) {
      console.error('Export JPG failed', err);
      toast.error('Не удалось сохранить JPG');
    } finally {
      setBoardsListExportLoading(null);
    }
  }, []);
  const handleBoardsListExportPdf = useCallback(async () => {
    const el = boardsListRef.current;
    if (!el) return;
    setBoardsListExportLoading('pdf');
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
      const dataUrl = await toPng(el, boardsListExportOptions);
      const img = new Image();
      img.onload = () => {
        const pdf = new jsPDF({
          orientation: img.width > img.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [img.width, img.height],
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
        pdf.save(`sprints-${Date.now()}.pdf`);
        toast.success('Сохранено в PDF');
      };
      img.onerror = () => setBoardsListExportLoading(null);
      img.src = dataUrl;
    } catch (err) {
      console.error('Export PDF failed', err);
      toast.error('Не удалось сохранить PDF');
    } finally {
      setBoardsListExportLoading(null);
    }
  }, []);
  const handleBoardsListExportExcel = useCallback(() => {
    const list = boards?.results ?? [];
    const filtered = boardsListSearch.trim()
      ? list.filter((b) => b.name?.toLowerCase().includes(boardsListSearch.trim().toLowerCase()))
      : list;
    const rows: (string | number)[][] = [
      ['Название спринта', 'Проект'],
      ...filtered.map((b) => [b.name ?? '', (projects?.results ?? []).find((p) => p.id === b.project)?.name ?? '']),
    ];
    downloadCsv(`sprints-${Date.now()}.csv`, rows);
    toast.success('Сохранено в CSV');
  }, [boards?.results, boardsListSearch, projects?.results]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        setBoardsListFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (viewMode === 'list' && columns.length > 0) {
      setListAccordionOpen(new Set(columns.map((c) => c.id)));
    }
  }, [viewMode, columns]);

  const toggleListAccordion = useCallback((columnId: number) => {
    setListAccordionOpen((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  }, []);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !boardData) return;

    const { draggableId, source, destination } = result;

    // Перетаскивание колонок (изменение порядка)
    if (source.droppableId === 'columns-order' && draggableId.startsWith('column-')) {
      const realColumns = columns.filter((c) => c.id !== UNPLACED_COLUMN_ID);
      if (source.index === destination.index || realColumns.length === 0) return;
      const reordered = [...realColumns];
      const [removed] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, removed);
      // Обязательный порядок: В плане → В работе → Завершено (plan < in_progress < done)
      const idxPlan = reordered.findIndex((c) => c.system_type === 'plan');
      const idxInProgress = reordered.findIndex((c) => c.system_type === 'in_progress');
      const idxDone = reordered.findIndex((c) => c.system_type === 'done');
      const invalidOrder =
        (idxPlan >= 0 && idxInProgress >= 0 && idxPlan >= idxInProgress) ||
        (idxInProgress >= 0 && idxDone >= 0 && idxInProgress >= idxDone) ||
        (idxPlan >= 0 && idxDone >= 0 && idxPlan >= idxDone);
      if (invalidOrder) {
        queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
        toast.error('Обязательные колонки «В плане», «В работе», «Завершено» должны сохранять порядок.');
        return;
      }
      const toUpdate = reordered
        .map((col, index) => (col.order !== index ? { id: col.id, position: index } : null))
        .filter((x): x is { id: number; position: number } => x != null);
      if (toUpdate.length === 0) return;
      Promise.all(toUpdate.map(({ id, position }) => kanbanApi.updateColumn(id, { position } as Partial<Column>)))
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
          toast.success('Порядок колонок обновлён');
        })
        .catch(() => toast.error('Ошибка при изменении порядка колонок'));
      return;
    }

    // Перетаскивание задачи — только в зону колонки (не в columns-order)
    if (destination.droppableId === 'columns-order') return;

    const workitemId = Number(draggableId);
    const targetColumnId = Number(destination.droppableId);
    const newOrder = destination.index;

    if (Number.isNaN(targetColumnId) || targetColumnId === UNPLACED_COLUMN_ID) return;
    if (!columns.some((c) => c.id === targetColumnId)) return;

    let currentColumnId = 0;
    let currentOrder = -1;
    for (const col of columns) {
      const idx = (col.items || []).findIndex((it) => it.id === workitemId);
      if (idx !== -1) {
        currentColumnId = col.id;
        currentOrder = idx;
        break;
      }
    }

    if (currentColumnId === targetColumnId && currentOrder === newOrder) return;

    moveTaskMutation.mutate({
      workitemId,
      targetColumnId,
      newOrder,
    });
  };

  const handleDragStart = (result: { source: { droppableId: string }; draggableId: string }) => {
    const isColumnDrag = result.source.droppableId === 'columns-order' && result.draggableId.startsWith('column-');
    setIsTaskDragging(!isColumnDrag);
  };

  const handleDragEndWithReset = (result: DropResult) => {
    handleDragEnd(result);
    setIsTaskDragging(false);
  };

  // Показываем загрузку только при первой загрузке
  if (isLoading && !boardData) {
    return <div className="text-center py-12 text-gray-500 dark:text-slate-300">Загрузка спринта...</div>;
  }

  // Если нет boardId или данных (и не идет загрузка/обновление), показываем список всех досок с фильтрами
  // Но если есть boardId и идет обновление (isFetching), показываем доску с предыдущими данными
  if (!boardId || (!boardData && !isFetching && !isLoading)) {
    const projId = projectId ? Number(projectId) : 0;
    const boardsList = boards?.results ?? [];

    if (!currentWorkspace?.id) {
      return (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-imperial-text">Этапы проектов</h1>
          <p className="text-gray-500 dark:text-slate-300">Выберите рабочее пространство или создайте его.</p>
        </div>
      );
    }

    const filteredBoardsList = boardsListSearch.trim()
      ? boardsList.filter((b) => b.name?.toLowerCase().includes(boardsListSearch.trim().toLowerCase()))
      : boardsList;

    return (
      <div ref={boardsListRef} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Этапы проектов</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Все спринты пространства «{currentWorkspace.name}».
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setBoardCreateOpen(true)}
              title="Создать спринт"
              className="px-2 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium text-xs"
            >
              +
            </button>
            <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
            <button
              type="button"
              onClick={handleBoardsListExportJpg}
              disabled={!!boardsListExportLoading}
              className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs"
            >
              JPG
            </button>
            <button
              type="button"
              onClick={handleBoardsListExportPdf}
              disabled={!!boardsListExportLoading}
              className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs"
            >
              PDF
            </button>
            <button
              type="button"
              onClick={handleBoardsListExportExcel}
              className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs"
            >
              Excel
            </button>
            <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
            <button
              type="button"
              onClick={() => setBoardsListViewMode('grid')}
              title="Сетка"
              className={`p-1.5 rounded-md border ${boardsListViewMode === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setBoardsListViewMode('list')}
              title="Список"
              className={`p-1.5 rounded-md border ${boardsListViewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
            <button
              type="button"
              onClick={handleBoardsListFullscreen}
              className="p-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              title={boardsListFullscreen ? 'Свернуть' : 'Во весь экран'}
            >
              {boardsListFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700 p-2 flex flex-wrap gap-2 items-end">
          <div className="min-w-0 flex-1 sm:flex-initial sm:min-w-[170px]">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Поиск</label>
            <input
              type="search"
              placeholder="Название спринта..."
              value={boardsListSearch}
              onChange={(e) => setBoardsListSearch(e.target.value)}
              className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[11.8rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="min-w-0 flex-1 sm:flex-initial">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Проект</label>
            <select
              value={projectId || ''}
              onChange={(e) =>
                setSearchParams(e.target.value ? { project: e.target.value } : {}, { replace: true })
              }
              className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[10.2rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="">Все проекты</option>
              {(projects?.results ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700 overflow-hidden">
          {filteredBoardsList.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              {projectId
                ? 'Нет спринтов в этом проекте. Создайте спринт.'
                : boardsListSearch.trim()
                  ? 'Нет спринтов по запросу.'
                  : 'Нет спринтов в пространстве. Создайте спринт или выберите проект.'}
            </div>
          ) : boardsListViewMode === 'grid' ? (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBoardsList.map((board) => (
                <Link
                  key={board.id}
                  to={`/kanban?project=${board.project}&board=${board.id}`}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors block text-left"
                >
                  <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate">{board.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {board.project_name && <span className="text-primary-600 dark:text-primary-400">{board.project_name}</span>}
                  </p>
                  <span className="text-primary-600 dark:text-primary-400 text-sm mt-2 inline-block">Открыть →</span>
                </Link>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-600">
              {filteredBoardsList.map((board) => (
                <li key={board.id}>
                  <Link
                    to={`/kanban?project=${board.project}&board=${board.id}`}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 block transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate">{board.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {board.project_name && (
                          <span className="text-primary-600 dark:text-primary-400">{board.project_name}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-primary-600 dark:text-primary-400 text-sm shrink-0 ml-2">Открыть →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {boardCreateOpen && (
          <BoardCreateModal
            projectId={projId}
            projects={projects?.results ?? []}
            onClose={() => setBoardCreateOpen(false)}
            onSubmit={(name, project) => createBoardMutation.mutate({ name, project })}
            isSubmitting={createBoardMutation.isPending}
          />
        )}
      </div>
    );
  }

  // Защита от undefined (до boardData уже могли вернуться выше по списку спринтов / загрузке)
  if (!boardData) {
    return <div className="text-center py-12 text-gray-500 dark:text-slate-300">Загрузка спринта...</div>;
  }

  const handleDeleteBoard = () => {
    if (!boardId) return;
    if (window.confirm('Удалить этот спринт?')) {
      deleteBoardMutation.mutate(Number(boardId));
    }
  };

  const firstColumnId = columns.find((c) => c.id !== UNPLACED_COLUMN_ID)?.id ?? columns[0]?.id;
  const currentProjectName = projects?.results?.find((p) => p.id === boardData?.project)?.name ?? '';

  return (
    <div ref={kanbanFullscreenRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{boardData?.name || 'Этап'}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            {currentProjectName ? `Спринт · ${currentProjectName}` : 'Управление спринтом'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => firstColumnId != null && setTaskCreateColumnId(firstColumnId)}
            title="Новая задача"
            className="px-2 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium text-xs"
          >
            +
          </button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button
            type="button"
            onClick={handleExportJpg}
            disabled={!!exportLoading}
            className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs"
          >
            JPG
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!!exportLoading}
            className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!!exportLoading}
            className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs"
          >
            Excel
          </button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            title="Сетка"
            className={`p-1.5 rounded-md border ${viewMode === 'kanban' ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            title="Список"
            className={`p-1.5 rounded-md border ${viewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button
            type="button"
            onClick={() => setBoardEditOpen(true)}
            className="p-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            title="Редактировать спринт"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={handleDeleteBoard}
            disabled={deleteBoardMutation.isPending}
            className="p-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 hover:text-red-600 dark:hover:text-red-400"
            title="Удалить спринт"
          >
            🗑️
          </button>
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 text-xs">|</span>
          <button
            type="button"
            onClick={handleFullscreen}
            className="p-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            title={isFullscreen ? 'Свернуть' : 'Во весь экран'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Фильтры — как на странице Задачи */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-none border border-slate-200 dark:border-slate-700 p-2 flex flex-wrap gap-2 items-end">
        <div className="min-w-0 flex-1 sm:flex-initial sm:min-w-[170px]">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Поиск</label>
          <input
            type="search"
            placeholder="Название или описание..."
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[11.8rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="min-w-0 flex-1 sm:flex-initial">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Проект</label>
          <select
            disabled
            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[10.2rem] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-not-allowed"
            value={boardData?.project ?? ''}
            title="Текущий проект спринта"
          >
            <option value={boardData?.project ?? ''}>{currentProjectName || '—'}</option>
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Статус</label>
          <select
            value={taskStatusFilter}
            onChange={(e) => setTaskStatusFilter(e.target.value)}
            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[8.5rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Все</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Приоритет</label>
          <select
            value={taskPriorityFilter}
            onChange={(e) => setTaskPriorityFilter(e.target.value)}
            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[8.5rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">Все</option>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {currentWorkspace?.id && (
          <div className="min-w-0 flex-1 sm:flex-initial">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Исполнитель</label>
            <select
              value={taskAssigneeFilter}
              onChange={(e) => setTaskAssigneeFilter(e.target.value ? Number(e.target.value) : '')}
              className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 w-full sm:w-[10.2rem] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="">Все</option>
              {(Array.isArray(members) ? members : []).map((m: { user?: { id: number; username?: string } }) => (
                <option key={m.user?.id} value={m.user?.id ?? ''}>
                  {m.user?.username ?? `User ${m.user?.id}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {boardEditOpen && boardData && (
        <BoardEditModal
          board={boardData}
          onClose={() => setBoardEditOpen(false)}
          onSubmit={(name) => {
            if (boardData) {
              updateBoardMutation.mutate({ id: boardData.id, data: { name } });
            }
          }}
          isSubmitting={updateBoardMutation.isPending}
        />
      )}

      {columnCreateOpen && boardData && (
        <AddColumnModal
          boardId={boardData.id}
          columns={columns}
          onClose={() => setColumnCreateOpen(false)}
          onSubmit={(name, position) => {
            if (boardData) {
              createColumnMutation.mutate({ board: boardData.id, name, position });
            }
          }}
          isSubmitting={createColumnMutation.isPending}
        />
      )}

      {columnEditId != null && boardData && (() => {
        const editColumn = columns.find((c) => c.id === columnEditId);
        const editColumnItems = editColumn ? (filteredItemsByColumn[editColumn.id] || []) : [];
        const canDeleteEditColumn = editColumn?.system_type === 'other';
        return editColumn ? (
          <EditColumnModal
            column={editColumn}
            onClose={() => setColumnEditId(null)}
            onSubmit={(name, position, color) =>
              updateColumnMutation.mutate({ id: columnEditId, data: { name, order: position, color } })
            }
            onDelete={
              canDeleteEditColumn && editColumnItems.length === 0
                ? () => {
                  if (window.confirm('Удалить колонку?')) deleteColumnMutation.mutate(columnEditId);
                }
                : undefined
            }
            deleteDisabledReason={
              canDeleteEditColumn && editColumnItems.length > 0
                ? `В колонке есть задачи (${editColumnItems.length}). Перенесите их в другие колонки.`
                : undefined
            }
            isSubmitting={updateColumnMutation.isPending}
          />
        ) : null;
      })()}

      {taskCreateColumnId != null && boardData?.project && (
        <AddTaskModal
          boardId={boardData.id}
          columnId={taskCreateColumnId}
          columns={columns}
          projectId={boardData.project}
          projects={projects?.results ?? []}
          workspaceId={currentWorkspace?.id}
          onClose={() => setTaskCreateColumnId(null)}
          hideSprintColumnChoice
          onSubmit={(data) => {
            createTaskMutation.mutate({
              ...data,
              project: boardData.project,
              stage: data.stage !== undefined ? data.stage : boardData.id,
              kanban_column: data.kanban_column !== undefined ? data.kanban_column : taskCreateColumnId,
            } as Parameters<typeof todoApi.createTask>[0]);
          }}
          isSubmitting={createTaskMutation.isPending}
        />
      )}

      {addTaskMenuFor != null && boardData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setAddTaskMenuFor(null)}
          role="dialog"
          aria-label="Добавить задачу в колонку"
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 max-w-md w-full mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Добавить задачу в колонку</h3>
            </div>
            <div className="p-4 flex flex-col gap-3 overflow-y-auto">
              <button
                type="button"
                className="w-full py-2.5 px-4 text-left text-sm font-medium text-primary-600 dark:text-imperial-gold hover:bg-primary-50 dark:hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => {
                  setTaskCreateColumnId(addTaskMenuFor.columnId);
                  setAddTaskMenuFor(null);
                }}
              >
                + Создать новую задачу
              </button>
              <div className="pt-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Добавить существующую задачу</p>
                {(() => {
                  const list = projectTasksResponse?.results ?? [];
                  const existingTasks = list.filter(
                    (t: WorkItem) => t.stage == null || t.stage !== addTaskMenuFor.boardId
                  );
                  if (existingTasks.length === 0) {
                    return (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-1">
                        Нет задач в бэклоге или других спринтах. Создайте новую задачу выше.
                      </p>
                    );
                  }
                  return (
                    <ul className="space-y-1 max-h-48 overflow-y-auto">
                      {existingTasks.map((t: WorkItem) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            className="w-full py-2 px-3 text-left text-sm text-gray-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg truncate"
                            onClick={() => {
                              moveTaskMutation.mutate(
                                { workitemId: t.id, targetColumnId: addTaskMenuFor.columnId, newOrder: 0 },
                                { onSuccess: () => setAddTaskMenuFor(null) }
                              );
                            }}
                            disabled={moveTaskMutation.isPending}
                          >
                            {t.title || 'Без названия'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                onClick={() => setAddTaskMenuFor(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="bg-white dark:bg-imperial-surface/80 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
          {columns.every((c) => (filteredItemsByColumn[c.id] || []).length === 0) ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              Нет задач по текущим фильтрам.
            </div>
          ) : (
            <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEndWithReset}>
              <Droppable droppableId="columns-order" type="COLUMN" direction="vertical">
                {(droppableProvided) => (
                  <div
                    ref={droppableProvided.innerRef}
                    {...droppableProvided.droppableProps}
                    className="divide-y divide-slate-200 dark:divide-white/10 flex flex-col gap-4"
                  >
                    {columns
                      .filter((c) => c.id === UNPLACED_COLUMN_ID)
                      .map((col) => {
                        const items = filteredItemsByColumn[col.id] || [];
                        const isOpen = listAccordionOpen.has(col.id);
                        const columnColor = col.color || '#fbbf24';
                        return (
                          <div
                            key={col.id}
                            className="rounded-lg border-2 transition-shadow dark:border-white/10"
                            style={{
                              borderColor: columnColor,
                              borderBottomWidth: 3,
                              borderBottomColor: columnColor,
                              boxShadow: `0 0 24px -2px ${columnColor}60, 0 0 12px ${columnColor}50, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 6px 20px -2px ${columnColor}80`,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleListAccordion(col.id)}
                              className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                              <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                              {isOpen ? (
                                <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                              )}
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); setColumnEditId(col.id); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setColumnEditId(col.id); } }}
                                className="font-medium text-gray-900 dark:text-slate-100 cursor-pointer hover:underline"
                                title="Настройки колонки"
                              >
                                {col.name ?? 'Без названия'}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                                {items.length}
                              </span>
                            </button>
                            {isOpen && (
                              <Droppable droppableId={String(col.id)} type="TASK">
                                {(taskProvided, taskSnapshot) => (
                                  <ul
                                    ref={taskProvided.innerRef}
                                    {...taskProvided.droppableProps}
                                    className={`bg-slate-50/50 dark:bg-white/5 min-h-[28px] ${taskSnapshot.isDraggingOver ? 'ring-1 ring-inset ring-imperial-gold/30' : ''}`}
                                  >
                                    {items.length === 0 ? (
                                      <li className="px-4 py-3 pl-10 text-sm text-slate-500 dark:text-slate-400">
                                        Нет задач — перетащите сюда
                                      </li>
                                    ) : (
                                      items.map((item, index) => (
                                        <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                                          {(itemProvided, itemSnapshot) => (
                                            <li
                                              ref={itemProvided.innerRef}
                                              {...itemProvided.draggableProps}
                                              className={`border-t border-slate-200/50 dark:border-white/5 flex items-center min-w-0 ${itemSnapshot.isDragging ? 'opacity-90 shadow-lg z-10' : ''}`}
                                            >
                                              <span
                                                className="w-3 h-3 rounded-full shrink-0 mr-1"
                                                style={{ backgroundColor: item.color || '#fbbf24' }}
                                                aria-hidden
                                              />
                                              <div
                                                {...itemProvided.dragHandleProps}
                                                className="p-2 shrink-0 cursor-grab active:cursor-grabbing"
                                                style={{ color: item.color || '#fbbf24' }}
                                              >
                                                <GripVertical className="w-4 h-4" />
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => setSelectedItem(item)}
                                                className="flex-1 min-w-0 max-w-[50%] overflow-hidden text-left px-2 py-2.5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors flex flex-wrap items-center gap-2 sm:gap-4"
                                              >
                                                {(() => {
                                                  const schedule = getInScheduleStatus(item);
                                                  return schedule ? (
                                                    <span className="shrink-0 text-sm" title={schedule.tooltip}>
                                                      {schedule.inGraph ? (
                                                        <span className="text-green-600 dark:text-green-400" aria-label="В графике">!!!</span>
                                                      ) : (
                                                        <span className="text-red-600 dark:text-red-400" aria-label="Вне графика">??</span>
                                                      )}
                                                    </span>
                                                  ) : null;
                                                })()}
                                                <span className="text-sm font-medium truncate flex-1 min-w-0" style={{ color: item.color || '#fbbf24' }}>
                                                  {item.title || 'Без названия'}
                                                </span>
                                                {item.priority && (
                                                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                                                    {item.priority === 'urgent' ? 'Срочный' : item.priority === 'high' ? 'Высокий' : item.priority === 'medium' ? 'Средний' : 'Низкий'}
                                                  </span>
                                                )}
                                                {item.due_date && (
                                                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                                                    {item.due_date}
                                                  </span>
                                                )}
                                              </button>
                                              {(item.checklist_stats?.total ?? 0) > 0 && (() => {
                                                const total = item.checklist_stats?.total ?? 0;
                                                const done = item.checklist_stats?.done ?? 0;
                                                return (
                                                  <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[140px]" title={`Подзадачи ${done}/${total}`}>
                                                    <div className="flex-1 flex gap-0.5 min-w-0">
                                                      {Array.from({ length: total }, (_, i) => (
                                                        <div
                                                          key={i}
                                                          className={`flex-1 min-w-0 h-2 rounded-sm first:rounded-l last:rounded-r ${i < done ? 'bg-imperial-gold' : 'bg-gray-200 dark:bg-white/10'}`}
                                                          title={i < done ? 'Выполнено' : 'Не выполнено'}
                                                        />
                                                      ))}
                                                    </div>
                                                    <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">{done}/{total}</span>
                                                  </div>
                                                );
                                              })()}
                                              <div className="ml-auto shrink-0">
                                                <TaskListRowActions
                                                  item={item}
                                                  itemColumn={col}
                                                  boardColumns={columns.filter((c) => c.id !== UNPLACED_COLUMN_ID)}
                                                  boardId={boardId}
                                                  moveTaskMutation={moveTaskMutation}
                                                  completeTaskMutation={completeTaskMutation}
                                                />
                                              </div>
                                              <div className="flex items-center gap-1 shrink-0 ml-2" aria-hidden>
                                                <GripVertical className="w-4 h-4" style={{ color: item.color || '#fbbf24' }} />
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color || '#fbbf24' }} />
                                              </div>
                                            </li>
                                          )}
                                        </Draggable>
                                      ))
                                    )}
                                    {taskProvided.placeholder}
                                  </ul>
                                )}
                              </Droppable>
                            )}
                            <button
                              type="button"
                              onClick={() => boardData && setAddTaskMenuFor({ columnId: col.id, boardId: boardData.id })}
                              className="w-full py-2 px-4 text-left text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-imperial-gold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-t border-slate-200/50 dark:border-white/5"
                              title="Добавить задачу в колонку"
                            >
                              + Добавить задачу
                            </button>
                          </div>
                        );
                      })}
                    {columns
                      .filter((c) => c.id !== UNPLACED_COLUMN_ID)
                      .map((col, index) => {
                        const items = filteredItemsByColumn[col.id] || [];
                        const isOpen = listAccordionOpen.has(col.id);
                        return (
                          <Draggable key={col.id} draggableId={`column-${col.id}`} index={index}>
                            {(colProvided, colSnapshot) => {
                              const columnColor = col.color || '#fbbf24';
                              const neonStyle = {
                                borderColor: columnColor,
                                borderBottomWidth: 3,
                                borderBottomColor: columnColor,
                                boxShadow: `0 0 24px -2px ${columnColor}60, 0 0 12px ${columnColor}50, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 6px 20px -2px ${columnColor}80`,
                              };
                              return (
                              <div
                                ref={colProvided.innerRef}
                                {...colProvided.draggableProps}
                                style={{ ...colProvided.draggableProps.style, ...neonStyle }}
                                className={`rounded-lg border-2 transition-shadow dark:border-white/10 ${colSnapshot.isDragging ? 'bg-white dark:bg-white/10 shadow-md' : ''}`}
                              >
                                <div className="flex items-center border-b border-slate-200/50 dark:border-white/5">
                                  <div
                                    {...colProvided.dragHandleProps}
                                    className="p-2 cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                                    title="Перетащите для изменения порядка колонок"
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleListAccordion(col.id)}
                                    className="flex-1 text-left px-2 py-3 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                  >
                                    {isOpen ? (
                                      <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                                    )}
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => { e.stopPropagation(); setColumnEditId(col.id); }}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setColumnEditId(col.id); } }}
                                      className="font-medium text-gray-900 dark:text-slate-100 cursor-pointer hover:underline"
                                      title="Настройки колонки"
                                    >
                                      {col.name ?? 'Без названия'}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                                      {items.length}
                                    </span>
                                  </button>
                                </div>
                                {isOpen && (
                                  <Droppable droppableId={String(col.id)} type="TASK">
                                    {(taskProvided, taskSnapshot) => (
                                      <ul
                                        ref={taskProvided.innerRef}
                                        {...taskProvided.droppableProps}
                                        className={`bg-slate-50/50 dark:bg-white/5 min-h-[28px] ${taskSnapshot.isDraggingOver ? 'ring-1 ring-inset ring-imperial-gold/30' : ''}`}
                                      >
                                        {items.length === 0 ? (
                                          <li className="px-4 py-3 pl-12 text-sm text-slate-500 dark:text-slate-400">
                                            Нет задач — перетащите сюда
                                          </li>
                                        ) : (
                                          items.map((item, idx) => (
                                            <Draggable key={item.id} draggableId={String(item.id)} index={idx}>
                                              {(itemProvided, itemSnapshot) => (
                                                <li
                                                  ref={itemProvided.innerRef}
                                                  {...itemProvided.draggableProps}
                                                  className={`border-t border-slate-200/50 dark:border-white/5 flex items-center min-w-0 ${itemSnapshot.isDragging ? 'opacity-90 shadow-lg z-10' : ''}`}
                                                >
                                                  <span
                                                    className="w-3 h-3 rounded-full shrink-0 mr-1"
                                                    style={{ backgroundColor: item.color || '#fbbf24' }}
                                                    aria-hidden
                                                  />
                                                  <div
                                                    {...itemProvided.dragHandleProps}
                                                    className="p-2 shrink-0 cursor-grab active:cursor-grabbing"
                                                    style={{ color: item.color || '#fbbf24' }}
                                                  >
                                                    <GripVertical className="w-4 h-4" />
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => setSelectedItem(item)}
                                                    className="flex-1 min-w-0 max-w-[50%] overflow-hidden text-left px-2 py-2.5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors flex flex-wrap items-center gap-2 sm:gap-4"
                                                  >
                                                    {(() => {
                                                      const schedule = getInScheduleStatus(item);
                                                      return schedule ? (
                                                        <span className="shrink-0 text-sm" title={schedule.tooltip}>
                                                          {schedule.inGraph ? (
                                                            <span className="text-green-600 dark:text-green-400" aria-label="В графике">!!!</span>
                                                          ) : (
                                                            <span className="text-red-600 dark:text-red-400" aria-label="Вне графика">??</span>
                                                          )}
                                                        </span>
                                                      ) : null;
                                                    })()}
                                                    <span className="text-sm font-medium truncate flex-1 min-w-0" style={{ color: item.color || '#fbbf24' }}>
                                                      {item.title || 'Без названия'}
                                                    </span>
                                                    {item.priority && (
                                                      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                                                        {item.priority === 'urgent' ? 'Срочный' : item.priority === 'high' ? 'Высокий' : item.priority === 'medium' ? 'Средний' : 'Низкий'}
                                                      </span>
                                                    )}
                                                    {item.due_date && (
                                                      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                                                        {item.due_date}
                                                      </span>
                                                    )}
                                                  </button>
                                                  {(item.checklist_stats?.total ?? 0) > 0 && (() => {
                                                    const total = item.checklist_stats?.total ?? 0;
                                                    const done = item.checklist_stats?.done ?? 0;
                                                    return (
                                                      <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[140px]" title={`Подзадачи ${done}/${total}`}>
                                                        <div className="flex-1 flex gap-0.5 min-w-0">
                                                          {Array.from({ length: total }, (_, i) => (
                                                            <div
                                                              key={i}
                                                              className={`flex-1 min-w-0 h-2 rounded-sm first:rounded-l last:rounded-r ${i < done ? 'bg-imperial-gold' : 'bg-gray-200 dark:bg-white/10'}`}
                                                              title={i < done ? 'Выполнено' : 'Не выполнено'}
                                                            />
                                                          ))}
                                                        </div>
                                                        <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">{done}/{total}</span>
                                                      </div>
                                                    );
                                                  })()}
                                                  <div className="ml-auto shrink-0">
                                                    <TaskListRowActions
                                                      item={item}
                                                      itemColumn={col}
                                                      boardColumns={columns.filter((c) => c.id !== UNPLACED_COLUMN_ID)}
                                                      boardId={boardId}
                                                      moveTaskMutation={moveTaskMutation}
                                                      completeTaskMutation={completeTaskMutation}
                                                    />
                                                  </div>
                                                  <div className="flex items-center gap-1 shrink-0 ml-2" aria-hidden>
                                                    <GripVertical className="w-4 h-4" style={{ color: item.color || '#fbbf24' }} />
                                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color || '#fbbf24' }} />
                                                  </div>
                                                </li>
                                              )}
                                            </Draggable>
                                          ))
                                        )}
                                        {taskProvided.placeholder}
                                      </ul>
                                    )}
                                  </Droppable>
                                )}
                                <button
                                  type="button"
                                  onClick={() => boardData && setAddTaskMenuFor({ columnId: col.id, boardId: boardData.id })}
                                  className="w-full py-2 px-4 text-left text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-imperial-gold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-t border-slate-200/50 dark:border-white/5"
                                  title="Добавить задачу в колонку"
                                >
                                  + Добавить задачу
                                </button>
                              </div>
                            );
                            }}
                          </Draggable>
                        );
                      })}
                    <div className="rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-500 min-h-[52px] flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setColumnCreateOpen(true)}
                        className="w-full py-4 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-imperial-gold hover:border-transparent rounded-lg transition-colors"
                        title="Добавить колонку"
                      >
                        + Добавить колонку
                      </button>
                    </div>
                    {droppableProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
      ) : (
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEndWithReset}>
          <Droppable droppableId="columns-order" type="COLUMN" direction="horizontal">
            {(droppableProvided) => {
              const onMainScroll = () => {
                if (scrollSyncRef.current) return;
                scrollSyncRef.current = true;
                if (columnsScrollTopRef.current && columnsScrollRef.current) {
                  columnsScrollTopRef.current.scrollLeft = columnsScrollRef.current.scrollLeft;
                }
                setTimeout(() => { scrollSyncRef.current = false; }, 0);
              };
              const onTopScroll = () => {
                if (scrollSyncRef.current) return;
                scrollSyncRef.current = true;
                if (columnsScrollRef.current && columnsScrollTopRef.current) {
                  columnsScrollRef.current.scrollLeft = columnsScrollTopRef.current.scrollLeft;
                }
                setTimeout(() => { scrollSyncRef.current = false; }, 0);
              };
              return (
                <div className="flex flex-col gap-0 kanban-scroll-zone">
                  <style>{`
                .kanban-scroll-zone .scrollbar-thumb-ball::-webkit-scrollbar { height: 16px; width: 16px; }
                .kanban-scroll-zone .scrollbar-thumb-ball::-webkit-scrollbar-track {
                  background: rgb(226 232 240);
                  border-radius: 8px;
                }
                .dark .kanban-scroll-zone .scrollbar-thumb-ball::-webkit-scrollbar-track {
                  background: rgb(51 65 85);
                }
                .kanban-scroll-zone .scrollbar-thumb-ball::-webkit-scrollbar-thumb {
                  background: rgb(148 163 184);
                  border-radius: 8px;
                  min-width: 48px;
                  min-height: 48px;
                }
                .kanban-scroll-zone .scrollbar-thumb-ball::-webkit-scrollbar-thumb:hover {
                  background: rgb(100 116 139);
                }
                .dark .kanban-scroll-zone .scrollbar-thumb-ball::-webkit-scrollbar-thumb {
                  background: rgb(100 116 139);
                }
                .dark .kanban-scroll-zone .scrollbar-thumb-ball::-webkit-scrollbar-thumb:hover {
                  background: rgb(148 163 184);
                }
                .kanban-scroll-zone .scrollbar-thumb-ball { scrollbar-color: rgb(148 163 184) rgb(226 232 240); scrollbar-width: auto; }
                .dark .kanban-scroll-zone .scrollbar-thumb-ball { scrollbar-color: rgb(100 116 139) rgb(51 65 85); }
              `}</style>
                  {/* Верхняя полоса прокрутки — синхронна с основной */}
                  <div
                    ref={columnsScrollTopRef}
                    onScroll={onTopScroll}
                    className={`scrollbar-thumb-ball overflow-x-auto overflow-y-hidden flex-shrink-0 ${isTaskDragging ? 'overflow-x-hidden' : ''}`}
                    style={{ minHeight: 16, maxHeight: 16 }}
                    aria-hidden
                  >
                    <div style={{ width: columnsScrollWidth || '100%', minHeight: 1 }} />
                  </div>
                  <div
                    ref={(el) => {
                      droppableProvided.innerRef(el);
                      (columnsScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                      if (el) setTimeout(updateColumnsScrollWidth, 0);
                    }}
                    {...droppableProvided.droppableProps}
                    onScroll={onMainScroll}
                    className={`scrollbar-thumb-ball flex gap-4 pt-2 pb-4 ${isTaskDragging ? 'overflow-x-hidden' : 'overflow-x-auto'}`}
                  >
                    {columns
                      .filter((c) => c.id === UNPLACED_COLUMN_ID)
                      .map((column) => {
                        const columnItems = filteredItemsByColumn[column.id] || [];
                        return (
                          <div key={column.id} className="flex-shrink-0 w-56">
                            <KanbanColumn
                              column={column}
                              columns={columns.filter((c) => c.id !== UNPLACED_COLUMN_ID)}
                              items={columnItems}
                              onItemClick={setSelectedItem}
                              onAddTask={undefined}
                              onEditColumn={undefined}
                              onDeleteColumn={undefined}
                              deleteDisabledReason={undefined}
                              onMoveTask={(workitemId, targetColumnId, newOrder) =>
                                moveTaskMutation.mutate({ workitemId, targetColumnId, newOrder })
                              }
                              isMoveTaskPending={moveTaskMutation.isPending}
                            />
                          </div>
                        );
                      })}
                    {columns
                      .filter((c) => c.id !== UNPLACED_COLUMN_ID)
                      .map((column, index) => {
                        const columnItems = filteredItemsByColumn[column.id] || [];
                        const isUserColumn = column.system_type === 'other';
                        const hasTasks = columnItems.length > 0;
                        return (
                          <Draggable key={column.id} draggableId={`column-${column.id}`} index={index}>
                            {(draggableProvided) => (
                              <div
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                className="flex-shrink-0"
                              >
                                <KanbanColumn
                                  column={column}
                                  columns={columns.filter((c) => c.id !== UNPLACED_COLUMN_ID)}
                                  items={columnItems}
                                  onItemClick={setSelectedItem}
                                  onAddTask={() => boardData && setAddTaskMenuFor({ columnId: column.id, boardId: boardData.id })}
                                  onEditColumn={() => setColumnEditId(column.id)}
                                  onDeleteColumn={
                                    isUserColumn
                                      ? () => {
                                        if (!hasTasks && window.confirm('Удалить колонку?')) deleteColumnMutation.mutate(column.id);
                                      }
                                      : undefined
                                  }
                                  deleteDisabledReason={isUserColumn && hasTasks ? `В колонке есть задачи (${columnItems.length}). Перенесите их в другие колонки.` : undefined}
                                  onMoveTask={(workitemId, targetColumnId, newOrder) =>
                                    moveTaskMutation.mutate({ workitemId, targetColumnId, newOrder })
                                  }
                                  isMoveTaskPending={moveTaskMutation.isPending}
                                  columnDragHandleProps={draggableProvided.dragHandleProps}
                                />
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                    {droppableProvided.placeholder}
                    <div className="flex-shrink-0 w-56">
                      <button
                        onClick={() => setColumnCreateOpen(true)}
                        className="w-full h-24 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-gray-500 dark:text-slate-400 hover:border-primary-400 hover:text-primary-600 dark:hover:border-imperial-gold dark:hover:text-imperial-gold"
                      >
                        + Колонка
                      </button>
                    </div>
                  </div>
                </div>
              );
            }}
          </Droppable>
        </DragDropContext>
      )}

      {selectedItem && boardData?.project && (
        <TaskDetailModal
          item={selectedItem}
          boardId={boardId ? Number(boardId) : undefined}
          columns={boardData?.columns}
          projectId={boardData.project}
          projects={projects?.results ?? []}
          workspaceId={currentWorkspace?.id}
          onClose={() => setSelectedItem(null)}
          activeTab={itemModalTab}
          onTabChange={setItemModalTab}
          onTaskUpdate={(data) => {
            todoApi
              .updateTask(selectedItem.id, data as Partial<WorkItem>)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
                queryClient.invalidateQueries({ queryKey: ['task', selectedItem.id] });
                setSelectedItem({ ...selectedItem, ...data });
                toast.success('Задача обновлена');
              })
              .catch(() => toast.error('Ошибка при обновлении задачи'));
          }}
          onDeleteTask={() => {
            if (window.confirm('Удалить задачу?')) {
              deleteTaskMutation.mutate(selectedItem.id);
            }
          }}
        />
      )}
    </div>
  );
}

function formatTimeSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Задача считается «в работе», если колонка = В работе или position колонки строго между В работе и Завершено. */
function isTaskInProgressByPosition(itemColumn: Column | undefined, colInProgress: Column | undefined, colDone: Column | undefined): boolean {
  if (!itemColumn || !colInProgress || !colDone) return false;
  return itemColumn.order > colInProgress.order && itemColumn.order < colDone.order;
}

/** Индикатор «в графике»: старт не позднее start_date, завершение не позднее due_date. Возвращает тип и текст подсказки с датами. */
function getInScheduleStatus(item: KanbanItem): { inGraph: boolean; tooltip: string } | null {
  const { start_date, due_date, started_at, completed_at, status } = item;
  if (status !== 'completed' || !completed_at || !due_date) return null;
  const formatD = (d: string) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
  const dateStr = (d: string) => new Date(d).toISOString().slice(0, 10);
  const completedDateStr = dateStr(completed_at);
  const endOk = completedDateStr <= due_date;
  if (start_date && started_at) {
    const startOk = dateStr(started_at) <= start_date;
    const inGraph = startOk && endOk;
    const tooltip = inGraph
      ? `В графике: старт и завершение в плановые сроки. План: ${formatD(start_date)} – ${formatD(due_date)}. Факт: ${formatD(started_at)} – ${formatD(completed_at)}.`
      : `Вне графика: фактические даты выходят за плановые. План: ${formatD(start_date)} – ${formatD(due_date)}. Факт: ${formatD(started_at)} – ${formatD(completed_at)}.`;
    return { inGraph, tooltip };
  }
  if (endOk) {
    const tooltip = `Завершение в срок (до ${formatD(due_date)}). Факт: ${formatD(completed_at)}.${!start_date ? ' Плановый старт не задан.' : ''}`;
    return { inGraph: true, tooltip };
  }
  const tooltip = `Вне графика: завершение позже срока. План: до ${formatD(due_date)}. Факт: ${formatD(completed_at)}.`;
  return { inGraph: false, tooltip };
}

/** Кнопки и таймер/подзадачи в строке списка (режим «Список»), дублируют детальное меню задачи. */
function TaskListRowActions({
  item,
  itemColumn,
  boardColumns,
  boardId,
  moveTaskMutation,
  completeTaskMutation,
}: {
  item: KanbanItem;
  /** Колонка, в которой сейчас задача (для логики «в работе» по position). */
  itemColumn?: Column;
  boardColumns: Column[];
  boardId: string | undefined;
  moveTaskMutation: { mutate: (v: { workitemId: number; targetColumnId: number; newOrder: number }) => void; isPending: boolean };
  completeTaskMutation: { mutate: (id: number) => void; isPending: boolean };
}) {
  const queryClient = useQueryClient();
  const workitemId = item.id;
  const colInProgress = boardColumns?.find((c) => c.system_type === 'in_progress');
  const colDone = boardColumns?.find((c) => c.system_type === 'done');
  const useMoveTask = !!boardId && !!colInProgress && !!colDone;
  const isInProgressByPosition = isTaskInProgressByPosition(itemColumn, colInProgress, colDone);
  const isInProgress = item.status === 'in_progress' || item.status === 'review' || isInProgressByPosition;
  const isCompleted = item.status === 'completed';

  const { data: timerData } = useQuery({
    queryKey: ['active-timer', workitemId],
    queryFn: () => timetrackingApi.getActiveTimerForTask(workitemId),
    enabled: !!workitemId,
  });
  const { data: summaryData } = useQuery({
    queryKey: ['time-summary', workitemId],
    queryFn: () => timetrackingApi.getSummary(workitemId),
    enabled: !!workitemId,
  });
  const isTimerRunning = timerData?.is_running ?? false;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!isTimerRunning) return;
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isTimerRunning]);
  const startTimerMutation = useMutation({
    mutationFn: (id: number) => timetrackingApi.startTimer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer', workitemId] });
      queryClient.invalidateQueries({ queryKey: ['time-summary', workitemId] });
    },
  });
  const stopTimerMutation = useMutation({
    mutationFn: () => timetrackingApi.stopTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer', workitemId] });
      queryClient.invalidateQueries({ queryKey: ['time-summary', workitemId] });
    },
  });
  const timerPending = startTimerMutation.isPending || stopTimerMutation.isPending;
  const totalDisplaySeconds = (summaryData?.total_minutes ?? 0) * 60 + elapsedSeconds;
  const pending = moveTaskMutation.isPending || completeTaskMutation.isPending || timerPending;

  const handleStart = () => {
    if (useMoveTask && colInProgress) moveTaskMutation.mutate({ workitemId: item.id, targetColumnId: colInProgress.id, newOrder: 0 });
  };
  const handleComplete = () => {
    if (useMoveTask && colDone) moveTaskMutation.mutate({ workitemId: item.id, targetColumnId: colDone.id, newOrder: 0 });
    else completeTaskMutation.mutate(item.id);
  };

  const canStart = item.status !== 'in_progress' && item.status !== 'review' && item.status !== 'completed' && item.status !== 'cancelled';
  const canComplete = item.status !== 'completed' && item.status !== 'cancelled';

  const timerColorClass = isCompleted
    ? 'text-blue-600 dark:text-blue-400'
    : isInProgress && !isTimerRunning
      ? 'text-red-600 dark:text-red-400'
      : 'text-slate-600 dark:text-slate-300';

  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {workitemId && (
        <span className={`text-xs font-mono tabular-nums shrink-0 ${timerColorClass}`} title={isCompleted ? 'Финишное время' : isInProgress && !isTimerRunning ? 'Таймер на паузе' : undefined}>
          {formatTimeSeconds(totalDisplaySeconds)}
        </span>
      )}
      {canStart && (
        <button type="button" onClick={handleStart} disabled={pending} className="px-1.5 py-0.5 text-[10px] bg-amber-500 text-slate-900 rounded hover:bg-amber-400 disabled:opacity-50 shrink-0" title="Старт">Старт</button>
      )}
      {workitemId && isInProgress && (
        <button type="button" onClick={() => isTimerRunning ? stopTimerMutation.mutate() : startTimerMutation.mutate(workitemId)} disabled={pending} className="px-1.5 py-0.5 text-[10px] bg-slate-500 text-white rounded hover:bg-slate-600 disabled:opacity-50 shrink-0" title={isTimerRunning ? 'Пауза' : 'Продолжить'}>{isTimerRunning ? 'Пауза' : 'Продолжить'}</button>
      )}
      {isCompleted && (
        <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 font-medium">ЗАВЕРШЕНА</span>
      )}
      {canComplete && (
        <button type="button" onClick={handleComplete} disabled={pending} className="px-1.5 py-0.5 text-[10px] bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 shrink-0" title="Готово">Готово</button>
      )}
    </div>
  );
}

const IMPERIAL_COLORS = [
  { name: 'Золото', hex: '#fbbf24' },
  { name: 'Синий', hex: '#3b82f6' },
  { name: 'Изумруд', hex: '#10b981' },
  { name: 'Пурпур', hex: '#8b5cf6' },
  { name: 'Багровый', hex: '#ef4444' },
];

function KanbanColumn({
  column,
  columns,
  items,
  onItemClick,
  onAddTask,
  onEditColumn,
  onDeleteColumn,
  deleteDisabledReason,
  onMoveTask,
  isMoveTaskPending,
  columnDragHandleProps,
}: {
  column: Column;
  columns: Column[];
  items: KanbanItem[];
  onItemClick: (item: KanbanItem) => void;
  onAddTask?: () => void;
  onEditColumn?: () => void;
  onDeleteColumn?: () => void;
  deleteDisabledReason?: string;
  onMoveTask?: (workitemId: number, targetColumnId: number, newOrder: number) => void;
  isMoveTaskPending?: boolean;
  /** Ручка перетаскивания колонки (для изменения порядка колонок) */
  columnDragHandleProps?: React.HTMLAttributes<HTMLDivElement> | null;
}) {
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const isSystemColumn = column.system_type && column.system_type !== 'other';
  const columnColor = column.color || '#fbbf24';
  const showDeleteButton = onDeleteColumn !== undefined || deleteDisabledReason !== undefined;

  return (
    <div className="flex-shrink-0 w-56">
      <div
        className="bg-white dark:bg-imperial-surface/80 rounded-lg shadow-lg border-4 transition-shadow hover:shadow-xl dark:border-white/10"
        style={{
          borderColor: columnColor,
          boxShadow: `0 0 24px -2px ${columnColor}60, 0 0 12px ${columnColor}50, 0 4px 6px -1px rgb(0 0 0 / 0.1)`,
        }}
      >
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {columnDragHandleProps && (
              <div
                {...columnDragHandleProps}
                className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 touch-none"
                title="Перетащите для изменения порядка колонок"
              >
                <span className="inline-block select-none" style={{ letterSpacing: '-0.2em' }}>⋮⋮</span>
              </div>
            )}
            {isSystemColumn && (
              <span className="text-amber-500 shrink-0" title="Системная колонка (порядок фиксирован)">
                🔒
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate">{column.name}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">{items.length} задач</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {onEditColumn && (
              <button onClick={onEditColumn} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-imperial-gold" title="Редактировать">
                ✏️
              </button>
            )}
            {showDeleteButton && (
              <button
                onClick={deleteDisabledReason ? undefined : onDeleteColumn}
                disabled={!!deleteDisabledReason}
                className={`p-1 ${deleteDisabledReason ? 'text-gray-400 cursor-not-allowed dark:text-slate-500' : 'text-gray-500 hover:text-red-600 dark:hover:text-red-400'}`}
                title={deleteDisabledReason ?? 'Удалить колонку'}
              >
                🗑️
              </button>
            )}
          </div>
        </div>
        <Droppable droppableId={String(column.id)} type="TASK">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`p-4 min-h-[400px] ${snapshot.isDraggingOver ? 'bg-primary-50 dark:bg-white/5' : 'bg-gray-50 dark:bg-white/5'}`}
            >
              {sortedItems.map((item, index) => (
                <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                  {(provided, snapshot) => {
                    const isCompletedColumn = column.column_type === 'completed';
                    const greenGlow = isCompletedColumn ? 'shadow-green-500/50 shadow-lg' : '';
                    const cardColor = item.color || columnColor;
                    return (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`bg-white dark:bg-imperial-surface rounded-lg shadow-sm mb-3 overflow-hidden transition-shadow flex items-start gap-0 cursor-grab active:cursor-grabbing border-4 border-transparent dark:border-white/5 ${snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'} ${greenGlow}`}
                        style={{
                          ...provided.draggableProps.style,
                          borderColor: cardColor,
                          boxShadow: snapshot.isDragging
                            ? `0 0 28px -2px ${cardColor}b0, 0 0 16px ${cardColor}80`
                            : `0 0 18px ${cardColor}55, 0 0 8px ${cardColor}40, 0 2px 4px rgb(0 0 0 / 0.06)`,
                        }}
                      >
                        {/* Контент задачи */}
                        <div className="flex-1 min-w-0 p-4 pt-3 pb-3">
                          <h4 className="font-medium text-sm text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-1 flex-wrap">
                            {(() => {
                              const schedule = getInScheduleStatus(item);
                              return schedule ? (
                                <span className="shrink-0 text-xs" title={schedule.tooltip}>
                                  {schedule.inGraph ? (
                                    <span className="text-green-600 dark:text-green-400">!!!</span>
                                  ) : (
                                    <span className="text-red-600 dark:text-red-400">??</span>
                                  )}
                                </span>
                              ) : null;
                            })()}
                            <span className="min-w-0 truncate">{item.title}</span>
                          </h4>
                          <div className="flex items-center gap-2 flex-nowrap min-w-0">
                            {item.priority && (
                              <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 leading-tight ${item.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200' :
                                item.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200' :
                                  item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-amber-900/40 dark:text-amber-200' :
                                    'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-slate-300'
                                }`}>
                                {item.priority === 'urgent' ? 'Срочно' :
                                  item.priority === 'high' ? 'Высокий' :
                                    item.priority === 'medium' ? 'Средний' : 'Низкий'}
                              </span>
                            )}
                            {item.due_date && (
                              <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate min-w-0">
                                {new Date(item.due_date).toLocaleDateString('ru-RU')}
                              </span>
                            )}
                            {item.cost != null && item.cost > 0 && (
                              <span className="text-[10px] text-green-600 dark:text-emerald-400 shrink-0">{item.cost} ₽</span>
                            )}
                          </div>
                          {/* Прогресс подзадач: сегменты по одной на подзадачу, закрашиваются по мере выполнения */}
                          {(item.checklist_stats?.total ?? 0) > 0 && (() => {
                            const total = item.checklist_stats?.total ?? 0;
                            const done = item.checklist_stats?.done ?? 0;
                            return (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 flex gap-0.5 min-w-0">
                                  {Array.from({ length: total }, (_, i) => (
                                    <div
                                      key={i}
                                      className={`flex-1 min-w-0 h-1.5 rounded-sm first:rounded-l last:rounded-r ${i < done
                                        ? 'bg-imperial-gold'
                                        : 'bg-gray-200 dark:bg-white/10'
                                        }`}
                                      title={i < done ? 'Выполнено' : 'Не выполнено'}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                                  {done}/{total}
                                </span>
                              </div>
                            );
                          })()}
                          {/* Mini-actions: Start / Finish */}
                          {onMoveTask && (
                            <div className="mt-2 flex flex-nowrap items-center gap-1">
                              {(column.system_type === 'plan' || item.status === 'todo') && (() => {
                                const colInProgress = columns.find((c) => c.system_type === 'in_progress');
                                return colInProgress ? (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMoveTask(item.id, colInProgress.id, 0);
                                    }}
                                    disabled={isMoveTaskPending}
                                    className="px-1.5 py-0.5 text-[10px] leading-tight rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 disabled:opacity-50"
                                    title="В работу"
                                  >
                                    ▶ Старт
                                  </button>
                                ) : null;
                              })()}
                              {column.system_type !== 'done' && item.status !== 'completed' && (() => {
                                const colDone = columns.find((c) => c.system_type === 'done');
                                return colDone ? (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMoveTask(item.id, colDone.id, 0);
                                    }}
                                    disabled={isMoveTaskPending}
                                    className="px-1.5 py-0.5 text-[10px] leading-tight rounded bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
                                    title="Завершить (все подзадачи будут отмечены)"
                                  >
                                    ✓ Готово
                                  </button>
                                ) : null;
                              })()}
                            </div>
                          )}
                        </div>
                        {/* Аватар исполнителя + кнопка открытия */}
                        <div className="flex items-center gap-1 pr-2 pt-2">
                          {item.executor_avatar && (
                            <img
                              src={item.executor_avatar}
                              alt=""
                              className="w-6 h-6 rounded-full"
                            />
                          )}
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              onItemClick(item);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/10 rounded cursor-pointer flex flex-col items-center justify-center gap-0.5"
                            title="Открыть задачу"
                            aria-label="Открыть задачу"
                          >
                            <span className="block w-1 h-1 rounded-full bg-current" />
                            <span className="block w-1 h-1 rounded-full bg-current" />
                            <span className="block w-1 h-1 rounded-full bg-current" />
                          </button>
                        </div>
                      </div>
                    );
                  }}
                </Draggable>
              ))}
              {onAddTask && (
                <button
                  onClick={onAddTask}
                  className="w-full py-2 mt-2 text-sm text-gray-500 dark:text-slate-400 border border-dashed border-gray-300 dark:border-white/20 rounded-lg hover:border-primary-400 hover:text-primary-600 dark:hover:text-imperial-gold"
                >
                  + Задача
                </button>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
}

function BoardCreateModal({
  projectId,
  projects,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  projectId: number;
  projects: { id: number; name: string }[];
  onClose: () => void;
  onSubmit: (name: string, project: number) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [project, setProject] = useState(projectId || (projects[0]?.id ?? 0));
  const valid = name.trim() && (projectId ? true : project > 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4">Создать спринт</h2>
        <div className="space-y-4">
          {!projectId && projects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Проект *</label>
              <select
                value={project}
                onChange={(e) => setProject(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Название спринта"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Отмена</button>
          <button
            disabled={!valid || isSubmitting}
            onClick={() => onSubmit(name.trim(), projectId || project)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}

function BoardEditModal({
  board,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  board: BoardFull;
  onClose: () => void;
  onSubmit: (name: string) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState(board.name);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-imperial-surface rounded-lg shadow-xl w-full max-w-md m-4 p-6 border border-slate-200 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-slate-100">Редактировать спринт</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-white/20 rounded-lg mb-4 bg-white dark:bg-white/5 text-gray-900 dark:text-slate-100 placeholder:text-gray-500 dark:placeholder:text-slate-400"
          placeholder="Название доски"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-white/10 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20">Отмена</button>
          <button
            disabled={!name.trim() || isSubmitting}
            onClick={() => onSubmit(name.trim())}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

const COLUMN_ZONES = [
  { label: 'До «В плане»', position: 500 },
  { label: 'Между «В плане» и «В работе»', position: 3000 },
  { label: 'Между «В работе» и «Завершено»', position: 7000 },
  { label: 'После «Завершено» (архив)', position: 9500 },
];

/** Кастомный выбор зоны: читаемый текст в выпадающем списке (нативный select даёт белый фон и невидимый текст). */
function ZoneSelect({
  value,
  options,
  onChange,
  className,
}: {
  value: number;
  options: { label: string; position: number }[];
  onChange: (index: number) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options[value];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between text-left ${className ?? ''}`}
      >
        <span>{selected?.label ?? '—'}</span>
        <span className="shrink-0 ml-2 text-slate-500 dark:text-slate-400">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul className="absolute z-20 mt-1 w-full py-1 rounded-lg border border-gray-200 dark:border-white/20 bg-white dark:bg-imperial-surface shadow-lg max-h-48 overflow-auto">
            {options.map((z, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => { onChange(i); setOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-sm text-slate-900 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-white/10 ${value === i ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : ''}`}
                >
                  {z.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function AddColumnModal({
  boardId: _boardId,
  columns: _columns,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  boardId: number;
  columns: Column[];
  onClose: () => void;
  onSubmit: (name: string, position: number) => void;
  isSubmitting: boolean;
}) {
  void _boardId;
  void _columns;
  const [name, setName] = useState('');
  const [zoneIndex, setZoneIndex] = useState(1);
  const position = COLUMN_ZONES[zoneIndex]?.position ?? 3000;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-imperial-surface rounded-xl shadow-xl w-full max-w-md m-4 p-6 border border-white/10" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Новая колонка</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Название</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
              placeholder="Название колонки"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Расположение</label>
            <ZoneSelect
              value={zoneIndex}
              options={COLUMN_ZONES}
              onChange={setZoneIndex}
              className="w-full px-3 py-2 border border-gray-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-white/10 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20">Отмена</button>
          <button
            disabled={!name.trim() || isSubmitting}
            onClick={() => onSubmit(name.trim(), position)}
            className="px-4 py-2 bg-imperial-gold text-imperial-bg rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}

function EditColumnModal({
  column,
  onClose,
  onSubmit,
  onDelete,
  deleteDisabledReason,
  isSubmitting,
}: {
  column: Column;
  onClose: () => void;
  onSubmit: (name: string, position: number, color?: string) => void;
  onDelete?: () => void;
  /** Сообщение, когда удалить нельзя (например, в колонке есть задачи) */
  deleteDisabledReason?: string;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState(column.name);
  const [position, setPosition] = useState(column.order);
  const [color, setColor] = useState(column.color || '#fbbf24');
  const isSystemColumn = column.system_type && column.system_type !== 'other';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-imperial-surface rounded-xl shadow-xl w-full max-w-md m-4 p-6 border border-white/10" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Редактировать колонку</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Название</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
            />
          </div>
          {!isSystemColumn && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Позиция</label>
              <input
                type="number"
                min={0}
                value={position}
                onChange={(e) => setPosition(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Цвет (Imperial Illumination)</label>
            <div className="flex flex-wrap gap-2">
              {IMPERIAL_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  onClick={() => setColor(c.hex)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${color === c.hex ? 'border-slate-900 dark:border-white ring-2 ring-offset-2 ring-offset-slate-100 dark:ring-offset-imperial-bg ring-slate-400' : 'border-transparent'}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100 text-sm font-mono"
              placeholder="#fbbf24"
            />
          </div>
        </div>
        <div className="flex justify-between mt-6">
          {onDelete ? (
            <button onClick={onDelete} className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">Удалить</button>
          ) : deleteDisabledReason ? (
            <span className="text-sm text-amber-600 dark:text-amber-400">{deleteDisabledReason}</span>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">Системную колонку нельзя удалить</span>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-white/10 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20">Отмена</button>
            <button
              disabled={!name.trim() || isSubmitting}
              onClick={() => onSubmit(name.trim(), position, color)}
              className="px-4 py-2 bg-imperial-gold text-imperial-bg rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Маппинг колонки канбана в статус задачи для предустановки при создании */
function columnSystemTypeToStatus(systemType?: string): WorkItem['status'] {
  if (systemType === 'plan') return 'todo';
  if (systemType === 'in_progress') return 'in_progress';
  if (systemType === 'done') return 'completed';
  return 'todo';
}

function AddTaskModal({
  boardId,
  columnId,
  columns,
  projectId,
  projects,
  workspaceId,
  onClose,
  onSubmit,
  isSubmitting,
  /** При открытии из колонки канбана («+ Задача») не показывать выбор спринта/колонки — задача создаётся в текущем спринте и колонке. */
  hideSprintColumnChoice = false,
}: {
  boardId: number;
  columnId: number;
  columns: Column[];
  projectId: number;
  projects: Project[] | { results?: Project[] };
  workspaceId?: number;
  onClose: () => void;
  onSubmit: (data: Partial<WorkItem>) => void;
  isSubmitting: boolean;
  hideSprintColumnChoice?: boolean;
}) {
  const [selectedSprintId, setSelectedSprintId] = useState<number | 'backlog'>(boardId);
  const [selectedColumnId, setSelectedColumnId] = useState<number>(columnId);

  const { data: boardsData } = useQuery({
    queryKey: ['kanban-boards', workspaceId, projectId],
    queryFn: () =>
      kanbanApi.getBoards({
        ...(workspaceId != null ? { workspace_id: Number(workspaceId) } : {}),
        project: projectId,
      }),
    enabled: projectId > 0,
  });
  const sprintBoards = boardsData?.results ?? [];

  const { data: selectedBoardFull } = useQuery({
    queryKey: ['kanban-board-full', selectedSprintId],
    queryFn: () => kanbanApi.getBoardFull(selectedSprintId as number),
    enabled: selectedSprintId !== 'backlog' && typeof selectedSprintId === 'number',
  });
  const selectedBoardColumns = selectedBoardFull?.columns ?? [];
  const sortedColumns = [...selectedBoardColumns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  useEffect(() => {
    if (selectedSprintId === 'backlog') return;
    if (sortedColumns.length > 0 && !sortedColumns.some((c) => c.id === selectedColumnId)) {
      setSelectedColumnId(sortedColumns[0].id);
    }
  }, [selectedSprintId, sortedColumns, selectedColumnId]);

  const column = columns.find((c) => c.id === columnId);
  const defaultStatus = columnSystemTypeToStatus(column?.system_type);

  const handleSubmit = (data: Partial<WorkItem>) => {
    const stage = hideSprintColumnChoice ? boardId : (selectedSprintId === 'backlog' ? null : selectedSprintId);
    const kanban_column = hideSprintColumnChoice ? columnId : (selectedSprintId === 'backlog' ? null : selectedColumnId);
    onSubmit({ ...data, stage, kanban_column });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4 p-6 border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-slate-100">Новая задача</h2>
        {!hideSprintColumnChoice && (
          <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400 shrink-0">Спринт:</label>
              <select
                value={selectedSprintId === 'backlog' ? 'backlog' : String(selectedSprintId)}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedSprintId(v === 'backlog' ? 'backlog' : Number(v));
                }}
                className="px-3 py-2 text-sm border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-w-[160px]"
              >
                <option value="backlog">Бэклог</option>
                {sprintBoards.map((b: { id: number; name: string }) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            {selectedSprintId !== 'backlog' && sortedColumns.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400 shrink-0">Колонка:</label>
                <select
                  value={selectedColumnId}
                  onChange={(e) => setSelectedColumnId(Number(e.target.value))}
                  className="px-3 py-2 text-sm border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-w-[160px]"
                >
                  {sortedColumns.map((c: { id: number; name: string }) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
        <TaskForm
          projects={projects}
          defaultProjectId={projectId}
          defaultColumnId={selectedSprintId === 'backlog' ? undefined : selectedColumnId}
          defaultStatus={defaultStatus}
          onSubmit={handleSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
          submitLabel="Создать"
        />
      </div>
    </div>
  );
}

/** Колонки доски (для Старт/Готово через moveTask — как на карточке). */
type BoardColumn = { id: number; system_type?: string };

/** Полноценная модалка задачи в Этапе: Детали (TaskForm), Файлы, Записки, Комментарии. Экспорт для использования на странице Ганта. */
export function TaskDetailModal({
  item,
  boardId,
  columns: boardColumns,
  projectId,
  projects,
  workspaceId,
  onClose,
  activeTab,
  onTabChange,
  onTaskUpdate,
  onDeleteTask,
}: {
  item: KanbanItem;
  boardId?: number;
  /** Колонки доски — если есть, Старт/Готово работают через moveTask (как на карточке). */
  columns?: BoardColumn[];
  projectId: number;
  projects: Project[] | { results?: Project[] };
  /** ID текущего пространства — для создания записки без проекта (из вкладки «Записки»). */
  workspaceId?: number;
  onClose: () => void;
  activeTab: 'details' | 'subtasks' | 'files' | 'wiki' | 'comments';
  onTabChange: (tab: 'details' | 'subtasks' | 'files' | 'wiki' | 'comments') => void;
  onTaskUpdate?: (data: Partial<KanbanItem> & Partial<WorkItem>) => void;
  onDeleteTask?: () => void;
}) {
  const projectList = Array.isArray(projects) ? projects : (projects.results ?? []);
  const queryClient = useQueryClient();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [attachNoteOpen, setAttachNoteOpen] = useState(false);
  const colInProgress = boardColumns?.find((c) => c.system_type === 'in_progress');
  const colDone = boardColumns?.find((c) => c.system_type === 'done');
  const useMoveTask = !!boardId && !!colInProgress && !!colDone;

  const moveTaskMutation = useMutation({
    mutationFn: ({ workitemId, targetColumnId, newOrder }: { workitemId: number; targetColumnId: number; newOrder: number }) =>
      kanbanApi.moveTask(workitemId, targetColumnId, newOrder),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task', data.id] });
      if (boardId != null) queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
      queryClient.invalidateQueries({ queryKey: ['gantt-project'] });
      toast.success('Задача обновлена');
      onClose();
    },
    onError: () => toast.error('Ошибка при обновлении задачи'),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => todoApi.completeTask(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task', data.id] });
      if (boardId != null) queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
      queryClient.invalidateQueries({ queryKey: ['gantt-project'] });
      toast.success('Задача завершена');
      onClose();
    },
    onError: () => toast.error('Ошибка при завершении задачи'),
  });
  const { data: fullTask, isLoading: taskLoading } = useQuery({
    queryKey: ['task', item.id],
    queryFn: () => todoApi.getTask(item.id),
    enabled: !!item.id,
    refetchOnMount: 'always',
  });

  const { data: boardsData } = useQuery({
    queryKey: ['kanban-boards', workspaceId, projectId],
    queryFn: () =>
      kanbanApi.getBoards({
        ...(workspaceId != null ? { workspace_id: Number(workspaceId) } : {}),
        project: projectId,
      }),
    enabled: projectId > 0,
  });
  const sprintBoards = boardsData?.results ?? [];

  const moveToSprintMutation = useMutation({
    mutationFn: async (sprintId: number | null) => {
      if (sprintId === null) {
        await todoApi.updateTask(item.id, { stage: null, kanban_column: null });
        return { sprintId: null, previousBoardId: fullTask?.stage ?? undefined };
      }
      const boardFull = await kanbanApi.getBoardFull(sprintId);
      const cols = [...(boardFull.columns || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const firstCol = cols[0];
      if (!firstCol) throw new Error('В спринте нет колонок');
      await todoApi.updateTask(item.id, { stage: sprintId, kanban_column: firstCol.id });
      return { sprintId, previousBoardId: fullTask?.stage ?? undefined };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task', item.id] });
      if (boardId != null) queryClient.invalidateQueries({ queryKey: ['kanban-board-full', boardId] });
      if (data.sprintId != null) queryClient.invalidateQueries({ queryKey: ['kanban-board-full', data.sprintId] });
      if (data.previousBoardId != null) queryClient.invalidateQueries({ queryKey: ['kanban-board-full', data.previousBoardId] });
      queryClient.invalidateQueries({ queryKey: ['gantt-project'] });
      toast.success(data.sprintId == null ? 'Задача перенесена в бэклог' : 'Задача перенесена в спринт');
    },
    onError: () => toast.error('Ошибка при переносе в спринт'),
  });

  const { data: wikiResponse } = useQuery({
    queryKey: ['wiki-pages', 'workitem', item.id],
    queryFn: () => documentsApi.getWikiPages({ workitem_id: item.id }),
    enabled: activeTab === 'wiki' && !!item.id,
  });
  const wikiPages = wikiResponse?.results ?? [];
  const currentColor = item.color || fullTask?.color || '#fbbf24';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-imperial-surface rounded-lg shadow-xl w-full max-w-lg h-[90vh] flex flex-col border-4 border-transparent dark:border-white/10" style={{ borderColor: currentColor }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 truncate pr-4">{item.title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {onTaskUpdate && (
              <div className="relative">
                <button
                  onClick={() => setColorPickerOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg"
                  title="Изменить цвет"
                >
                  <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-white/30 shrink-0" style={{ backgroundColor: currentColor }} />
                  <span className="hidden sm:inline">Цвет</span>
                </button>
                {colorPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-[5]" onClick={() => setColorPickerOpen(false)} aria-hidden />
                    <div className="absolute right-0 top-full mt-1 p-2 bg-white dark:bg-imperial-surface border border-slate-200 dark:border-white/10 rounded-lg shadow-lg z-10 flex gap-1.5 flex-wrap min-w-[180px]">
                      {IMPERIAL_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => {
                            onTaskUpdate({ color: c.hex });
                            setColorPickerOpen(false);
                          }}
                          className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c.hex,
                            borderColor: currentColor === c.hex ? '#3b82f6' : 'transparent',
                            boxShadow: currentColor === c.hex ? `0 0 12px ${c.hex}80` : undefined,
                          }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {onDeleteTask && (
              <button onClick={onDeleteTask} className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Удалить задачу">
                Удалить
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">✕</button>
          </div>
        </div>

        {/* Спринт: перенести задачу в другой спринт или бэклог */}
        {onTaskUpdate && projectId > 0 && (
          <div className="px-4 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Спринт:</span>
            <select
              value={fullTask?.stage != null ? String(fullTask.stage) : 'backlog'}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'backlog') {
                  if (fullTask?.stage != null) moveToSprintMutation.mutate(null);
                } else {
                  const id = Number(v);
                  if (!Number.isNaN(id) && fullTask?.stage !== id) moveToSprintMutation.mutate(id);
                }
              }}
              disabled={moveToSprintMutation.isPending}
              className="px-3 py-2 text-sm border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-w-[160px]"
              title="Переместить в спринт"
            >
              <option value="backlog">Бэклог</option>
              {sprintBoards.map((b: { id: number; name: string }) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {moveToSprintMutation.isPending && <span className="text-xs text-slate-500">Сохранение…</span>}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-white/10 overflow-x-auto">
          {(['details', 'subtasks', 'files', 'wiki', 'comments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                ? 'border-primary-600 text-primary-600 dark:text-imperial-gold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
            >
              {tab === 'details' ? 'Детали' : tab === 'subtasks' ? 'Подзадачи' : tab === 'files' ? 'Файлы' : tab === 'wiki' ? 'Записки' : 'Комментарии'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'details' && (
            <>
              {taskLoading ? (
                <p className="text-gray-500 dark:text-slate-400">Загрузка…</p>
              ) : fullTask && onTaskUpdate ? (
                <TaskForm
                  task={fullTask}
                  projects={projects}
                  onSubmit={(data) => onTaskUpdate(data)}
                  onStart={
                    useMoveTask && colInProgress
                      ? () => moveTaskMutation.mutate({ workitemId: item.id, targetColumnId: colInProgress.id, newOrder: 0 })
                      : onTaskUpdate
                        ? () => onTaskUpdate({ status: 'in_progress' })
                        : undefined
                  }
                  onComplete={
                    useMoveTask && colDone
                      ? () => moveTaskMutation.mutate({ workitemId: item.id, targetColumnId: colDone.id, newOrder: 0 })
                      : () => completeMutation.mutate(item.id)
                  }
                  isSubmitting={moveTaskMutation.isPending || completeMutation.isPending}
                  submitLabel="Сохранить"
                  invalidateKeys={
                    boardId != null
                      ? [['task', item.id], ['kanban-board-full', boardId]]
                      : [['task', item.id]]
                  }
                />
              ) : (
                <p className="text-gray-500 dark:text-slate-400">Не удалось загрузить задачу</p>
              )}
            </>
          )}

          {activeTab === 'subtasks' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Управляйте подзадачами (чек-лист). Отмечайте выполненные и добавляйте новые.
              </p>
              {taskLoading ? (
                <p className="text-gray-500 dark:text-slate-400">Загрузка…</p>
              ) : (
                <ChecklistBlock
                  workitemId={item.id}
                  items={fullTask?.checklist ?? []}
                  checklistStats={fullTask?.checklist_stats}
                  invalidateKeys={
                    boardId != null
                      ? [['task', item.id], ['kanban-board-full', boardId]]
                      : [['task', item.id]]
                  }
                />
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <FileList entityType="workitem" entityId={item.id} showUploader={true} />
          )}

          {activeTab === 'wiki' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Записки, привязанные к этой задаче или созданные из неё. Создайте новую или привяжите существующую.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCreateNoteOpen(true)}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
                >
                  Создать записку
                </button>
                {projectId > 0 && (
                  <button
                    type="button"
                    onClick={() => setAttachNoteOpen(true)}
                    className="px-3 py-2 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-white/20 text-sm font-medium"
                  >
                    Прикрепить существующую
                  </button>
                )}
              </div>
              <CreateNoteModal
                isOpen={createNoteOpen}
                onClose={() => setCreateNoteOpen(false)}
                workspaceId={workspaceId}
                defaultProjectId={projectId > 0 ? projectId : null}
                defaultWorkitemId={item.id}
                projects={projectList.map((p: Project) => ({ id: p.id, name: p.name }))}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['wiki-pages', 'workitem', item.id] });
                }}
              />
              {projectId > 0 && (
                <AttachNoteModal
                  isOpen={attachNoteOpen}
                  onClose={() => setAttachNoteOpen(false)}
                  workitemId={item.id}
                  projectId={projectId}
                  onAttached={() => {
                    queryClient.invalidateQueries({ queryKey: ['wiki-pages', 'workitem', item.id] });
                  }}
                />
              )}
              {wikiPages.length > 0 ? (
                <ul className="divide-y divide-slate-200 dark:divide-white/10">
                  {wikiPages.map((wp: { id: number; title?: string; project?: number | null }) => (
                    <li key={wp.id} className="py-2">
                      <Link
                        to={`/documents/notebook/${wp.id}`}
                        className="text-primary-600 dark:text-imperial-gold hover:underline"
                      >
                        {wp.title || `Запись #${wp.id}`}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-slate-400">Нет связанных записок</p>
              )}
              <Link
                to={`/notes?workitem_id=${item.id}&project_id=${projectId}`}
                className="inline-block px-4 py-2 bg-primary-100 dark:bg-white/10 text-primary-700 dark:text-slate-200 rounded-lg hover:bg-primary-200 dark:hover:bg-white/20 text-sm"
              >
                Все записки проекта →
              </Link>
            </div>
          )}

          {activeTab === 'comments' && (
            <CommentThread entityType="workitem" entityId={item.id} />
          )}
        </div>
      </div>
    </div>
  );
}
