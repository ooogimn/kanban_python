import api from './client';

export interface AnalyzeProjectResponse {
  context: {
    meta: { name: string; description?: string; health_status: string; progress: number; status: string };
    team: Array<{ name: string; role: string }>;
    tasks_stats: {
      total: number;
      completed: number;
      hot_count: number;
      hot_tasks: Array<{ id: number; title: string; priority: string; status: string; due_date: string | null }>;
      overdue_count: number;
    };
    finance?: { budget: string; spent: string; available: string; status: string };
    recent_activity: Array<{ action: string; model: string; object_id: number; user: string; timestamp: string }>;
  };
  summary: string;
}

/** Агент из каталога (Marketplace) и учётной карточки */
export interface AiAgentDto {
  id: number;
  name: string;
  role: string;
  description: string;
  system_prompt?: string;
  avatar_url: string;
  monthly_cost?: string | number;
  is_active: boolean;
  is_free: boolean;
  created_at: string;
  updated_at: string;
}

/** Нанятый агент в workspace (message_count приходит с list) */
export interface WorkspaceAgentDto {
  id: number;
  workspace: number;
  agent: AiAgentDto;
  message_count?: number;
  is_active: boolean;
  created_at: string;
}

/** Сообщение в чате */
export interface ChatMessageDto {
  id: number;
  workspace_agent: number;
  user: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const aiApi = {
  analyzeProject: async (projectId: number): Promise<AnalyzeProjectResponse> => {
    const response = await api.post<AnalyzeProjectResponse>('/ai/analyze/', { project_id: projectId });
    return response.data;
  },

  /** Список агентов в маркетплейсе */
  getMarketplace: async (): Promise<AiAgentDto[]> => {
    const response = await api.get<AiAgentDto[]>('/ai/marketplace/');
    return Array.isArray(response.data) ? response.data : (response.data as { results?: AiAgentDto[] })?.results ?? [];
  },

  /** Нанятые агенты в workspace */
  getWorkspaceAgents: async (workspaceId: number): Promise<WorkspaceAgentDto[]> => {
    const response = await api.get<WorkspaceAgentDto[]>('/ai/workspace-agents/', {
      params: { workspace_id: workspaceId },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  /** Нанять агента */
  hireAgent: async (workspaceId: number, agentId: number): Promise<WorkspaceAgentDto> => {
    const response = await api.post<WorkspaceAgentDto>('/ai/workspace-agents/hire/', {
      workspace_id: workspaceId,
      agent_id: agentId,
    });
    return response.data;
  },

  /** История сообщений чата */
  getMessages: async (workspaceAgentId: number): Promise<ChatMessageDto[]> => {
    const response = await api.get<ChatMessageDto[]>(`/ai/workspace-agents/${workspaceAgentId}/messages/`);
    return Array.isArray(response.data) ? response.data : [];
  },

  /** Отправить сообщение в чат (ответ вернётся в assistant_message) */
  chat: async (
    workspaceAgentId: number,
    message: string
  ): Promise<{ user_message: ChatMessageDto; assistant_message: ChatMessageDto }> => {
    const response = await api.post<{ user_message: ChatMessageDto; assistant_message: ChatMessageDto }>(
      `/ai/workspace-agents/${workspaceAgentId}/chat/`,
      { message }
    );
    return response.data;
  },

  /** Сравнение продуктивности и затрат: люди vs ИИ-сотрудники */
  getTeamComparison: async (workspaceId: number): Promise<TeamComparisonResponse> => {
    const response = await api.get<TeamComparisonResponse>('/ai/team-comparison/', {
      params: { workspace_id: workspaceId },
    });
    return response.data;
  },
};

/** Ответ API сравнения команды (люди vs ИИ) */
export interface TeamComparisonResponse {
  humans: Array<{
    contact_id: number;
    name: string;
    total_hours: number;
    payroll_total: string;
    tasks_count: number;
  }>;
  ai: Array<{
    workspace_agent_id: number;
    name: string;
    role: string;
    message_count: number;
    monthly_cost: string;
  }>;
}
