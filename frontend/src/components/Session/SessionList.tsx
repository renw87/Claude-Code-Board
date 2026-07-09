import { Plus } from "lucide-react";
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useDeviceType } from "../../hooks/useMediaQuery";
import { useSessions } from "../../hooks/useSessions";
import { Session, SessionStatus } from "../../types/session.types";
import { EmptyState } from "../Common/EmptyState";
import { LoadingSpinner } from "../Common/LoadingSpinner";
import { SessionCard } from "./SessionCard";
import { SearchBar } from "../Common/SearchBar";
import { SortSelector } from "../Common/SortSelector";
import { sortSessions, getSortOptions, SortType } from "../../utils/sessionSort";

interface SessionListProps {
  onCreateSession: () => void;
}

interface KanbanColumnProps {
  title: string;
  color: "yellow" | "green" | "blue" | "red";
  sessions: Session[];
  searchTerm: string;
  onComplete: (sessionId: string) => void;
  onInterrupt: (sessionId: string) => void;
  onResume: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onReorder?: (reorderedSessions: Session[]) => void;
  disableDrag?: boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps & { sortType?: SortType }> = ({ title, color, sessions, searchTerm, onComplete, onInterrupt, onResume, onDelete, onReorder, disableDrag = false, sortType = 'updated_desc' }) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // 过滤并排序 sessions
  const filteredSessions = useMemo(() => {
    let filtered = sessions;
    
    // 先过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = sessions.filter((session) => 
        session.name.toLowerCase().includes(term) || 
        session.task.toLowerCase().includes(term) || 
        session.workingDir.toLowerCase().includes(term)
      );
    }
    
