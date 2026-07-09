import { useState, useEffect } from 'react';
import { commonPathApi, CommonPath } from '../services/api';
import toast from 'react-hot-toast';

export type { CommonPath };

export const useSettings = () => {
  const [commonPaths, setCommonPaths] = useState<CommonPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 加载设置
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const paths = await commonPathApi.getAllPaths();
      setCommonPaths(paths);
    } catch (error) {
      console.error('Failed to load common paths:', error);
      toast.error('无法加载常用路径');
      // 使用空数组作为后备
      setCommonPaths([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 保存设置（批量更新）
  const saveSettings = async (newPaths: CommonPath[]): Promise<boolean> => {
    try {
      // 如果是重新排序，使用 reorder API
      const reorderData = newPaths.map((path, index) => ({
        id: path.id,
        sort_order: index + 1
      }));
      
      await commonPathApi.reorderPaths(reorderData);
      setCommonPaths(newPaths);
      
      // 触发自定义事件以通知其他组件
      window.dispatchEvent(new Event('settings-updated'));
      
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('保存设置失败');
      return false;
    }
  };

  // 重置为默认设置
  const resetToDefault = async (): Promise<boolean> => {
    try {
      const paths = await commonPathApi.resetToDefault();
      setCommonPaths(paths);
      
      // 触发自定义事件以通知其他组件
      window.dispatchEvent(new Event('settings-updated'));
      
      toast.success('已重置为默认设置');
      return true;
    } catch (error) {
      console.error('Failed to reset settings:', error);
      toast.error('重置设置失败');
      return false;
    }
  };

  // 添加常用路径
  const addCommonPath = async (path: Omit<CommonPath, 'id'>): Promise<boolean> => {
    try {
      const created = await commonPathApi.createPath({
        label: path.label,
        path: path.path,
        icon: path.icon,
        sort_order: commonPaths.length + 1
      });
      
      setCommonPaths([...commonPaths, created]);
      
      // 触发自定义事件
      window.dispatchEvent(new Event('settings-updated'));
      
      toast.success('已添加常用路径');
      return true;
    } catch (error) {
      console.error('Failed to add common path:', error);
      toast.error('添加常用路径失败');
      return false;
    }
  };

  // 更新常用路径
  const updateCommonPath = async (id: string, updates: Partial<CommonPath>): Promise<boolean> => {
    try {
      const updated = await commonPathApi.updatePath(id, updates);
      
      setCommonPaths(commonPaths.map(path => 
        path.id === id ? updated : path
      ));
      
      // 触发自定义事件
      window.dispatchEvent(new Event('settings-updated'));
      
      toast.success('已更新常用路径');
      return true;
    } catch (error) {
      console.error('Failed to update common path:', error);
      toast.error('更新常用路径失败');
      return false;
    }
  };

  // 删除常用路径
  const deleteCommonPath = async (id: string): Promise<boolean> => {
    try {
      await commonPathApi.deletePath(id);
      
      setCommonPaths(commonPaths.filter(path => path.id !== id));
      
      // 触发自定义事件
      window.dispatchEvent(new Event('settings-updated'));
      
      toast.success('已删除常用路径');
      return true;
    } catch (error) {
      console.error('Failed to delete common path:', error);
      toast.error('删除常用路径失败');
      return false;
    }
  };

  // 取得设置信息
  const getSettingsInfo = () => {
    return {
      hasCustomSettings: commonPaths.length > 0,
      lastUpdated: null, // 可以从 commonPaths 中取得最新的 updated_at
      pathCount: commonPaths.length,
    };
  };

  // 初始化加载
  useEffect(() => {
    loadSettings();
  }, []);

  // 监听自定义事件，用于同一标签页内的同步
  useEffect(() => {
    const handleCustomStorageChange = () => {
      loadSettings();
    };
    
    window.addEventListener('settings-updated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('settings-updated', handleCustomStorageChange);
    };
  }, []);

  return {
    commonPaths,
    isLoading,
    saveSettings,
    resetToDefault,
    addCommonPath,
    updateCommonPath,
    deleteCommonPath,
    getSettingsInfo,
    reloadSettings: loadSettings,
  };
};