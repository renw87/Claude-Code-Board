import { v4 as uuidv4 } from "uuid";
import { MessageRepository } from "../repositories/MessageRepository";
import { SessionRepository } from "../repositories/SessionRepository";
import { io } from "../server";
import { CreateSessionRequest, Session, SessionStatus } from "../types/session.types";
import { logger } from "../utils/logger";
import { agentPromptService } from "./AgentPromptService";
import { ProcessManager } from "./ProcessManager";

export class SessionService {
  private processManager: ProcessManager;
  private sessionRepository: SessionRepository;
  private messageRepository: MessageRepository;

  constructor(processManager?: ProcessManager) {
    // 使用传入的 ProcessManager 实例，或者创建新的（向后兼容）
    if (processManager) {
      this.processManager = processManager;
      logger.info("Using shared ProcessManager instance");
    } else {
      this.processManager = new ProcessManager(true);
      logger.info("ProcessManager initialized (npx mode)");
      // 监听进程事件
      this.setupProcessEventListeners();
    }

    this.sessionRepository = new SessionRepository();
    this.messageRepository = new MessageRepository();
  }

  async initialize(): Promise<void> {
    await this.processManager.initialize();
  }

  private setupProcessEventListeners(): void {
    // 进程准备就绪
    this.processManager.on("processReady", async (data: { sessionId: string }) => {
      const session = await this.sessionRepository.findById(data.sessionId);
      if (session && session.status !== SessionStatus.IDLE) {
        session.status = SessionStatus.IDLE;
        session.updatedAt = new Date();
        await this.sessionRepository.update(session);
      }
    });

    // 进程结束
    this.processManager.on("processExit", async (data: { sessionId: string; code: number | null; signal: string | null }) => {
      const session = await this.sessionRepository.findById(data.sessionId);
      if (session) {
        // 只有在运行失败时才更新状态为 ERROR
        // 正常运行完成时，状态应该保持 IDLE（已在 ProcessManager 中处理）
        if (data.code !== 0) {
          session.status = SessionStatus.ERROR;
          session.error = `Process exited with code ${data.code}`;
          session.updatedAt = new Date();
          await this.sessionRepository.update(session);
        }
        // 注意：不再将 code === 0 的情况设为 COMPLETED
        // COMPLETED 状态应该只在用户明确结束 session 时才设置
      }
    });

    // 进程错误
    this.processManager.on("processError", async (data: { sessionId: string; error: string }) => {
      const session = await this.sessionRepository.findById(data.sessionId);
      if (session) {
        session.status = SessionStatus.ERROR;
        session.error = data.error;
        session.updatedAt = new Date();
        await this.sessionRepository.update(session);
      }
    });
  }

