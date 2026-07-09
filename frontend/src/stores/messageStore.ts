import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Message } from '../types/session.types';
import { sessionApi } from '../services/api';

interface MessageState {
  // 状态
  messages: Map<string, Message>;
  currentSessionId: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  lastSyncTime: Date | null;
  error: Error | null;
  
  // 分页状态
  pagination: {
    currentPage: number;
    totalPages: number;
    totalMessages: number;
    hasMore: boolean;
    loadedPages: Set<number>;
  };
  
  // Actions
  initializeFromAPI: (sessionId: string) => Promise<void>;
  loadMoreMessages: (direction: 'older' | 'newer') => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, status: 'sending' | 'sent' | 'failed') => void;
  removeMessage: (messageId: string) => void;
  reset: () => void;
  
  // Selectors
  getSortedMessages: () => Message[];
  hasMessage: (messageId: string) => boolean;
  getMessageCount: () => number;
  canLoadMore: (direction: 'older' | 'newer') => boolean;
}

export const useMessageStore = create<MessageState>()(
  subscribeWithSelector((set, get) => ({
    // 初始状态
    messages: new Map(),
    currentSessionId: null,
    isInitialized: false,
    isLoading: false,
    isLoadingMore: false,
    lastSyncTime: null,
    error: null,
    
    // 分页状态
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalMessages: 0,
      hasMore: false,
      loadedPages: new Set<number>(),
    },
    
    // 从 API 初始化（页面加载/刷新时）
    initializeFromAPI: async (sessionId: string) => {
      const state = get();
      
      // 如果是同一个 session 且已初始化或正在加载，不重复加载
      if (state.currentSessionId === sessionId && (state.isInitialized || state.isLoading)) {
        console.log('Skipping duplicate initialization for session:', sessionId);
        return;
      }
      
      set({ 
        isLoading: true, 
        error: null,
        currentSessionId: sessionId,
        isInitialized: false // 确保重置初始化状态
      });
      
      try {
        // 先获取第一页来得知总页数
        const firstPageResponse = await sessionApi.getMessages(sessionId, 1, 100);
        const totalPages = firstPageResponse.pagination.totalPages;
        
        // 如果有多页，加载最后一页；否则就用第一页的数据
        let response;
        if (totalPages > 1) {
          response = await sessionApi.getMessages(sessionId, totalPages, 100);
        } else {
          response = firstPageResponse;
        }
        
        const messages = new Map<string, Message>();
        
        // 将消息加入 Map，保留原始的消息类型
        response.messages.forEach(msg => {
          messages.set(msg.messageId, {
            ...msg,
            // 确保 timestamp 是 Date 对象
            timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
          });
        });
        
        set({
          messages,
          isInitialized: true,
          isLoading: false,
          lastSyncTime: new Date(), // 记录同步时间
          error: null,
          pagination: {
            currentPage: totalPages > 1 ? totalPages : 1,
            totalPages: response.pagination.totalPages,
            totalMessages: response.pagination.total,
            hasMore: totalPages > 1,
            loadedPages: new Set([totalPages > 1 ? totalPages : 1]),
          }
        });
        
        console.log(`Initialized ${messages.size} messages from page ${totalPages > 1 ? totalPages : 1} of ${totalPages} for session ${sessionId}`);
      } catch (error) {
        console.error('Failed to load messages:', error);
        set({ 
          isLoading: false,
          error: error as Error
        });
      }
    },
    
    // 添加消息（来自 WebSocket 或用户输入）
    addMessage: (message: Message) => {
      const state = get();
      
      // 检查 session 是否匹配
      if (state.currentSessionId && message.sessionId !== state.currentSessionId) {
        console.log('Ignoring message from different session:', message.sessionId);
        return;
      }
      
      // 检查是否已存在（避免重复）
      if (state.hasMessage(message.messageId)) {
        console.log('Message already exists:', message.messageId);
        return;
      }
      
      // 检查时间戳（避免处理旧消息）
      const messageTime = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);
      if (state.lastSyncTime && messageTime < state.lastSyncTime) {
        console.log('Skipping old message:', message.messageId, 'timestamp:', messageTime, 'lastSync:', state.lastSyncTime);
        return;
      }
      
      // 特殊处理：如果是用户消息，检查是否需要替换临时消息
      if (message.type === 'user' && !message.messageId.startsWith('temp-')) {
        const existingMessages = Array.from(state.messages.entries());
        const tempMessage = existingMessages.find(([id, msg]) => 
          id.startsWith('temp-') && 
          msg.type === 'user' && 
          msg.content === message.content &&
          msg.metadata?.status === 'sending'
        );
        
        if (tempMessage) {
          console.log('Replacing temp message with official message:', tempMessage[0], '->', message.messageId);
          const messages = new Map(state.messages);
          // 删除临时消息
          messages.delete(tempMessage[0]);
          // 添加正式消息
          messages.set(message.messageId, {
            ...message,
            timestamp: messageTime
          });
          set({ messages });
          return;
        }
      }
      
      // 进一步检查：避免相同时间、相同类型、相同内容的消息
      const existingMessages = Array.from(state.messages.values());
      const isDuplicate = existingMessages.some(existing => {
        const existingTime = existing.timestamp instanceof Date ? existing.timestamp.getTime() : new Date(existing.timestamp).getTime();
        const newTime = messageTime.getTime();
        
        // 如果时间差在 100ms 内，且类型和内容相同，视为重复
        return Math.abs(existingTime - newTime) < 100 && 
               existing.type === message.type && 
               existing.content === message.content;
      });
      
      if (isDuplicate) {
        console.log('Skipping duplicate message (same time/type/content):', message.type, message.content.slice(0, 50));
        return;
      }
      
      // 添加新消息
      const messages = new Map(state.messages);
      messages.set(message.messageId, {
        ...message,
        timestamp: messageTime
      });
      
      set({ messages });
      console.log('Added new message:', message.messageId, 'type:', message.type);
    },
    
    // 更新消息状态（用于发送状态追踪）
    updateMessageStatus: (messageId: string, status: 'sending' | 'sent' | 'failed') => {
      const state = get();
      const message = state.messages.get(messageId);
      
      if (!message) return;
      
      const messages = new Map(state.messages);
      messages.set(messageId, {
        ...message,
        metadata: {
          ...message.metadata,
          status
        }
      });
      
      set({ messages });
    },
    
    // 移除消息（用于发送失败时）
    removeMessage: (messageId: string) => {
      const state = get();
      const messages = new Map(state.messages);
      messages.delete(messageId);
      set({ messages });
    },
    
    // 加载更多消息
    loadMoreMessages: async (direction: 'older' | 'newer') => {
      const state = get();
      
      if (!state.currentSessionId || state.isLoadingMore || !state.canLoadMore(direction)) {
        return;
      }
      
      set({ isLoadingMore: true, error: null });
      
      try {
        // 计算要加载的页数
        let pageToLoad: number;
        const loadedPages = Array.from(state.pagination.loadedPages).sort((a, b) => a - b);
        
        if (direction === 'older') {
          // 加载更旧的消息（较小的页数）
          pageToLoad = Math.min(...loadedPages) - 1;
        } else {
          // 加载更新的消息（较大的页数）
          pageToLoad = Math.max(...loadedPages) + 1;
        }
        
        if (pageToLoad < 1 || pageToLoad > state.pagination.totalPages) {
          set({ isLoadingMore: false });
          return;
        }
        
        // 加载新页面
        const response = await sessionApi.getMessages(state.currentSessionId, pageToLoad, 100);
        const messages = new Map(state.messages);
        
        // 将新消息加入 Map
        response.messages.forEach(msg => {
          if (!messages.has(msg.messageId)) {
            messages.set(msg.messageId, {
              ...msg,
              timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
            });
          }
        });
        
        // 更新加载的页面集合
        const newLoadedPages = new Set(state.pagination.loadedPages);
        newLoadedPages.add(pageToLoad);
        
        set({
          messages,
          isLoadingMore: false,
          pagination: {
            ...state.pagination,
            loadedPages: newLoadedPages,
            hasMore: newLoadedPages.size < state.pagination.totalPages,
          }
        });
        
        console.log(`Loaded ${response.messages.length} messages from page ${pageToLoad}`);
      } catch (error) {
        console.error('Failed to load more messages:', error);
        set({ 
          isLoadingMore: false,
          error: error as Error
        });
      }
    },
    
    // 重置状态（切换 session 时）
    reset: () => {
      set({
        messages: new Map(),
        currentSessionId: null,
        isInitialized: false,
        isLoading: false,
        isLoadingMore: false,
        lastSyncTime: null,
        error: null,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalMessages: 0,
          hasMore: false,
          loadedPages: new Set<number>(),
        }
      });
    },
    
    // 获取排序后的消息数组
    getSortedMessages: () => {
      const messages = Array.from(get().messages.values());
      return messages.sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeA - timeB;
      });
    },
    
    // 检查消息是否存在
    hasMessage: (messageId: string) => {
      return get().messages.has(messageId);
    },
    
    // 获取消息数量
    getMessageCount: () => {
      return get().messages.size;
    },
    
    // 检查是否可以加载更多
    canLoadMore: (direction: 'older' | 'newer') => {
      const state = get();
      const loadedPages = Array.from(state.pagination.loadedPages);
      
      if (loadedPages.length === 0) return false;
      
      if (direction === 'older') {
        return Math.min(...loadedPages) > 1;
      } else {
        return Math.max(...loadedPages) < state.pagination.totalPages;
      }
    }
  }))
);