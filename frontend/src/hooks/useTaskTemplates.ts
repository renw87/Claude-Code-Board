import { useState, useEffect } from 'react';
import { taskTemplateApi } from '../services/api';
import { TaskTemplate, CreateTaskTemplateRequest, UpdateTaskTemplateRequest, ReorderTaskTemplatesRequest } from '../types/taskTemplate.types';
import toast from 'react-hot-toast';

export const useTaskTemplates = () => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 加载所有模板
  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const data = await taskTemplateApi.getAllTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load task templates:', error);
      toast.error('无法加载任务模板');
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 取得激活的模板
  const getActiveTemplates = () => templates.filter(t => t.is_active);

  // 添加模板
  const createTemplate = async (data: CreateTaskTemplateRequest): Promise<boolean> => {
    try {
      const created = await taskTemplateApi.createTemplate(data);
      setTemplates([...templates, created]);

      // 触发自定义事件
      window.dispatchEvent(new Event('templates-updated'));

      toast.success('已添加任务模板');
      return true;
    } catch (error) {
      console.error('Failed to create task template:', error);
      toast.error('添加任务模板失败');
      return false;
    }
  };

  // 更新模板
  const updateTemplate = async (id: string, data: UpdateTaskTemplateRequest): Promise<boolean> => {
    try {
      const updated = await taskTemplateApi.updateTemplate(id, data);
      setTemplates(templates.map(t => t.id === id ? updated : t));

      // 触发自定义事件
      window.dispatchEvent(new Event('templates-updated'));

      toast.success('已更新任务模板');
      return true;
    } catch (error) {
      console.error('Failed to update task template:', error);
      toast.error('更新任务模板失败');
      return false;
    }
  };

  // 删除模板
  const deleteTemplate = async (id: string): Promise<boolean> => {
    try {
      await taskTemplateApi.deleteTemplate(id);
      setTemplates(templates.filter(t => t.id !== id));

      // 触发自定义事件
      window.dispatchEvent(new Event('templates-updated'));

      toast.success('已删除任务模板');
      return true;
    } catch (error) {
      console.error('Failed to delete task template:', error);
      toast.error('删除任务模板失败');
      return false;
    }
  };

  // 重新排序
  const reorderTemplates = async (newOrder: TaskTemplate[]): Promise<boolean> => {
    try {
      const orders: ReorderTaskTemplatesRequest[] = newOrder.map((t, index) => ({
        id: t.id,
        sort_order: index + 1
      }));

      await taskTemplateApi.reorderTemplates(orders);
      setTemplates(newOrder);

      // 触发自定义事件
      window.dispatchEvent(new Event('templates-updated'));

      return true;
    } catch (error) {
      console.error('Failed to reorder task templates:', error);
      toast.error('重新排序失败');
      return false;
    }
  };

  // 重置为默认
  const resetToDefault = async (): Promise<boolean> => {
    try {
      const defaultTemplates = await taskTemplateApi.resetToDefault();
      setTemplates(defaultTemplates);

      // 触发自定义事件
      window.dispatchEvent(new Event('templates-updated'));

      toast.success('已重置为默认模板');
      return true;
    } catch (error) {
      console.error('Failed to reset templates:', error);
      toast.error('重置模板失败');
      return false;
    }
  };

  // 初始化加载
  useEffect(() => {
    loadTemplates();
  }, []);

  // 监听自定义事件，用于同一标签页内的同步
  useEffect(() => {
    const handleTemplatesUpdated = () => {
      loadTemplates();
    };

    window.addEventListener('templates-updated', handleTemplatesUpdated);

    return () => {
      window.removeEventListener('templates-updated', handleTemplatesUpdated);
    };
  }, []);

  return {
    templates,
    activeTemplates: getActiveTemplates(),
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    reorderTemplates,
    resetToDefault,
    reloadTemplates: loadTemplates,
  };
};