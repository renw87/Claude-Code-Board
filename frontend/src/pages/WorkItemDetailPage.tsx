import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Briefcase, 
  Plus, 
  Clock, 
  Play, 
  CheckCircle, 
  XCircle,
  Trash2,
  Calendar,
  Edit2,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  List,
  Hash,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { useWorkItemStore } from '../stores/workItemStore';
import { useSessions } from '../hooks/useSessions';
import { SessionCard } from '../components/Session/SessionCard';
import { CreateSessionModal } from '../components/Session/CreateSessionModal';
import { EditWorkItemDialog } from '../components/WorkItem/EditWorkItemDialog';
import { WorkItemStatus } from '../types/workitem';
import toast from 'react-hot-toast';
import { workItemApi } from '../services/workItemApi';
import { SessionDetail } from '../components/Session/SessionDetail';
import { SearchBar } from '../components/Common/SearchBar';
import { MarkdownRenderer } from '../components/Common/MarkdownRenderer';

export const WorkItemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    currentWorkItem, 
    fetchWorkItem, 
    updateWorkItem, 
    deleteWorkItem 
  } = useWorkItemStore();
  const { sessions, loadSessions, deleteSession } = useSessions();
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [devMdContent, setDevMdContent] = useState<string>('');
  const [loadingDevMd, setLoadingDevMd] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<'devmd' | 'session' | null>('devmd'); // 控制右侧显示内容
  const [showNavPanel, setShowNavPanel] = useState(false); // 显示快速导览面板
  const [sessionSearchQuery, setSessionSearchQuery] = useState(''); // Session 搜索关键字
  const devMdContentRef = useRef<HTMLDivElement>(null);
  
  // 从 localStorage 读取 dev.md 侧边栏状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('devMdSidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // 从 localStorage 读取侧边栏宽度
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('devMdSidebarWidth');
    return saved ? parseInt(saved, 10) : 500; // 默认 500px
  });

  // 拖曳调整宽度的状态
  const [isResizing, setIsResizing] = useState(false);
  const MIN_WIDTH = 300;
  const MAX_WIDTH = 1200;

  // 切换侧边栏状态并保存到 localStorage
  const toggleDevMdSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('devMdSidebarCollapsed', JSON.stringify(newState));
  };

  // 处理拖曳开始
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // 处理拖曳中
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
        localStorage.setItem('devMdSidebarWidth', newWidth.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // 解析 dev.md 内容，提取 Session 段落信息
  const sessionSections = useMemo(() => {
    if (!devMdContent) return [];
    
    const sections: Array<{ title: string; sessionName: string; sessionId: string; lineNumber: number; isStandard: boolean }> = [];
    const lines = devMdContent.split('\n');
    
    lines.forEach((line, index) => {
      // 优先匹配标准格式：## [Session名称] - sessionId
      const standardMatch = line.match(/^##\s+\[([^\]]+)\]\s+-\s+([a-f0-9]{8})/i);
      if (standardMatch) {
        sections.push({
          title: line.replace(/^##\s+/, ''),
          sessionName: standardMatch[1],
          sessionId: standardMatch[2],
          lineNumber: index,
          isStandard: true
        });
        return;
      }
      
      // 回退：匹配任何 ## 开头的标题
      const h2Match = line.match(/^##\s+(.+)/);
      if (h2Match) {
        const titleContent = h2Match[1].trim();
        // 跳过一些可能的系统标题
        if (!titleContent.match(/^(dev\.md|开发日志|Work Item|任务|备注)/i)) {
          sections.push({
            title: titleContent,
            sessionName: titleContent,
            sessionId: '',
            lineNumber: index,
            isStandard: false
          });
        }
      }
    });
    
    return sections;
  }, [devMdContent]);

  // 滚动到指定的 Session 段落
  const scrollToSection = (sessionName: string, isStandard: boolean = true) => {
    if (!devMdContentRef.current) return;
    
    // 找到对应的标题元素
    const headings = devMdContentRef.current.querySelectorAll('h2');
    for (const heading of headings) {
      const text = heading.textContent || '';
      
      // 根据是否为标准格式使用不同的匹配方式
      const isMatch = isStandard 
        ? text.includes(`[${sessionName}]`)
        : text.trim() === sessionName;
        
      if (isMatch) {
        // 滚动到该元素
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // 高亮效果
        heading.classList.add('bg-yellow-200', 'transition-colors');
        setTimeout(() => {
          heading.classList.remove('bg-yellow-200');
        }, 2000);
        
        break;
      }
    }
  };

  useEffect(() => {
    if (id) {
      loadWorkItem();
      // 自动加载 dev.md
      loadDevMd();
    }
  }, [id]);

  useEffect(() => {
    // 每次 sessions 更新时重新加载
    loadSessions();
  }, []);

  // 处理 Session 选择
  const handleSessionClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setRightPanelView('session'); // 切换到显示 Session
    setSidebarCollapsed(false); // 展开侧边栏以显示 Session
  };

  // 处理 Session 删除
  const handleSessionDelete = async (sessionId: string) => {
    if (window.confirm('确定要删除这个 Session 吗？这个动作无法复原。')) {
      try {
        await deleteSession(sessionId);
        toast.success('Session 已删除');
        
        // 如果删除的是当前选中的 Session，清除选择状态
        if (selectedSessionId === sessionId) {
          setSelectedSessionId(null);
          setRightPanelView('devmd');
        }
        
        // 重新加载相关数据
        loadSessions();
        loadWorkItem();
        loadDevMd(); // 删除后重新加载 dev.md
      } catch (error) {
        console.error('Failed to delete session:', error);
        toast.error('删除 Session 失败');
      }
    }
  };


  const loadWorkItem = async () => {
    if (!id) return;
    setLoading(true);
    try {
      await fetchWorkItem(id);
    } finally {
      setLoading(false);
    }
  };

  // 过滤出属于这个 Work Item 的 Sessions，并根据搜索关键字过滤
  const workItemSessions = useMemo(() => {
    let filtered = sessions.filter(s => s.work_item_id === id);
    
    // 如果有搜索关键字，进一步过滤
    if (sessionSearchQuery) {
      const query = sessionSearchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.task.toLowerCase().includes(query) ||
        (s.lastUserMessage && s.lastUserMessage.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [sessions, id, sessionSearchQuery]);


  const handleStatusChange = async (status: WorkItemStatus) => {
    if (!id) return;
    try {
      await updateWorkItem(id, { 
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : undefined
      });
      
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


  const handleDelete = async () => {
    if (!id) return;
    if (window.confirm('确定要删除这个 Work Item 吗？相关的 Sessions 不会被删除，但会解除关联。')) {
      try {
        await deleteWorkItem(id);
        toast.success('Work Item 已删除');
        navigate('/work-items');
      } catch (err) {
        console.error('Failed to delete work item:', err);
        toast.error('删除 Work Item 失败');
      }
    }
  };

  const loadDevMd = async () => {
    if (!id) return;
    
    setLoadingDevMd(true);
    try {
      const content = await workItemApi.getDevMd(id);
      setDevMdContent(content);
    } catch (err) {
      console.error('Failed to load dev.md:', err);
      toast.error('加载 dev.md 失败');
    } finally {
      setLoadingDevMd(false);
    }
  };

  const downloadDevMd = () => {
    if (!devMdContent || !currentWorkItem) return;
    
    const blob = new Blob([devMdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentWorkItem.title}-dev.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('dev.md 已下载');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentWorkItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <Briefcase className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-medium text-gray-900 mb-2">找不到 Work Item</h2>
        <button
          onClick={() => navigate('/work-items')}
          className="text-blue-600 hover:text-blue-700"
        >
          返回列表
        </button>
      </div>
    );
  }

  const statusConfig = {
    planning: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: '规划中' },
    in_progress: { icon: Play, color: 'text-blue-500', bg: 'bg-blue-100', label: '进行中' },
    completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', label: '已完成' },
    cancelled: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', label: '已取消' }
  };


  const status = statusConfig[currentWorkItem.status];
  const StatusIcon = status.icon;

  // 计算进度
  const completedSessions = workItemSessions.filter(s => s.status === 'completed').length;
  const progress = workItemSessions.length > 0 
    ? Math.round((completedSessions / workItemSessions.length) * 100)
    : 0;

  return (
    <div className="flex-1 bg-gray-50">
      <div className="flex h-full">
        {/* 主内容区 */}
        <div
          className="flex-1 px-2 sm:px-3 lg:px-4 py-2 transition-all duration-300"
          style={{
            marginRight: sidebarCollapsed ? '48px' : `${sidebarWidth}px`
          }}
        >
        {/* Header */}
        <div className="mb-3">
          <div className="bg-white rounded-lg shadow p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => navigate('/work-items')}
                    className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="text-xs">返回</span>
                  </button>
                  <span className="text-gray-300">|</span>
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <h1 className="text-lg font-bold text-gray-900">{currentWorkItem.title}</h1>
                </div>
                
                {currentWorkItem.description && (
                  <p className="text-xs text-gray-600 mb-1 line-clamp-1 ml-20">{currentWorkItem.description}</p>
                )}
                
                {currentWorkItem.workspace_path && (
                  <p className="text-xs text-gray-500 mb-1 ml-20">
                    📁 {currentWorkItem.workspace_path}
                  </p>
                )}

                {/* Badges and Meta Info in one line */}
                <div className="flex flex-wrap items-center gap-2 text-sm ml-20">
                  {/* Status */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>

                  {/* Progress */}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600">
                    进度 {progress}%
                  </span>
                  
                  {/* Meta Info inline */}
                  <span className="text-gray-500 flex items-center gap-1 text-xs">
                    <Calendar className="w-3 h-3" />
                    创建于 {formatDistanceToNow(new Date(currentWorkItem.created_at), { locale: zhTW, addSuffix: true })}
                  </span>
                  {currentWorkItem.completed_at && (
                    <span className="text-green-600 text-xs">
                      完成于 {formatDistanceToNow(new Date(currentWorkItem.completed_at), { locale: zhTW, addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1 flex-shrink-0">
                {currentWorkItem.status === 'planning' && (
                  <button
                    onClick={() => handleStatusChange('in_progress')}
                    className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                  >
                    开始运行
                  </button>
                )}
                {currentWorkItem.status === 'in_progress' && (
                  <button
                    onClick={() => handleStatusChange('completed')}
                    className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs"
                  >
                    标记完成
                  </button>
                )}
                <button
                  onClick={() => setEditDialogOpen(true)}
                  className="p-1 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                  title="编辑"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Sessions */}
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">
                Sessions ({workItemSessions.length})
              </h2>
              <span className="text-xs text-gray-500">
                {completedSessions} 完成
              </span>
            </div>
            <button
              onClick={() => setCreateSessionOpen(true)}
              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1 text-xs"
            >
              <Plus className="w-3 h-3" />
              添加
            </button>
          </div>

          {/* 搜索框 - 只在有 Sessions 时显示 */}
          {sessions.filter(s => s.work_item_id === id).length > 0 && (
            <div className="mb-3">
              <SearchBar
                placeholder="搜索 Sessions..."
                onSearch={setSessionSearchQuery}
                defaultValue={sessionSearchQuery}
                className="w-full"
                debounceDelay={200}
              />
            </div>
          )}

          {/* Progress Bar */}
          {workItemSessions.length > 0 && (
            <div className="mb-2">
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div 
                  className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Session List */}
          {workItemSessions.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-gray-400 mb-2">
                <Calendar className="w-8 h-8 mx-auto" />
              </div>
              <p className="text-xs text-gray-500 mb-2">
                还没有 Sessions
              </p>
              <button
                onClick={() => setCreateSessionOpen(true)}
                className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors inline-flex items-center gap-1 text-xs"
              >
                <Plus className="w-3 h-3" />
                创建第一个
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {workItemSessions.map((session, index) => {
                // 根据 Session 状态决定色块颜色
                const getStatusColor = () => {
                  switch (session.status) {
                    case 'processing':
                      return { bg: 'bg-yellow-500', title: '处理中' };
                    case 'completed':
                      return { bg: 'bg-green-500', title: '已完成' };
                    case 'error':
                      return { bg: 'bg-red-500', title: '发生错误' };
                    case 'interrupted':
                      return { bg: 'bg-orange-500', title: '已中断' };
                    case 'idle':
                      return { bg: 'bg-blue-500', title: '闲置中' };
                    default:
                      return { bg: 'bg-gray-400', title: '未知状态' };
                  }
                };
                
                const statusColor = getStatusColor();
                
                return (
                  <div key={session.sessionId} className="w-full relative">
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 z-10">
                      <div className={`${statusColor.bg} w-1.5 h-6 rounded-r`} title={statusColor.title} />
                    </div>
                    <div 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSessionClick(session.sessionId);
                      }}
                      className={`cursor-pointer transition-all ${
                        selectedSessionId === session.sessionId 
                          ? 'ring-2 ring-blue-500 rounded-lg' 
                          : ''
                      }`}
                    >
                      <SessionCard
                        session={session}
                        index={index}
                        onComplete={() => {}}
                        onInterrupt={() => {}}
                        onResume={() => {}}
                        onDelete={() => handleSessionDelete(session.sessionId)}
                        preserveWorkItemContext={false}
                        workItemId={id}
                        disableNavigation={true}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Session Modal - 默认关联到这个 Work Item */}
        {createSessionOpen && (
          <CreateSessionModal
            isOpen={createSessionOpen}
            onClose={() => {
              setCreateSessionOpen(false);
              loadSessions(); // 重新加载 sessions
              loadWorkItem(); // 重新加载 Work Item 以更新统计数据
            }}
            defaultWorkItemId={id}
          />
        )}

        {/* Edit Work Item Dialog */}
        <EditWorkItemDialog
          open={editDialogOpen}
          workItem={currentWorkItem}
          onClose={() => setEditDialogOpen(false)}
          onUpdated={() => {
            loadWorkItem();
            setEditDialogOpen(false);
            toast.success('Work Item 已更新');
          }}
        />
        </div>

        {/* 右侧侧边栏 - 统一容器 */}
        <div
          className="fixed right-0 top-0 h-full bg-white shadow-lg z-10"
          style={{
            width: sidebarCollapsed ? '48px' : `${sidebarWidth}px`,
            transition: isResizing ? 'none' : 'all 0.3s'
          }}
        >
          {/* 拖曳调整手柄 - 只在展开时显示 */}
          {!sidebarCollapsed && (
            <div
              onMouseDown={handleMouseDown}
              className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-400 transition-colors group"
              style={{ zIndex: 30 }}
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-gray-300 group-hover:bg-blue-500 transition-colors rounded-r" />
            </div>
          )}

          {/* 收合/展开按钮 */}
          <button
            onClick={toggleDevMdSidebar}
            className="absolute -left-3 top-1/2 -translate-y-1/2 bg-white shadow-md rounded-full p-1 hover:bg-gray-50 transition-colors z-20"
          >
            {sidebarCollapsed ? (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>

          {/* 侧边栏内容 */}
          {!sidebarCollapsed ? (
            <div className="h-full flex flex-col">
              {/* 顶部切换标签 - 只在有 Session 时显示 */}
              {selectedSessionId && (
                <div className="flex border-b">
                  <button
                    onClick={() => setRightPanelView('devmd')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      rightPanelView === 'devmd' 
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    开发日志
                  </button>
                  <button
                    onClick={() => setRightPanelView('session')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      rightPanelView === 'session' 
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Session 详情
                  </button>
                </div>
              )}

              {/* 内容区域 */}
              {rightPanelView === 'session' && selectedSessionId ? (
                // SessionDetail 内容
                <div className="flex-1 overflow-hidden">
                  <SessionDetail key={selectedSessionId} sessionId={selectedSessionId} embedded={true} />
                </div>
              ) : (
                // dev.md 内容
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                    <h2 className="text-sm font-semibold text-gray-900">开发日志 (dev.md)</h2>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={loadDevMd}
                        className={`p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors ${
                          loadingDevMd ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="重新加载 dev.md"
                        disabled={loadingDevMd}
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingDevMd ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => setShowNavPanel(!showNavPanel)}
                        className={`p-1.5 rounded transition-colors relative ${
                          showNavPanel ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                        title="快速导览"
                      >
                        <List className="w-4 h-4" />
                        {sessionSections.length > 0 && (
                          <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                            {sessionSections.length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={downloadDevMd}
                        className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                        title="下载 dev.md"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* 快速导览面板 */}
                  {showNavPanel && (
                    <div className="border-b bg-gray-50 p-3 flex-shrink-0">
                      {sessionSections.length > 0 ? (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              快速跳转到 Session 段落
                            </div>
                            <span className="text-[10px] text-gray-500">
                              共 {sessionSections.length} 个段落
                            </span>
                          </div>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {sessionSections.map((section, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  scrollToSection(section.sessionName, section.isStandard);
                                  setShowNavPanel(false);
                                }}
                                className="w-full text-left px-2 py-1 text-xs rounded transition-colors flex items-center gap-2 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <span className="text-gray-400">#{index + 1}</span>
                                <span className="truncate flex-1 font-medium">
                                  {section.sessionName}
                                </span>
                                {section.isStandard ? (
                                  <span className="text-gray-400 text-[10px]">{section.sessionId}</span>
                                ) : (
                                  <span className="text-orange-400 text-[10px]" title="非标准格式">H2</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-3">
                          <Hash className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">尚无 Session 段落</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            Claude Code 运行后会自动创建段落
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex-1 overflow-y-auto p-4 min-h-0">
                    {loadingDevMd ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : devMdContent ? (
                      <div ref={devMdContentRef}>
                        <MarkdownRenderer content={devMdContent} />
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 text-sm">
                        <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>dev.md 尚未创建</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // 收合时的图标
            <div className="h-full flex items-center justify-center">
              {rightPanelView === 'session' && selectedSessionId ? (
                <MessageSquare className="w-5 h-5 text-gray-400" />
              ) : (
                <FileText className="w-5 h-5 text-gray-400" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};