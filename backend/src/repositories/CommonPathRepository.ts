import { Database } from '../database/database';
import { v4 as uuidv4 } from 'uuid';

export interface CommonPath {
  id: string;
  label: string;
  path: string;
  icon: 'FolderOpen' | 'Code' | 'Home';
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export class CommonPathRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async getAll(): Promise<CommonPath[]> {
    const paths = await this.db.all<CommonPath>(`
      SELECT id, label, path, icon, sort_order, created_at, updated_at
      FROM common_paths
      ORDER BY sort_order ASC, created_at ASC
    `);
    return paths;
  }

  async getById(id: string): Promise<CommonPath | undefined> {
    const path = await this.db.get<CommonPath>(`
      SELECT id, label, path, icon, sort_order, created_at, updated_at
      FROM common_paths
      WHERE id = ?
    `, [id]);
    return path;
  }

  async create(data: Omit<CommonPath, 'id' | 'created_at' | 'updated_at'>): Promise<CommonPath> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Get max sort_order
    const maxSortOrder = await this.db.get<{ max_order: number }>(`
      SELECT MAX(sort_order) as max_order FROM common_paths
    `);
    
    const sort_order = data.sort_order ?? ((maxSortOrder?.max_order ?? 0) + 1);
    
    await this.db.run(`
      INSERT INTO common_paths (id, label, path, icon, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, data.label, data.path, data.icon, sort_order, now, now]);
    
    const created = await this.getById(id);
    if (!created) {
      throw new Error('Failed to create common path');
    }
    
    return created;
  }

  async update(id: string, data: Partial<Omit<CommonPath, 'id' | 'created_at'>>): Promise<CommonPath> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Common path not found');
    }
    
    const now = new Date().toISOString();
    const updateFields = [];
    const values = [];
    
    if (data.label !== undefined) {
      updateFields.push('label = ?');
      values.push(data.label);
    }
    
    if (data.path !== undefined) {
      updateFields.push('path = ?');
      values.push(data.path);
    }
    
    if (data.icon !== undefined) {
      updateFields.push('icon = ?');
      values.push(data.icon);
    }
    
    if (data.sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      values.push(data.sort_order);
    }
    
    updateFields.push('updated_at = ?');
    values.push(now);
    
    values.push(id);
    
    await this.db.run(`
      UPDATE common_paths
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, values);
    
    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('Failed to update common path');
    }
    
    return updated;
  }

  async delete(id: string): Promise<void> {
    const result = await this.db.run(`
      DELETE FROM common_paths WHERE id = ?
    `, [id]);
    
    if (result.changes === 0) {
      throw new Error('Common path not found');
    }
  }

  async reorder(paths: { id: string; sort_order: number }[]): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.beginTransaction();
    try {
      for (const path of paths) {
        await this.db.run(`
          UPDATE common_paths
          SET sort_order = ?, updated_at = ?
          WHERE id = ?
        `, [path.sort_order, now, path.id]);
      }
      await this.db.commit();
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }

  async resetToDefault(): Promise<CommonPath[]> {
    await this.db.beginTransaction();
    try {
      // Delete all existing paths
      await this.db.run('DELETE FROM common_paths');
      
      // Insert default paths
      const defaultPaths = [
        { id: '1', icon: 'Code' as const, label: 'Projects', path: 'C:\\Users\\Projects', sort_order: 1 },
        { id: '2', icon: 'Code' as const, label: 'Example', path: 'C:\\Users\\Example', sort_order: 2 },
        { id: '3', icon: 'Home' as const, label: 'Desktop', path: 'C:\\Users\\User\\Desktop', sort_order: 3 },
        { id: '4', icon: 'Home' as const, label: 'Documents', path: 'C:\\Users\\User\\Documents', sort_order: 4 },
        { id: '5', icon: 'FolderOpen' as const, label: '当前目录', path: '.', sort_order: 5 },
      ];
      
      const now = new Date().toISOString();
      
      for (const path of defaultPaths) {
        await this.db.run(`
          INSERT INTO common_paths (id, label, path, icon, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [path.id, path.label, path.path, path.icon, path.sort_order, now, now]);
      }
      
      await this.db.commit();
      
      return await this.getAll();
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }
}