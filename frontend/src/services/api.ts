import axiosInstance from '../utils/axiosInstance';
import { Session, CreateSessionRequest, Message, SystemStats } from '../types/session.types';
import { 
  Project, 
  Tag, 
  CreateProjectRequest, 
  CreateTagRequest, 
  UpdateProjectRequest, 
  UpdateTagRequest,
  ProjectStats 
} from '../types/classification.types';

// 使用共用的 axiosInstance
const api = axiosInstance;

// Common Path Types
export interface CommonPath {
  id: string;
  label: string;
  path: string;
  icon: 'FolderOpen' | 'Code' | 'Home';
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export const sessionApi = {
  // 获取所有 Sessions
  async getAllSessions(): Promise<Session[]> {
    const response = await api.get<Session[]>('/sessions');
    return response.data.map(session => ({
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      completedAt: session.completedAt ? new Date(session.completedAt) : undefined,
      deletedAt: session.deletedAt ? new Date(session.deletedAt) : undefined,
    }));
  },

  // 获取单个 Session
  async getSession(sessionId: string): Promise<Session> {
    const response = await api.get<Session>(`/sessions/${sessionId}`);
    return {
      ...response.data,
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
      completedAt: response.data.completedAt ? new Date(response.data.completedAt) : undefined,
      deletedAt: response.data.deletedAt ? new Date(response.data.deletedAt) : undefined,
    };
  },

  // 创建新 Session
  async createSession(request: CreateSessionRequest): Promise<Session> {
    const response = await api.post<Session>('/sessions', request);
    return {
      ...response.data,
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
      completedAt: response.data.completedAt ? new Date(response.data.completedAt) : undefined,
      deletedAt: response.data.deletedAt ? new Date(response.data.deletedAt) : undefined,
    };
  },

  // 完成 Session
  async completeSession(sessionId: string): Promise<Session> {
    const response = await api.post<Session>(`/sessions/${sessionId}/complete`);
    return {
      ...response.data,
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
      completedAt: response.data.completedAt ? new Date(response.data.completedAt) : undefined,
      deletedAt: response.data.deletedAt ? new Date(response.data.deletedAt) : undefined,
    };
  },

  // 删除 Session
  async deleteSession(sessionId: string): Promise<void> {
    await api.delete(`/sessions/${sessionId}`);
  },

  // 中断 Session
  async interruptSession(sessionId: string): Promise<Session> {
    const response = await api.post<Session>(`/sessions/${sessionId}/interrupt`);
    return {
      ...response.data,
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
      completedAt: response.data.completedAt ? new Date(response.data.completedAt) : undefined,
      deletedAt: response.data.deletedAt ? new Date(response.data.deletedAt) : undefined,
    };
  },

  // 恢复 Session
  async resumeSession(sessionId: string): Promise<Session> {
    const response = await api.post<Session>(`/sessions/${sessionId}/resume`);
    return {
      ...response.data,
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
      completedAt: response.data.completedAt ? new Date(response.data.completedAt) : undefined,
      deletedAt: response.data.deletedAt ? new Date(response.data.deletedAt) : undefined,
    };
  },

  // 发送消息
  async sendMessage(sessionId: string, content: string): Promise<Message> {
    const response = await api.post(`/sessions/${sessionId}/messages`, { content });
    const msg = response.data;
    return {
      messageId: msg.messageId,
      sessionId: msg.sessionId,
      type: msg.type,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      compressed: msg.compressed,
      originalSize: msg.originalSize,
      compressedSize: msg.compressedSize,
      metadata: msg.metadata
    };
  },

  // 获取消息
  async getMessages(sessionId: string, page: number = 1, limit: number = 50): Promise<{
    messages: Message[];
    pagination: {
      total: number;
      page: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const response = await api.get(`/sessions/${sessionId}/messages`, {
      params: { page, limit }
    });
    
    return {
      messages: response.data.messages.map((msg: any) => ({
        messageId: msg.messageId,
        sessionId: msg.sessionId,
        type: msg.type,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        compressed: msg.compressed,
        originalSize: msg.originalSize,
        compressedSize: msg.compressedSize,
        metadata: msg.metadata
      })),
      pagination: response.data.pagination,
    };
  },

  // 获取系统统计
  async getSystemStats(): Promise<SystemStats> {
    const response = await api.get<SystemStats>('/sessions/system/stats');
    return response.data;
  },

  // 重新排序 Sessions
  async reorderSessions(status: string, sessionIds: string[]): Promise<void> {
    await api.put('/sessions/reorder', { status, sessionIds });
  },

  // 导入 ~/.claude/projects/ 下的历史会话（只读，按 claude_session_id 去重）
  async importHistory(): Promise<{ imported: number; backfilled: number; skipped: number; messagesImported: number; errors: Array<{ file: string; error: string }>; projectsDir: string }> {
    const response = await api.post('/sessions/import-history');
    return response.data;
  },
};

// Common Paths API
export const commonPathApi = {
  // 获取所有常用路径
  async getAllPaths(): Promise<CommonPath[]> {
    const response = await api.get<{ success: boolean; data: CommonPath[] }>('/common-paths');
    return response.data.data;
  },

  // 获取单个路径
  async getPath(id: string): Promise<CommonPath> {
    const response = await api.get<{ success: boolean; data: CommonPath }>(`/common-paths/${id}`);
    return response.data.data;
  },

  // 创建新路径
  async createPath(path: Omit<CommonPath, 'id' | 'created_at' | 'updated_at'>): Promise<CommonPath> {
    const response = await api.post<{ success: boolean; data: CommonPath }>('/common-paths', path);
    return response.data.data;
  },

  // 更新路径
  async updatePath(id: string, updates: Partial<Omit<CommonPath, 'id' | 'created_at'>>): Promise<CommonPath> {
    const response = await api.put<{ success: boolean; data: CommonPath }>(`/common-paths/${id}`, updates);
    return response.data.data;
  },

  // 删除路径
  async deletePath(id: string): Promise<void> {
    await api.delete(`/common-paths/${id}`);
  },

  // 重新排序路径
  async reorderPaths(paths: { id: string; sort_order: number }[]): Promise<void> {
    await api.post('/common-paths/reorder', { paths });
  },

  // 重置为默认值
  async resetToDefault(): Promise<CommonPath[]> {
    const response = await api.post<{ success: boolean; data: CommonPath[] }>('/common-paths/reset');
    return response.data.data;
  },
};

// Projects API
export const projectApi = {
  // 获取所有项目
  async getAllProjects(): Promise<Project[]> {
    const response = await api.get<{ success: boolean; data: Project[] }>('/projects');
    return response.data.data;
  },

  // 获取活跃项目
  async getActiveProjects(): Promise<Project[]> {
    const response = await api.get<{ success: boolean; data: Project[] }>('/projects/active');
    return response.data.data;
  },

  // 获取单个项目
  async getProject(projectId: string): Promise<Project> {
    const response = await api.get<{ success: boolean; data: Project }>(`/projects/${projectId}`);
    return response.data.data;
  },

  // 创建新项目
  async createProject(project: CreateProjectRequest): Promise<Project> {
    const response = await api.post<{ success: boolean; data: Project }>('/projects', project);
    return response.data.data;
  },

  // 更新项目
  async updateProject(projectId: string, updates: UpdateProjectRequest): Promise<Project> {
    const response = await api.put<{ success: boolean; data: Project }>(`/projects/${projectId}`, updates);
    return response.data.data;
  },

  // 删除项目
  async deleteProject(projectId: string): Promise<void> {
    await api.delete(`/projects/${projectId}`);
  },

  // 获取项目统计
  async getProjectStats(projectId: string): Promise<ProjectStats> {
    const response = await api.get<{ success: boolean; data: ProjectStats }>(`/projects/${projectId}/stats`);
    return response.data.data;
  },

  // 获取对话的项目列表
  async getProjectsBySessionId(sessionId: string): Promise<Project[]> {
    const response = await api.get<{ success: boolean; data: Project[] }>(`/projects/sessions/${sessionId}/projects`);
    return response.data.data;
  },

  // 更新对话的项目（替换所有）
  async updateSessionProjects(sessionId: string, projectIds: string[]): Promise<void> {
    await api.put(`/projects/sessions/${sessionId}/projects`, { projectIds });
  },
};

// Tags API
export const tagApi = {
  // 获取所有标签
  async getAllTags(): Promise<Tag[]> {
    const response = await api.get<{ success: boolean; data: Tag[] }>('/tags');
    return response.data.data;
  },

  // 按类型获取标签
  async getTagsByType(type: 'general' | 'activity' | 'topic' | 'department'): Promise<Tag[]> {
    const response = await api.get<{ success: boolean; data: Tag[] }>(`/tags/type/${type}`);
    return response.data.data;
  },

  // 获取热门标签
  async getPopularTags(limit: number = 10): Promise<Tag[]> {
    const response = await api.get<{ success: boolean; data: Tag[] }>('/tags/popular', {
      params: { limit }
    });
    return response.data.data;
  },

  // 获取单个标签
  async getTag(tagId: string): Promise<Tag> {
    const response = await api.get<{ success: boolean; data: Tag }>(`/tags/${tagId}`);
    return response.data.data;
  },

  // 创建新标签
  async createTag(tag: CreateTagRequest): Promise<Tag> {
    const response = await api.post<{ success: boolean; data: Tag }>('/tags', tag);
    return response.data.data;
  },

  // 更新标签
  async updateTag(tagId: string, updates: UpdateTagRequest): Promise<Tag> {
    const response = await api.put<{ success: boolean; data: Tag }>(`/tags/${tagId}`, updates);
    return response.data.data;
  },

  // 删除标签
  async deleteTag(tagId: string): Promise<void> {
    await api.delete(`/tags/${tagId}`);
  },

  // 获取对话的标签列表
  async getTagsBySessionId(sessionId: string): Promise<Tag[]> {
    const response = await api.get<{ success: boolean; data: Tag[] }>(`/tags/sessions/${sessionId}/tags`);
    return response.data.data;
  },

  // 更新对话的标签（替换所有）
  async updateSessionTags(sessionId: string, tagIds: string[]): Promise<void> {
    await api.put(`/tags/sessions/${sessionId}/tags`, { tagIds });
  },

  // 按名称分配标签（会自动创建不存在的标签）
  async assignTagsByNames(sessionId: string, tagNames: string[], type?: 'general' | 'activity' | 'topic' | 'department'): Promise<void> {
    await api.post(`/tags/sessions/${sessionId}/tags/by-names`, { tagNames, type });
  },
};

// Task Template API
import { TaskTemplate, CreateTaskTemplateRequest, UpdateTaskTemplateRequest, ReorderTaskTemplatesRequest } from '../types/taskTemplate.types';

export const taskTemplateApi = {
  // 获取所有任务模板
  async getAllTemplates(): Promise<TaskTemplate[]> {
    const response = await api.get<{ success: boolean; data: TaskTemplate[] }>('/task-templates');
    return response.data.data;
  },

  // 获取单个任务模板
  async getTemplate(id: string): Promise<TaskTemplate> {
    const response = await api.get<{ success: boolean; data: TaskTemplate }>(`/task-templates/${id}`);
    return response.data.data;
  },

  // 创建新任务模板
  async createTemplate(data: CreateTaskTemplateRequest): Promise<TaskTemplate> {
    const response = await api.post<{ success: boolean; data: TaskTemplate }>('/task-templates', data);
    return response.data.data;
  },

  // 更新任务模板
  async updateTemplate(id: string, data: UpdateTaskTemplateRequest): Promise<TaskTemplate> {
    const response = await api.put<{ success: boolean; data: TaskTemplate }>(`/task-templates/${id}`, data);
    return response.data.data;
  },

  // 删除任务模板
  async deleteTemplate(id: string): Promise<void> {
    await api.delete(`/task-templates/${id}`);
  },

  // 重新排序任务模板
  async reorderTemplates(templates: ReorderTaskTemplatesRequest[]): Promise<void> {
    await api.post('/task-templates/reorder', { templates });
  },

  // 重置为默认模板
  async resetToDefault(): Promise<TaskTemplate[]> {
    const response = await api.post<{ success: boolean; data: TaskTemplate[] }>('/task-templates/reset');
    return response.data.data;
  },
};

export default api;