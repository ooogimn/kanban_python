import { useState, useEffect, useRef } from 'react';
import { Workspace } from '../types';
import { useNetworkStatus } from './NetworkStatus';

export interface WorkspaceFormValues {
  name: string;
  description: string;
}

const defaultValues: WorkspaceFormValues = {
  name: '',
  description: '',
};

interface WorkspaceFormProps {
  workspace?: Workspace | null;
  onSubmit: (data: Partial<Workspace> & { name: string }, logoFile?: File) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export default function WorkspaceForm({
  workspace,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Сохранить',
}: WorkspaceFormProps) {
  const isOffline = useNetworkStatus();
  const [values, setValues] = useState<WorkspaceFormValues>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof WorkspaceFormValues, string>>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (workspace) {
      setValues({
        name: workspace.name,
        description: workspace.description || '',
      });
    } else {
      setValues(defaultValues);
    }
  }, [workspace]);

  const validate = (): boolean => {
    const next: Partial<Record<keyof WorkspaceFormValues, string>> = {};
    if (!values.name.trim()) next.name = 'Обязательное поле';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: Partial<Workspace> & { name: string } = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
    };
    onSubmit(payload, logoFile ?? undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Логотип пространства — покрупнее для наглядности */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Логотип пространства</label>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden flex items-center justify-center shrink-0">
            {workspace?.logo_url ? (
              <img src={workspace.logo_url} alt="" className="w-full h-full object-cover" />
            ) : logoFile ? (
              <img src={URL.createObjectURL(logoFile)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl text-slate-400">📁</span>
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
              {workspace?.logo_url || logoFile ? 'Заменить' : 'Загрузить'}
            </button>
            {logoFile && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">{logoFile.name}</p>
            )}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">JPEG, PNG, GIF или WebP, до 5 МБ</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Название пространства *
        </label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Например: ООО Компания, Отдел разработки"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        <p className="mt-1 text-xs text-gray-500">
          Это может быть организация, подразделение или область, которая объединяет проекты
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
        <textarea
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Описание пространства"
        />
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
