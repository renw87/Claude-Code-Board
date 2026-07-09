import { AlertCircle, Bot } from "lucide-react";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useWebSocket } from "../../hooks/useWebSocket";
import { sessionApi } from "../../services/api";
import { WebSocketMessage } from "../../services/websocket";
import { useMessageStore } from "../../stores/messageStore";
import { Message, Session } from "../../types/session.types";
import MessageInput from "./MessageInput";
import MessageItem from "./MessageItem";
import { MessageFilter } from "./MessageFilter";

interface ChatInterfaceProps {
  sessionId: string;
  session?: Session;
  initialMessages: Message[];
  isSessionActive: boolean;
  isProcessing?: boolean;
  onSessionUpdate?: (updates: Partial<Session>) => void;
}

// 将消息列表提取为单独的组件，使用 React.memo 优化
interface MessageListProps {
  messages: Message[];
}

const MessageList = React.memo<MessageListProps>(({ messages }) => {
  return (
    <div className="w-full">
      {messages.map((message) => (
        <MessageItem key={message.messageId} message={message} isStreaming={message.metadata?.isStreaming} />
      ))}
    </div>
  );
});

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ sessionId, session, isSessionActive, isProcessing = false, onSessionUpdate }) => {
  // 使用 message store - 分别获取 actions 和 state
  const messages = useMessageStore((state) => state.messages);
  const isLoading = useMessageStore((state) => state.isLoading);
  const isLoadingMore = useMessageStore((state) => state.isLoadingMore);
  const error = useMessageStore((state) => state.error);
  const initializeFromAPI = useMessageStore((state) => state.initializeFromAPI);
  const loadMoreMessages = useMessageStore((state) => state.loadMoreMessages);
  const canLoadMore = useMessageStore((state) => state.canLoadMore);
  const addMessage = useMessageStore((state) => state.addMessage);
  const updateMessageStatus = useMessageStore((state) => state.updateMessageStatus);

  // 消息过滤状态 - 从 localStorage 读取或使用默认值
  const [hiddenMessageTypes, setHiddenMessageTypes] = useState<Set<Message['type']>>(() => {
    const saved = localStorage.getItem('messageFilterHiddenTypes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return new Set(parsed as Message['type'][]);
      } catch {
        // 如果解析失败，使用默认值
      }
    }
    // 默认隐藏 tool_use 和 thinking
    return new Set(['tool_use', 'thinking'] as Message['type'][]);
  });

  // 当过滤设置改变时，保存到 localStorage
  const handleFilterChange = useCallback((types: Set<Message['type']>) => {
    setHiddenMessageTypes(types);
    localStorage.setItem('messageFilterHiddenTypes', JSON.stringify(Array.from(types)));
  }, []);

  // 将 Map 转换为排序后的数组，并应用过滤
  const { sortedMessages, filteredCount } = React.useMemo(() => {
    const allMessages = Array.from(messages.values());
    const filtered = allMessages.filter((message) => !hiddenMessageTypes.has(message.type));
    const sorted = filtered.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
    return {
      sortedMessages: sorted,
      filteredCount: allMessages.length - filtered.length
    };
  }, [messages, hiddenMessageTypes]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesStartRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { addEventListener, removeEventListener, subscribe, unsubscribe } = useWebSocket();

  // 1️⃣ 初始加载（页面加载/刷新时）
  useEffect(() => {
    if (sessionId) {
      const state = useMessageStore.getState();
      // 只有在切换到不同 session 或尚未初始化时才加载
      if (state.currentSessionId !== sessionId || !state.isInitialized) {
        // 重置旧数据并从 API 加载历史消息
        state.reset();
        state.initializeFromAPI(sessionId);
      }
    }

    return () => {
      // 清理时重置 store
      useMessageStore.getState().reset();
    };
  }, [sessionId]); // 只依赖 sessionId

  // 2️⃣ WebSocket 即时消息监听
  useEffect(() => {
    if (!sessionId) return;

    // WebSocket 事件处理函数
    const handleWebSocketMessage = (data: WebSocketMessage) => {
      if (data.sessionId !== sessionId) return;

      // 转换 WebSocket 消息为标准 Message 格式，保留原始类型
      const message: Message = {
        messageId: data.messageId || `ws-${Date.now()}-${Math.random()}`,
        sessionId: data.sessionId,
        type: data.type as Message["type"], // 保留原始类型，不做转换
        content: data.content || "",
        timestamp: data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp),
        metadata: data.metadata,
      };

      addMessage(message);
    };

    // 订阅这个 session
    subscribe(sessionId);

    // 只监听统一的 message 事件
    // （WebSocket 服务已经修改为所有消息都触发 message 事件）
    addEventListener("message" as any, handleWebSocketMessage);

    // 清理函数
    return () => {
      if (sessionId) {
        unsubscribe(sessionId);
      }
      removeEventListener("message" as any, handleWebSocketMessage);
    };
  }, [sessionId, addEventListener, removeEventListener, subscribe, unsubscribe, addMessage]);

  // 3️⃣ 自动滚动处理
  const [isInitialScroll, setIsInitialScroll] = useState(true);

  // 初次加载立即滚动（在浏览器绘制前）
  useLayoutEffect(() => {
    if (sortedMessages.length > 0 && isInitialScroll && !isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      setIsInitialScroll(false);
    }
  }, [sortedMessages.length, isInitialScroll, isLoading]);

  // 新消息平滑滚动
  useEffect(() => {
    if (sortedMessages.length > 0 && !isInitialScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [sortedMessages.length, isInitialScroll]); // 只依赖消息数量变化

  // 当 sessionId 改变时，重置初次滚动状态
  useEffect(() => {
    setIsInitialScroll(true);
  }, [sessionId]);

  // 4️⃣ 无限滚动检测
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // 检查是否滚动到顶部（加载更旧的消息）
      if (container.scrollTop < 100 && canLoadMore("older") && !isLoadingMore) {
        const previousScrollHeight = container.scrollHeight;
        const previousScrollTop = container.scrollTop;

        loadMoreMessages("older").then(() => {
          // 加载完成后，保持滚动位置
          requestAnimationFrame(() => {
            const newScrollHeight = container.scrollHeight;
            const scrollDiff = newScrollHeight - previousScrollHeight;
            container.scrollTop = previousScrollTop + scrollDiff;
          });
        });
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [canLoadMore, loadMoreMessages, isLoadingMore]);

  // 4️⃣ 发送新消息
  const handleSendMessage = useCallback(
    async (messageContent: string) => {
      if (!messageContent.trim() || !isSessionActive) {
        return;
      }

      // 乐观更新：立即显示用户消息
      const tempMessage: Message = {
        messageId: `temp-${Date.now()}`,
        sessionId,
        type: "user",
        content: messageContent,
        timestamp: new Date(),
        metadata: { status: "sending" },
      };

      addMessage(tempMessage);

      try {
        // 发送消息到后端，WebSocket 会推送正式的消息
        await sessionApi.sendMessage(sessionId, messageContent);

        // 立即更新 session 的 lastUserMessage 和 messageCount
        if (onSessionUpdate) {
          console.log("=== ChatInterface 调用 onSessionUpdate ===", {
            lastUserMessage: messageContent,
            messageCount: (session?.messageCount || 0) + 1,
          });
          onSessionUpdate({
            lastUserMessage: messageContent,
            messageCount: (session?.messageCount || 0) + 1,
          });
        }

        // 成功后更新状态
        updateMessageStatus(tempMessage.messageId, "sent");
      } catch (error) {
        toast.error("发送消息失败");
        console.error("Error sending message:", error);
        // 标记为失败
        updateMessageStatus(tempMessage.messageId, "failed");
        throw error; // 让 MessageInput 组件能够处理错误
      }
    },
    [sessionId, isSessionActive, onSessionUpdate, session?.messageCount, addMessage, updateMessageStatus]
  );

  // 渲染
  if (isLoading && sortedMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载对话记录中...</p>
        </div>
      </div>
    );
  }

  if (error && sortedMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">加载消息失败</p>
          <button onClick={() => initializeFromAPI(sessionId)} className="btn-primary">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部工具列 */}
      <div className="glass border-b border-glass-border px-4 py-2">
        <div className="flex items-center justify-between">
          {!isSessionActive ? (
            <div className="flex items-center space-x-2 text-gray-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Session 已停止，无法发送新消息</span>
            </div>
          ) : (
            <div className="flex-1" /> // 占比特素
          )}
          <MessageFilter 
            hiddenTypes={hiddenMessageTypes}
            onFilterChange={handleFilterChange}
          />
        </div>
      </div>

      {/* 消息列表 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-gradient-soft px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        <div ref={messagesStartRef} />

        {/* 加载更多指示器 */}
        {canLoadMore("older") && (
          <div className="text-center py-4">
            {isLoadingMore ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-500">加载更多消息...</span>
              </div>
            ) : (
              <button onClick={() => loadMoreMessages("older")} className="text-sm text-primary-600 hover:text-primary-700 font-medium hover:underline">
                加载更早的消息
              </button>
            )}
          </div>
        )}

        {sortedMessages.length === 0 && !isLoading ? (
          <div className="text-center py-16">
            {filteredCount > 0 ? (
              <>
                <div className="bg-gradient-to-br from-warning-400 to-warning-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-soft-md">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">没有可显示的消息</h3>
                <p className="text-gray-600">有 {filteredCount} 则消息被过滤隐藏</p>
                <p className="text-sm text-gray-500 mt-2">点击右上角的消息过滤按钮调整设置</p>
              </>
            ) : (
              <>
                <div className="bg-gradient-to-br from-success-400 to-success-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-soft-md animate-float">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">开始新的对话</h3>
                <p className="text-gray-600">向 Claude Code 发送消息开始交互</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* 过滤提示 */}
            {filteredCount > 0 && (
              <div className="flex justify-center mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-warning-50 text-warning-700 text-sm rounded-full border border-warning-200">
                  <span>已隐藏 {filteredCount} 则消息</span>
                </div>
              </div>
            )}
            <MessageList messages={sortedMessages} />
          </>
        )}

        {/* 处理中的 loading 动画 */}
        {isProcessing && (
          <div className="w-full">
            <div className="mb-4 pr-4 sm:pr-4 md:pr-4 lg:pr-4">
              <div className="card rounded-2xl p-4 shadow-soft w-full">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-success-400 to-success-500 flex items-center justify-center shadow-soft-sm">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2">Claude</div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 - 使用独立的 MessageInput 组件 */}
      <MessageInput onSendMessage={handleSendMessage} disabled={!isSessionActive} placeholder={isSessionActive ? "输入消息..." : "Session 已停止"} />
    </div>
  );
};
