import { Database } from '../database/database';
import { v4 as uuidv4 } from 'uuid';
import { TaskTemplate, CreateTaskTemplateRequest, UpdateTaskTemplateRequest } from '../types/taskTemplate.types';

export class TaskTemplateRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async getAll(): Promise<TaskTemplate[]> {
    const templates = await this.db.all<TaskTemplate>(`
      SELECT * FROM task_templates WHERE is_active = 1 ORDER BY sort_order ASC
    `);
    return templates;
  }

  async getById(id: string): Promise<TaskTemplate | null> {
    const template = await this.db.get<TaskTemplate>(`
      SELECT * FROM task_templates WHERE id = ?
    `, [id]);
    return template || null;
  }

  async create(data: CreateTaskTemplateRequest): Promise<TaskTemplate> {
    const { label, template, sort_order = 999, is_active = true } = data;
    const id = uuidv4();
    const now = new Date().toISOString();

    await this.db.run(`
      INSERT INTO task_templates (id, label, template, sort_order, is_active, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `, [id, label, template, sort_order, is_active ? 1 : 0, now, now]);

    const created = await this.getById(id);
    if (!created) {
      throw new Error('Failed to create task template');
    }
    return created;
  }

  async update(id: string, data: UpdateTaskTemplateRequest): Promise<TaskTemplate> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.label !== undefined) {
      fields.push('label = ?');
      values.push(data.label);
    }
    if (data.template !== undefined) {
      fields.push('template = ?');
      values.push(data.template);
    }
    if (data.sort_order !== undefined) {
      fields.push('sort_order = ?');
      values.push(data.sort_order);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }

    if (fields.length === 0) {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Task template not found');
      }
      return existing;
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const query = `
      UPDATE task_templates
      SET ${fields.join(', ')}
      WHERE id = ?
    `;

    await this.db.run(query, values);

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('Task template not found');
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.run(
      'DELETE FROM task_templates WHERE id = ? AND is_default = 0',
      [id]
    );
  }

  async reorder(orders: { id: string; sort_order: number }[]): Promise<void> {
    const now = new Date().toISOString();

    for (const order of orders) {
      await this.db.run(
        'UPDATE task_templates SET sort_order = ?, updated_at = ? WHERE id = ?',
        [order.sort_order, now, order.id]
      );
    }
  }

  async resetToDefault(): Promise<TaskTemplate[]> {
    // 删除所有非默认模板
    await this.db.run('DELETE FROM task_templates WHERE is_default = 0');

    // 重置默认模板为激活状态
    await this.db.run('UPDATE task_templates SET is_active = 1 WHERE is_default = 1');

    const templates = await this.db.all<TaskTemplate>(
      'SELECT * FROM task_templates ORDER BY sort_order ASC'
    );

    return templates;
  }
}