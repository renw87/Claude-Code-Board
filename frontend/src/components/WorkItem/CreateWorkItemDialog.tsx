import React, { useState } from 'react';
import { X, Plus, AlertCircle, FolderOpen } from 'lucide-react';
import { useWorkItemStore } from '../../stores/workItemStore';
import { CreateWorkItemRequest } from '../../types/workitem';

interface CreateWorkItemDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (workItemId: string) => void;
  projectId?: string;
}

export const CreateWorkItemDialog: React.FC<CreateWorkItemDialogProps> = ({
  open,
  onClose,
  onCreated,
  projectId
}) => {
  const { createWorkItem } = useWorkItemStore();
  
  const [formData, setFormData] = useState<CreateWorkItemRequest>({
    title: '',
    description: '',
    workspace_path: '',
    project_id: projectId
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('标题是必填的');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newWorkItem = await createWorkItem(formData);
      onCreated?.(newWorkItem.work_item_id);
      onClose();
      // Reset form
      setFormData({
        title: '',
        description: '',
        workspace_path: '',
        project_id: projectId
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setError(null);
    }
  };


  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  创建 Work Item
                </h3>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    标题 *
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    描述
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-none"
                  />
                </div>

                {/* Workspace Path */}
                <div>
                  <label htmlFor="workspace_path" className="block text-sm font-medium text-gray-700 mb-1">
                    工作区路径 (选填)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="workspace_path"
                      value={formData.workspace_path}
                      onChange={(e) => setFormData({ ...formData, workspace_path: e.target.value })}
                      disabled={loading}
                      placeholder="例如：C:\\Users\\YourName\\Projects\\MyProject"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    />
                    <FolderOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    设置此 Work Item 的默认工作目录，创建 Session 时会自动填入
                  </p>
                </div>


                {/* Info */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    💡 Work Item 是用来组织相关 Sessions 的容器。您可以在创建 Session 时选择关联到此 Work Item，
                    或稍后再将现有 Session 关联过来。
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
              <button
                type="submit"
                disabled={loading || !formData.title.trim()}
                className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                创建
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};