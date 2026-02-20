import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNetworkStatus } from './NetworkStatus';
import { Project } from '../types';
import { workspaceApi } from '../api/workspace';

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Планирование' },
  { value: 'active', label: 'Активный' },
  { value: 'on_hold', label: 'На паузе' },
  { value: 'completed', label: 'Завершён' },
  { value: 'archived', label: 'В архиве' },
] as const;

export interface ProjectFormValues {
  name: string;
  description: string;
  status: string;
  workspace: number;
  start_date: string;
  end_date: string;
  budget: string;
}

const defaultValues: ProjectFormValues = {
  name: '',
  description: '',
  status: 'active',
  workspace: 0,
  start_date: '',
  end_date: '',
  budget: '',
};

interface ProjectFormProps {
  project?: Project | null;
  workspaceId?: number;
  onSubmit: (data: Partial<Project> & { name: string; status: string }, logoFile?: File) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export default function ProjectForm({
  project,
  workspaceId,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Сохранить',
}: ProjectFormProps) {
  const isOffline = useNetworkStatus();
  const [values, setValues] = useState<ProjectFormValues>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormValues, string>>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceApi.getWorkspaces(),
  });

  const workspaces = workspacesData?.results ?? [];

  useEffect(() => {
    if (project) {
      setValues({
        name: project.name,
        description: project.description || '',
        status: project.status,
        workspace: project.workspace,
        start_date: project.start_date ? project.start_date.slice(0, 10) : '',
        end_date: project.end_date ? project.end_date.slice(0, 10) : '',
        budget: project.budget ? String(project.budget) : '',
      });
    } else {
      setValues({
        ...defaultValues,
        // Если есть workspaceId, используем его, иначе первый доступный workspace
        workspace: workspaceId || (workspaces[0]?.id ?? 0),
      });
    }
  }, [project, workspaceId, workspaces]);

  const validate = (): boolean => {
    const next: Partial<Record<keyof ProjectFormValues, string>> = {};
    if (!values.name.trim()) next.name = 'Обязательное поле';
    if (!project && !values.workspace) next.workspace = 'Выберите пространство';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: Partial<Project> & { name: string; status: string } = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      status: values.status as Project['status'],
      start_date: values.start_date || undefined,
      end_date: values.end_date || undefined,
      budget: values.budget ? parseFloat(values.budget) : undefined,
    };
    if (!project) {
      (payload as Partial<Project>).workspace = values.workspace || workspaceId;
    }
    onSubmit(payload, logoFile ?? undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Логотип / аватар проекта */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Логотип проекта</label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden flex items-center justify-center shrink-0">
            {project?.logo_url ? (
              <img src={project.logo_url} alt="" className="w-full h-full object-cover" />
            ) : logoFile ? (
              <img src={URL.createObjectURL(logoFile)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl text-slate-400">📁</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              {project?.logo_url || logoFile ? 'Заменить' : 'Загрузить'}
            </button>
            {logoFile && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">{logoFile.name}</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Название *</label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Название проекта"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      {!project && workspaces.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Пространство *</label>
          <select
            value={values.workspace}
            onChange={(e) => setValues((v) => ({ ...v, workspace: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value={0}>Выберите пространство</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
          {errors.workspace && <p className="mt-1 text-sm text-red-600">{errors.workspace}</p>}
          <p className="mt-1 text-xs text-gray-500">
            Пространство объединяет проекты и всё что внутри
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
        <textarea
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Описание проекта"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
        <select
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
          <input
            type="date"
            value={values.start_date}
            onChange={(e) => setValues((v) => ({ ...v, start_date: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания</label>
          <input
            type="date"
            value={values.end_date}
            onChange={(e) => setValues((v) => ({ ...v, end_date: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Бюджет проекта</label>
        <div className="relative">
          <input
            type="number"
            value={values.budget}
            onChange={(e) => setValues((v) => ({ ...v, budget: e.target.value }))}
            min="0"
            step="1000"
            className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="0"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 text-sm">
            ₽
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          Общий бюджет для отслеживания расходов
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Отмена
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || isOffline}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Сохранение…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
