import { EventEmitter } from 'events';
import { ClaudeStreamMessage } from '../types/process.types';
import { MessageRepository } from '../repositories/MessageRepository';
import { logger } from '../utils/logger';

/**
 * 消息累积器 - 智能处理消息保存
 * 
 * 策略：
 * 1. 即时发送片段给前端（串流效果）
 * 2. 累积完整消息后保存到数据库
 * 3. 工具使用和思考过程分开处理
 * 4. 支持消息合并和去重
 */
export class MessageAccumulator extends EventEmitter {
  private messageRepository: MessageRepository;
  private accumulator: Map<string, AccumulatedMessage> = new Map();
  private toolUsageBuffer: Map<string, ToolUsageInfo[]> = new Map();
  
  constructor() {
    super();
    this.messageRepository = new MessageRepository();
  }

  /**
   * 处理串流消息
   */
  async handleStreamMessage(message: ClaudeStreamMessage): Promise<void> {
    const { sessionId, type, content, metadata } = message;
    
    // 注意：不在这里 emit realtimeMessage，避免重复
    // 交由 StreamProcessor 统一处理前端发送
    
    // 根据消息类型处理
    switch (type) {
      case 'assistant':
        await this.handleAssistantMessage(message);
        break;
        
      case 'user':
        // 用户消息直接保存
        await this.saveMessage(sessionId, 'user', content);
        break;
        
      case 'tool_use':
        await this.handleToolUse(message);
        break;
        
      case 'thinking':
        await this.handleThinking(message);
        break;
        
      case 'system':
        // 系统消息直接保存
        await this.saveMessage(sessionId, 'system', content, metadata);
        break;
        
      case 'error':
        // 错误消息保持原始类型
        await this.saveMessage(sessionId, 'error', content, metadata);
        break;
    }
  }

  /**
   * 处理助手消息
   */
  private async handleAssistantMessage(message: ClaudeStreamMessage): Promise<void> {
    const { sessionId, content, metadata } = message;
    const sequenceId = metadata?.sequenceId || `default_${sessionId}`;
    
    if (metadata?.isPartial) {
      // 累积片段
      const accumulated = this.accumulator.get(sequenceId) || {
        sessionId,
        type: 'assistant',
        content: [],
        startTime: new Date(),
        metadata: {}
      };
      
      accumulated.content.push(content);
      this.accumulator.set(sequenceId, accumulated);
      
    } else if (metadata?.isComplete) {
      // 消息完成，保存到数据库
      const accumulated = this.accumulator.get(sequenceId);
      
      if (accumulated) {
        const fullContent = accumulated.content.join('');
        await this.saveMessage(sessionId, 'assistant', fullContent, {
          ...accumulated.metadata,
          duration: Date.now() - accumulated.startTime.getTime()
        });
        
        this.accumulator.delete(sequenceId);
      } else {
        // 没有累积的消息，直接保存
        await this.saveMessage(sessionId, 'assistant', content, metadata);
      }
    } else {
      // 完整消息，直接保存
      await this.saveMessage(sessionId, 'assistant', content, metadata);
    }
  }

  /**
   * 处理工具使用
   */
  private async handleToolUse(message: ClaudeStreamMessage): Promise<void> {
    const { sessionId, metadata } = message;
    
    if (!metadata?.toolName) return;
    
    // 累积工具使用信息
    const toolUsage = this.toolUsageBuffer.get(sessionId) || [];
    
    const toolInfo: ToolUsageInfo = {
      name: metadata.toolName,
      status: metadata.toolStatus || 'start',
      input: metadata.toolInput,
      output: metadata.toolOutput,
      timestamp: message.timestamp,
      fileOperation: metadata.fileOperation,
      filePath: metadata.filePath
    };
    
    // 检查是否已经有相同的工具使用记录（避免重复）
    const existingTool = toolUsage.find(tool => 
      tool.name === toolInfo.name && 
      tool.status === toolInfo.status &&
      Math.abs(tool.timestamp.getTime() - toolInfo.timestamp.getTime()) < 1000 // 1秒内视为重复
    );
    
    if (!existingTool) {
      toolUsage.push(toolInfo);
      this.toolUsageBuffer.set(sessionId, toolUsage);
      
      // 如果工具使用完成，生成摘要并保存
      if (metadata.toolStatus === 'complete') {
        const summary = this.generateToolUsageSummary(toolInfo);
        await this.saveMessage(sessionId, 'tool_use', summary, {
          tool: metadata.toolName,
          ...metadata
        });
      }
    } else {
      logger.debug(`Skipping duplicate tool usage: ${toolInfo.name} (${toolInfo.status})`);
    }
  }

