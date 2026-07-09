import axiosInstance from '../utils/axiosInstance';

export interface WorkflowStage {
  stage_id: string;
  name: string;
  description?: string;
  system_prompt: string;
  agent_ref?: string; // 参照的 Agent 文件名
  suggested_tasks?: string[];
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateWorkflowStageRequest {
  name: string;
  description?: string;
  system_prompt: string;
  agent_ref?: string;
  suggested_tasks?: string[];
  color?: string;
  icon?: string;
  sort_order?: number;
}

export interface UpdateWorkflowStageRequest {
  name?: string;
  description?: string;
  system_prompt?: string;
  agent_ref?: string;
  suggested_tasks?: string[];
  color?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

export const workflowStageService = {
  // 获取所有工作流程阶段
  async getAllStages(activeOnly: boolean = false): Promise<WorkflowStage[]> {
    const params = activeOnly ? { params: { active: true } } : {};
    const response = await axiosInstance.get<WorkflowStage[]>('/workflow-stages', params);
    return response.data;
  },

  // 获取单个工作流程阶段
  async getStage(stageId: string): Promise<WorkflowStage> {
    const response = await axiosInstance.get<WorkflowStage>(`/workflow-stages/${stageId}`);
    return response.data;
  },

  // 创建新的工作流程阶段
  async createStage(request: CreateWorkflowStageRequest): Promise<WorkflowStage> {
    const response = await axiosInstance.post<WorkflowStage>('/workflow-stages', request);
    return response.data;
  },

  // 更新工作流程阶段
  async updateStage(stageId: string, request: UpdateWorkflowStageRequest): Promise<WorkflowStage> {
    const response = await axiosInstance.put<WorkflowStage>(`/workflow-stages/${stageId}`, request);
    return response.data;
  },

  // 删除工作流程阶段
  async deleteStage(stageId: string): Promise<void> {
    await axiosInstance.delete(`/workflow-stages/${stageId}`);
  },

  // 重新排序阶段
  async reorderStages(stages: { stage_id: string; sort_order: number }[]): Promise<void> {
    await axiosInstance.post('/workflow-stages/reorder', { stages });
  },

  // 检查 Agent 是否存在
  async checkAgentExists(agentName: string): Promise<boolean> {
    const response = await axiosInstance.post<{ exists: boolean }>('/workflow-stages/check-agent', {
      agentName
    });
    return response.data.exists;
  },

  // 取得有效提示词
  async getEffectivePrompt(stageId: string): Promise<{
    content: string;
    source: 'agent' | 'custom';
    agentName?: string;
  }> {
    const response = await axiosInstance.get(`/workflow-stages/${stageId}/effective-prompt`);
    return response.data;
  }
};