import { useEffect, useCallback, useState } from 'react';
import { websocketService, WebSocketMessage, WebSocketEvents } from '../services/websocket';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);

  useEffect(() => {
    // 避免重复连接
    if (websocketService.isConnected()) {
      setIsConnected(true);
      return;
    }

    const connect = async () => {
      try {
        await websocketService.connect();
        setIsConnected(true);
        setConnectionError(null);
      } catch (error) {
        setConnectionError(error as Error);
        setIsConnected(false);
      }
    };

    connect();

    // 监听连接状态变化
    const handleConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleError = (error: Error) => {
      setConnectionError(error);
    };

    websocketService.on('connect', handleConnect);
    websocketService.on('disconnect', handleDisconnect);
    websocketService.on('connect_error', handleError);

    return () => {
      websocketService.off('connect', handleConnect);
      websocketService.off('disconnect', handleDisconnect);
      websocketService.off('connect_error', handleError);
    };
  }, []);

  const subscribe = useCallback((sessionId: string) => {
    websocketService.subscribe(sessionId);
  }, []);

  const unsubscribe = useCallback((sessionId: string) => {
    websocketService.unsubscribe(sessionId);
  }, []);

  const addEventListener = useCallback(<T extends keyof WebSocketEvents>(
    event: T, 
    callback: WebSocketEvents[T]
  ) => {
    websocketService.on(event, callback);
  }, []);

  const removeEventListener = useCallback(<T extends keyof WebSocketEvents>(
    event: T, 
    callback: WebSocketEvents[T]
  ) => {
    websocketService.off(event, callback);
  }, []);

  return {
    isConnected,
    connectionError,
    subscribe,
    unsubscribe,
    addEventListener,
    removeEventListener,
  };
};

// 专门用于监听 Session 消息的 Hook
export const useSessionMessages = (sessionId: string | null) => {
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { subscribe, unsubscribe, addEventListener, removeEventListener } = useWebSocket();

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setIsSubscribed(false);
      return;
    }

    // 订阅 session
    subscribe(sessionId);
    setIsSubscribed(true);

    // 监听消息
    const handleMessage = (data: WebSocketMessage) => {
      if (data.sessionId === sessionId) {
        console.log('useSessionMessages: Received message', data.type, data);
        setMessages(prev => [...prev, data]);
      }
    };

    const handleAssistant = (data: WebSocketMessage) => {
      if (data.sessionId === sessionId) {
        setMessages(prev => [...prev, { ...data, type: 'assistant' }]);
      }
    };

    const handleUser = (data: WebSocketMessage) => {
      if (data.sessionId === sessionId) {
        setMessages(prev => [...prev, { ...data, type: 'user' }]);
      }
    };

    const handleSystem = (data: WebSocketMessage) => {
      if (data.sessionId === sessionId) {
        setMessages(prev => [...prev, { ...data, type: 'system' }]);
      }
    };

    const handleOutput = (data: WebSocketMessage) => {
      if (data.sessionId === sessionId) {
        setMessages(prev => [...prev, { ...data, type: 'output' }]);
      }
    };

    const handleToolUse = (data: WebSocketMessage) => {
      if (data.sessionId === sessionId) {
        console.log('useSessionMessages: Received tool_use', data);
        setMessages(prev => [...prev, { ...data, type: 'tool_use' }]);
      }
    };

    const handleThinking = (data: WebSocketMessage) => {
      if (data.sessionId === sessionId) {
        console.log('useSessionMessages: Received thinking', data);
        setMessages(prev => [...prev, { ...data, type: 'thinking' }]);
      }
    };

    // 恢复所有事件监听，重复过滤在 ChatInterface 中处理
    addEventListener('message', handleMessage);
    addEventListener('assistant', handleAssistant);
    addEventListener('user', handleUser);
    addEventListener('system', handleSystem);
    addEventListener('output', handleOutput);
    addEventListener('tool_use', handleToolUse);
    addEventListener('thinking', handleThinking);

    return () => {
      if (sessionId) {
        unsubscribe(sessionId);
      }
      removeEventListener('message', handleMessage);
      removeEventListener('assistant', handleAssistant);
      removeEventListener('user', handleUser);
      removeEventListener('system', handleSystem);
      removeEventListener('output', handleOutput);
      removeEventListener('tool_use', handleToolUse);
      removeEventListener('thinking', handleThinking);
      setIsSubscribed(false);
    };
  }, [sessionId, subscribe, unsubscribe, addEventListener, removeEventListener]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isSubscribed,
    clearMessages,
  };
};

// 用于监听系统状态的 Hook
export const useSystemStatus = () => {
  const [processCount, setProcessCount] = useState(0);
  const { addEventListener, removeEventListener } = useWebSocket();

  useEffect(() => {
    const handleProcessStarted = () => {
      setProcessCount(prev => prev + 1);
    };

    const handleProcessExit = () => {
      setProcessCount(prev => Math.max(0, prev - 1));
    };

    addEventListener('process_started', handleProcessStarted);
    addEventListener('process_exit', handleProcessExit);

    return () => {
      removeEventListener('process_started', handleProcessStarted);
      removeEventListener('process_exit', handleProcessExit);
    };
  }, [addEventListener, removeEventListener]);

  return {
    processCount,
  };
};