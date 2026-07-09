import axiosInstance from '../utils/axiosInstance';

export interface AgentListItem {
  name: string;
  fileName: string;
}

export interface AgentDetail extends AgentListItem {
  content: string;
  description?: string;
  tools?: string[];
}

export interface ConfigStatus {
  configured: boolean;
  path: string | null;
}

export const agentPromptService = {
  // 取得配置状态
  async getConfig(): Promise<ConfigStatus> {
    const response = await axiosInstance.get<ConfigStatus>('/agent-prompts/config');
    return response.data;
  },

  // 设置路径
  async setConfig(path: string): Promise<void> {
    await axiosInstance.put('/agent-prompts/config', { path });
  },

  // 列出所有 Agent
  async listAgents(): Promise<AgentListItem[]> {
    const response = await axiosInstance.get<AgentListItem[]>('/agent-prompts');
    return response.data;
  },

  // 取得单一 Agent 内容
  async getAgentContent(agentName: string): Promise<AgentDetail | null> {
    try {
      const response = await axiosInstance.get<AgentDetail>(`/agent-prompts/${agentName}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }
};