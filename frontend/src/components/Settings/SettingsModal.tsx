import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Settings, FolderOpen, Code, Home, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings, CommonPath } from '../../hooks/useSettings';
import { TaskTemplateSettings } from './TaskTemplateSettings';


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const iconComponents = {
  FolderOpen,
  Code,
  Home,
};

type TabType = 'paths' | 'templates';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('paths');

  const {
    commonPaths,
    resetToDefault,
    addCommonPath,
    updateCommonPath,
    deleteCommonPath,
    reloadSettings,
  } = useSettings();

  const [editingPath, setEditingPath] = useState<CommonPath | null>(null);

  // 当打开 modal 时重新加载设置
  useEffect(() => {
    if (isOpen) {
      reloadSettings();
    }
  }, [isOpen, reloadSettings]);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newPathData, setNewPathData] = useState<Omit<CommonPath, 'id'>>({
    label: '',
    path: '',
    icon: 'FolderOpen',
  });

  const addNewPath = () => {
    setIsAddingNew(true);
    setEditingPath(null);
    setNewPathData({
      label: '',
      path: '',
      icon: 'FolderOpen',
    });
  };

  const handleSaveNewPath = async () => {
    if (!newPathData.label.trim() || !newPathData.path.trim()) {
      toast.error('标签和路径不能为空');
      return;
    }
    
    const success = await addCommonPath(newPathData);
    if (success) {
      setIsAddingNew(false);
      setNewPathData({
        label: '',
        path: '',
        icon: 'FolderOpen',
      });
    }
  };

  const handleCancelNewPath = () => {
    setIsAddingNew(false);
    setNewPathData({
      label: '',
      path: '',
      icon: 'FolderOpen',
    });
  };

  const deletePath = async (id: string) => {
    await deleteCommonPath(id);
    if (editingPath?.id === id) {
      setEditingPath(null);
    }
  };

  const updatePath = async (updatedPath: CommonPath) => {
    const success = await updateCommonPath(updatedPath.id, {
      label: updatedPath.label,
      path: updatedPath.path,
      icon: updatedPath.icon,
    });
    if (success) {
      setEditingPath(null);
    }
  };

  const handleResetToDefault = async () => {
    const success = await resetToDefault();
    if (success) {
      setEditingPath(null);
    }
  };


  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden sm:mx-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tab 导航 */}
        <div className="flex border-b border-gray-200 px-4 sm:px-6">
          <button
            onClick={() => setActiveTab('paths')}
            className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'paths'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>常用路径</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>任务模板</span>
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-220px)] sm:max-h-[calc(90vh-260px)]">
          {activeTab === 'paths' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">常用路径</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleResetToDefault}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    重置默认
                  </button>
                  <button
                    onClick={addNewPath}
                    disabled={isAddingNew}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>添加</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {/* 添加路径的编辑表单 */}
                {isAddingNew && (
                  <div className="border border-green-300 rounded-lg p-3 sm:p-4 bg-green-50">
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            标签
                          </label>
                          <input
                            type="text"
                            value={newPathData.label}
                            onChange={(e) => setNewPathData(prev => ({ ...prev, label: e.target.value }))}
                            className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            placeholder="路径标签"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            图标
                          </label>
                          <select
                            value={newPathData.icon}
                            onChange={(e) => setNewPathData(prev => ({ ...prev, icon: e.target.value as any }))}
                            className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          >
                            <option value="FolderOpen">📁 文件夹</option>
                            <option value="Code">💻 代码</option>
                            <option value="Home">🏠 家目录</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          路径
                        </label>
                        <input
                          type="text"
                          value={newPathData.path}
                          onChange={(e) => setNewPathData(prev => ({ ...prev, path: e.target.value }))}
                          className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono"
                          placeholder="C:\Users\User"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={handleCancelNewPath}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveNewPath}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          添加
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 现有路径列表 */}
                {commonPaths.map((path) => (
                  <PathEditor
                    key={path.id}
                    path={path}
                    isEditing={editingPath?.id === path.id}
                    onEdit={(p) => {
                      setEditingPath(p);
                      setIsAddingNew(false); // 编辑现有路径时关闭添加表单
                    }}
                    onUpdate={updatePath}
                    onDelete={deletePath}
                  />
                ))}
              </div>

              {commonPaths.length === 0 && !isAddingNew && (
                <div className="text-center py-8 text-gray-500">
                  <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>尚无常用路径</p>
                  <button
                    onClick={addNewPath}
                    className="mt-2 text-blue-600 hover:text-blue-700"
                  >
                    添加第一个路径
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && <TaskTemplateSettings />}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-xs sm:text-sm text-gray-500">
            设置会自动同步到数据库
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// 路径编辑器组件
interface PathEditorProps {
  path: CommonPath;
  isEditing: boolean;
  onEdit: (path: CommonPath | null) => void;
  onUpdate: (path: CommonPath) => void;
  onDelete: (id: string) => void;
}

const PathEditor: React.FC<PathEditorProps> = ({
  path,
  isEditing,
  onEdit,
  onUpdate,
  onDelete,
}) => {
  const [editData, setEditData] = useState<CommonPath>({
    id: path.id,
    label: path.label,
    path: path.path,
    icon: path.icon,
  });

  useEffect(() => {
    // 每次 path 改变或进入编辑模式时，重新设置 editData
    setEditData({
      id: path.id,
      label: path.label,
      path: path.path,
      icon: path.icon,
    });
  }, [path.id, path.label, path.path, path.icon, isEditing]);

  const handleSave = () => {
    console.log('Saving editData:', editData);
    if (!editData.label.trim() || !editData.path.trim()) {
      toast.error('标签和路径不能为空');
      return;
    }
    onUpdate(editData);
  };

  const handleCancel = () => {
    setEditData(path);
    onEdit(null);
  };

  const IconComponent = iconComponents[path.icon];

  if (isEditing) {
    return (
      <div className="border border-blue-300 rounded-lg p-3 sm:p-4 bg-blue-50">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                标签
              </label>
              <input
                type="text"
                value={editData.label}
                onChange={(e) => {
                  const newValue = e.target.value;
                  console.log('Changing label to:', newValue);
                  setEditData(prev => {
                    const newData = { ...prev, label: newValue };
                    console.log('New editData:', newData);
                    return newData;
                  });
                }}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="路径标签"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                图标
              </label>
              <select
                value={editData.icon}
                onChange={(e) => setEditData(prev => ({ ...prev, icon: e.target.value as any }))}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="FolderOpen">📁 文件夹</option>
                <option value="Code">💻 代码</option>
                <option value="Home">🏠 家目录</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              路径
            </label>
            <input
              type="text"
              value={editData.path}
              onChange={(e) => {
                const newValue = e.target.value;
                setEditData(prev => ({ ...prev, path: newValue }));
              }}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              placeholder="C:\Users\User"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors gap-3">
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <IconComponent className="w-4 h-4 text-gray-600 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 truncate">{path.label}</div>
          <div className="text-sm text-gray-500 font-mono truncate">{path.path}</div>
        </div>
      </div>
      <div className="flex items-center space-x-1 flex-shrink-0">
        <button
          onClick={() => onEdit(path)}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="编辑"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(path.id)}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};