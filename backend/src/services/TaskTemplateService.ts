import { TaskTemplateRepository } from '../repositories/TaskTemplateRepository';
import { TaskTemplate, CreateTaskTemplateRequest, UpdateTaskTemplateRequest } from '../types/taskTemplate.types';

export class TaskTemplateService {
  private repository: TaskTemplateRepository;

  constructor() {
    this.repository = new TaskTemplateRepository();
  }

  async getAllTemplates(): Promise<TaskTemplate[]> {
    return await this.repository.getAll();
  }

  async getTemplate(id: string): Promise<TaskTemplate> {
    const template = await this.repository.getById(id);
    if (!template) {
      throw new Error('Task template not found');
    }
    return template;
  }

  async createTemplate(data: CreateTaskTemplateRequest): Promise<TaskTemplate> {
    // 验证必填字段
    if (!data.label || !data.template) {
      throw new Error('Label and template are required');
    }

    // 验证标签长度
    if (data.label.length > 100) {
      throw new Error('Label must be 100 characters or less');
    }

    return await this.repository.create(data);
  }

  async updateTemplate(id: string, data: UpdateTaskTemplateRequest): Promise<TaskTemplate> {
    // 验证标签长度
    if (data.label && data.label.length > 100) {
      throw new Error('Label must be 100 characters or less');
    }

    return await this.repository.update(id, data);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async reorderTemplates(orders: { id: string; sort_order: number }[]): Promise<void> {
    // 验证输入
    if (!Array.isArray(orders)) {
      throw new Error('Invalid input: orders must be an array');
    }

    for (const order of orders) {
      if (!order.id || typeof order.sort_order !== 'number') {
        throw new Error('Invalid order data');
      }
    }

    await this.repository.reorder(orders);
  }

  async resetToDefault(): Promise<TaskTemplate[]> {
    return await this.repository.resetToDefault();
  }
}