import { io, Socket } from 'socket.io-client';
import { config } from '../config/env';

export interface WebSocketMessage {
  sessionId: string;
  type: 'message' | 'output' | 'status' | 'error' | 'assistant' | 'user' | 'system' | 'tool_use' | 'thinking' | 'claude';
  content: string;
  timestamp: Date;
  messageId?: string;
  metadata?: {
    // 工具使用相关
    toolName?: string;
    toolInput?: any;
    toolOutput?: any;
    toolStatus?: 'start' | 'complete' | 'error';
    
    // 思考过程
    isThinking?: boolean;
    thinkingDepth?: number;
    
    // 文件操作
    fileOperation?: 'read' | 'write' | 'edit' | 'delete';
    filePath?: string;
    fileContent?: string;
    lineNumbers?: { start: number; end: number };
    
    // 串流相关
    isPartial?: boolean;
    sequenceId?: string;
    isComplete?: boolean;
    
    // 原始数据
    raw?: any;
  };
}

export interface WebSocketError {
  sessionId: string;
  error: string;
  errorType?: string;
  details?: {
    originalError?: string;
    stderr?: string;
    exitCode?: number | string;
    command?: string;
  };
  timestamp: Date;
}

export interface WebSocketEvents {
  // 收到的事件
  message: (data: WebSocketMessage) => void;
  output: (data: WebSocketMessage) => void;
  assistant: (data: WebSocketMessage) => void;
  user: (data: WebSocketMessage) => void;
  system: (data: WebSocketMessage) => void;
  tool_use: (data: WebSocketMessage) => void;
  thinking: (data: WebSocketMessage) => void;
  error: (data: WebSocketError) => void;
  status_update: (data: { sessionId: string; status: string }) => void;
  global_status_update: (data: { sessionId: string; status: string }) => void;
  session_updated: (data: { sessionId: string; lastUserMessage?: string; messageCount?: number; updatedAt?: string }) => void;
  process_started: (data: { sessionId: string; pid: number }) => void;
  process_exit: (data: { sessionId: string; code: number | null; signal: string | null }) => void;
  global_process_exit: (data: { sessionId: string; code: number | null; signal: string | null }) => void;
  connect: () => void;
  disconnect: () => void;
  connect_error: (error: Error) => void;
  
  // 发送的事件
  subscribe: (sessionId: string) => void;
  unsubscribe: (sessionId: string) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private subscribers: Set<string> = new Set();
  private eventListeners: Map<string, Set<Function>> = new Map();
  private isConnecting: boolean = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 如果已经连接，直接返回
      if (this.socket?.connected) {
        resolve();
        return;
      }

