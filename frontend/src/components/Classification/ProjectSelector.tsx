import React, { useState, useEffect } from 'react';
import { projectApi } from '../../services/api';
import { Project } from '../../types/classification.types';
import { MultiSelect } from '../Common/MultiSelect';
import toast from 'react-hot-toast';

interface ProjectSelectorProps {
  sessionId: string;
  selectedProjects: string[];
  onProjectsChange: (projectIds: string[]) => void;
  className?: string;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  sessionId,
  selectedProjects,
  onProjectsChange,
  className,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 加载所有项目
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const allProjects = await projectApi.getActiveProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('加载项目失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理项目变更
  const handleProjectsChange = async (newProjectIds: string[]) => {
    try {
      setSaving(true);
      await projectApi.updateSessionProjects(sessionId, newProjectIds);
      onProjectsChange(newProjectIds);
      toast.success('项目已更新');
    } catch (error) {
      console.error('Failed to update projects:', error);
      toast.error('更新项目失败');
    } finally {
      setSaving(false);
    }
  };

  // 创建新项目
  const handleCreateProject = async (name: string) => {
    try {
      const newProject = await projectApi.createProject({
        name,
        color: '#' + Math.floor(Math.random()*16777215).toString(16), // 随机颜色
        icon: '📁',
      });
      
      // 重新加载项目列表
      await loadProjects();
      
      // 自动选择新创建的项目
      const newProjectIds = [...selectedProjects, newProject.project_id];
      await handleProjectsChange(newProjectIds);
      
      toast.success('项目已创建');
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('创建项目失败');
      throw error;
    }
  };

  // 转换项目为选项格式
  const options = projects.map(project => ({
    value: project.project_id,
    label: project.name,
    color: project.color,
    icon: project.icon,
  }));

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        项目
      </label>
      <MultiSelect
        options={options}
        value={selectedProjects}
        onChange={handleProjectsChange}
        placeholder="选择项目..."
        disabled={saving}
        loading={loading}
        onCreateNew={handleCreateProject}
        createNewPlaceholder="创建新项目"
      />
    </div>
  );
};