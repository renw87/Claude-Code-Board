// 项目相关类型
export interface Project {
  project_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

// 标签相关类型
export interface Tag {
  tag_id: string;
  name: string;
  color?: string;
  type: 'general' | 'topic' | 'department';
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// 创建项目请求
export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

// 创建标签请求
export interface CreateTagRequest {
  name: string;
  color?: string;
  type?: 'general' | 'topic' | 'department';
}

// 更新项目请求
export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: 'active' | 'completed' | 'archived';
}

// 更新标签请求
export interface UpdateTagRequest {
  name?: string;
  color?: string;
  type?: 'general' | 'topic' | 'department';
}

// 项目统计
export interface ProjectStats {
  session_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}