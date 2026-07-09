import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Square,
  RotateCcw,
  Trash2,
  Download,
  Folder,
  CheckCircle,
  Settings,
  Plus
} from 'lucide-react';
import { sessionApi, projectApi, tagApi } from '../../services/api';
import { Session, Message, SessionStatus } from '../../types/session.types';
import { Project, Tag } from '../../types/classification.types';
import { ChatInterface } from './ChatInterface';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { cn, getStatusColor, getStatusText } from '../../utils';
import { useSessions } from '../../hooks/useSessions';
import { useWebSocket } from '../../hooks/useWebSocket';
import { WebSocketError } from '../../services/websocket';
import toast from 'react-hot-toast';
import { Tooltip } from '../Common/Tooltip';
import { ProjectSelector } from '../Classification/ProjectSelector';
import { TagSelector } from '../Classification/TagSelector';
import { CreateSessionModal } from './CreateSessionModal';

interface SessionDetailProps {
  sessionId?: string;
  embedded?: boolean;
}

const SessionDetailComponent: React.FC<SessionDetailProps> = ({ sessionId: propSessionId, embedded = false }) => {
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const sessionId = propSessionId || urlSessionId;
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClassification, setShowClassification] = useState(false);
  const [sessionProjects, setSessionProjects] = useState<string[]>([]);
  const [_sessionTags, setSessionTags] = useState<string[]>([]);
  const [topicTags, setTopicTags] = useState<string[]>([]);
  const [showQuickStart, setShowQuickStart] = useState(false);
  
  const { completeSession, interruptSession, resumeSession, deleteSession } = useSessions();
  const { addEventListener, removeEventListener } = useWebSocket();

  useEffect(() => {
    if (!sessionId) {
      if (!embedded) {
        navigate('/');
      }
      return;
    }

    loadSessionDetails();
  }, [sessionId, navigate, embedded]);

  // 监听 WebSocket 状态更新
  useEffect(() => {
    if (!sessionId) return;

    const handleStatusUpdate = (data: { sessionId: string; status: string }) => {
      if (data.sessionId === sessionId) {
        console.log('Status update received:', data.status);
        setSession(prev => {
          if (!prev) return prev;
          
          // 将状态字符串转换为 SessionStatus 枚举
          let newStatus: SessionStatus;
          switch (data.status) {
            case 'idle':
              newStatus = SessionStatus.IDLE;
              break;
            case 'processing':
              newStatus = SessionStatus.PROCESSING;
              break;
            case 'error':
              newStatus = SessionStatus.ERROR;
              break;
            case 'completed':
              newStatus = SessionStatus.COMPLETED;
              break;
            case 'interrupted':
              newStatus = SessionStatus.INTERRUPTED;
              break;
            default:
              return prev;
          }
          
          return {
            ...prev,
            status: newStatus,
            // 如果状态变为 idle，清调试误消息
            error: newStatus === SessionStatus.IDLE ? undefined : prev.error
          };
        });
      }
    };

    addEventListener('status_update', handleStatusUpdate);
    addEventListener('global_status_update', handleStatusUpdate);

    return () => {
      removeEventListener('status_update', handleStatusUpdate);
      removeEventListener('global_status_update', handleStatusUpdate);
    };
  }, [sessionId, addEventListener, removeEventListener]);

  // 监听 WebSocket 错误事件
  useEffect(() => {
    if (!sessionId) return;

    const handleError = (data: WebSocketError) => {
      if (data.sessionId === sessionId) {
        console.error('Session error received:', data);
        
        // 显示详细的错误消息
        const errorMessage = data.error || '运行时发生未知错误';
        const errorDetails = [];
        
        if (data.errorType) {
          errorDetails.push(`错误类型: ${data.errorType}`);
        }
        
        if (data.details?.stderr) {
          errorDetails.push(`详细信息: ${data.details.stderr}`);
        }
        
        if (data.details?.exitCode) {
          errorDetails.push(`退出代码: ${data.details.exitCode}`);
        }
        
        // 显示错误通知
        toast.error(
          <div>
            <div className="font-semibold">{errorMessage}</div>
            {errorDetails.length > 0 && (
              <div className="text-sm mt-1">
                {errorDetails.map((detail, index) => (
                  <div key={index}>{detail}</div>
                ))}
              </div>
            )}
          </div>,
          { duration: 10000 }
        );
        
        // 更新 session 状态
        setSession(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            status: SessionStatus.ERROR,
            error: JSON.stringify({
              message: data.error,
              type: data.errorType,
              details: data.details,
              timestamp: data.timestamp
            })
          };
        });
      }
    };

    addEventListener('error', handleError);

    return () => {
      removeEventListener('error', handleError);
    };
  }, [sessionId, addEventListener, removeEventListener]);

  const handleSessionUpdate = (updates: Partial<Session>) => {
    console.log('=== SessionDetail handleSessionUpdate ===', updates);
    setSession(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        ...updates
      };
      console.log('=== SessionDetail session 更新前 ===', prev);
      console.log('=== SessionDetail session 更新后 ===', updated);
      return updated;
    });
  };

  const loadSessionDetails = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);
      
      // 并行加载 session 数据、项目和标签
      const [sessionData, projects, tags] = await Promise.all([
        sessionApi.getSession(sessionId),
        projectApi.getProjectsBySessionId(sessionId).catch(() => []),
        tagApi.getTagsBySessionId(sessionId).catch(() => [])
      ]);
      
      console.log('=== SessionDetail API 回传数据 ===');
      console.log('sessionData:', sessionData);
      console.log('projects:', projects);
      console.log('tags:', tags);
      
      setSession(sessionData);
      setSessionProjects(projects.map((p: Project) => p.project_id));
      
      // 根据标签类型分组
      const allTagIds = tags.map((t: Tag) => t.tag_id);
      const topicTagIds = tags.filter((t: Tag) => t.type === 'topic').map((t: Tag) => t.tag_id);
      
      setSessionTags(allTagIds);
      setTopicTags(topicTagIds);
      
      // 不再这里加载消息，交给 ChatInterface 的 messageStore 处理
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session details');
      console.error('Error loading session details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!sessionId) return;
    
    try {
      const updatedSession = await completeSession(sessionId);
      setSession(updatedSession);
      toast.success('Session 已标记为完成');
    } catch (error) {
      toast.error('无法完成 Session');
    }
  };

  const handleInterrupt = async () => {
    if (!sessionId) return;
    
    try {
      const updatedSession = await interruptSession(sessionId);
      setSession(updatedSession);
      toast.success('Session 已中断');
    } catch (error) {
      toast.error('无法中断 Session');
    }
  };

  const handleResume = async () => {
    if (!sessionId) return;
    
    try {
      const updatedSession = await resumeSession(sessionId);
      setSession(updatedSession);
      toast.success('Session 已恢复');
    } catch (error) {
      toast.error('无法恢复 Session');
    }
  };

  // handleContinue 函数已移除，因为用户现在可以直接在聊天接口中继续对话

  const handleDelete = async () => {
    if (!sessionId) return;
    
    if (!confirm('确定要删除这个 Session 吗？此操作无法复原。')) {
      return;
    }

    try {
      await deleteSession(sessionId);
      toast.success('Session 已删除');
      if (!embedded) {
        navigate('/');
      }
    } catch (error) {
      toast.error('无法删除 Session');
    }
  };

  const handleExportMessages = () => {
    if (!messages.length) {
      toast.error('没有消息可以导出');
      return;
    }

    const exportData = {
      session: {
        id: session?.sessionId,
        name: session?.name,
        task: session?.task,
        workingDir: session?.workingDir,
        status: session?.status,
        createdAt: session?.createdAt,
        updatedAt: session?.updatedAt,
      },
      messages: messages.map(msg => ({
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp,
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session?.name || sessionId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('消息已导出');
  };

  const handleQuickStart = () => {
    setShowQuickStart(true);
  };

  const handleQuickStartCreated = (newSession: Session) => {
    setShowQuickStart(false);
    toast.success('新 Session 已创建');
    // 导航到新的 Session
    navigate(`/sessions/${newSession.sessionId}`);
  };

  // 准备预填数据
  const getPrefillData = () => {
    if (!session) return undefined;

    return {
      baseSessionName: session.name,
      workingDir: session.workingDir,
      work_item_id: session.work_item_id,
      workflow_stage_id: session.workflow_stage_id,
      name: `${session.name} - 新任务`,
      task: `基于前一个对话的上下文，请先阅读 dev.md 和相关项目文件。

新任务：`,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="加载 Session 详情中..." />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error || 'Session 不存在'}</div>
        {!embedded && (
          <button 
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            返回 Sessions 列表
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 页面标题和操作 */}
      <div className="glass-card border-b border-glass-border px-3 py-2">
        <div className="pl-24">
          {/* 标题和状态 */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h1 className="text-lg font-bold text-gray-900 truncate flex-1 min-w-0">
              {session.name}
            </h1>
            <div className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
              getStatusColor(session.status)
            )}>
              {getStatusText(session.status)}
            </div>
          </div>
          
          {/* 元信息 - 极简模式 */}
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <div className="flex items-center gap-1 min-w-0">
              <Folder className="w-3 h-3 flex-shrink-0" />
              <span className="truncate" title={session.workingDir}>
                {session.workingDir.split('/').pop() || 'root'}
              </span>
            </div>
            {/* 操作按钮 - 移到第二行 */}
            <div className="flex items-center gap-1 mt-1.5">
              <Tooltip content="分类管理">
                <button
                  onClick={() => setShowClassification(!showClassification)}
                  className={cn(
                    "p-1.5 rounded-lg transition-all hover:shadow-soft-sm",
                    showClassification
                      ? "bg-primary-100 text-primary-600"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </Tooltip>

              <Tooltip content="导出对话">
                <button
                  onClick={handleExportMessages}
                  className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-all hover:shadow-soft-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </Tooltip>

              <Tooltip content="基于此对话快速启动">
                <button
                  onClick={handleQuickStart}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all hover:shadow-soft-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </Tooltip>

              {/* 根据状态显示不同操作 */}
              {session.status === SessionStatus.PROCESSING && (
                <Tooltip content="中断运行">
                  <button
                    onClick={handleInterrupt}
                    className="p-1.5 text-warning-600 hover:bg-warning-50 rounded-lg transition-all hover:shadow-soft-sm"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              )}
              
              {session.status === SessionStatus.IDLE && (
                <Tooltip content="标记为完成">
                  <button
                    onClick={handleComplete}
                    className="p-1.5 text-success-600 hover:bg-success-50 rounded-lg transition-all hover:shadow-soft-sm"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              )}

              {session.status === SessionStatus.INTERRUPTED && (
                <>
                  <Tooltip content="恢复 Session">
                    <button
                      onClick={handleResume}
                      className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-all hover:shadow-soft-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="标记为完成">
                    <button
                      onClick={handleComplete}
                      className="p-1.5 text-success-600 hover:bg-success-50 rounded-lg transition-all hover:shadow-soft-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </>
              )}

              {/* COMPLETED 和 ERROR 状态的 Session 可以直接在聊天接口中继续对话 */}

              <Tooltip content="删除 Session">
                <button
                  onClick={handleDelete}
                  className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-all hover:shadow-soft-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* 分类管理面板 */}
        {showClassification && (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="space-y-4">
              <ProjectSelector
                sessionId={sessionId!}
                selectedProjects={sessionProjects}
                onProjectsChange={setSessionProjects}
              />
              <TagSelector
                sessionId={sessionId!}
                selectedTags={topicTags}
                onTagsChange={setTopicTags}
                tagType="topic"
              />
            </div>
          </div>
        )}

        {/* 错误消息 */}
        {session.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-sm font-medium text-red-700 mb-2">错误消息：</h3>
            <p className="text-red-600 text-sm">{session.error}</p>
          </div>
        )}
      </div>

      {/* 聊天接口 */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface
          sessionId={sessionId!}
          session={session}
          initialMessages={messages}
          isSessionActive={session.status === SessionStatus.IDLE || session.status === SessionStatus.PROCESSING || session.status === SessionStatus.COMPLETED || session.status === SessionStatus.ERROR}
          isProcessing={session.status === SessionStatus.PROCESSING}
          onSessionUpdate={handleSessionUpdate}
        />
      </div>

      {/* 快速启动 Modal */}
      <CreateSessionModal
        isOpen={showQuickStart}
        onClose={() => setShowQuickStart(false)}
        prefillData={getPrefillData()}
        onCreated={handleQuickStartCreated}
      />
    </div>
  );
};

// 使用 React.memo 来防止不必要的重新渲染
export const SessionDetail = React.memo(SessionDetailComponent);