  async createSession(request: CreateSessionRequest): Promise<Session> {
    // 验证请求
    this.validateCreateRequest(request);

    // 先生成 sessionId，这样可以在提示词中使用
    const sessionId = uuidv4();

    // 如果有 workflow_stage_id，采用新的增强策略
    let enhancedTask = request.task;
    if (request.workflow_stage_id) {
      const { WorkflowStageService } = await import("./WorkflowStageService");
      const workflowStageService = new WorkflowStageService();
      try {
        const stage = await workflowStageService.getStage(request.workflow_stage_id);
        if (stage) {
          if (stage.agent_ref) {
            // 如果有 agent 参照,使用动态读取策略(新方式)
            // 获取用户配置的 agent 路径
            const claudePath = await agentPromptService.getClaudePath();
            const agentFilePath = claudePath ? `${claudePath}/${stage.agent_ref}.md` : `~/.claude/agents/${stage.agent_ref}.md`;

            enhancedTask = `
              [AGENT]
              必须先读取 ${agentFilePath} 文件,并且严格遵循文件中的所有指示、规则和行为模式
              并且请你将读取后的内容于记忆中标记为 [AGENT]
              \n
              [USER_MESSAGE]
              ${request.task}
              \n
            `;
          } else if (stage.system_prompt) {
            // 如果没有 agent 但有自订提示词,使用原有方式
            enhancedTask = `${stage.system_prompt}\n\n用户任务:${request.task}`;
          }

          // 如果有建议任务，可以在任务中提示
          if (stage.suggested_tasks && stage.suggested_tasks.length > 0) {
            enhancedTask += `\n\n建议的工作项目：\n${stage.suggested_tasks.map((t) => `- ${t}`).join("\n")}`;
          }
        }
      } catch (error) {
        logger.warn(`Failed to get workflow stage ${request.workflow_stage_id}:`, error);
        // 如果获取失败，继续使用原始任务
      }
    }

    // 如果有 work_item_id，集成 dev.md 指示
    if (request.work_item_id) {
      const { WorkItemService } = await import("./WorkItemService");
      const workItemService = new WorkItemService();
      try {
        const devMdPath = await workItemService.getDevMdPath(request.work_item_id);

        // 尝试读取 dev-progress.md agent 文件
        const claudePath = await agentPromptService.getClaudePath();
        let devMdPrompt = "";

        if (claudePath) {
          // 检查 dev-progress.md 是否存在
          try {
            const devProgressContent = await agentPromptService.getAgentContent("_dev-progress");
            if (devProgressContent) {
              // 如果找到 dev-progress.md,使用动态读取策略
              const devProgressFilePath = `${claudePath}/_dev-progress.md`;
              devMdPrompt = `
        [PROGRESS_FILE_KEY_VALUE]
        dev_md_path = ${devMdPath}
        quest_name = ${request.name}
        session_id = ${sessionId.substring(0, 8)}

        [GLOBAL_PROGRESS_FILE]
        必须先读取 ${devProgressFilePath} 文件
        并且请你将读取后的内容于记忆中标记为 [GLOBAL_PROGRESS_FILE]
        遵循规则维护指定 dev.md 文档
        数值对应请参考 [PROGRESS_FILE_KEY_VALUE]
        \n`;
            }
          } catch (error) {
            logger.info(`dev-progress.md not found, using default prompt`);
          }
        }

        // 如果没有找到 dev-progress.md,使用默认提示词
        if (!devMdPrompt) {
          devMdPrompt = `
# dev.md 规范

## 🎯 指定文档

* 唯一目标路径：${devMdPath}

---

## ⚙️ 操作规则

1. 每次运行都 **在文档末尾添加一个段落**
2. 段落标题为 [${request.name}]-{${sessionId.substring(0, 8)}} 组成
3. 以最精简的文本来表达最必要且充分的消息量

---

## 🧱 段落示意

\`\`\`markdown
## [${request.name}]-{${sessionId.substring(0, 8)}}
| 字段 | 内容 |
|------|------|
| **任务** | ≤15字 |
| **完成** | - 项目（每项≤10字） |
| **产出** | - /绝对路径 |
| **摘要** | ≤40字，1句 |
| **待办** | - [ ] 项目 |
---
\`\`\`

---

## 🚫 禁止事项

* 编辑非指定路径之 dev.md、创建、修改或覆盖任何其他 dev.md
* 变动 {{quest_name}} 为其他名称
* 使用相对路径于「产出」字段
* 删除或覆盖已存在段落
* 仅在对话展示内容而不写入文件

---

## 📦 补充

* 所有重要产出文件须存于 \`/docs/\` 并于「产出」中纪录绝对路径。
* 每个段落代表一次任务运行记录。
`;
        }

        enhancedTask = devMdPrompt + enhancedTask;
      } catch (error) {
        logger.warn(`Failed to get dev.md path for work item ${request.work_item_id}:`, error);
        // 如果获取失败，继续不影响 Session 创建
      }
    }

    // 创建 Session，使用预先生成的 sessionId
    const session: Session = {
      sessionId: sessionId, // 使用预先生成的 sessionId
      name: request.name,
      workingDir: request.workingDir,
      task: enhancedTask,
      status: SessionStatus.PROCESSING,
      continueChat: request.continueChat || false,
      previousSessionId: request.previousSessionId,
      dangerouslySkipPermissions: request.dangerouslySkipPermissions || false,
      workflow_stage_id: request.workflow_stage_id,
      work_item_id: request.work_item_id,
      lastUserMessage: undefined, // 初始时没有用户对话消息
      messageCount: 0, // 初始对话计数为 0
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 保存 Session
    await this.sessionRepository.save(session);

    try {
      // 启动 Claude Code 进程
      const processId = await this.processManager.startClaudeProcess(session);

      // 更新 Session 状态 - 如果有初始任务，保持 PROCESSING 状态
      session.processId = processId;
      // 只有在没有初始任务时才设为 IDLE
      if (!session.task) {
        session.status = SessionStatus.IDLE;
      }
      session.updatedAt = new Date();

      await this.sessionRepository.update(session);

      // 获取该 session 的项目和标签信息（新创建的通常为空，但保持 API 一致性）
      const [projects, tags] = await Promise.all([this.sessionRepository.getSessionProjects(session.sessionId), this.sessionRepository.getSessionTags(session.sessionId)]);

      session.projects = projects;
      session.tags = tags;

      // 如果有 workflow_stage_id，获取完整的 stage 信息
      if (session.workflow_stage_id) {
        const { WorkflowStageService } = await import("./WorkflowStageService");
        const workflowStageService = new WorkflowStageService();
        try {
          const stage = await workflowStageService.getStage(session.workflow_stage_id);
          if (stage) {
            session.workflow_stage = {
              stage_id: stage.stage_id,
              name: stage.name,
              color: stage.color,
              icon: stage.icon,
              system_prompt: stage.system_prompt,
              temperature: stage.temperature,
              suggested_tasks: stage.suggested_tasks,
            };
          }
        } catch (error) {
          logger.warn(`Failed to get workflow stage for new session ${session.sessionId}:`, error);
        }
      }

      // 如果有 work_item_id，自动更新 Work Item 状态
      if (request.work_item_id) {
        try {
          const { WorkItemService } = await import("./WorkItemService");
          const workItemService = new WorkItemService();

          // 检查 Work Item 是否存在
          const workItem = await workItemService.getWorkItem(request.work_item_id);
          if (workItem) {
            // 如果 Work Item 状态还在 planning，更新为 in_progress
            if (workItem.status === "planning") {
              await workItemService.updateWorkItem(request.work_item_id, {
                status: "in_progress" as any,
              });
            }
          }
        } catch (error) {
          logger.warn(`Failed to update work item ${request.work_item_id} for new session:`, error);
          // 不要因为 Work Item 更新失败而阻止 Session 创建
        }
      }

      return session;
    } catch (error) {
      // 如果启动失败，更新状态
      session.status = SessionStatus.ERROR;
      session.error = error instanceof Error ? error.message : "Unknown error";
      session.updatedAt = new Date();

      await this.sessionRepository.update(session);

      throw error;
    }
  }

  async listSessions(): Promise<Session[]> {
    const sessions = await this.sessionRepository.findAll();

    // 如果没有 sessions，直接返回
    if (sessions.length === 0) {
      return sessions;
    }

    // 获取所有 session IDs
    const sessionIds = sessions.map((s) => s.sessionId);

    // 批量获取项目和标签信息
    const [projectsMap, tagsMap] = await Promise.all([this.sessionRepository.getSessionsProjects(sessionIds), this.sessionRepository.getSessionsTags(sessionIds)]);

    // 获取 WorkflowStageService 来加载阶段信息
    const { WorkflowStageService } = await import("./WorkflowStageService");
    const workflowStageService = new WorkflowStageService();

    // 将项目、标签和工作流程阶段信息附加到每个 session
    for (const session of sessions) {
      session.projects = projectsMap.get(session.sessionId) || [];
      session.tags = tagsMap.get(session.sessionId) || [];

      // 获取 workflow stage 信息
      if (session.workflow_stage_id) {
        try {
          const stage = await workflowStageService.getStage(session.workflow_stage_id);
          if (stage) {
            session.workflow_stage = {
              stage_id: stage.stage_id,
              name: stage.name,
              color: stage.color,
              icon: stage.icon,
              system_prompt: stage.system_prompt,
              temperature: stage.temperature,
              suggested_tasks: stage.suggested_tasks,
            };
          }
        } catch (error) {
          logger.warn(`Failed to get workflow stage for session ${session.sessionId}:`, error);
        }
      }
    }

    return sessions;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      return null;
    }

    // 获取该 session 的项目和标签信息
    const [projects, tags] = await Promise.all([this.sessionRepository.getSessionProjects(sessionId), this.sessionRepository.getSessionTags(sessionId)]);

    session.projects = projects;
    session.tags = tags;

    // 获取 workflow stage 信息
    if (session.workflow_stage_id) {
      const { WorkflowStageService } = await import("./WorkflowStageService");
      const workflowStageService = new WorkflowStageService();
      try {
        const stage = await workflowStageService.getStage(session.workflow_stage_id);
        if (stage) {
          session.workflow_stage = {
            stage_id: stage.stage_id,
            name: stage.name,
            color: stage.color,
            icon: stage.icon,
            system_prompt: stage.system_prompt,
            temperature: stage.temperature,
            suggested_tasks: stage.suggested_tasks,
          };
        }
      } catch (error) {
        logger.warn(`Failed to get workflow stage for session ${sessionId}:`, error);
      }
    }

    return session;
  }

