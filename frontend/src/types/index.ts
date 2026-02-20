// User types
export type PlanType = 'personal' | 'business';

export interface User {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  telegram_id?: number;
  telegram_username?: string;
  timezone?: string;
  avatar?: string | null;
  date_joined?: string;
  /** Группы RBAC: Director, Manager, Employee */
  groups?: string[];
  /** Прошёл ли онбординг (из login/register/me) */
  is_onboarded?: boolean;
  /** Freemium: personal | business */
  plan_type?: PlanType;
  /** Показывать рекламу в сайдбаре (только при plan_type === 'personal') */
  show_ads?: boolean;
  /** Личное пространство (для личного аккаунта — одно, создаётся автоматически) */
  personal_workspace_id?: number | null;
  /** Личный проект в личном пространстве */
  personal_project_id?: number | null;
}

/** Данные профиля для GET/PATCH /auth/me/ */
export interface UserProfile extends User {
  timezone: string;
  date_joined?: string;
  /** Суперпользователь — доступ в /saas-admin */
  is_superuser?: boolean;
  /** Прошёл ли онбординг (workspace + первый ИИ) */
  is_onboarded?: boolean;
  plan_type?: PlanType;
  show_ads?: boolean;
}

export interface UserProfileUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  timezone?: string;
  telegram_username?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Workspace types
export interface Workspace {
  id: number;
  name: string;
  slug: string;
  description?: string;
  /** URL логотипа пространства (с бэкенда приходит logo_url) */
  logo_url?: string | null;
  settings?: Record<string, unknown>;
  projects_count?: number;
  members_count?: number;
  user_role?: 'owner' | 'admin' | 'member' | 'viewer';
  /** Прогресс пространства 0–100 (среднее по проектам), SPRINT 1 */
  progress?: number;
  /** on_track | behind, SPRINT 1 */
  health_status?: string;
  created_at: string;
  updated_at: string;
}

/** Вложенный контакт в участнике проекта (HR-SPRINT 3). */
export interface ProjectMemberContact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  user: number | null;
  avatar_url: string | null;
}

/** Участник проекта (в т.ч. теневой — без привязки к User). */
export interface ProjectMember {
  id: number;
  display_name: string;
  role: string;
  avatar_url?: string | null;
  /** Для записи (создание теневого): project_id обязателен. */
  project?: number;
  hourly_rate?: number | null;
  /** HR: вложенный контакт при наличии связи. */
  contact?: ProjectMemberContact | null;
}

// Project types
export interface Project {
  id: number;
  name: string;
  description?: string;
  status: 'active' | 'on_hold' | 'completed' | 'cancelled' | 'planning' | 'archived';
  workspace: number;
  owner: number;
  start_date?: string;
  end_date?: string;
  /** Общий бюджет проекта */
  budget?: number | null;
  /** Израсходованный бюджет */
  budget_spent?: number | null;
  /** URL логотипа/аватара проекта (с бэкенда приходит logo_url) */
  logo_url?: string | null;
  /** Прогресс 0–100 (с бэкенда). */
  progress?: number;
  /** Здоровье: on_track | behind */
  health_status?: 'on_track' | 'behind';
  /** Участники проекта (в т.ч. теневые). */
  members?: ProjectMember[];
  created_at: string;
  updated_at: string;
}

// Источник задачи (запись/комментарий)
export interface TaskSourceDetails {
  type: 'wikipage' | 'comment';
  id: number;
  url: string | null;
  label: string;
}

// WorkItem types
export interface WorkItem {
  id: number;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  project: number;
  created_by: number;
  /** @deprecated Предпочтительно responsible (ProjectMember). */
  assigned_to: number[];
  /** Ответственный (участник проекта, в т.ч. теневой). */
  responsible?: ProjectMember | null;
  /** Для записи (create/update): id участника проекта. */
  responsible_id?: number | null;
  dependencies?: number[];
  due_date?: string;
  start_date?: string;
  completed_at?: string;
  progress: number;
  estimated_hours?: number;
  actual_hours?: number;
  // Kanban fields
  kanban_column?: number | null;
  sort_order?: number;
  stage?: number | null;
  // Finance fields
  cost?: number | null;
  price?: number | null;
  is_billable?: boolean;
  // Meta
  created_at: string;
  updated_at: string;
  source_type?: string | null;
  source_id?: number | null;
  source_details?: TaskSourceDetails | null;
  /** Hex цвет карточки (Imperial Illumination) */
  color?: string | null;
  /** Подзадачи (чек-лист). */
  checklist?: ChecklistItem[];
  /** Статистика чек-листа: { total, done }. */
  checklist_stats?: { total: number; done: number };
}

/** Подзадача (чек-лист) для WorkItem. */
export interface ChecklistItem {
  id: number;
  workitem: number;
  title: string;
  is_done: boolean;
  sort_order: number;
}

// Kanban types
export interface Board {
  id: number;
  name: string;
  project: number;
  project_name?: string;
  is_default?: boolean;
  columns?: Column[];
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: number;
  name: string;
  order: number;           // position на бэкенде
  project?: number;
  wip_limit?: number | null;
  column_type?: string;
  /** plan | in_progress | done | other — системные колонки нельзя удалять */
  system_type?: 'plan' | 'in_progress' | 'done' | 'other';
  /** Hex цвет колонки (Imperial Illumination) */
  color?: string;
  items?: KanbanItem[];    // WorkItem на канбане
}

