import React, { useEffect, useState } from 'react';
import { Plus, Briefcase, RefreshCw } from 'lucide-react';
import { useWorkItemStore } from '../stores/workItemStore';
import { useWorkflowStageStore } from '../stores/workflowStageStore';
import toast from 'react-hot-toast';
import { WorkItemRow } from '../components/WorkItem/WorkItemRow';
import { CreateWorkItemDialog } from '../components/WorkItem/CreateWorkItemDialog';
import { EditWorkItemDialog } from '../components/WorkItem/EditWorkItemDialog';
import { WorkItemStatus, WorkItem } from '../types/workitem';
import { SearchBar } from '../components/Common/SearchBar';

export const WorkItemListPage: React.FC = () => {
  const {
    workItems,
    stats,
    loading,
    error,
    fetchWorkItems,
    fetchStats,
    updateWorkItem,
    deleteWorkItem,
    clearError
  } = useWorkItemStore();
  
  const { fetchStages } = useWorkflowStageStore();
  
  const [statusFilter, setStatusFilter] = useState<WorkItemStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingWorkItem, setEditingWorkItem] = useState<WorkItem | null>(null);

  useEffect(() => {
    // 初始加载
    loadData();
    fetchStages();
  }, []);

  useEffect(() => {
    // 当筛选条件改变时重新加载
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    const status = statusFilter === 'all' ? undefined : statusFilter;
    await Promise.all([
      fetchWorkItems(status),
      fetchStats()
    ]);
  };

  const handleStatusChange = async (workItemId: string, status: WorkItemStatus) => {
    try {
      await updateWorkItem(workItemId, { 
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : undefined
      });
      await fetchStats();
      
      // 显示成功提示
      const statusText: Record<string, string> = {
        'planning': '已设为规划中',
        'in_progress': '已开始运行',
        'completed': '已标记完成',
        'cancelled': '已取消'
      };
      toast.success(`Work Item ${statusText[status] || '状态已更新'}`);
    } catch (err) {
      console.error('Failed to update work item status:', err);
      toast.error('更新状态失败');
    }
  };

  const handleDelete = async (workItemId: string) => {
    if (window.confirm('确定要删除这个 Work Item 吗？相关的 Sessions 不会被删除。')) {
      try {
        await deleteWorkItem(workItemId);
        await fetchStats();
        toast.success('Work Item 已删除');
      } catch (err) {
        console.error('Failed to delete work item:', err);
        toast.error('删除 Work Item 失败');
      }
    }
  };

  const handleWorkItemCreated = () => {
    loadData();
    toast.success('Work Item 已创建');
  };

  const handleEdit = (workItem: WorkItem) => {
    setEditingWorkItem(workItem);
    setEditDialogOpen(true);
  };

  const handleWorkItemUpdated = () => {
    loadData();
    setEditDialogOpen(false);
    setEditingWorkItem(null);
    toast.success('Work Item 已更新');
  };

  // 搜索过滤和排序
  const filteredWorkItems = workItems
    .filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // 当筛选为「全部」时，按状态排序：规划中 -> 进行中 -> 已完成 -> 已取消
      if (statusFilter === 'all') {
        const statusOrder = {
          'planning': 1,
          'in_progress': 2,
          'completed': 3,
          'cancelled': 4
        };
        return statusOrder[a.status] - statusOrder[b.status];
      }
      // 其他情况按创建时间排序（最新的在前）
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const statusTabs = [
    { value: 'all', label: '全部', count: stats?.total },
    { value: 'planning', label: '规划中', count: stats?.planning },
    { value: 'in_progress', label: '进行中', count: stats?.in_progress },
    { value: 'completed', label: '已完成', count: stats?.completed },
    { value: 'cancelled', label: '已取消', count: stats?.cancelled }
  ];

  return (
    <div className="flex-1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="glass-card rounded-xl p-4 flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-blue">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Work Items</h1>
            {stats && (
              <span className="px-3 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-sm font-medium">
                总计 {stats.total}
              </span>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all hover:shadow-soft-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setCreateDialogOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              添加 Work Item
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-xl flex justify-between items-center shadow-soft">
            <span className="text-danger-700">{error}</span>
            <button
              onClick={clearError}
              className="text-danger-500 hover:text-danger-700 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs and Search */}
        <div className="glass-card rounded-xl shadow-soft mb-6">
          <div className="border-b border-glass-border">
            <nav className="flex -mb-px">
              {statusTabs.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value as WorkItemStatus | 'all')}
                  className={`
                    px-6 py-3 border-b-2 font-medium text-sm transition-colors
                    ${statusFilter === tab.value
                      ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <span className="flex items-center gap-2">
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className="px-2 py-0.5 bg-white/80 text-gray-600 rounded-full text-xs border border-gray-200">
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </nav>
          </div>
          
          <div className="p-4">
            <SearchBar
              placeholder="搜索 Work Items..."
              onSearch={setSearchQuery}
              defaultValue={searchQuery}
              className="w-full"
            />
          </div>
        </div>

        {/* Content */}
        {loading && !workItems.length ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredWorkItems.length === 0 ? (
          <div className="glass-extreme rounded-xl p-16 text-center">
            <div className="inline-flex p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-4">
              <Briefcase className="w-16 h-16 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? '没有找到符合条件的 Work Items' : '还没有 Work Items'}
            </h3>
            <p className="text-gray-500 mb-6">
              Work Items 帮助您组织和追踪相关的 Sessions
            </p>
            {!searchQuery && (
              <button
                onClick={() => setCreateDialogOpen(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                创建第一个 Work Item
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWorkItems.map(workItem => (
              <WorkItemRow
                key={workItem.work_item_id}
                workItem={workItem}
                onEdit={handleEdit}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <CreateWorkItemDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onCreated={handleWorkItemCreated}
        />

        {/* Edit Dialog */}
        <EditWorkItemDialog
          open={editDialogOpen}
          workItem={editingWorkItem}
          onClose={() => {
            setEditDialogOpen(false);
            setEditingWorkItem(null);
          }}
          onUpdated={handleWorkItemUpdated}
        />

        {/* Floating Action Button for mobile */}
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};