  async completeSession(sessionId: string): Promise<Session | null> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return null;
    }

    // 只有 IDLE 或 ERROR 状态的 session 可以被标记为完成
    if (session.status !== SessionStatus.IDLE && session.status !== SessionStatus.ERROR) {
      throw new ValidationError("Session must be idle or in error state to complete", "INVALID_STATUS");
    }

    // 停止进程（如果有的话）
    if (session.processId) {
      await this.processManager.stopProcess(sessionId);
    }

    // Update session
    session.status = SessionStatus.COMPLETED;
    session.completedAt = new Date();
    session.updatedAt = new Date();
    session.error = null; // 清调试误消息

    await this.sessionRepository.update(session);

    // 获取该 session 的项目和标签信息
    const [projects, tags] = await Promise.all([this.sessionRepository.getSessionProjects(sessionId), this.sessionRepository.getSessionTags(sessionId)]);

    session.projects = projects;
    session.tags = tags;

    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    // 不能删除正在处理中的 session
    if (session.status === SessionStatus.PROCESSING) {
      throw new ValidationError("Cannot delete a session that is currently processing", "SESSION_STILL_PROCESSING");
    }

    // 如果有进程在运行，先停止它
    if (session.processId && session.status === SessionStatus.IDLE) {
      try {
        await this.processManager.stopProcess(sessionId);
      } catch (error) {
        logger.warn(`Failed to stop process before deletion:`, error);
      }
    }

    await this.sessionRepository.delete(sessionId);
  }

  async sendMessage(sessionId: string, content: string): Promise<any> {
    logger.info(`=== SessionService.sendMessage START ===`);
    logger.info(`SessionId: ${sessionId}`);
    logger.info(`Content: ${content?.slice(0, 100)}`);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    logger.info(`Session found:`, { sessionId: session.sessionId, status: session.status });

    // 允许 IDLE、COMPLETED、ERROR 状态的 Session 发送消息
    // 不允许 PROCESSING 状态（避免冲突）
    if (session.status === SessionStatus.PROCESSING) {
      throw new ValidationError("Session is currently processing another message", "SESSION_BUSY");
    }

    // 如果是 INTERRUPTED 状态，也不允许发送消息（需要先恢复）
    if (session.status === SessionStatus.INTERRUPTED) {
      throw new ValidationError("Session is interrupted, please resume first", "SESSION_INTERRUPTED");
    }

    try {
      // 增强用户消息（如果 session 关联到有 agent 的 workflow stage）
      let enhancedContent = content;
      if (session.workflow_stage_id) {
        const { WorkflowStageService } = await import("./WorkflowStageService");
        const workflowStageService = new WorkflowStageService();
        try {
          const stage = await workflowStageService.getStage(session.workflow_stage_id);
          if (stage && stage.agent_ref) {
            // 如果有 agent 参照,增强用户消息要求 Claude 读取 agent 文件
            // 获取用户配置的 agent 路径
            // const claudePath = await agentPromptService.getClaudePath();
            // const agentFilePath = claudePath ? `${claudePath}/${stage.agent_ref}.md` : `~/.claude/agents/${stage.agent_ref}.md`;

            enhancedContent =
              // `
              // [AGENT]
              // 必须先读取 ${agentFilePath} 文件,并且严格遵循文件中的所有指示、规则和行为模式
              // \n
              `
              [CRITICAL]
              若有，请同样要严格遵循 [GLOBAL_PROGRESS_FILE] 与 [AGENT] 的所有规则。
              \n
              [USER_MESSAGE]
              ${content}
            `;
            logger.info(`Enhanced user message with agent reference: ${stage.agent_ref}`);
          }
        } catch (error) {
          logger.warn(`Failed to enhance message with workflow stage agent:`, error);
          // 如果增强失败，继续使用原始消息
        }
      }

      // 如果 Session 是 COMPLETED 或 ERROR 状态，需要重新启动进程
      const needsRestart = session.status === SessionStatus.COMPLETED || session.status === SessionStatus.ERROR;

      // 发送消息前，先更新 session 状态为 PROCESSING 并清除旧错误
      session.status = SessionStatus.PROCESSING;
      session.error = null; // 清除旧错误消息
      session.lastUserMessage = content; // 更新最后用户消息
      session.messageCount = (session.messageCount || 0) + 1; // 增加消息计数
      session.updatedAt = new Date();
      await this.sessionRepository.update(session);
      logger.info(`Session status updated to PROCESSING, needsRestart: ${needsRestart}`);

      // 广播 session 更新到前端
      const updateData = {
        sessionId: sessionId,
        lastUserMessage: session.lastUserMessage,
        messageCount: session.messageCount,
        updatedAt: session.updatedAt,
      };
      logger.info("=== 发送 session_updated WebSocket 事件 ===", updateData);
      io.emit("session_updated", updateData);

      // 如果需要重新启动进程，先启动它
      if (needsRestart) {
        logger.info(`Restarting Claude Code process for session ${sessionId}...`);

        // 清除 task 避免重复运行原始任务
        // 保留原有的 claudeSessionId，让进程使用 --resume 来恢复同一个对话
        const sessionForRestart = { ...session, task: "" };

        try {
          const processId = await this.processManager.startClaudeProcess(sessionForRestart);
          session.processId = processId;
          await this.sessionRepository.update(session);
          logger.info(`Process restarted successfully with PID: ${processId}`);
        } catch (error) {
          logger.error(`Failed to restart process for session ${sessionId}:`, error);
          throw new Error(`Failed to restart session: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      // ProcessManager 会自动保存用户消息并发送到进程
      logger.info(`Calling ProcessManager.sendMessage...`);
      await this.processManager.sendMessage(sessionId, enhancedContent);
      logger.info(`ProcessManager.sendMessage completed`);

      // 返回刚保存的用户消息
      logger.info(`Fetching recent messages...`);
      // 获取更多最近消息，因为可能有 assistant 消息在用户消息之后
      const messages = await this.messageRepository.getRecentMessages(sessionId, 10);

      const userMessage = messages.find((msg) => msg.type === "user" && msg.content === enhancedContent);
      logger.info(`Looking for user message with content: "${enhancedContent?.slice(0, 100)}"`);
      logger.info(`Found user message:`, userMessage);

      if (!userMessage) {
        logger.warn(
          `User message not found! Available messages:`,
          messages.map((m) => ({ type: m.type, content: m.content?.slice(0, 50), timestamp: m.timestamp }))
        );
      }

      return userMessage;
    } catch (error) {
      logger.error(`SessionService.sendMessage error:`, error);
      // 如果进程发送失败，更新 session 状态
      session.status = SessionStatus.ERROR;
      session.error = error instanceof Error ? error.message : "Unknown error";
      session.updatedAt = new Date();
      await this.sessionRepository.update(session);

      throw error;
    }
  }

  async getMessages(sessionId: string, page: number = 1, limit: number = 50): Promise<any> {
    logger.info(`=== SessionService.getMessages START ===`);
    logger.info(`SessionId: ${sessionId}, Page: ${page}, Limit: ${limit}`);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    logger.info(`Session found, calling MessageRepository.findBySessionId...`);
    const result = await this.messageRepository.findBySessionId(sessionId, page, limit);

    return result;
  }

  async saveAssistantMessage(sessionId: string, content: string): Promise<any> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    return await this.messageRepository.save({
      sessionId,
      type: "assistant",
      content,
    });
  }

  async getRecentMessages(sessionId: string, count: number = 10): Promise<any[]> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    return await this.messageRepository.getRecentMessages(sessionId, count);
  }

  async exportSessionConversation(sessionId: string, format: "json" | "markdown" | "csv" = "json"): Promise<string> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    return await this.messageRepository.exportSessionConversation(sessionId, format);
  }

  async interruptSession(sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    if (session.status !== SessionStatus.PROCESSING) {
      throw new ValidationError("Session is not processing", "INVALID_STATUS");
    }

    try {
      // 发送中断信号到进程
      await this.processManager.interruptProcess(sessionId);

      // 中断后保持在 IDLE 状态，并清调试误消息
      session.status = SessionStatus.IDLE;
      session.error = null; // 清调试误消息
      session.updatedAt = new Date();

      await this.sessionRepository.update(session);

      // 获取该 session 的项目和标签信息
      const [projects, tags] = await Promise.all([this.sessionRepository.getSessionProjects(sessionId), this.sessionRepository.getSessionTags(sessionId)]);

      session.projects = projects;
      session.tags = tags;

      return session;
    } catch (error) {
      session.status = SessionStatus.ERROR;
      session.error = error instanceof Error ? error.message : "Unknown error";
      session.updatedAt = new Date();
      await this.sessionRepository.update(session);

      throw error;
    }
  }

  async resumeSession(sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    if (session.status !== SessionStatus.INTERRUPTED) {
      throw new ValidationError("Session is not interrupted", "INVALID_STATUS");
    }

    // 检查进程是否仍在运行
    const processInfo = this.processManager.getProcessInfo(sessionId);
    if (!processInfo) {
      throw new ValidationError("Process not found for session", "PROCESS_NOT_FOUND");
    }

    // 恢复会话只需要更新状态，进程会自动处理
    session.status = SessionStatus.IDLE;
    session.updatedAt = new Date();

    await this.sessionRepository.update(session);

    // 获取该 session 的项目和标签信息
    const [projects, tags] = await Promise.all([this.sessionRepository.getSessionProjects(sessionId), this.sessionRepository.getSessionTags(sessionId)]);

    session.projects = projects;
    session.tags = tags;

    return session;
  }

  // 添加方法：获取进程信息
  async getProcessInfo(sessionId: string): Promise<any> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    const processInfo = this.processManager.getProcessInfo(sessionId);
    const metrics = await this.processManager.getProcessMetrics(sessionId);

    return {
      processInfo,
      metrics,
      isActive: !!processInfo,
    };
  }

  // 添加方法：获取所有活跃进程统计
  async getSystemStats(): Promise<any> {
    const allProcessInfo = this.processManager.getAllProcessInfo();
    const activeCount = this.processManager.getActiveProcessCount();

    return {
      totalProcesses: activeCount,
      processes: allProcessInfo,
      systemStatus: activeCount > 0 ? "active" : "idle",
    };
  }

  private validateCreateRequest(request: CreateSessionRequest): void {
    if (!request.name) {
      throw new ValidationError("name is required", "VALIDATION_ERROR");
    }
    if (!request.workingDir) {
      throw new ValidationError("workingDir is required", "VALIDATION_ERROR");
    }
    if (!request.task) {
      throw new ValidationError("task is required", "VALIDATION_ERROR");
    }
  }

  async reorderSessions(status: SessionStatus, sessionIds: string[]): Promise<void> {
    // Update sort order for each session
    for (let i = 0; i < sessionIds.length; i++) {
      await this.sessionRepository.updateSortOrder(sessionIds[i], i);
    }

    logger.info(`Reordered ${sessionIds.length} sessions for status ${status}`);
  }

  // Work Item 相关方法
  async associateWithWorkItem(sessionId: string, workItemId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    // 更新 session 的 work_item_id
    session.work_item_id = workItemId;
    session.updatedAt = new Date();
    await this.sessionRepository.update(session);

    // 同时更新 Work Item 状态
    try {
      const { WorkItemService } = await import("./WorkItemService");
      const workItemService = new WorkItemService();

      const workItem = await workItemService.getWorkItem(workItemId);
      if (workItem && workItem.status === "planning") {
        await workItemService.updateWorkItem(workItemId, {
          status: "in_progress" as any,
        });
      }
    } catch (error) {
      logger.warn(`Failed to update work item ${workItemId}:`, error);
    }

    return session;
  }

  async disassociateFromWorkItem(sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    // 清除 session 的 work_item_id
    session.work_item_id = undefined;
    session.updatedAt = new Date();
    await this.sessionRepository.update(session);

    return session;
  }

  async getSessionsByWorkItem(workItemId: string): Promise<Session[]> {
    const sessions = await this.sessionRepository.findAll();

    // 过滤出属于该 Work Item 的 Sessions
    const workItemSessions = sessions.filter((s) => s.work_item_id === workItemId);

    if (workItemSessions.length === 0) {
      return workItemSessions;
    }

    // 获取所有 session IDs
    const sessionIds = workItemSessions.map((s) => s.sessionId);

    // 批量获取项目和标签信息
    const [projectsMap, tagsMap] = await Promise.all([this.sessionRepository.getSessionsProjects(sessionIds), this.sessionRepository.getSessionsTags(sessionIds)]);

    // 获取 WorkflowStageService 来加载阶段信息
    const { WorkflowStageService } = await import("./WorkflowStageService");
    const workflowStageService = new WorkflowStageService();

    // 将项目、标签和工作流程阶段信息附加到每个 session
    for (const session of workItemSessions) {
      session.projects = projectsMap.get(session.sessionId) || [];
      session.tags = tagsMap.get(session.sessionId) || [];

      // 获取 workflow stage 信息
      if (session.workflow_stage_id) {
        try {
          const stage = await workflowStageService.getStage(session.workflow_stage_id);
          if (stage) {
            session.workflow_stage = {
              stage_id: stage.stage_id,
              name: stage.name,
              color: stage.color,
              icon: stage.icon,
              system_prompt: stage.system_prompt,
              temperature: stage.temperature,
              suggested_tasks: stage.suggested_tasks,
            };
          }
        } catch (error) {
          logger.warn(`Failed to get workflow stage for session ${session.sessionId}:`, error);
        }
      }
    }

    return workItemSessions;
  }
}

// 自订错误类别
export class ValidationError extends Error {
  statusCode: number = 400;
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "ValidationError";
  }
}
