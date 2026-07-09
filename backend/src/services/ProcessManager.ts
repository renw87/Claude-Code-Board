import { exec } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { Session } from '../types/session.types';
import { 
  ProcessInfo, 
  ProcessStatus, 
  ProcessMessage, 
  ProcessMetrics, 
  ClaudeCodeConfig,
  ClaudeStreamMessage
} from '../types/process.types';
import { MessageRepository } from '../repositories/MessageRepository';
import { SessionRepository } from '../repositories/SessionRepository';
import { SessionStatus } from '../types/session.types';
import { logger } from '../utils/logger';
import { getNotificationService } from './NotificationService';
import { StreamProcessor } from './StreamProcessor';
import { MessageAccumulator } from './MessageAccumulator';
import { UnifiedStreamProcessor } from './UnifiedStreamProcessor';

/**
 * ProcessManager - 使用 npx 运行 Claude Code
 * 
 * 主要特点：
 * 1. 使用 npx 运行最新版 Claude Code
 * 2. 使用 --output-format=stream-json 解析结构化输出
 * 3. 避免 Windows spawn 问题
 * 4. 支持多文件夹多 session
 */
export class ProcessManager extends EventEmitter {
  private processInfo: Map<string, ProcessInfo> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private messageRepository: MessageRepository;
  private sessionRepository: SessionRepository;
  private streamProcessors: Map<string, StreamProcessor> = new Map();
  private messageAccumulators: Map<string, MessageAccumulator> = new Map();
  private unifiedProcessors: Map<string, UnifiedStreamProcessor> = new Map();
  private useStreamMode: boolean = true; // 切换串流模式
  private useUnifiedProcessor: boolean = true; // 使用统一处理器
  
  private config: ClaudeCodeConfig = {
    executablePath: 'npx',
    defaultTimeout: 3600000, // 60 分钟
    maxConcurrentProcesses: 10,
    healthCheckInterval: 30000, // 30 秒
    maxIdleTime: 3600000, // 1 小时
    maxMemoryUsage: 2048, // 2GB
    enableMetrics: true,
    logLevel: 'info'
  };
  
  constructor(enableHealthCheck: boolean = true) {
    super();
    this.messageRepository = new MessageRepository();
    this.sessionRepository = new SessionRepository();
    
    if (enableHealthCheck) {
      this.startHealthCheck();
    }
  }

