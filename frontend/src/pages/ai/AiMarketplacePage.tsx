import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useUpgradeModalStore } from '../../store/upgradeModalStore';
import { authApi } from '../../api/auth';
import { workspaceApi } from '../../api/workspace';
import { aiApi, type AiAgentDto, type WorkspaceAgentDto } from '../../api/ai';
import AgentDetailModal from '../../components/ai/AgentDetailModal';
import { getAssetUrl } from '../../utils/assetUrl';

const UPGRADE_MESSAGE = 'Для доступа к этому разделу оплатите подписку.';

export default function AiMarketplacePage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const openUpgradeModal = useUpgradeModalStore((s) => s.openModal);
  const [detailAgent, setDetailAgent] = useState<AiAgentDto | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
    enabled: !!user,
  });
  const planType = profile?.plan_type ?? 'personal';
  const isPersonalPlan = planType === 'personal';

  const { data: currentWorkspace } = useQuery({
    queryKey: ['workspace-current'],
    queryFn: () => workspaceApi.getCurrentWorkspace(),
  });
  const workspaceId = currentWorkspace?.id ?? 0;

  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ['ai-marketplace'],
    queryFn: () => aiApi.getMarketplace(),
  });

  const { data: hired = [], isLoading: loadingHired } = useQuery({
    queryKey: ['ai-workspace-agents', workspaceId],
    queryFn: () => aiApi.getWorkspaceAgents(workspaceId),
    enabled: workspaceId > 0,
  });

  const hireMutation = useMutation({
    mutationFn: ({ agentId }: { agentId: number }) => aiApi.hireAgent(workspaceId, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-workspace-agents', workspaceId] });
    },
  });

  const hiredAgentIds = new Set((hired as WorkspaceAgentDto[]).map((wa) => wa.agent.id));

  const handleHire = (agent: AiAgentDto) => {
    if (isPersonalPlan) {
      openUpgradeModal('FEATURE_LOCKED', UPGRADE_MESSAGE);
      return;
    }
    if (workspaceId <= 0) return;
    hireMutation.mutate({ agentId: agent.id });
  };

  if (workspaceId <= 0 && !isPersonalPlan) {
    return (
      <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
        Выберите или создайте рабочее пространство, чтобы просматривать и нанимать ИИ-агентов.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Маркетплейс ИИ-агентов</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Workspace: <span className="font-medium text-slate-700 dark:text-slate-300">{currentWorkspace?.name}</span>
        </p>
      </div>

      {(loadingAgents || loadingHired) && (
        <div className="text-slate-500 dark:text-slate-400">Загрузка…</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => {
          const isHired = hiredAgentIds.has(agent.id);
          return (
            <div
              key={agent.id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailAgent(agent)}
              onKeyDown={(e) => e.key === 'Enter' && setDetailAgent(agent)}
              className="rounded-xl border-2 border-emerald-500/70 bg-white dark:bg-imperial-surface/80 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer shadow-[0_0_10px_1px_rgba(16,185,129,0.4),0_0_20px_4px_rgba(16,185,129,0.2)] hover:shadow-[0_0_12px_2px_rgba(16,185,129,0.5),0_0_24px_6px_rgba(16,185,129,0.25)]"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{agent.name}</h2>
                  {agent.is_free && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      Free
                    </span>
                  )}
                </div>
                {agent.avatar_url ? (
                  <img
                    src={getAssetUrl(agent.avatar_url)}
                    alt=""
                    className="w-full aspect-square max-w-[10.5rem] mx-auto rounded-xl object-cover bg-slate-100 dark:bg-slate-700 border-2 border-violet-500 shadow-[0_0_12px_2px_rgba(139,92,246,0.5),0_0_24px_4px_rgba(139,92,246,0.3)]"
                  />
                ) : (
                  <div className="w-full aspect-square max-w-[10.5rem] mx-auto rounded-xl bg-imperial-gold/20 text-imperial-gold flex items-center justify-center text-4xl font-bold border-2 border-violet-500 shadow-[0_0_12px_2px_rgba(139,92,246,0.5),0_0_24px_4px_rgba(139,92,246,0.3)]">
                    {agent.name.charAt(0)}
                  </div>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{agent.role}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{agent.description}</p>
              </div>
              <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                {isHired ? (
                  isPersonalPlan ? (
                    <button
                      type="button"
                      onClick={() => openUpgradeModal('FEATURE_LOCKED', UPGRADE_MESSAGE)}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-imperial-gold/20 text-imperial-gold font-medium hover:bg-imperial-gold/30 transition-colors"
                    >
                      Открыть чат
                    </button>
                  ) : (
                    <Link
                      to="/"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-imperial-gold/20 text-imperial-gold font-medium hover:bg-imperial-gold/30 transition-colors"
                    >
                      Открыть чат
                    </Link>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => handleHire(agent)}
                    disabled={hireMutation.isPending}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-imperial-gold text-imperial-bg font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors"
                  >
                    {hireMutation.isPending ? '…' : 'Нанять'}
                  </button>
                )}
              </div>
              {hireMutation.isError && (
                <p className="mt-2 text-sm text-red-500" onClick={(e) => e.stopPropagation()}>
                  {(hireMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Ошибка'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {detailAgent && (
        <AgentDetailModal
          agent={detailAgent}
          isHired={hiredAgentIds.has(detailAgent.id)}
          onClose={() => setDetailAgent(null)}
          onHire={() => handleHire(detailAgent)}
          hireLoading={hireMutation.isPending}
        />
      )}

      {!loadingAgents && agents.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-imperial-surface/60 p-8 text-center text-imperial-muted">
          В каталоге пока нет агентов.
        </div>
      )}
    </div>
  );
}