  /**
   * 处理思考过程
   */
  private async handleThinking(message: ClaudeStreamMessage): Promise<void> {
    const { sessionId, content, metadata } = message;
    
    // 思考过程可以选择性保存或只在前端显示
    // 这里我们选择累积后保存摘要
    const thinkingKey = `thinking_${sessionId}`;
    const accumulated = this.accumulator.get(thinkingKey) || {
      sessionId,
      type: 'thinking',
      content: [],
      startTime: new Date(),
      metadata: { type: 'thinking' }
    };
    
    accumulated.content.push(content);
    this.accumulator.set(thinkingKey, accumulated);
    
    // 设置定时器，在思考结束后保存
    this.scheduleThinkingSave(sessionId);
  }

  /**
   * 生成工具使用摘要
   */
  private generateToolUsageSummary(toolInfo: ToolUsageInfo): string {
    const { name, fileOperation, filePath } = toolInfo;
    
    // 根据工具类型生成易读的摘要
    const toolSummaries: Record<string, (info: ToolUsageInfo) => string> = {
      'Read': (info) => `📖 读取文件: ${info.filePath}`,
      'Write': (info) => `✏️ 写入文件: ${info.filePath}`,
      'Edit': (info) => `📝 编辑文件: ${info.filePath}`,
      'MultiEdit': (info) => `📝 批量编辑: ${info.filePath}`,
      'Bash': (info) => `💻 运行命令: ${this.extractCommand(info.input)}`,
      'Grep': (info) => `🔍 搜索: ${this.extractSearchPattern(info.input)}`,
      'TodoWrite': (info) => `✅ 更新待办事项`,
      'WebSearch': (info) => `🌐 网络搜索: ${this.extractSearchQuery(info.input)}`,
      'Task': (info) => `🤖 委派任务给子代理`
    };
    
    const summaryGenerator = toolSummaries[name];
    if (summaryGenerator) {
      return summaryGenerator(toolInfo);
    }
    
    // 默认摘要
    if (fileOperation && filePath) {
      const operations: Record<string, string> = {
        'read': '读取',
        'write': '写入',
        'edit': '编辑',
        'delete': '删除'
      };
      return `📄 ${operations[fileOperation] || fileOperation} ${filePath}`;
    }
    
    return `🔧 使用工具: ${name}`;
  }

  /**
   * 提取命令
   */
  private extractCommand(input: any): string {
    if (typeof input === 'string') return input;
    if (input?.command) return input.command;
    return '(命令)';
  }

  /**
   * 提取搜索模式
   */
  private extractSearchPattern(input: any): string {
    if (typeof input === 'string') return input;
    if (input?.pattern) return input.pattern;
    return '(模式)';
  }

  /**
   * 提取搜索查找
   */
  private extractSearchQuery(input: any): string {
    if (typeof input === 'string') return input;
    if (input?.query) return input.query;
    return '(查找)';
  }

  /**
   * 调度保存思考内容
   */
  private scheduleThinkingSave(sessionId: string): void {
    const key = `thinking_save_${sessionId}`;
    
    // 清除现有定时器
    if (this.thinkingSaveTimers.has(key)) {
      clearTimeout(this.thinkingSaveTimers.get(key));
    }
    
    // 设置新定时器（1秒后保存）
    const timer = setTimeout(async () => {
      const thinkingKey = `thinking_${sessionId}`;
      const accumulated = this.accumulator.get(thinkingKey);
      
      if (accumulated && accumulated.content.length > 0) {
        const fullContent = accumulated.content.join('');
        const summary = `💭 思考过程 (${fullContent.length} 字符)`;
        
        await this.saveMessage(sessionId, 'thinking', summary, {
          fullContent, // 完整内容存在 metadata 中
          duration: Date.now() - accumulated.startTime.getTime()
        });
        
        this.accumulator.delete(thinkingKey);
      }
      
      this.thinkingSaveTimers.delete(key);
    }, 1000);
    
    this.thinkingSaveTimers.set(key, timer);
  }

