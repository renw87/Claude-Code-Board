import React, { JSX, useState } from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { 
  User, Bot, Terminal, FileText, Search, Code, 
  ChevronDown, ChevronRight, Eye, Edit, Trash,
  Brain, Loader, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { Message } from '../../types/session.types';
import { MarkdownRenderer } from '../Common/MarkdownRenderer';
import { cn } from '../../utils';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
}

const MessageItemComponent: React.FC<MessageItemProps> = ({ message, isStreaming }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  // 根据消息类型选择图标
  const getIcon = () => {
    switch (message.type) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'assistant':
      case 'claude':
        return <Bot className="w-4 h-4" />;
      case 'system':
        return <Terminal className="w-4 h-4" />;
      case 'tool_use':
        return getToolIcon(message.metadata?.toolName);
      case 'thinking':
        return <Brain className="w-4 h-4 animate-pulse" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  // 根据工具名称选择图标
  const getToolIcon = (toolName?: string) => {
    const toolIcons: Record<string, JSX.Element> = {
      'Read': <Eye className="w-4 h-4" />,
      'Write': <FileText className="w-4 h-4" />,
      'Edit': <Edit className="w-4 h-4" />,
      'MultiEdit': <Edit className="w-4 h-4" />,
      'Delete': <Trash className="w-4 h-4" />,
      'Grep': <Search className="w-4 h-4" />,
      'Bash': <Terminal className="w-4 h-4" />,
      'TodoWrite': <CheckCircle className="w-4 h-4" />,
      'WebSearch': <Search className="w-4 h-4" />,
    };
    return toolIcons[toolName || ''] || <Code className="w-4 h-4" />;
  };

  // 获取消息样式
  const getMessageStyle = () => {
    const baseStyle = 'glass-card shadow-soft hover:shadow-soft-md transition-all duration-200 break-words overflow-hidden';

    switch (message.type) {
      case 'user':
        return `${baseStyle} bg-gradient-to-br from-primary-500 to-primary-600 text-white`;
      case 'assistant':
      case 'claude':
        return `${baseStyle} bg-white border border-gray-100`;
      case 'system':
        return `${baseStyle} bg-warning-50 border border-warning-200 text-warning-900`;
      case 'tool_use':
        return `${baseStyle} bg-success-50 border border-success-200 text-success-900`;
      case 'thinking':
        return `${baseStyle} bg-purple-50 border border-purple-200 text-purple-900`;
      case 'error':
        return `${baseStyle} bg-danger-50 border border-danger-200 text-danger-900`;
      default:
        return `${baseStyle} bg-gray-50 border border-gray-200 text-gray-900`;
    }
  };

  // 是否为用户消息
  const isUserMessage = message.type === 'user';

  // 渲染工具使用详情
  const renderToolDetails = () => {
    const { metadata } = message;
    if (!metadata) return null;

    return (
      <div className="mt-1.5 space-y-1.5">
        {metadata.toolStatus && (
          <div className="flex items-center gap-1.5 text-xs">
            {metadata.toolStatus === 'start' && (
              <div className="flex items-center gap-1.5 text-primary-600">
                <Loader className="w-3 h-3 animate-spin" />
                <span>运行中...</span>
              </div>
            )}
            {metadata.toolStatus === 'complete' && (
              <div className="flex items-center gap-1.5 text-success-600">
                <CheckCircle className="w-3 h-3" />
                <span>已完成</span>
              </div>
            )}
            {metadata.toolStatus === 'error' && (
              <div className="flex items-center gap-1.5 text-danger-600">
                <XCircle className="w-3 h-3" />
                <span>运行失败</span>
              </div>
            )}
          </div>
        )}

        {metadata.filePath && (
          <div className="inline-flex items-center gap-1.5 text-xs bg-gray-100 px-2 py-1 rounded-full border border-gray-200">
            <FileText className="w-3 h-3 text-gray-500" />
            <span className="text-gray-700 font-mono text-xs">{metadata.filePath}</span>
          </div>
        )}

        {metadata.toolInput && (
          <div className="mt-1.5">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 transition-colors"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span className="font-medium">参数详情</span>
            </button>
            {isExpanded && (
              <pre className="mt-1.5 text-xs bg-gray-50 text-gray-700 p-2 rounded-lg overflow-x-auto border border-gray-200 shadow-inner">
                {JSON.stringify(metadata.toolInput, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  };

  // 渲染思考过程
  const renderThinking = () => {
    if (message.type !== 'thinking' || !showThinking) return null;

    return (
      <div className="mt-1.5 p-2 bg-purple-50 rounded-lg border border-purple-200 shadow-inner">
        <div className="text-xs text-purple-700 whitespace-pre-wrap font-mono leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  };

  // 渲染消息内容
  const renderContent = () => {
    // 工具使用消息特殊处理
    if (message.type === 'tool_use') {
      return (
        <div>
          <div className="text-sm font-medium">{message.content}</div>
          {renderToolDetails()}
        </div>
      );
    }

    // 思考过程可折叠
    if (message.type === 'thinking') {
      return (
        <div>
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-300 hover:underline"
          >
            {showThinking ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            显示思考过程
          </button>
          {renderThinking()}
        </div>
      );
    }

    // 一般消息使用 Markdown 渲染
    return (
      <div className={cn("text-sm", isStreaming ? 'animate-pulse' : '')}>
        <MarkdownRenderer content={message.content} />
      </div>
    );
  };

  return (
    <div className={`mb-2 ${isUserMessage ? 'pl-6' : 'pr-6'}`}>
      <div className={`px-3 py-2 rounded-lg ${getMessageStyle()} w-full transform transition-all duration-200 hover:scale-[1.005] group`}>
        {!isUserMessage && (
          <div className="flex items-start gap-2">
            {/* 头像区域 */}
            <div className="flex-shrink-0 relative">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                (message.type === 'assistant' || message.type === 'claude') ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-md shadow-green-500/30' :
                message.type === 'system' ? 'bg-gradient-to-br from-yellow-400 via-amber-500 to-amber-600 shadow-md shadow-amber-400/30' :
                message.type === 'tool_use' ? 'bg-gradient-to-br from-emerald-400 via-teal-500 to-teal-600 shadow-md shadow-emerald-400/30' :
                message.type === 'thinking' ? 'bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-600 shadow-md shadow-purple-400/30' :
                'bg-gradient-to-br from-gray-400 via-slate-500 to-gray-600 shadow-md shadow-gray-400/30'
              } text-white ring-2 ring-white/30 dark:ring-white/20 backdrop-blur-sm transform transition-transform duration-200 group-hover:scale-110`}>
                {React.cloneElement(getIcon(), { className: 'w-3.5 h-3.5 drop-shadow-sm' })}
              </div>
              {/* 在线状态指示器 */}
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-1 ring-white dark:ring-gray-800"></div>
            </div>
            
            <div className="flex-1 min-w-0 overflow-hidden">
              {/* 标题行 */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-xs text-gray-900 dark:text-gray-100 truncate">
                    {(message.type === 'assistant' || message.type === 'claude') && 'Claude'}
                    {message.type === 'system' && '系统'}
                    {message.type === 'tool_use' && `🔧 ${message.metadata?.toolName || '工具'}`}
                    {message.type === 'thinking' && '💭 思考中'}
                  </span>
                  
                  {/* 部分消息指示器 */}
                  {message.metadata?.isPartial && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">输入中</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {format(new Date(message.timestamp), 'HH:mm', { locale: zhTW })}
                  </span>
                  {/* 消息状态指示器 */}
                  <div className="flex items-center">
                    <CheckCircle className="w-2.5 h-2.5 text-green-500 opacity-70" />
                  </div>
                </div>
              </div>

              {/* 消息内容 */}
              <div className="text-gray-800 dark:text-gray-200 min-w-0 break-words overflow-wrap-anywhere">
                {renderContent()}
              </div>

              {/* 串流指示器 */}
              {isStreaming && message.metadata?.isPartial && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <Loader className="w-2.5 h-2.5 animate-spin" />
                  <span>正在输入...</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {isUserMessage && (
          <div className="min-w-0">
            <div className="flex items-start gap-2 justify-end">
              <div className="max-w-[85%] flex flex-col items-end">
                {/* 标题行 */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs text-blue-100 font-medium">您</span>
                  <div className="flex items-center">
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-300" />
                  </div>
                  <span className="text-xs text-blue-300 opacity-80">
                    {format(new Date(message.timestamp), 'HH:mm', { locale: zhTW })}
                  </span>
                </div>
                
                {/* 消息内容 - 用户消息不使用markdown，靠右对齐 */}
                <div className="text-white break-words overflow-wrap-anywhere leading-relaxed whitespace-pre-wrap text-right w-full text-sm">
                  {message.content}
                </div>
              </div>
              
              {/* 头像 */}
              <div className="flex-shrink-0 relative">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 ring-2 ring-white/30 dark:ring-white/20 backdrop-blur-sm transform transition-transform duration-200 group-hover:scale-110">
                  <User className="w-3.5 h-3.5 drop-shadow-sm" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-1 ring-white dark:ring-blue-600"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 使用 React.memo 和自定义比较函数来优化渲染
export const MessageItem = React.memo(MessageItemComponent, (prevProps, nextProps) => {
  // 如果消息 ID 相同且串流状态相同，则不需要重新渲染
  return (
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.type === nextProps.message.type &&
    prevProps.message.timestamp === nextProps.message.timestamp &&
    prevProps.isStreaming === nextProps.isStreaming &&
    // 检查 metadata 是否相同
    JSON.stringify(prevProps.message.metadata) === JSON.stringify(nextProps.message.metadata)
  );
});

export default MessageItem;