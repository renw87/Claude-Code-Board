import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { sessionApi } from '../services/api';
import { Session, CreateSessionRequest, SessionStatus, SystemStats } from '../types/session.types';
import { useWebSocket } from '../hooks/useWebSocket';

interface SessionsContextValue {
  sessions: Session[];
  sessionsByStatus: Record<string, Session[]>;
  systemStats: SystemStats | null;
  loading: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  createSession: (request: CreateSessionRequest) => Promise<Session>;
  importHistory: () => Promise<{ imported: number; skipped: number; errors: number }>;
  completeSession: (sessionId: string) => Promise<Session>;
  interruptSession: (sessionId: string) => Promise<Session>;
  resumeSession: (sessionId: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
  reorderSessionsByStatus: (status: SessionStatus, reorderedSessions: Session[]) => void;
}

const SessionsContext = createContext<SessionsContextValue | undefined>(undefined);

export const useSessionsContext = () => {
  const context = useContext(SessionsContext);
  if (!context) {
    throw new Error('useSessionsContext must be used within SessionsProvider');
  }
  return context;
};

export const SessionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const initialLoadRef = useRef(false);
  
  const { addEventListener, removeEventListener } = useWebSocket();

  // 加载所有 sessions
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sessionsData, statsData] = await Promise.all([
        sessionApi.getAllSessions(),
        sessionApi.getSystemStats()
      ]);
      setSessions(sessionsData);
      setSystemStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 创建新 session
  const createSession = useCallback(async (request: CreateSessionRequest): Promise<Session> => {
    try {
      setError(null);
      const newSession = await sessionApi.createSession(request);
      setSessions(prev => [newSession, ...prev]);
      return newSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // 导入 ~/.claude/projects/ 历史会话（只读、去重），完成后刷新列表
  const importHistory = useCallback(async () => {
    try {
      setError(null);
      const summary = await sessionApi.importHistory();
      await loadSessions();
      return { imported: summary.imported, skipped: summary.skipped, errors: summary.errors.length };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import history';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [loadSessions]);

  // 完成 session
  const completeSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      const updatedSession = await sessionApi.completeSession(sessionId);
      
      // 更新状态并将 session 移到已完成列表的最前面
      setSessions(prev => {
        const session = prev.find(s => s.sessionId === sessionId);
        if (!session) return prev;
        
        // 取得已完成、错误、中断的状态栏表
        const completedStatuses = [SessionStatus.COMPLETED, SessionStatus.ERROR, SessionStatus.INTERRUPTED];
        
        // 合并：其他状态 + 新完成的（在已完成组的最前面）+ 其他已完成的
        const result: Session[] = [];
        let insertedCompleted = false;
        
        for (const s of prev) {
          if (s.sessionId === sessionId) {
            continue; // 跳过原本的 session
          }
          
          if (!insertedCompleted && completedStatuses.includes(s.status)) {
            // 在遇到第一个已完成类型时，先插入新完成的 session
            result.push(updatedSession);
            insertedCompleted = true;
          }
          
          result.push(s);
        }
        
        // 如果没有其他已完成的 sessions，将新完成的放在最后
        if (!insertedCompleted) {
          result.push(updatedSession);
        }
        
        return result;
      });
      
      return updatedSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // 中断 session
  const interruptSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      const updatedSession = await sessionApi.interruptSession(sessionId);
      setSessions(prev => prev.map(session => 
        session.sessionId === sessionId ? updatedSession : session
      ));
      return updatedSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to interrupt session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // 恢复 session
  const resumeSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      const updatedSession = await sessionApi.resumeSession(sessionId);
      setSessions(prev => prev.map(session => 
        session.sessionId === sessionId ? updatedSession : session
      ));
      return updatedSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // 删除 session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      await sessionApi.deleteSession(sessionId);
      setSessions(prev => prev.filter(session => session.sessionId !== sessionId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // 重新排序特定状态的 sessions
  const reorderSessionsByStatus = useCallback(async (status: SessionStatus, reorderedSessions: Session[]) => {
    // 立即更新本地状态
    setSessions(prev => {
      // 获取其他状态的 sessions
      const otherSessions = prev.filter(session => session.status !== status);
      
      // 合并重新排序的 sessions 和其他状态的 sessions
      // 保持其他状态的 sessions 在原来的相对位置
      const newSessions: Session[] = [];
      let reorderedIndex = 0;
      let otherIndex = 0;
      
      // 遍历原始 sessions，决定是使用重新排序的还是其他的
      for (const session of prev) {
        if (session.status === status) {
          // 使用重新排序的 session
          if (reorderedIndex < reorderedSessions.length) {
            newSessions.push(reorderedSessions[reorderedIndex]);
            reorderedIndex++;
          }
        } else {
          // 使用其他状态的 session
          if (otherIndex < otherSessions.length) {
            newSessions.push(otherSessions[otherIndex]);
            otherIndex++;
          }
        }
      }
      
      return newSessions;
    });

    // 发送 API 请求保存排序
    try {
      const sessionIds = reorderedSessions.map(s => s.sessionId);
      await sessionApi.reorderSessions(status, sessionIds);
    } catch (error) {
      console.error('Failed to save session order:', error);
      // 可选：如果保存失败，可以重新加载 sessions
      // await loadSessions();
    }
  }, []);

  // 更新单个 session 状态
  const updateSessionStatus = useCallback((sessionId: string, status: SessionStatus) => {
    setSessions(prev => prev.map(session => 
      session.sessionId === sessionId 
        ? { 
            ...session, 
            status, 
            updatedAt: new Date(),
            // 如果状态不是 ERROR，清调试误消息
            error: status === SessionStatus.ERROR ? session.error : undefined
          }
        : session
    ));
  }, []);

  // 监听 WebSocket 状态更新
  useEffect(() => {
    const handleStatusUpdate = (data: { sessionId: string; status: string }) => {
      // 将小写状态转换为大写的 enum 值
      const statusMap: Record<string, SessionStatus> = {
        'processing': SessionStatus.PROCESSING,
        'idle': SessionStatus.IDLE,
        'initializing': SessionStatus.PROCESSING,
        'running': SessionStatus.IDLE,
        'completed': SessionStatus.COMPLETED,
        'error': SessionStatus.ERROR,
        'interrupted': SessionStatus.INTERRUPTED
      };
      
      const mappedStatus = statusMap[data.status.toLowerCase()];
      if (mappedStatus) {
        updateSessionStatus(data.sessionId, mappedStatus);
      }
    };

    const handleProcessExit = (data: { sessionId: string; code: number | null }) => {
      // 只有在运行失败时才更新状态为 ERROR
      // 正常运行完成时，状态应该保持当前状态（通常是 IDLE）
      if (data.code !== 0) {
        updateSessionStatus(data.sessionId, SessionStatus.ERROR);
      }
      // 注意：不再将 code === 0 的情况设为 COMPLETED
    };

    const handleSessionUpdate = (data: { 
      sessionId: string; 
      lastUserMessage?: string; 
      messageCount?: number;
      updatedAt?: string;
    }) => {
      console.log('=== 收到 session_updated 事件 ===', data);
      setSessions(prev => {
        const updated = prev.map(session => 
          session.sessionId === data.sessionId ? {
            ...session,
            lastUserMessage: data.lastUserMessage || session.lastUserMessage,
            messageCount: data.messageCount || session.messageCount,
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : session.updatedAt
          } : session
        );
        console.log('=== Sessions 状态已更新 ===');
        return updated;
      });
    };

    // 监听房间事件（用于详细页面）
    addEventListener('status_update', handleStatusUpdate);
    addEventListener('process_exit', handleProcessExit);
    addEventListener('session_updated', handleSessionUpdate);
    
    // 同时监听全域事件（用于列表页面）
    addEventListener('global_status_update', handleStatusUpdate);
    addEventListener('global_process_exit', handleProcessExit);

    return () => {
      removeEventListener('status_update', handleStatusUpdate);
      removeEventListener('process_exit', handleProcessExit);
      removeEventListener('session_updated', handleSessionUpdate);
      removeEventListener('global_status_update', handleStatusUpdate);
      removeEventListener('global_process_exit', handleProcessExit);
    };
  }, [addEventListener, removeEventListener, updateSessionStatus]);

  // 初始化加载 - 使用 ref 避免重复请求
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      loadSessions();
    }
  }, [loadSessions]);

  // 按状态分组的 sessions
  const sessionsByStatus = {
    idle: sessions.filter(s => s.status === SessionStatus.IDLE),
    completed: sessions.filter(s => s.status === SessionStatus.COMPLETED),
    error: sessions.filter(s => s.status === SessionStatus.ERROR),
    interrupted: sessions.filter(s => s.status === SessionStatus.INTERRUPTED),
    processing: sessions.filter(s => s.status === SessionStatus.PROCESSING),
  };

  const value: SessionsContextValue = {
    sessions,
    sessionsByStatus,
    systemStats,
    loading,
    error,
    loadSessions,
    createSession,
    importHistory,
    completeSession,
    interruptSession,
    resumeSession,
    deleteSession,
    reorderSessionsByStatus,
  };

  return (
    <SessionsContext.Provider value={value}>
      {children}
    </SessionsContext.Provider>
  );
};