  /**
   * 保存消息到数据库
   */
  private async saveMessage(
    sessionId: string,
    type: 'user' | 'assistant' | 'system' | 'tool_use' | 'thinking' | 'output' | 'error',
    content: string,
    metadata?: any
  ): Promise<void> {
    try {
      // 检查是否为空白或重复内容
      if (!content.trim()) {
        logger.debug('Skipping empty message');
        return;
      }
      
      // 检查最近是否有相同内容的消息（避免重复保存）
      const recentResult = await this.messageRepository.findBySessionId(sessionId, 1, 5); // 检查最近5则
      const isDuplicate = recentResult.messages.some((msg: any) => 
        msg.type === type && 
        msg.content.trim() === content.trim() &&
        Math.abs(new Date().getTime() - msg.timestamp.getTime()) < 5000 // 5秒内视为重复
      );
      
      if (isDuplicate) {
        logger.debug(`Skipping duplicate message: ${type} - ${content.slice(0, 50)}...`);
        return;
      }
      
      const saved = await this.messageRepository.save({
        sessionId,
        type,
        content,
        metadata
      });
      
      logger.info(`Message saved: ${saved.messageId} (${type})`);
      
      // 发送保存完成事件
      this.emit('messageSaved', {
        sessionId,
        messageId: saved.messageId,
        type,
        timestamp: saved.timestamp
      });
      
    } catch (error) {
      logger.error('Failed to save message:', error);
    }
  }

  /**
   * 获取 session 摘要
   */
  async getSessionSummary(sessionId: string): Promise<SessionSummary> {
    const toolUsage = this.toolUsageBuffer.get(sessionId) || [];
    
    // 统计工具使用
    const toolStats = toolUsage.reduce((acc, tool) => {
      acc[tool.name] = (acc[tool.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // 统计文件操作
    const fileOperations = toolUsage
      .filter(tool => tool.fileOperation && tool.filePath)
      .map(tool => ({
        operation: tool.fileOperation!,
        path: tool.filePath!,
        timestamp: tool.timestamp
      }));
    
    return {
      sessionId,
      toolUsageCount: toolUsage.length,
      toolStats,
      fileOperations,
      filesRead: fileOperations.filter(op => op.operation === 'read').map(op => op.path),
      filesWritten: fileOperations.filter(op => op.operation === 'write').map(op => op.path),
      filesEdited: fileOperations.filter(op => op.operation === 'edit').map(op => op.path)
    };
  }

  /**
   * 清理 session 数据
   */
  cleanup(sessionId: string): void {
    // 清理累积器
    const keysToDelete: string[] = [];
    this.accumulator.forEach((_, key) => {
      if (key.includes(sessionId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.accumulator.delete(key));
    
    // 清理工具使用缓冲
    this.toolUsageBuffer.delete(sessionId);
    
    // 清理定时器
    const timerKey = `thinking_save_${sessionId}`;
    if (this.thinkingSaveTimers.has(timerKey)) {
      clearTimeout(this.thinkingSaveTimers.get(timerKey));
      this.thinkingSaveTimers.delete(timerKey);
    }
  }

  private thinkingSaveTimers: Map<string, NodeJS.Timeout> = new Map();
}

// 类型定义
interface AccumulatedMessage {
  sessionId: string;
  type: string;
  content: string[];
  startTime: Date;
  metadata: any;
}

interface ToolUsageInfo {
  name: string;
  status: string;
  input?: any;
  output?: any;
  timestamp: Date;
  fileOperation?: string;
  filePath?: string;
}

interface SessionSummary {
  sessionId: string;
  toolUsageCount: number;
  toolStats: Record<string, number>;
  fileOperations: Array<{
    operation: string;
    path: string;
    timestamp: Date;
  }>;
  filesRead: string[];
  filesWritten: string[];
  filesEdited: string[];
}