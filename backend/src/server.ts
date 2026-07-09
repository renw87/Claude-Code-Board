import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
// import { sessionRouter } from './routes/session.routes'; // 动态加载
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import { Database } from './database/database';
import { ProcessManager } from './services/ProcessManager';
import { getEnvConfig } from './config/env.config';

const config = getEnvConfig();
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Routes - 延迟到 ProcessManager 初始化后再加载
// app.use('/api/sessions', sessionRouter);

// Error handling
app.use(errorHandler);

// WebSocket handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('subscribe', (sessionId: string) => {
    socket.join(`session:${sessionId}`);
    logger.info(`Client ${socket.id} subscribed to session ${sessionId}`);
  });
  
  socket.on('unsubscribe', (sessionId: string) => {
    socket.leave(`session:${sessionId}`);
    logger.info(`Client ${socket.id} unsubscribed from session ${sessionId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Export for use in other modules
export { io };

// Initialize database and start server
const PORT = config.port;

// Global process manager instance
let processManager: ProcessManager;

// 全局错误处理
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // 不要退出进程，继续运行
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // 不要退出进程，继续运行
});

async function startServer() {
  try {
    // Initialize database
    const db = Database.getInstance();
    await db.initialize();
    logger.info('Database initialized successfully');

    // Initialize Agent Prompt Service
    const { agentPromptService } = await import('./services/AgentPromptService');
    await agentPromptService.initialize();
    logger.info('Agent Prompt Service initialized');

    // Initialize process manager
    processManager = new ProcessManager();
    
    // 设置 ProcessManager 错误处理，防止进程崩溃
    processManager.on('error', (data) => {
      logger.error(`ProcessManager error for session ${data.sessionId}:`, {
        error: data.error,
        errorType: data.errorType,
        details: data.details,
        timestamp: data.timestamp
      });
      // 将结构化错误转发给订阅的客户端
      io.to(`session:${data.sessionId}`).emit('error', {
        sessionId: data.sessionId,
        error: data.error,
        errorType: data.errorType,
        details: data.details,
        timestamp: data.timestamp
      });
    });
    
    // 设置 ProcessManager 事件处理，用于 WebSocket 推送
    processManager.on('message', (data) => {
      logger.info(`=== WebSocket: Received message event from ProcessManager ===`);
      logger.info(`SessionId: ${data.sessionId}, Type: ${data.type}, Content: ${data.content?.slice(0, 100)}`);
      
      // 检查是否有客户端订阅这个 session
      const room = `session:${data.sessionId}`;
      const clientsInRoom = io.sockets.adapter.rooms.get(room);
      logger.info(`Clients in room ${room}:`, clientsInRoom ? Array.from(clientsInRoom) : 'No clients');
      
      // 发送通用的 message 事件和特定类型事件，前端会过滤重复
      logger.info(`Emitting message to room: ${room}, type: ${data.type}`);
      io.to(room).emit('message', data);
      
      // 同时发送特定类型事件，确保前端兼容性
      if (data.type === 'assistant') {
        io.to(room).emit('assistant', data);
      } else if (data.type === 'user') {
        io.to(room).emit('user', data);
      } else if (data.type === 'system') {
        io.to(room).emit('system', data);
      }
      
      logger.info(`=== WebSocket: Message forwarding completed ===`);
    });

    processManager.on('output', (data) => {
      io.to(`session:${data.sessionId}`).emit('output', data);
    });

    processManager.on('statusUpdate', (data) => {
      // 发送到特定 session 房间（详细页面使用）
      io.to(`session:${data.sessionId}`).emit('status_update', data);
      // 同时发送全域事件（列表页面使用）
      io.emit('global_status_update', data);
    });

    processManager.on('processStarted', (data) => {
      io.emit('process_started', data);
    });

    processManager.on('processExit', (data) => {
      // 发送到特定 session 房间（详细页面使用）
      io.to(`session:${data.sessionId}`).emit('process_exit', data);
      // 同时发送全域事件（列表页面使用）
      io.emit('global_process_exit', data);
    });

    logger.info('ProcessManager initialized successfully');

    // 现在动态加载 routes，这样 SessionController 就能获得正确的 ProcessManager 实例
    const { sessionRouter } = await import('./routes/session.routes');
    
    // Auth routes (不需要认证)
    const authRouter = (await import('./routes/auth.routes')).default;
    app.use('/api/auth', authRouter);
    
    // Common paths routes (需要认证)
    const commonPathRouter = (await import('./routes/commonPath.routes')).default;
    
    // Project routes (需要认证)
    const projectRouter = (await import('./routes/project.routes')).default;
    
    // Tag routes (需要认证)
    const tagRouter = (await import('./routes/tag.routes')).default;
    
    // Workflow Stage routes (需要认证)
    const workflowStageRouter = (await import('./routes/workflowStage.routes')).default;
    
    // Work Item routes (需要认证)
    const { workItemRouter } = await import('./routes/workitem.routes');
    
    // Agent Prompts routes (需要认证)
    const agentPromptsRouter = (await import('./routes/agentPrompts')).default;

    // Task Template routes (需要认证)
    const taskTemplateRouter = (await import('./routes/taskTemplate.routes')).default;

    // Service & Nginx inspection routes (只读，auth 保护)
    const { serviceRouter } = await import('./routes/service.routes');
    const { nginxRouter } = await import('./routes/nginx.routes');

    // Session routes (需要认证)
    const { authMiddleware } = await import('./middleware/auth.middleware');
    app.use('/api/sessions', authMiddleware, sessionRouter);
    app.use('/api/common-paths', authMiddleware, commonPathRouter);
    app.use('/api/projects', authMiddleware, projectRouter);
    app.use('/api/tags', authMiddleware, tagRouter);
    app.use('/api/workflow-stages', authMiddleware, workflowStageRouter);
    app.use('/api/work-items', authMiddleware, workItemRouter);
    app.use('/api/agent-prompts', authMiddleware, agentPromptsRouter);
    app.use('/api/task-templates', authMiddleware, taskTemplateRouter);
    app.use('/api/services', authMiddleware, serviceRouter);
    app.use('/api/nginx', authMiddleware, nginxRouter);

    logger.info('Routes initialized successfully');

    // Start HTTP server
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`WebSocket server is ready`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export process manager for use in other modules
export { processManager };

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await gracefulShutdown();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await gracefulShutdown();
});

async function gracefulShutdown() {
  try {
    // Shutdown process manager first
    if (processManager) {
      await processManager.shutdown();
      logger.info('ProcessManager shutdown complete');
    }

    // Close database connection
    const db = Database.getInstance();
    await db.close();
    logger.info('Database closed');
    
    // Close HTTP server
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

startServer();