import { Database } from '../database/database';
import { v4 as uuidv4 } from 'uuid';

export interface WorkflowStage {
  stage_id: string;
  name: string;
  description?: string;
  system_prompt: string;
  agent_ref?: string; // 参照的 Agent 文件名
  temperature?: number; // 添加 temperature 属性
  suggested_tasks?: string[];
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateWorkflowStageRequest {
  name: string;
  description?: string;
  system_prompt: string;
  agent_ref?: string;
  suggested_tasks?: string[];
  color?: string;
  icon?: string;
  sort_order?: number;
}

export interface UpdateWorkflowStageRequest {
  name?: string;
  description?: string;
  system_prompt?: string;
  agent_ref?: string;
  suggested_tasks?: string[];
  color?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

export class WorkflowStageRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async findAll(activeOnly: boolean = false): Promise<WorkflowStage[]> {
    const query = activeOnly 
      ? `SELECT * FROM workflow_stages WHERE is_active = 1 ORDER BY sort_order ASC, name ASC`
      : `SELECT * FROM workflow_stages ORDER BY sort_order ASC, name ASC`;
    
    const stages = await this.db.all<WorkflowStage>(query);
    
    // Parse JSON fields
    return stages.map((stage: any) => ({
      ...stage,
      suggested_tasks: stage.suggested_tasks ? JSON.parse(stage.suggested_tasks) : []
    }));
  }

  async findById(stageId: string): Promise<WorkflowStage | null> {
    const stage = await this.db.get<WorkflowStage>(
      `SELECT * FROM workflow_stages WHERE stage_id = ?`,
      [stageId]
    );
    
    if (!stage) return null;
    
    // Parse JSON fields
    return {
      ...stage,
      suggested_tasks: stage.suggested_tasks ? JSON.parse(stage.suggested_tasks as any) : []
    };
  }

  async findByName(name: string): Promise<WorkflowStage | null> {
    const stage = await this.db.get<WorkflowStage>(
      `SELECT * FROM workflow_stages WHERE name = ?`,
      [name]
    );
    
    if (!stage) return null;
    
    // Parse JSON fields
    return {
      ...stage,
      suggested_tasks: stage.suggested_tasks ? JSON.parse(stage.suggested_tasks as any) : []
    };
  }

  async create(request: CreateWorkflowStageRequest): Promise<WorkflowStage> {
    const stageId = uuidv4();
    const now = new Date();
    
    // Get max sort_order if not provided
    let sortOrder = request.sort_order;
    if (sortOrder === undefined) {
      const result = await this.db.get<{ max_order: number }>(
        `SELECT MAX(sort_order) as max_order FROM workflow_stages`
      );
      sortOrder = (result?.max_order || 0) + 1;
    }
    
    const stage: WorkflowStage = {
      stage_id: stageId,
      name: request.name,
      description: request.description || undefined,
      system_prompt: request.system_prompt,
      agent_ref: request.agent_ref || undefined,
      suggested_tasks: request.suggested_tasks || [],
      color: request.color || '#4F46E5',
      icon: request.icon || 'folder',
      sort_order: sortOrder,
      is_active: true,
      created_at: now,
      updated_at: now
    };
    
    await this.db.run(
      `INSERT INTO workflow_stages (
        stage_id, name, description, system_prompt, agent_ref,
        suggested_tasks, color, icon, sort_order, is_active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stage.stage_id,
        stage.name,
        stage.description,
        stage.system_prompt,
        stage.agent_ref,
        JSON.stringify(stage.suggested_tasks),
        stage.color,
        stage.icon,
        stage.sort_order,
        stage.is_active ? 1 : 0,
        stage.created_at,
        stage.updated_at
      ]
    );
    
    return stage;
  }

  async update(stageId: string, request: UpdateWorkflowStageRequest): Promise<WorkflowStage | null> {
    const existingStage = await this.findById(stageId);
    if (!existingStage) {
      return null;
    }
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (request.name !== undefined) {
      updates.push('name = ?');
      values.push(request.name);
    }
    
    if (request.description !== undefined) {
      updates.push('description = ?');
      values.push(request.description);
    }
    
    if (request.system_prompt !== undefined) {
      updates.push('system_prompt = ?');
      values.push(request.system_prompt);
    }
    
    if (request.agent_ref !== undefined) {
      updates.push('agent_ref = ?');
      values.push(request.agent_ref);
    }
    
    if (request.suggested_tasks !== undefined) {
      updates.push('suggested_tasks = ?');
      values.push(JSON.stringify(request.suggested_tasks));
    }
    
    if (request.color !== undefined) {
      updates.push('color = ?');
      values.push(request.color);
    }
    
    if (request.icon !== undefined) {
      updates.push('icon = ?');
      values.push(request.icon);
    }
    
    if (request.sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(request.sort_order);
    }
    
    if (request.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(request.is_active ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return existingStage;
    }
    
    updates.push('updated_at = ?');
    values.push(new Date());
    
    values.push(stageId);
    
    await this.db.run(
      `UPDATE workflow_stages SET ${updates.join(', ')} WHERE stage_id = ?`,
      values
    );
    
    return await this.findById(stageId);
  }

  async delete(stageId: string): Promise<boolean> {
    const result = await this.db.run(
      `DELETE FROM workflow_stages WHERE stage_id = ?`,
      [stageId]
    );
    
    return result.changes > 0;
  }

  async reorder(stageOrders: { stage_id: string; sort_order: number }[]): Promise<void> {
    const db = this.db;
    
    await db.beginTransaction();
    
    try {
      for (const { stage_id, sort_order } of stageOrders) {
        await db.run(
          `UPDATE workflow_stages SET sort_order = ?, updated_at = ? WHERE stage_id = ?`,
          [sort_order, new Date(), stage_id]
        );
      }
      
      await db.commit();
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }
}