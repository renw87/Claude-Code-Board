import { WorkItemRepository } from '../repositories/WorkItemRepository';
import { SessionRepository } from '../repositories/SessionRepository';
import { 
  WorkItem, 
  WorkItemStatus,
  CreateWorkItemRequest,
  UpdateWorkItemRequest,
  WorkItemWithSessions
} from '../types/workitem.types';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export class WorkItemService {
  private workItemRepository: WorkItemRepository;
  private sessionRepository: SessionRepository;

  constructor() {
    this.workItemRepository = new WorkItemRepository();
    this.sessionRepository = new SessionRepository();
  }

  async createWorkItem(request: CreateWorkItemRequest): Promise<WorkItem> {
    try {
      // Validate request
      if (!request.title) {
        throw new Error('Title is required');
      }

      const workItem = await this.workItemRepository.create({
        title: request.title,
        description: request.description,
        workspace_path: request.workspace_path,
        project_id: request.project_id,
        status: WorkItemStatus.PLANNING
      });

      // Create dev.md file for this work item
      await this.initializeDevMd(workItem);

      logger.info(`Work item created: ${workItem.work_item_id}`);
      return workItem;
    } catch (error) {
      logger.error('Failed to create work item:', error);
      throw error;
    }
  }

  async getWorkItem(workItemId: string): Promise<WorkItemWithSessions | null> {
    try {
      const workItem = await this.workItemRepository.findById(workItemId);
      if (!workItem) {
        return null;
      }

      // Get associated sessions
      const sessions = await this.workItemRepository.getSessionsForWorkItem(workItemId);
      
      // Calculate progress
      const progress = this.calculateProgress(workItem, sessions);

      return {
        ...workItem,
        sessions,
        progress
      };
    } catch (error) {
      logger.error(`Failed to get work item ${workItemId}:`, error);
      throw error;
    }
  }

  async listWorkItems(): Promise<WorkItem[]> {
    try {
      return await this.workItemRepository.findAll();
    } catch (error) {
      logger.error('Failed to list work items:', error);
      throw error;
    }
  }

  async listWorkItemsByStatus(status: WorkItemStatus): Promise<WorkItem[]> {
    try {
      return await this.workItemRepository.findByStatus(status);
    } catch (error) {
      logger.error(`Failed to list work items by status ${status}:`, error);
      throw error;
    }
  }

  async listWorkItemsByProject(projectId: string): Promise<WorkItem[]> {
    try {
      return await this.workItemRepository.findByProject(projectId);
    } catch (error) {
      logger.error(`Failed to list work items by project ${projectId}:`, error);
      throw error;
    }
  }

  async updateWorkItem(workItemId: string, updates: UpdateWorkItemRequest): Promise<WorkItem | null> {
    try {
      const workItem = await this.workItemRepository.findById(workItemId);
      if (!workItem) {
        return null;
      }


      const updatedWorkItem = await this.workItemRepository.update(workItemId, updates);
      
      if (updatedWorkItem) {
        logger.info(`Work item updated: ${workItemId}`);
      }
      
      return updatedWorkItem;
    } catch (error) {
      logger.error(`Failed to update work item ${workItemId}:`, error);
      throw error;
    }
  }

  async deleteWorkItem(workItemId: string): Promise<boolean> {
    try {
      // First, disassociate all sessions from this work item
      const sessions = await this.sessionRepository.findByWorkItem(workItemId);
      for (const session of sessions) {
        await this.sessionRepository.updateWorkItemId(session.sessionId, null);
        logger.info(`Disassociated session ${session.sessionId} from work item ${workItemId}`);
      }
      
      // Now delete the work item
      const result = await this.workItemRepository.delete(workItemId);
      if (result) {
        logger.info(`Work item deleted: ${workItemId}`);
      }
      return result;
    } catch (error) {
      logger.error(`Failed to delete work item ${workItemId}:`, error);
      throw error;
    }
  }


  async associateSession(sessionId: string, workItemId: string): Promise<boolean> {
    try {
      // Update session with work_item_id
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Update session's work_item_id
      session.work_item_id = workItemId;
      await this.sessionRepository.update(session);

      // Auto-update work item status if needed
      const workItem = await this.workItemRepository.findById(workItemId);
      if (workItem && workItem.status === WorkItemStatus.PLANNING) {
        await this.workItemRepository.update(workItemId, {
          status: WorkItemStatus.IN_PROGRESS
        });
      }

      logger.info(`Session ${sessionId} associated with work item ${workItemId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to associate session ${sessionId} with work item ${workItemId}:`, error);
      throw error;
    }
  }

  async disassociateSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Remove work_item_id from session
      session.work_item_id = undefined;
      await this.sessionRepository.update(session);

      logger.info(`Session ${sessionId} disassociated from work item`);
      return true;
    } catch (error) {
      logger.error(`Failed to disassociate session ${sessionId}:`, error);
      throw error;
    }
  }

  async getStats(): Promise<any> {
    try {
      return await this.workItemRepository.getStats();
    } catch (error) {
      logger.error('Failed to get work item stats:', error);
      throw error;
    }
  }

  private getWorkItemDir(workItemId: string): string {
    const dataDir = path.join(process.cwd(), 'data', 'work-items', workItemId);
    return dataDir;
  }

  private async initializeDevMd(workItem: WorkItem): Promise<void> {
    try {
      const workItemDir = this.getWorkItemDir(workItem.work_item_id);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(workItemDir)) {
        fs.mkdirSync(workItemDir, { recursive: true });
      }

      // Create initial dev.md content
      const devMdPath = path.join(workItemDir, 'dev.md');
      const initialContent = `# ${workItem.title}

## 概述
- **创建时间**: ${new Date(workItem.created_at).toLocaleString('zh-CN')}
- **状态**: ${workItem.status}
- **Work Item ID**: ${workItem.work_item_id}
${workItem.description ? `- **描述**: ${workItem.description}` : ''}

---

## 开发日志

<!-- AI 将在此处追加每个 Session 的进度和产出 -->
`;

      fs.writeFileSync(devMdPath, initialContent, 'utf-8');
      logger.info(`Initialized dev.md for work item ${workItem.work_item_id}`);
    } catch (error) {
      logger.error(`Failed to initialize dev.md for work item ${workItem.work_item_id}:`, error);
      // Don't throw error - dev.md is not critical for work item creation
    }
  }

  async getDevMdPath(workItemId: string): Promise<string> {
    const workItemDir = this.getWorkItemDir(workItemId);
    return path.join(workItemDir, 'dev.md');
  }

  async getDevMdContent(workItemId: string): Promise<string | null> {
    try {
      const devMdPath = await this.getDevMdPath(workItemId);
      
      if (!fs.existsSync(devMdPath)) {
        // Try to recreate dev.md if work item exists
        const workItem = await this.workItemRepository.findById(workItemId);
        if (workItem) {
          await this.initializeDevMd(workItem);
        } else {
          return null;
        }
      }

      return fs.readFileSync(devMdPath, 'utf-8');
    } catch (error) {
      logger.error(`Failed to read dev.md for work item ${workItemId}:`, error);
      return null;
    }
  }

  private calculateProgress(workItem: WorkItem, sessions: any[]): { completed: number; total: number } {
    // Use session count for progress
    const completedSessions = sessions.filter(s => 
      s.status === 'completed' || s.status === 'idle'
    ).length;
    return {
      completed: completedSessions,
      total: sessions.length || 1
    };
  }
}