  async initialize(): Promise<void> {
    // 创建必要的目录
    await this.ensureDirectories();
    
    logger.info('ProcessManager initialized successfully');
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = ['./data/sessions', './data/logs', './data/temp'];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug(`Created directory: ${dir}`);
      }
    }
  }

  async startClaudeProcess(session: Session): Promise<number> {
    // 验证工作目录
    if (!fs.existsSync(session.workingDir)) {
      throw new Error(`Working directory does not exist: ${session.workingDir}`);
    }

    const virtualPid = Date.now();
    
    // 创建进程信息
    const processInfo: ProcessInfo = {
      sessionId: session.sessionId,
      pid: virtualPid,
      startTime: new Date(),
      status: ProcessStatus.IDLE,
      memoryUsage: 0,
      cpuUsage: 0,
      workingDirectory: session.workingDir,
      commandArgs: [],
      lastActivityTime: new Date()
    };

    this.processInfo.set(session.sessionId, processInfo);
    
    // 触发事件 - 立即返回
    this.emit('processStarted', { sessionId: session.sessionId, pid: virtualPid });
    // 如果有初始任务，状态应该是 processing
    if (session.task) {
      this.emit('statusUpdate', { sessionId: session.sessionId, status: 'processing' });
    } else {
      this.emit('statusUpdate', { sessionId: session.sessionId, status: 'idle' });
    }
    
    logger.info(`Claude Code session created successfully`, {
      sessionId: session.sessionId,
      virtualPid
    });

    // 如果有初始任务，异步运行（不等待）
    if (session.task) {
      setImmediate(async () => {
        try {
          await this.sendMessage(session.sessionId, session.task);
        } catch (error: any) {
          logger.error(`Failed to execute initial task for ${session.sessionId}:`, error);
          this.emit('error', {
            sessionId: session.sessionId,
            error: error.message || 'Failed to execute initial task',
            timestamp: new Date()
          });
        }
      });
    }

    return virtualPid;
  }

  async sendMessage(sessionId: string, content: string): Promise<void> {
    const session = await this.getSessionInfo(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // 保存用户消息
    logger.info(`=== ProcessManager.sendMessage: Saving user message ===`);
    logger.info(`SessionId: ${sessionId}, Content: ${content?.slice(0, 100)}`);
    
    try {
      const savedMessage = await this.messageRepository.save({
        sessionId,
        type: 'user',
        content
      });
      logger.info(`User message saved successfully:`, savedMessage);
    } catch (saveError) {
      logger.error(`Failed to save user message:`, saveError);
      throw saveError;
    }
    
    // 立即发送用户消息到 WebSocket
    logger.info(`Emitting user message immediately for session ${sessionId}:`, { content: content.slice(0, 100) });
    
    const messageData = {
      sessionId,
      type: 'user',
      content,
      timestamp: new Date()
    };
    
    this.emit('message', messageData);
    
    // 准备 Claude Code 命令
    let claudeCommand: string;
    let claudeSessionIdToResume: string | null = null;
    
    // 准备参数 - 参考 vibe-kanban 的实现方式
    logger.info(`Session dangerouslySkipPermissions: ${session.dangerouslySkipPermissions}`);
    const baseFlags = ['-p'];
    if (session.dangerouslySkipPermissions) {
      logger.info(`Adding --dangerously-skip-permissions flag`);
      baseFlags.push('--dangerously-skip-permissions');
    }
    baseFlags.push('--verbose', '--output-format=stream-json');
    
    // 1. 优先检查当前 session 是否已有 Claude session ID（同个对话继续）
    if (session.claudeSessionId) {
      logger.info(`Continuing same conversation with Claude session ID: ${session.claudeSessionId}`);
      claudeCommand = `npx -y @anthropic-ai/claude-code@latest ${baseFlags.join(' ')} --resume=${session.claudeSessionId}`;
    }
    // 2. 检查是否要延续最近的对话（使用 --continue）
    else if (session.continueChat) {
      logger.info(`Continuing most recent conversation using --continue`);
      claudeCommand = `npx -y @anthropic-ai/claude-code@latest ${baseFlags.join(' ')} --continue`;
    }
    // 3. 全新对话
    else {
      logger.info(`Starting new conversation`);
      claudeCommand = `npx -y @anthropic-ai/claude-code@latest ${baseFlags.join(' ')}`;
    }
    
    if (session.dangerouslySkipPermissions) {
      logger.warn(`⚠️ DANGEROUS: Session ${sessionId} is running with --dangerously-skip-permissions`);
    }
    
    logger.info(`Executing Claude Code for session ${sessionId}`, {
      command: claudeCommand,
      workingDir: session.workingDir
    });
    
    // 更新状态为忙碌
    const processInfo = this.processInfo.get(sessionId);
    if (processInfo) {
      processInfo.status = ProcessStatus.BUSY;
      processInfo.lastActivityTime = new Date();
    }
    
    // 发送状态更新事件
    this.emit('statusUpdate', { sessionId, status: 'processing' });
    
    try {
      logger.info(`=== ProcessManager execution mode: useUnifiedProcessor=${this.useUnifiedProcessor}, useStreamMode=${this.useStreamMode} ===`);
      
      if (this.useUnifiedProcessor) {
        // 使用统一处理器（推荐）
        logger.info(`Using UnifiedStreamProcessor for session ${sessionId}`);
        await this.executeClaudeUnifiedCommand(sessionId, claudeCommand, content, session.workingDir);
      } else if (this.useStreamMode) {
        // 使用旧的串流处理器（兼容性）
        logger.info(`Using legacy StreamProcessor for session ${sessionId}`);
        await this.executeClaudeStreamCommand(sessionId, claudeCommand, content, session.workingDir);
      } else {
        // 使用原有的批量处理（调试用）
        logger.info(`Using legacy exec mode for session ${sessionId}`);
        await this.executeClaudeCommand(sessionId, claudeCommand, content, session.workingDir);
      }
    } catch (error) {
      logger.error(`Failed to execute Claude Code:`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        sessionId,
        command: claudeCommand.slice(0, 200)
      });
      // 不要抛出错误，而是更新 session 状态
      const sessionRepo = new SessionRepository();
      try {
        session.status = 'error' as any;
        session.error = JSON.stringify({
          message: error instanceof Error ? error.message : 'Execution failed',
          type: 'EXECUTION_ERROR',
          timestamp: new Date().toISOString()
        });
        session.updatedAt = new Date();
        await sessionRepo.update(session);
      } catch (updateError) {
        logger.error('Failed to update session status after error:', updateError);
      }
    }
  }
  
  /**
   * 使用统一处理器运行 Claude 命令 - 解决重复保存问题
   */
  private async executeClaudeUnifiedCommand(
    sessionId: string,
    command: string,
    prompt: string,
    workingDir: string
  ): Promise<void> {
    // 创建统一处理器
    const unifiedProcessor = new UnifiedStreamProcessor();
    this.unifiedProcessors.set(sessionId, unifiedProcessor);
    
    // 设置统一事件处理
    this.setupUnifiedEventHandlers(sessionId, unifiedProcessor);
    
    try {
      // 解析命令和参数
      const [cmd, ...args] = command.split(' ');
      
      // 使用统一处理器运行
      await unifiedProcessor.startProcess(sessionId, cmd, args, workingDir, prompt);
      
    } finally {
      // 清理资源
      unifiedProcessor.cleanup(sessionId);
      this.unifiedProcessors.delete(sessionId);
    }
  }
  
  /**
   * 设置统一处理器事件处理
   */
  private setupUnifiedEventHandlers(
    sessionId: string,
    unifiedProcessor: UnifiedStreamProcessor
  ): void {
    // 即时消息 - 直接转发给前端
    unifiedProcessor.on('message', (message: ClaudeStreamMessage) => {
      this.emit('message', message);
    });
    
    // 消息开始
    unifiedProcessor.on('messageStart', (data: any) => {
      logger.info(`Message started: ${data.messageId}`, { sessionId });
    });
    
    // 消息完成
    unifiedProcessor.on('messageComplete', (data: any) => {
      logger.info(`Message completed: ${data.messageId}`, { sessionId });
    });
    
    // Claude session ID
    unifiedProcessor.on('sessionId', async (data: { sessionId: string; claudeSessionId: string }) => {
      await this.updateSessionClaudeId(data.sessionId, data.claudeSessionId);
    });
    
    // 工具使用开始
    unifiedProcessor.on('toolUseStart', (data: any) => {
      logger.info(`Tool use started: ${data.toolName}`, { sessionId });
    });
    
    // 工具使用完成
    unifiedProcessor.on('toolUseComplete', (data: any) => {
      logger.info(`Tool use completed: ${data.toolName}`, { sessionId });
    });
    
    // 错误处理
    unifiedProcessor.on('error', (error: any) => {
      logger.error('Unified processor error:', error);
      this.emit('error', error);
    });
    
    // 进程开始
    unifiedProcessor.on('processStarted', (data: any) => {
      this.emit('processStarted', data);
    });
    
    // 进程结束
    unifiedProcessor.on('processExit', async (data: any) => {
      // 更新 session 状态
      try {
        const session = await this.sessionRepository.findById(sessionId);
        if (session) {
          session.status = SessionStatus.IDLE;
          session.error = null;
          session.updatedAt = new Date();
          await this.sessionRepository.update(session);
        }
      } catch (error) {
        logger.error('Failed to update session status:', error);
      }
      
      this.emit('statusUpdate', { sessionId, status: 'idle' });
      this.emit('processExit', data);
      
      // 发送完成通知
      const notificationService = getNotificationService();
      const session = await this.sessionRepository.findById(sessionId);
      if (session) {
        notificationService.notify({
          title: 'Claude Code Board',
          message: `任务运行完成：${session.name}`,
          sound: true
        }).catch(err => {
          logger.warn('Failed to send notification:', err);
        });
      }
    });
    
    // 原始输出
    unifiedProcessor.on('output', (data: any) => {
      logger.debug('Raw output:', data);
    });
  }
  
  /**
   * 使用串流处理器运行 Claude 命令
   */
  private async executeClaudeStreamCommand(
    sessionId: string,
    command: string,
    prompt: string,
    workingDir: string
  ): Promise<void> {
    if (this.useUnifiedProcessor) {
      // 使用统一处理器
      const unifiedProcessor = new UnifiedStreamProcessor();
      this.unifiedProcessors.set(sessionId, unifiedProcessor);
      
      // 设置统一处理器事件处理
      this.setupUnifiedProcessorEventHandlers(sessionId, unifiedProcessor);
      
      try {
        // 解析命令和参数
        const [cmd, ...args] = command.split(' ');
        
        // 使用统一处理器运行
        await unifiedProcessor.startProcess(sessionId, cmd, args, workingDir, prompt);
        
      } catch (error) {
        logger.error(`Unified processor execution failed:`, error);
        throw error;
      }
      
      return;
    }
    
    // 创建串流处理器和消息累积器（旧版后备）
    const streamProcessor = new StreamProcessor();
    const messageAccumulator = new MessageAccumulator();
    
    this.streamProcessors.set(sessionId, streamProcessor);
    this.messageAccumulators.set(sessionId, messageAccumulator);
    
    // 设置事件处理
    this.setupStreamEventHandlers(sessionId, streamProcessor, messageAccumulator);
    
    try {
      // 解析命令和参数
      const [cmd, ...args] = command.split(' ');
      
      // 使用串流处理器运行
      await streamProcessor.startProcess(sessionId, cmd, args, workingDir, prompt);
      
    } finally {
      // 清理资源
      streamProcessor.cleanup(sessionId);
      this.streamProcessors.delete(sessionId);
      this.messageAccumulators.delete(sessionId);
      messageAccumulator.cleanup(sessionId);
    }
  }
  
  /**
   * 设置串流事件处理器
   */
  /**
   * 设置统一处理器事件处理器
   */
  private setupUnifiedProcessorEventHandlers(sessionId: string, processor: UnifiedStreamProcessor): void {
    // 消息事件
    processor.on('message', (message: ClaudeStreamMessage) => {
      // 转发给前端
      this.emit('message', message);
    });

    // 进程相关事件
    processor.on('processStarted', (data) => {
      logger.info(`Unified processor started for session ${sessionId}`, data);
    });

    processor.on('processExit', (data) => {
      logger.info(`Unified processor exited for session ${sessionId}`, data);
      // 清理资源
      this.unifiedProcessors.delete(sessionId);
    });

    processor.on('error', (error) => {
      logger.error(`Unified processor error for session ${sessionId}:`, error);
      this.emit('error', { sessionId, error });
    });
  }

  private setupStreamEventHandlers(
    sessionId: string,
    streamProcessor: StreamProcessor,
    messageAccumulator: MessageAccumulator
  ): void {
    // 处理串流消息
    streamProcessor.on('message', async (message: ClaudeStreamMessage) => {
      // 发送到前端
      this.emit('message', message);
      
      // 交给累积器处理保存（仅保存，不重复发送）
      await messageAccumulator.handleStreamMessage(message);
    });
    
    // 处理完整消息（用于保存）
    streamProcessor.on('messageComplete', async (message: ClaudeStreamMessage) => {
      // 只保存，不发送到前端（避免重复）
      await messageAccumulator.handleStreamMessage(message);
    });
    
    // 处理 Claude session ID
    streamProcessor.on('sessionId', async (data: { sessionId: string; claudeSessionId: string }) => {
      await this.updateSessionClaudeId(data.sessionId, data.claudeSessionId);
    });
    
    // 处理工具使用开始
    streamProcessor.on('toolUseStart', (data: any) => {
      logger.info(`Tool use started: ${data.toolName}`, { sessionId, tool: data.toolName });
      // 不再重复发送，StreamProcessor 会通过 'message' 事件处理
    });
    
    // 处理工具使用完成
    streamProcessor.on('toolUseComplete', (data: any) => {
      logger.info(`Tool use completed: ${data.toolName}`, { sessionId, duration: data.duration });
      // 不再重复发送，StreamProcessor 会通过 'message' 事件处理
    });
    
    // 处理思考开始
    streamProcessor.on('thinkingStart', (data: any) => {
      logger.info('Claude started thinking', { sessionId });
      // 不再重复发送，StreamProcessor 会通过 'message' 事件处理
    });
    
    // 处理思考内容
    streamProcessor.on('thinking', (message: ClaudeStreamMessage) => {
      // 不再重复发送，StreamProcessor 会通过 'message' 事件处理
    });
    
    // 处理错误
    streamProcessor.on('error', (error: any) => {
      logger.error('Stream processor error:', error);
      this.emit('error', error);
    });
    
    // 处理进程开始
    streamProcessor.on('processStarted', (data: any) => {
      this.emit('processStarted', data);
    });
    
    // 处理进程结束
    streamProcessor.on('processExit', async (data: any) => {
      // 更新 session 状态
      try {
        const session = await this.sessionRepository.findById(sessionId);
        if (session) {
          session.status = SessionStatus.IDLE;
          session.error = null;
          session.updatedAt = new Date();
          await this.sessionRepository.update(session);
        }
      } catch (error) {
        logger.error('Failed to update session status:', error);
      }
      
      this.emit('statusUpdate', { sessionId, status: 'idle' });
      this.emit('processExit', data);
      
      // 发送完成通知
      const notificationService = getNotificationService();
      const session = await this.sessionRepository.findById(sessionId);
      if (session) {
        notificationService.notify({
          title: 'Claude Code Board',
          message: `任务运行完成：${session.name}`,
          sound: true
        }).catch(err => {
          logger.warn('Failed to send notification:', err);
        });
      }
    });
    
    // 消息累积器事件
    messageAccumulator.on('realtimeMessage', (message: ClaudeStreamMessage) => {
      // 即时消息已经在上面的 message 事件中处理
    });
    
    messageAccumulator.on('messageSaved', (data: any) => {
      logger.debug('Message saved:', data);
    });
  }
  
  private async executeClaudeCommand(
    sessionId: string, 
    command: string, 
    prompt: string, 
    workingDir: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const execOptions = {
        cwd: workingDir,
        env: {
          ...process.env,
          CLAUDE_SESSION_ID: sessionId,
          NODE_NO_WARNINGS: '1'
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: this.config.defaultTimeout
      };
      
      const startTime = Date.now();
      
      // 创建进程信息
      const processInfo: ProcessInfo = {
        sessionId,
        pid: 0, // 将在运行后更新
        status: ProcessStatus.RUNNING,
        startTime: new Date(),
        lastActivityTime: new Date(),
        memoryUsage: 0,
        cpuUsage: 0,
        workingDirectory: workingDir,
        commandArgs: command.split(' ')
      };
      
      this.processInfo.set(sessionId, processInfo);
      
      // 标记是否已中断
      let isInterrupted = false;
      
      // 使用 exec 运行命令，通过 stdin 传入 prompt
      const childProcess = exec(command, execOptions, async (error, stdout, stderr) => {
        logger.info(stdout);
        const executionTime = Date.now() - startTime;
        
        // 检查是否已被中断（进程信息已被移除）
        if (!this.processInfo.has(sessionId)) {
          isInterrupted = true;
          logger.info(`Process was interrupted, skipping post-processing for session ${sessionId}`);
          resolve();
          return;
        }
        
        logger.info(`Claude Code execution completed in ${executionTime}ms`, { sessionId });
        
        // 运行完成后移除进程信息
        this.processInfo.delete(sessionId);
        
        // 更新 session 状态回 IDLE 并清调试误消息
        try {
          const sessionRepo = new SessionRepository();
          const session = await sessionRepo.findById(sessionId);
          if (session) {
            session.status = SessionStatus.IDLE;
            session.error = null; // 清调试误消息
            session.updatedAt = new Date();
            await sessionRepo.update(session);
            logger.info(`Session status updated back to IDLE`);
          }
        } catch (updateError) {
          logger.error(`Failed to update session status:`, updateError);
        }
        
        // 发送完成状态更新
        this.emit('statusUpdate', { sessionId, status: 'idle' });
        this.emit('processExit', { sessionId, code: 0 });
        
        // 发送桌面通知
        if (!error) {
          const notificationService = getNotificationService();
          const sessionRepo = new SessionRepository();
          sessionRepo.findById(sessionId).then(session => {
            if (session) {
              notificationService.notify({
                title: 'Claude Code Board',
                message: `任务运行完成：${session.name}`,
                sound: true
              }).catch(err => {
                logger.warn('Failed to send notification:', err);
              });
            }
          }).catch(err => {
            logger.error('Failed to get session for notification:', err);
          });
        }
        
        if (error) {
          // 收集详细的错误信息
          const errorDetails = {
            message: error.message,
            code: error.code,
            signal: error.signal,
            killed: error.killed,
            cmd: error.cmd || command,
            stdout: stdout?.slice(0, 2000), // 截取前 2000 字符
            stderr: stderr || '无 stderr 输出',
            workingDir,
            executionTime: `${executionTime}ms`,
            timestamp: new Date().toISOString()
          };
          
          // 详细记录错误
          logger.error(`Claude Code execution error:`, errorDetails);
          
          // 分析错误类型
          let friendlyErrorMessage = 'Claude 运行失败';
          let errorType = 'UNKNOWN_ERROR';
          
          if ((error as any).code === 'ENOENT') {
            friendlyErrorMessage = 'Claude Code 未找到，请确认是否已安装';
            errorType = 'CLAUDE_NOT_FOUND';
          } else if ((error as any).code === 'ETIMEDOUT' || error.killed) {
            friendlyErrorMessage = `运行逾时 (${this.config.defaultTimeout / 1000}秒)`;
            errorType = 'TIMEOUT';
          } else if (stderr?.includes('permission')) {
            friendlyErrorMessage = '权限不足，请检查工作目录权限';
            errorType = 'PERMISSION_DENIED';
          } else if (stderr?.includes('npm ERR!')) {
            friendlyErrorMessage = 'npm 运行错误，请检查网络连接或 npm 设置';
            errorType = 'NPM_ERROR';
            // 记录完整的 npm 错误
            logger.error('NPM Error Details:', { stderr });
          } else if (stderr?.includes('Invalid') || stderr?.includes('invalid')) {
            friendlyErrorMessage = `参数错误: ${stderr.split('\n')[0]}`;
            errorType = 'INVALID_ARGUMENTS';
          } else if (error.message?.includes('Command failed')) {
            // 尝试从 stderr 提取更有意义的错误
            const stderrFirstLine = stderr?.split('\n')[0];
            friendlyErrorMessage = stderrFirstLine || error.message;
            errorType = 'COMMAND_FAILED';
          }
          
          // 构建结构化的错误信息
          const structuredError = {
            sessionId,
            error: friendlyErrorMessage,
            errorType,
            details: {
              originalError: error.message,
              stderr: stderr || '',
              exitCode: error.code,
              command: command.slice(0, 200) // 不包含完整 prompt
            },
            timestamp: new Date()
          };
          
          this.emit('error', structuredError);
          
          // 发送错误通知
          const notificationService = getNotificationService();
          const errorSessionRepo = new SessionRepository();
          errorSessionRepo.findById(sessionId).then(session => {
            if (session) {
              notificationService.notify({
                title: 'Claude Code Board - 错误',
                message: `${session.name}: ${friendlyErrorMessage}`,
                sound: true
              }).catch(err => {
                logger.warn('Failed to send error notification:', err);
              });
            }
          }).catch(err => {
            logger.error('Failed to get session for error notification:', err);
          });
          
          // 更新 session 状态为错误，包含详细错误信息
          const updateSessionRepo = new SessionRepository();
          updateSessionRepo.findById(sessionId).then(session => {
            if (session) {
              session.status = 'error' as any;
              session.error = JSON.stringify({
                message: friendlyErrorMessage,
                type: errorType,
                stderr: stderr?.slice(0, 500),
                timestamp: new Date().toISOString()
              });
              session.updatedAt = new Date();
              return updateSessionRepo.update(session);
            }
          }).catch(err => {
            logger.error('Failed to update session status:', err);
          });
          
          // 发送错误状态更新
          this.emit('statusUpdate', { sessionId, status: 'error' });
          this.emit('processExit', { sessionId, code: error.code || 1, signal: error.signal || null });
          
          // 清理进程信息
          this.processInfo.delete(sessionId);
          
          // 不要 reject，而是 resolve 以防止未处理的 Promise rejection
          resolve();
          return;
        }
        
        // 处理 stream-json 格式的输出
        if (stdout && stdout.trim()) {
          await this.processStreamJsonOutput(sessionId, stdout);
        }
        
        if (stderr && stderr.trim()) {
          // 记录完整的 stderr 输出以便调试
          logger.warn(`Claude Code stderr output:`, {
            sessionId,
            stderr: stderr,
            stderrLength: stderr.length,
            workingDir,
            command: command.slice(0, 200) // 不包含完整 prompt
          });
        }
        
        resolve();
      });
      
      // 更新进程 PID
      if (childProcess.pid && processInfo) {
        processInfo.pid = childProcess.pid;
      }
      
      // 将 prompt 写入 stdin
      if (childProcess.stdin) {
        childProcess.stdin.write(prompt);
        childProcess.stdin.end();
      }
    });
  }
  
  private async processStreamJsonOutput(sessionId: string, output: string): Promise<void> {
    const lines = output.trim().split('\n');
    let claudeSessionId: string | null = null;
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const json = JSON.parse(line);
        
        // 提取 session ID 并保存到数据库
        if (json.session_id && !claudeSessionId) {
          claudeSessionId = json.session_id;
          logger.info(`Claude session ID: ${claudeSessionId}`);
          
          // 更新数据库中的 claude_session_id
          if (claudeSessionId) {
            try {
              await this.sessionRepository.updateClaudeSessionId(sessionId, claudeSessionId);
              logger.info(`Updated Claude session ID for session ${sessionId}: ${claudeSessionId}`);
            } catch (error) {
              logger.error(`Failed to update Claude session ID:`, error);
            }
          }
        }
        
        // 处理不同类型的消息
        logger.info(`Processing message type: ${json.type}`, { json });
        
        switch (json.type) {
          case 'assistant':
            if (json.message?.content) {
              const content = this.extractTextContent(json.message.content);
              if (content) {
                await this.messageRepository.save({
                  sessionId,
                  type: 'assistant',
                  content
                });
                
                logger.info(`Emitting assistant message for session ${sessionId}:`, { content: content.slice(0, 100) });
                logger.info(`EventEmitter listeners for 'message' (assistant):`, this.listenerCount('message'));
                
                const assistantData = {
                  sessionId,
                  type: 'assistant',
                  content,
                  timestamp: new Date()
                };
                
                logger.info(`About to emit assistant message event with data:`, assistantData);
                this.emit('message', assistantData);
                logger.info(`Assistant message event emitted successfully`);
              }
            }
            break;
            
          case 'user':
            // 用户消息已在 sendMessage 方法中立即发送，避免重复发送
            if (json.message?.content) {
              const content = this.extractTextContent(json.message.content);
              logger.info(`User message already sent immediately, skipping stream duplicate: ${content?.slice(0, 100)}`);
            }
            break;
            
          case 'system':
            if (json.subtype === 'init') {
              logger.info(`Claude initialized with model: ${json.model}`);
            }
            break;
            
          case 'error':
            logger.error(`Claude error:`, json);
            this.emit('error', {
              sessionId,
              error: json.error || json.message || 'Unknown error',
              timestamp: new Date()
            });
            break;
            
          case 'result':
            // 忽略 result 类型（如 vibe-kanban）
            break;
            
          default:
            logger.debug(`Unhandled message type: ${json.type}`);
        }
      } catch (parseError) {
        // 如果不是 JSON，当作普通文本处理
        if (line.trim()) {
          await this.messageRepository.save({
            sessionId,
            type: 'assistant',
            content: line
          });
          
          this.emit('message', {
            sessionId,
            type: 'assistant',
            content: line,
            timestamp: new Date()
          });
        }
      }
    }
    
    // 保存 Claude session ID 以供后续使用
    if (claudeSessionId) {
      await this.updateSessionClaudeId(sessionId, claudeSessionId);
    }
  }
  
  private extractTextContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      const textParts: string[] = [];
      
      for (const item of content) {
        if (item.type === 'text' && item.text) {
          textParts.push(item.text);
        }
      }
      
      return textParts.join('\n');
    }
    
    return '';
  }
  
  private async updateSessionClaudeId(sessionId: string, claudeSessionId: string): Promise<void> {
    // 更新 session 的 Claude session ID
    const { SessionRepository } = require('../repositories/SessionRepository');
    const sessionRepo = new SessionRepository();
    
    try {
      const session = await sessionRepo.findById(sessionId);
      if (session) {
        session.claudeSessionId = claudeSessionId;
        await sessionRepo.update(session);
        logger.info(`Updated Claude session ID for ${sessionId}: ${claudeSessionId}`);
      }
    } catch (error) {
      logger.error(`Failed to update Claude session ID:`, error);
    }
  }
  
  private async getSessionInfo(sessionId: string): Promise<any> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        return null;
      }
      
      return {
        sessionId: session.sessionId,
        workingDir: session.workingDir,
        continueChat: session.continueChat || false,
        previousSessionId: session.previousSessionId,
        claudeSessionId: session.claudeSessionId,
        dangerouslySkipPermissions: session.dangerouslySkipPermissions || false
      };
    } catch (error) {
      logger.error(`Failed to get session info for ${sessionId}:`, error);
      
      const processInfo = this.processInfo.get(sessionId);
      if (!processInfo) {
        return null;
      }
      
      return {
        sessionId,
        workingDir: processInfo.workingDirectory,
        continueChat: false
      };
    }
  }

  async stopProcess(sessionId: string): Promise<void> {
    const processInfo = this.processInfo.get(sessionId);
    
    if (!processInfo) {
      logger.warn(`Process info not found for session ${sessionId}`);
      return;
    }
    
    processInfo.status = ProcessStatus.STOPPED;
    logger.info(`Stopping session ${sessionId}`);
    
    await this.saveSessionHistory(sessionId);
    this.processInfo.delete(sessionId);
    this.emit('processStopped', { sessionId });
  }

  private async saveSessionHistory(sessionId: string): Promise<void> {
    try {
      const historyPath = path.join('./data/sessions', `${sessionId}.history`);
      const messages = await this.messageRepository.getRecentMessages(sessionId, 1000);
      
      const historyData = {
        sessionId,
        savedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map(msg => ({
          type: msg.type,
          content: msg.content,
          timestamp: msg.timestamp
        }))
      };
      
      fs.writeFileSync(historyPath, JSON.stringify(historyData, null, 2));
      logger.info(`Session history saved: ${historyPath}`);
    } catch (error) {
      logger.error(`Failed to save session history for ${sessionId}:`, error);
    }
  }

  async interruptProcess(sessionId: string): Promise<void> {
    // 检查是否有统一处理器
    const unifiedProcessor = this.unifiedProcessors.get(sessionId);
    if (unifiedProcessor) {
      unifiedProcessor.interrupt();
      unifiedProcessor.cleanup(sessionId);
      this.unifiedProcessors.delete(sessionId);
    }
    
    // 检查是否有串流处理器（兼容性）
    const streamProcessor = this.streamProcessors.get(sessionId);
    if (streamProcessor) {
      streamProcessor.interrupt();
      this.streamProcessors.delete(sessionId);
      
      // 清理消息累积器
      const messageAccumulator = this.messageAccumulators.get(sessionId);
      if (messageAccumulator) {
        messageAccumulator.cleanup(sessionId);
        this.messageAccumulators.delete(sessionId);
      }
    }
    
    const processInfo = this.processInfo.get(sessionId);
    
    if (!processInfo) {
      throw new Error(`Process info not found for session ${sessionId}`);
    }
    
    // 如果有 PID，尝试终止进程
    if (processInfo.pid && processInfo.pid > 0) {
      try {
        // 在 Windows 上使用 taskkill，其他平台使用 kill
        if (process.platform === 'win32') {
          // 使用 /T 参数终止进程树（包含所有子进程）
          exec(`taskkill /F /T /PID ${processInfo.pid}`, (error) => {
            if (error) {
              logger.warn(`Failed to kill process ${processInfo.pid}:`, error);
              // 如果失败，尝试使用进程名称
              exec(`taskkill /F /IM node.exe /FI "PID eq ${processInfo.pid}"`, (killError) => {
                if (killError) {
                  logger.error(`Failed to kill process by name:`, killError);
                }
              });
            } else {
              logger.info(`Successfully killed process ${processInfo.pid}`);
            }
          });
        } else {
          // 先尝试 SIGTERM，然后 SIGKILL
          process.kill(processInfo.pid, 'SIGTERM');
          setTimeout(() => {
            try {
              process.kill(processInfo.pid, 'SIGKILL');
            } catch (e) {
              // 进程可能已经结束
            }
          }, 1000);
        }
      } catch (error) {
        logger.warn(`Failed to interrupt process:`, error);
      }
    }
    
    // 从 Map 中移除进程信息
    this.processInfo.delete(sessionId);
    
    // 发送中断事件和状态更新
    this.emit('processInterrupted', { sessionId });
    this.emit('statusUpdate', { sessionId, status: 'idle' });
    
    // 保存中断消息
    try {
      await this.messageRepository.save({
        sessionId,
        type: 'assistant',
        content: '⚠️ 运行已被用户中断'
      });
    } catch (error) {
      logger.error('Failed to save interrupt message:', error);
    }
    
    logger.info(`Session interrupted: ${sessionId}`);
  }

  getProcess(sessionId: string): any {
    // 使用 npx 模式时，我们不维护长期运行的进程
    return undefined;
  }

  getProcessInfo(sessionId: string): ProcessInfo | undefined {
    return this.processInfo.get(sessionId);
  }

  getAllProcessInfo(): ProcessInfo[] {
    return Array.from(this.processInfo.values());
  }

  getActiveProcessCount(): number {
    return this.processInfo.size;
  }

  async getProcessMetrics(sessionId: string): Promise<ProcessMetrics | null> {
    const processInfo = this.processInfo.get(sessionId);
    
    if (!processInfo) {
      return null;
    }

    const metrics: ProcessMetrics = {
      sessionId,
      timestamp: new Date(),
      memoryUsage: {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0
      },
      cpuUsage: {
        user: 0,
        system: 0
      },
      uptime: (Date.now() - processInfo.startTime.getTime()) / 1000
    };

    return metrics;
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
    
    logger.info('Health check started', { interval: this.config.healthCheckInterval });
  }

  private async performHealthCheck(): Promise<void> {
    const now = Date.now();
    const toStop: string[] = [];

    for (const [sessionId, processInfo] of this.processInfo.entries()) {
      const idleTime = now - processInfo.lastActivityTime.getTime();
      if (idleTime > this.config.maxIdleTime) {
        logger.info(`Session ${sessionId} has been idle for too long:`, {
          idleTime: idleTime / 1000 / 60,
          maxIdleMinutes: this.config.maxIdleTime / 1000 / 60
        });
        toStop.push(sessionId);
        continue;
      }
    }

    for (const sessionId of toStop) {
      try {
        await this.stopProcess(sessionId);
        this.emit('processCleanedUp', { sessionId, reason: 'health_check' });
      } catch (error) {
        logger.error(`Failed to stop session ${sessionId} during health check:`, error);
      }
    }

    if (this.config.enableMetrics) {
      this.emit('healthCheck', {
        totalSessions: this.processInfo.size,
        cleanedUp: toStop.length,
        timestamp: new Date()
      });
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down ProcessManager...');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    const stopPromises = Array.from(this.processInfo.keys()).map(sessionId =>
      this.stopProcess(sessionId).catch(error =>
        logger.error(`Error stopping session ${sessionId}:`, error)
      )
    );

    await Promise.all(stopPromises);
    
    logger.info('ProcessManager shutdown complete');
  }

  /**
   * 设置处理器模式
   */
  setProcessorMode(mode: 'unified' | 'stream' | 'legacy'): void {
    switch (mode) {
      case 'unified':
        this.useUnifiedProcessor = true;
        this.useStreamMode = true;
        logger.info('Switched to unified processor mode');
        break;
      case 'stream':
        this.useUnifiedProcessor = false;
        this.useStreamMode = true;
        logger.info('Switched to legacy stream processor mode');
        break;
      case 'legacy':
        this.useUnifiedProcessor = false;
        this.useStreamMode = false;
        logger.info('Switched to legacy batch processor mode');
        break;
    }
  }

  /**
   * 获取当预处理器模式
   */
  getProcessorMode(): string {
    if (this.useUnifiedProcessor) {
      return 'unified';
    } else if (this.useStreamMode) {
      return 'stream';
    } else {
      return 'legacy';
    }
  }

  /**
   * 获取处理器统计信息
   */
  getProcessorStats(): any {
    return {
      mode: this.getProcessorMode(),
      unifiedProcessors: this.unifiedProcessors.size,
      streamProcessors: this.streamProcessors.size,
      messageAccumulators: this.messageAccumulators.size,
      totalActiveSessions: this.processInfo.size
    };
  }
}