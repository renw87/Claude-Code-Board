import { 
  WorkflowStageRepository, 
  WorkflowStage, 
  CreateWorkflowStageRequest, 
  UpdateWorkflowStageRequest 
} from '../repositories/WorkflowStageRepository';
import { ValidationError } from './SessionService';
import { agentPromptService } from './AgentPromptService';

export class WorkflowStageService {
  private repository: WorkflowStageRepository;

  constructor() {
    this.repository = new WorkflowStageRepository();
  }

  async getAllStages(activeOnly: boolean = false): Promise<WorkflowStage[]> {
    return await this.repository.findAll(activeOnly);
  }

  async getStage(stageId: string): Promise<WorkflowStage> {
    const stage = await this.repository.findById(stageId);
    if (!stage) {
      throw new ValidationError('Workflow stage not found', 'STAGE_NOT_FOUND');
    }
    return stage;
  }

  async getStageByName(name: string): Promise<WorkflowStage> {
    const stage = await this.repository.findByName(name);
    if (!stage) {
      throw new ValidationError('Workflow stage not found', 'STAGE_NOT_FOUND');
    }
    return stage;
  }

  async createStage(request: CreateWorkflowStageRequest): Promise<WorkflowStage> {
    // Validate required fields - either system_prompt or agent_ref must be provided
    if (!request.name || (!request.system_prompt && !request.agent_ref)) {
      throw new ValidationError('Name and either system prompt or agent reference are required', 'INVALID_REQUEST');
    }

    // Validate Agent reference if provided
    if (request.agent_ref) {
      const agentContent = await agentPromptService.getAgentContent(request.agent_ref);
      if (!agentContent) {
        throw new ValidationError(`Agent "${request.agent_ref}" 文件不存在或无法读取`, 'AGENT_NOT_FOUND');
      }
    }

    // Check if name already exists
    const existing = await this.repository.findByName(request.name);
    if (existing) {
      throw new ValidationError('Stage name already exists', 'DUPLICATE_NAME');
    }


    return await this.repository.create(request);
  }

  async updateStage(stageId: string, request: UpdateWorkflowStageRequest): Promise<WorkflowStage> {
    // Check if stage exists
    const existing = await this.repository.findById(stageId);
    if (!existing) {
      throw new ValidationError('Workflow stage not found', 'STAGE_NOT_FOUND');
    }

    // Validate Agent reference if provided
    if (request.agent_ref) {
      const agentContent = await agentPromptService.getAgentContent(request.agent_ref);
      if (!agentContent) {
        throw new ValidationError(`Agent "${request.agent_ref}" 文件不存在或无法读取`, 'AGENT_NOT_FOUND');
      }
    }

    // If updating name, check for duplicates
    if (request.name && request.name !== existing.name) {
      const duplicate = await this.repository.findByName(request.name);
      if (duplicate) {
        throw new ValidationError('Stage name already exists', 'DUPLICATE_NAME');
      }
    }


    const updated = await this.repository.update(stageId, request);
    if (!updated) {
      throw new ValidationError('Failed to update stage', 'UPDATE_FAILED');
    }

    return updated;
  }

  async deleteStage(stageId: string): Promise<void> {
    // 检查 stage 是否存在
    const stage = await this.repository.findById(stageId);
    if (!stage) {
      throw new ValidationError('Workflow stage not found', 'STAGE_NOT_FOUND');
    }

    // 在删除之前，先将所有使用此 stage 的 sessions 的 workflow_stage_id 设为 NULL
    const { Database } = await import('../database/database');
    const db = Database.getInstance();
    
    try {
      // 更新所有相关的 sessions
      await db.run(
        `UPDATE sessions SET workflow_stage_id = NULL WHERE workflow_stage_id = ?`,
        [stageId]
      );
      
      // 现在可以安全地删除 workflow stage
      const deleted = await this.repository.delete(stageId);
      if (!deleted) {
        throw new ValidationError('Failed to delete workflow stage', 'DELETE_FAILED');
      }
    } catch (error: any) {
      throw new ValidationError(
        `删除工作流程阶段时发生错误: ${error.message}`,
        'DELETE_ERROR'
      );
    }
  }

  async reorderStages(stageOrders: { stage_id: string; sort_order: number }[]): Promise<void> {
    // Validate all stage IDs exist
    for (const { stage_id } of stageOrders) {
      const stage = await this.repository.findById(stage_id);
      if (!stage) {
        throw new ValidationError(`Stage ${stage_id} not found`, 'STAGE_NOT_FOUND');
      }
    }

    await this.repository.reorder(stageOrders);
  }

  /**
   * 取得工作阶段的有效提示词
   * 如果设置了 agent_ref，优先使用 Agent 提示词；否则使用自订提示词
   */
  async getEffectivePrompt(stageId: string): Promise<{
    content: string;
    source: 'agent' | 'custom';
    agentName?: string;
  }> {
    const stage = await this.getStage(stageId);
    
    if (stage.agent_ref) {
      try {
        // 使用新的方法只取得提示词内容（不包含 frontmatter）
        const promptContent = await agentPromptService.getAgentPromptOnly(stage.agent_ref);
        if (promptContent) {
          return {
            content: promptContent,
            source: 'agent',
            agentName: stage.agent_ref
          };
        }
      } catch (error) {
        // Agent 读取失败，抛出错误（阻断式处理）
        throw new ValidationError(`Agent "${stage.agent_ref}" 文件不存在或无法读取`, 'AGENT_NOT_FOUND');
      }
    }
    
    // 使用自订提示词
    return {
      content: stage.system_prompt || '',
      source: 'custom'
    };
  }

  /**
   * 检查 Agent 是否存在（用于前端验证）
   */
  async checkAgentExists(agentName: string): Promise<boolean> {
    try {
      const agentContent = await agentPromptService.getAgentContent(agentName);
      return !!agentContent;
    } catch (error) {
      return false;
    }
  }

}