/** Краткое представление WorkItem для канбана (из WorkItemShortSerializer) */
export interface KanbanItem {
  id: number;
  title: string;
  cost?: number | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string | null;
  start_date?: string | null;
  /** Фактическое время завершения (для индикатора «в графике») */
  completed_at?: string | null;
  /** Фактическое время первого перевода в «В работе» */
  started_at?: string | null;
  status?: string;
  sort_order: number;
  /** Hex цвет карточки (Imperial Illumination) */
  color?: string | null;
  executor_avatar?: string | null;
  /** Имя ответственного (для экспорта в Excel) */
  responsible_name?: string | null;
  /** Статистика подзадач для прогресс-бара на карточке */
  checklist_stats?: { total: number; done: number };
}

/** @deprecated Модель Card удалена. Используйте KanbanItem */
export interface Card {
  id: number;
  title: string;
  description?: string;
  column: number;
  position: number;
  priority?: string;
  assigned_to?: number[] | User[];
  due_date?: string;
  created_at?: string;
  updated_at?: string;
}

// Calendar types (API использует start_date/end_date)
export interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  start?: string;
  end?: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  owner?: number;
  work_item?: number;
  related_workitem?: number | null;
  location?: string;
  created_at?: string;
  updated_at?: string;
}

// Gantt types
export interface GanttTask {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  progress: number;
  /** Hex цвет из Imperial Palette */
  color?: string;
  related_workitem: number | null;
  related_workitem_title?: string;
  parent: number | null;
  parent_name?: string;
  children?: GanttTask[];
  dependencies?: GanttDependency[];
  created_at: string;
  updated_at: string;
}

export interface GanttDependency {
  id: number;
  predecessor: number;
  predecessor_name?: string;
  successor: number;
  successor_name?: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number;
  created_at: string;
}

export interface GanttProjectData {
  project_id: number;
  project_name: string;
  tasks: GanttTask[];
  dependencies: GanttDependency[];
}

// Analytics types
export interface DashboardStats {
  total_tasks: number;
  active_tasks?: number;
  in_progress_tasks?: number;
  completed_tasks: number;
  overdue_tasks: number;
  upcoming_events?: number;
  active_projects: number;
  completed_projects?: number;
  completion_rate?: number;
}

/** Сводка главного дашборда (GET /analytics/dashboard/overview/) */
export interface DashboardOverview {
  tasks_count: number;
  tasks_today: number;
  active_projects_count: number;
  total_budget_spent: string;
  today_events_count: number;
  hours_today: number;
  recent_tasks: DashboardRecentTask[];
  active_timer: DashboardActiveTimer | null;
}

/** Данные для графиков дашборда (GET /core/dashboard-stats/) */
export interface DashboardChartsData {
  finance_flow: Array<{ month: string; income: number; expense: number }>;
  project_hours: Array<{ name: string; hours: number }>;
  team_load: Array<{ name: string; value: number }>;
}

export interface DashboardRecentTask {
  id: number;
  title: string;
  status: string;
  priority?: string;
  due_date: string | null;
  project_id: number | null;
  project_name: string | null;
}

export interface DashboardActiveTimer {
  id: number;
  workitem_id: number;
  workitem_title: string;
  started_at: string;
  elapsed_seconds: number;
}

export interface ProjectMetrics {
  project_id: number;
  project_name?: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks?: number;
  wip?: number;
  completion_rate?: number;
  progress_percent?: number;
  avg_lead_time_days?: number;
  throughput_30_days?: number;
  average_completion_time?: number;
}

// Activity / Audit log types
export interface ActivityLog {
  id: number;
  action: 'create' | 'update' | 'delete';
  action_display: string;
  model_name: string;
  object_id: number;
  target_display?: string;
  user: number | null;
  user_display: string;
  changes: Record<string, unknown>;
  timestamp: string;
}

// API Response types
export interface ApiResponse<T> {
  count?: number;
  next?: string;
  previous?: string;
  results: T[];
}

export interface ApiError {
  detail?: string;
  error?: string;
  [key: string]: any;
}

// Documents types
export interface Attachment {
  id: number;
  filename: string;
  file: string;
  file_url?: string;
  size: number;
  mime_type: string;
  file_type: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';
  project?: number;
  project_name?: string;
  is_public: boolean;
  uploaded_by: User;
  created_at: string;
  preview_url?: string;
  can_preview: boolean;
  google_preview_url?: string;
  content_object_type?: string;
  content_object_id?: number;
}

export interface Comment {
  id: number;
  content: string;
  author: User;
  parent?: number;
  replies_count?: number;
  replies?: Comment[];
  is_edited: boolean;
  edited_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WikiPage {
  id: number;
  title: string;
  content: string;
  slug: string;
  workspace?: number | null;
  project?: number | null;
  project_name?: string | null;
  workitem?: number | null;
  parent?: number;
  parent_title?: string;
  author: User;
  is_published: boolean;
  order: number;
  children_count?: number;
  attachments_count?: number;
  tags?: string[];
  tag_ids?: number[];
  created_at: string;
  updated_at: string;
  color?: string | null;
  full_path?: string;
  children?: WikiPage[];
}