    // 再排序
    return sortSessions(filtered, sortType);
  }, [sessions, searchTerm, sortType]);

  const getColorClasses = () => {
    switch (color) {
      case "yellow":
        return {
          header: "bg-gradient-to-r from-warning-50 to-warning-100/50",
          title: "text-warning-700",
          count: "bg-warning-100 text-warning-700 border border-warning-200",
        };
      case "green":
        return {
          header: "bg-gradient-to-r from-success-50 to-success-100/50",
          title: "text-success-700",
          count: "bg-success-100 text-success-700 border border-success-200",
        };
      case "blue":
        return {
          header: "bg-gradient-to-r from-primary-50 to-primary-100/50",
          title: "text-primary-700",
          count: "bg-primary-100 text-primary-700 border border-primary-200",
        };
      case "red":
        return {
          header: "bg-gradient-to-r from-danger-50 to-danger-100/50",
          title: "text-danger-700",
          count: "bg-danger-100 text-danger-700 border border-danger-200",
        };
    }
  };

  const colorClasses = getColorClasses();

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      return;
    }

    // 获取被拖曳的 session
    const draggedSession = filteredSessions[draggedIndex];
    const dropSession = filteredSessions[dropIndex];

    // 找到在原始 sessions 数组中的索引
    const originalDraggedIndex = sessions.findIndex((s) => s.sessionId === draggedSession.sessionId);
    const originalDropIndex = sessions.findIndex((s) => s.sessionId === dropSession.sessionId);

    if (originalDraggedIndex === -1 || originalDropIndex === -1) {
      return;
    }

    // 重新排序原始 sessions
    const newSessions = [...sessions];
    newSessions.splice(originalDraggedIndex, 1);
    newSessions.splice(originalDropIndex, 0, draggedSession);

    // 调用 onReorder 来更新状态
    onReorder?.(newSessions);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const deviceType = useDeviceType();

  return (
    <div className={`glass-card rounded-xl shadow-soft flex flex-col ${deviceType === "mobile" ? "h-[calc(100vh-280px)]" : "h-[600px]"} ${deviceType === "desktop" ? "min-w-[280px]" : ""}`}>
      {/* 字段标题 */}
      <div className={`px-4 py-3 border-b border-glass-border rounded-t-xl flex-shrink-0 ${colorClasses.header}`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold ${colorClasses.title}`}>{title}</h3>
          <span className={`inline-flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full shadow-soft-sm ${colorClasses.count}`}>{filteredSessions.length}</span>
        </div>
      </div>

      {/* Sessions 列表 */}
      <div className="p-3 space-y-2 flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">没有 Sessions</p>
          </div>
        ) : (
          filteredSessions.map((session, index) => (
            <div key={session.sessionId} className={`transform hover:scale-102 transition-transform ${!disableDrag && dragOverIndex === index ? "border-t-2 border-blue-500" : ""}`} onDragOver={!disableDrag ? (e) => handleDragOver(e, index) : undefined} onDrop={!disableDrag ? (e) => handleDrop(e, index) : undefined}>
              <SessionCard session={session} index={index} onComplete={() => onComplete(session.sessionId)} onInterrupt={() => onInterrupt(session.sessionId)} onResume={() => onResume(session.sessionId)} onDelete={() => onDelete(session.sessionId)} onDragStart={!disableDrag ? handleDragStart : undefined} onDragEnd={!disableDrag ? handleDragEnd : undefined} isDragging={!disableDrag && draggedIndex === index} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const SessionList: React.FC<SessionListProps> = ({ onCreateSession }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"processing" | "idle" | "completed">("idle");
  const [sortType, setSortType] = useState<SortType>('updated_desc');
  const deviceType = useDeviceType();

  const { sessions, sessionsByStatus, loading, error, completeSession, interruptSession, resumeSession, deleteSession, reorderSessionsByStatus } = useSessions();

  const handleComplete = async (sessionId: string) => {
    try {
      await completeSession(sessionId);
      toast.success("Session 已标记为完成");
    } catch (error) {
      toast.error("无法完成 Session");
    }
  };

  const handleInterrupt = async (sessionId: string) => {
    try {
      await interruptSession(sessionId);
      toast.success("Session 已中断");
    } catch (error) {
      toast.error("无法中断 Session");
    }
  };

  const handleResume = async (sessionId: string) => {
    try {
      await resumeSession(sessionId);
      toast.success("Session 已恢复");
    } catch (error) {
      toast.error("无法恢复 Session");
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm("确定要删除这个 Session 吗？此操作无法复原。")) {
      return;
    }

    try {
      await deleteSession(sessionId);
      toast.success("Session 已删除");
    } catch (error) {
      toast.error("无法删除 Session");
    }
  };
  
  // 不再需要 handleContinue，因为用户可以直接在聊天接口中继续对话

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col min-w-0`}>
      {/* 固定的顶部区域 - 包含标题、搜索和创建按钮 */}
      <div className={`glass-card rounded-b-none border-b border-glass-border ${deviceType === "mobile" ? "px-4" : "px-6"} py-4 flex-shrink-0`}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Sessions</h1>

          {/* 搜索框、排序和创建按钮 */}
          <div className="flex items-center gap-2">
            {/* 排序选择器 */}
            <SortSelector
              options={getSortOptions()}
              value={sortType}
              onChange={(value) => setSortType(value as SortType)}
              className="hidden sm:block"
            />
            
            {/* 搜索框 */}
            <SearchBar
              placeholder="搜索..."
              onSearch={setSearchTerm}
              defaultValue={searchTerm}
              className="w-24 sm:w-32"
            />

            {/* 创建按钮 */}
            <button onClick={onCreateSession} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">创建</span>
            </button>
          </div>
        </div>
        
        {/* 手机版排序选择器 */}
        {deviceType === "mobile" && sessions.length > 0 && (
          <div className="mt-3">
            <SortSelector
              options={getSortOptions()}
              value={sortType}
              onChange={(value) => setSortType(value as SortType)}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto">
        <div className={`h-full ${deviceType === "mobile" ? "p-4" : "p-6"}`}>
          {/* Kanban 看板 */}
          {sessions.length === 0 ? (
            <EmptyState title="没有找到 Sessions" description="还没有创建任何 Sessions" actionText="创建第一个 Session" onAction={onCreateSession} />
          ) : (
            <>
              {/* 行动版标签页 */}
              {deviceType === "mobile" && (
                <div className="glass-card rounded-xl shadow-soft p-1 mb-4 overflow-x-auto">
                  <div className="flex">
                    <button onClick={() => setActiveTab("processing")} className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all ${activeTab === "processing" ? "bg-warning-100 text-warning-700 shadow-soft-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                      正在处理 ({sessionsByStatus[SessionStatus.PROCESSING]?.length || 0})
                    </button>
                    <button onClick={() => setActiveTab("idle")} className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all ${activeTab === "idle" ? "bg-success-100 text-success-700 shadow-soft-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                      闲置 ({sessionsByStatus[SessionStatus.IDLE]?.length || 0})
                    </button>
                    <button onClick={() => setActiveTab("completed")} className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all ${activeTab === "completed" ? "bg-primary-100 text-primary-700 shadow-soft-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                      已完成 ({[...(sessionsByStatus[SessionStatus.COMPLETED] || []), ...(sessionsByStatus[SessionStatus.ERROR] || []), ...(sessionsByStatus[SessionStatus.INTERRUPTED] || [])].length})
                    </button>
                  </div>
                </div>
              )}

              <div className={deviceType === "mobile" ? "space-y-4 w-full" : "grid grid-cols-3 gap-4 md:gap-6 min-w-[900px]"}>
                {/* 行动版：根据选中的标签显示单一字段 */}
                {deviceType === "mobile" ? (
                  <>
                    {activeTab === "processing" && <KanbanColumn title="正在处理" color="yellow" sessions={sessionsByStatus[SessionStatus.PROCESSING] || []} searchTerm={searchTerm} sortType={sortType} onComplete={handleComplete} onInterrupt={handleInterrupt} onResume={handleResume} onDelete={handleDelete} disableDrag={true} />}

                    {activeTab === "idle" && <KanbanColumn title="闲置" color="green" sessions={sessionsByStatus[SessionStatus.IDLE] || []} searchTerm={searchTerm} sortType={sortType} onComplete={handleComplete} onInterrupt={handleInterrupt} onResume={handleResume} onDelete={handleDelete} onReorder={(reorderedSessions) => reorderSessionsByStatus(SessionStatus.IDLE, reorderedSessions)} />}

                    {activeTab === "completed" && (
                      <KanbanColumn
                        title="已完成"
                        color="blue"
                        sessions={[...(sessionsByStatus[SessionStatus.COMPLETED] || []), ...(sessionsByStatus[SessionStatus.ERROR] || []), ...(sessionsByStatus[SessionStatus.INTERRUPTED] || [])]}
                        searchTerm={searchTerm}
                        sortType={sortType}
                        onComplete={handleComplete}
                        onInterrupt={handleInterrupt}
                        onResume={handleResume}
                        onDelete={handleDelete}
                        onReorder={(reorderedSessions) => {
                          const completedSessions = reorderedSessions.filter((s) => s.status === SessionStatus.COMPLETED);
                          const errorSessions = reorderedSessions.filter((s) => s.status === SessionStatus.ERROR);
                          const interruptedSessions = reorderedSessions.filter((s) => s.status === SessionStatus.INTERRUPTED);

                          if (completedSessions.length > 0) {
                            reorderSessionsByStatus(SessionStatus.COMPLETED, completedSessions);
                          }
                          if (errorSessions.length > 0) {
                            reorderSessionsByStatus(SessionStatus.ERROR, errorSessions);
                          }
                          if (interruptedSessions.length > 0) {
                            reorderSessionsByStatus(SessionStatus.INTERRUPTED, interruptedSessions);
                          }
                        }}
                      />
                    )}
                  </>
                ) : (
                  <>
                    {/* 桌面版和平板版：显示所有字段 */}
                    <KanbanColumn title="正在处理" color="yellow" sessions={sessionsByStatus[SessionStatus.PROCESSING] || []} searchTerm={searchTerm} sortType={sortType} onComplete={handleComplete} onInterrupt={handleInterrupt} onResume={handleResume} onDelete={handleDelete} disableDrag={true} />

                    <KanbanColumn title="闲置" color="green" sessions={sessionsByStatus[SessionStatus.IDLE] || []} searchTerm={searchTerm} sortType={sortType} onComplete={handleComplete} onInterrupt={handleInterrupt} onResume={handleResume} onDelete={handleDelete} onReorder={(reorderedSessions) => reorderSessionsByStatus(SessionStatus.IDLE, reorderedSessions)} />

                    <KanbanColumn
                      title="已完成"
                      color="blue"
                      sessions={[...(sessionsByStatus[SessionStatus.COMPLETED] || []), ...(sessionsByStatus[SessionStatus.ERROR] || []), ...(sessionsByStatus[SessionStatus.INTERRUPTED] || [])]}
                      searchTerm={searchTerm}
                      sortType={sortType}
                      onComplete={handleComplete}
                      onInterrupt={handleInterrupt}
                      onResume={handleResume}
                      onDelete={handleDelete}
                      onReorder={(reorderedSessions) => {
                        const completedSessions = reorderedSessions.filter((s) => s.status === SessionStatus.COMPLETED);
                        const errorSessions = reorderedSessions.filter((s) => s.status === SessionStatus.ERROR);
                        const interruptedSessions = reorderedSessions.filter((s) => s.status === SessionStatus.INTERRUPTED);

                        if (completedSessions.length > 0) {
                          reorderSessionsByStatus(SessionStatus.COMPLETED, completedSessions);
                        }
                        if (errorSessions.length > 0) {
                          reorderSessionsByStatus(SessionStatus.ERROR, errorSessions);
                        }
                        if (interruptedSessions.length > 0) {
                          reorderSessionsByStatus(SessionStatus.INTERRUPTED, interruptedSessions);
                        }
                      }}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