      // 如果正在连接中，等待连接完成
      if (this.isConnecting) {
        const checkConnection = () => {
          if (this.socket?.connected) {
            resolve();
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      // 清理旧的连接
      if (this.socket) {
        this.socket.disconnect();
      }

      this.isConnecting = true;
      // 在开发环境中，使用代理，所以连接到根路径
      // 在生产环境中，直接连接到 WebSocket URL
      const wsUrl = config.NODE_ENV === 'development' ? '/' : config.WS_URL;
      this.socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected:', this.socket?.id);
        this.isConnecting = false;
        
        // 重新订阅之前的 sessions
        this.subscribers.forEach(sessionId => {
          this.socket?.emit('subscribe', sessionId);
        });
        
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.isConnecting = false;
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        this.isConnecting = false;
        this.notifyListeners('disconnect');
      });

      // 设置事件监听器
      this.setupEventListeners();
    });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // 安全转换时间戳的函数
    const safeTimestamp = (timestamp: any): Date => {
      try {
        if (!timestamp) return new Date();
        if (timestamp instanceof Date) return timestamp;
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? new Date() : date;
      } catch (error) {
        console.warn('Invalid timestamp in WebSocket data:', timestamp, error);
        return new Date();
      }
    };

    // 处理通用 message 事件
    this.socket.on('message', (data) => {
      console.log('=== WebSocket 接收 message 事件 ===', data);
      
      // 检查数据完整性
      if (!data || typeof data !== 'object') {
        console.warn('Invalid message data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: data.type || 'message',
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('处理后的 message 数据:', messageData);
      
      // 统一触发 message 事件，不再根据 type 分发
      this.notifyListeners('message', messageData);
    });

    // 注释掉特定类型的事件处理，避免重复
    // （因为后端同时发送 message 和特定类型事件，我们只需要处理 message）
    /*
    this.socket.on('assistant', (data) => {
      console.log('=== WebSocket 接收 assistant 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid assistant data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'assistant' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('处理后的 assistant 数据:', messageData);
      this.notifyListeners('assistant', messageData);
    });
    */

    /*
    this.socket.on('user', (data) => {
      console.log('=== WebSocket 接收 user 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid user data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'user' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('处理后的 user 数据:', messageData);
      this.notifyListeners('user', messageData);
    });
    */

    /*
    this.socket.on('system', (data) => {
      console.log('=== WebSocket 接收 system 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid system data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'system' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('处理后的 system 数据:', messageData);
      this.notifyListeners('system', messageData);
    });
    */

    // output 事件可能需要单独处理，因为它可能不会通过 message 事件发送
    this.socket.on('output', (data) => {
      console.log('=== WebSocket 接收 output 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid output data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'output' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('处理后的 output 数据:', messageData);
      // 统一触发 message 事件
      this.notifyListeners('message', messageData);
    });

    /*
    this.socket.on('tool_use', (data) => {
      console.log('=== WebSocket 接收 tool_use 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid tool_use data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'tool_use' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('处理后的 tool_use 数据:', messageData);
      this.notifyListeners('tool_use', messageData);
    });
    */

    /*
    this.socket.on('thinking', (data) => {
      console.log('=== WebSocket 接收 thinking 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid thinking data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'thinking' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('处理后的 thinking 数据:', messageData);
      this.notifyListeners('thinking', messageData);
    });
    */

    this.socket.on('status_update', (data) => {
      console.log('=== WebSocket 接收 status_update 事件 ===', data);
      this.notifyListeners('status_update', data);
    });

    this.socket.on('global_status_update', (data) => {
      this.notifyListeners('global_status_update', data);
    });

    this.socket.on('session_updated', (data) => {
      console.log('=== WebSocket 接收 session_updated 事件 ===', data);
      this.notifyListeners('session_updated', data);
    });

    this.socket.on('process_started', (data) => {
      this.notifyListeners('process_started', data);
    });

    this.socket.on('process_exit', (data) => {
      this.notifyListeners('process_exit', data);
    });

    this.socket.on('global_process_exit', (data) => {
      this.notifyListeners('global_process_exit', data);
    });

    // 处理错误事件
    this.socket.on('error', (data) => {
      console.log('=== WebSocket 接收 error 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid error data received:', data);
        return;
      }
      
      const errorData = {
        sessionId: data.sessionId || '',
        error: data.error || 'Unknown error',
        errorType: data.errorType,
        details: data.details,
        timestamp: safeTimestamp(data.timestamp)
      };
      
      console.log('处理后的 error 数据:', errorData);
      this.notifyListeners('error', errorData);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.subscribers.clear();
      this.isConnecting = false;
    }
  }

  subscribe(sessionId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    this.subscribers.add(sessionId);
    this.socket.emit('subscribe', sessionId);
    console.log(`Subscribed to session: ${sessionId}`);
  }

  unsubscribe(sessionId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot unsubscribe: WebSocket not connected');
      return;
    }

    this.subscribers.delete(sessionId);
    this.socket.emit('unsubscribe', sessionId);
    console.log(`Unsubscribed from session: ${sessionId}`);
  }

  on<T extends keyof WebSocketEvents>(event: T, callback: WebSocketEvents[T]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off<T extends keyof WebSocketEvents>(event: T, callback: WebSocketEvents[T]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private notifyListeners(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// 单例模式
export const websocketService = new WebSocketService();
export default websocketService;