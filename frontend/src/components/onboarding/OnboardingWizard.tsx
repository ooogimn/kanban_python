import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { workspaceApi } from '../../api/workspace';
import { aiApi } from '../../api/ai';
import toast from 'react-hot-toast';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: 'Приветствие' },
  { id: 2, title: 'Рабочее пространство' },
  { id: 3, title: 'Первый ИИ-помощник' },
  { id: 4, title: 'Готово' },
];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceApi.getWorkspaces(),
  });
  const workspaces = Array.isArray(workspacesData?.results) ? workspacesData.results : (workspacesData as { results?: unknown[] })?.results ?? [];
  const hasWorkspace = workspaces.length > 0;
  const currentWorkspaceId = hasWorkspace ? (workspaces[0] as { id: number }).id : null;

  const { data: workspaceCurrent } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
    enabled: hasWorkspace,
  });
  const activeWorkspaceId = workspaceCurrent?.id ?? currentWorkspaceId ?? 0;

  const { data: marketplace = [] } = useQuery({
    queryKey: ['ai-marketplace'],
    queryFn: () => aiApi.getMarketplace(),
  });
  const assistantAgent = marketplace.find((a) => a.role === 'assistant' || a.name?.includes('Помощник'));

  const { data: hiredAgents = [] } = useQuery({
    queryKey: ['ai-workspace-agents', activeWorkspaceId],
    queryFn: () => aiApi.getWorkspaceAgents(activeWorkspaceId),
    enabled: activeWorkspaceId > 0,
  });
  const hasAssistant = hiredAgents.some((wa) => wa.agent?.role === 'assistant' || wa.agent?.name?.includes('Помощник'));

  const createWorkspaceMutation = useMutation({
    mutationFn: (name: string) => workspaceApi.createWorkspace({ name, slug: name.toLowerCase().replace(/\s+/g, '-').slice(0, 50) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-current'] });
      setStep(3);
      toast.success('Рабочее пространство создано');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка создания'),
  });

  const hireAgentMutation = useMutation({
    mutationFn: ({ workspaceId, agentId }: { workspaceId: number; agentId: number }) => aiApi.hireAgent(workspaceId, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-workspace-agents'] });
      setStep(4);
      toast.success('ИИ-помощник нанят');
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('LIMIT') || msg.includes('лимит')) {
        toast.error('На бесплатном тарифе лимит ИИ-агентов. Можно нанять позже в маркетплейсе.');
        setStep(4);
      } else {
        toast.error(msg);
      }
    },
  });

  const finishMutation = useMutation({
    mutationFn: () => authApi.finishOnboarding(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onComplete();
      navigate('/dashboard', { replace: true });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  });

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleCreateWorkspace = () => {
    const name = workspaceName.trim() || 'Моя команда';
    createWorkspaceMutation.mutate(name);
  };

  const handleHireAssistant = () => {
    if (!assistantAgent || activeWorkspaceId <= 0) return;
    hireAgentMutation.mutate({ workspaceId: activeWorkspaceId, agentId: assistantAgent.id });
  };

  const handleFinish = () => {
    finishMutation.mutate();
  };

  const handleSkip = () => {
    finishMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-imperial-surface/95 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="flex gap-2 mb-4">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`h-1 flex-1 rounded-full ${step >= s.id ? 'bg-imperial-gold' : 'bg-white/20'}`}
              />
            ))}
          </div>
          <h2 className="text-xl font-bold text-white">{STEPS[step - 1].title}</h2>
        </div>
        <div className="p-6 min-h-[200px]">
          {step === 1 && (
            <>
              <p className="text-imperial-muted mb-6">
                Это операционная система для бизнеса с ИИ-штатом: проекты, задачи, HR, финансы и ИИ-сотрудники в одной платформе. За пару шагов создадим рабочее пространство и добавим первого ИИ-помощника.
              </p>
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-3 rounded-xl bg-imperial-gold text-imperial-bg font-semibold hover:bg-amber-500 transition-colors"
              >
                Далее
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {!hasWorkspace ? (
                <>
                  <p className="text-imperial-muted mb-4">Создайте первое рабочее пространство (компания или команда).</p>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Название компании / команды"
                    className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/5 text-white placeholder:text-imperial-muted mb-4"
                  />
                  <button
                    type="button"
                    onClick={handleCreateWorkspace}
                    disabled={createWorkspaceMutation.isPending}
                    className="w-full py-3 rounded-xl bg-imperial-gold text-imperial-bg font-semibold hover:bg-amber-500 transition-colors disabled:opacity-50"
                  >
                    {createWorkspaceMutation.isPending ? 'Создание…' : 'Создать workspace'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-imperial-muted mb-4">У вас уже есть рабочее пространство. Продолжаем к добавлению ИИ-помощника.</p>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full py-3 rounded-xl bg-imperial-gold text-imperial-bg font-semibold hover:bg-amber-500 transition-colors"
                  >
                    Продолжить
                  </button>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-imperial-muted mb-4">
                Нанимая ИИ-помощника, вы сразу получаете цифрового сотрудника для вопросов и сводок.
              </p>
              {!assistantAgent ? (
                <p className="text-imperial-muted text-sm mb-4">ИИ-помощник не найден в каталоге. Пропустите шаг и найдите его позже в маркетплейсе.</p>
              ) : hasAssistant ? (
                <p className="text-imperial-muted text-sm mb-4">ИИ-помощник уже в команде.</p>
              ) : (
                <button
                  type="button"
                  onClick={handleHireAssistant}
                  disabled={hireAgentMutation.isPending || activeWorkspaceId <= 0}
                  className="w-full py-3 rounded-xl bg-imperial-gold text-imperial-bg font-semibold hover:bg-amber-500 transition-colors disabled:opacity-50 mb-4"
                >
                  {hireAgentMutation.isPending ? 'Найм…' : 'Нанять ИИ-помощника'}
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-3 rounded-xl border border-white/30 text-white font-medium hover:bg-white/10 transition-colors"
              >
                {hasAssistant || !assistantAgent ? 'Далее' : 'Пропустить'}
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-imperial-muted mb-6">
                Готово! Рабочее пространство создано, ИИ-помощник в команде. Переходите к работе — всё доступно в меню.
              </p>
              <button
                type="button"
                onClick={handleFinish}
                disabled={finishMutation.isPending}
                className="w-full py-3 rounded-xl bg-imperial-gold text-imperial-bg font-semibold hover:bg-amber-500 transition-colors disabled:opacity-50 mb-3"
              >
                {finishMutation.isPending ? 'Переход…' : 'Перейти к работе'}
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="w-full py-2 text-sm text-imperial-muted hover:text-white transition-colors"
              >
                Пропустить онбординг
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
