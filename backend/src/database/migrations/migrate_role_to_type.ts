import { Database } from '../database';
import { logger } from '../../utils/logger';

/**
 * 迁移数据库 messages 表的 role 字段为 type 字段
 * 统一 WebSocket 即时消息与 API 加载消息的格式
 */
export class MigrateRoleToTypeMigration {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async up(): Promise<void> {
    logger.info('=== 开始运行 role → type 迁移 ===');

    try {
      // 1. 检查 type 字段是否已存在
      const hasTypeColumn = await this.checkColumnExists('messages', 'type');
      
      if (hasTypeColumn) {
        logger.info('type 字段已存在，跳过迁移');
        return;
      }

      // 2. 添加 type 字段
      await this.addTypeColumn();

      // 3. 迁移现有数据
      await this.migrateData();

      // 4. 更新约束条件
      await this.updateConstraints();

      // 5. 验证迁移结果
      await this.validateMigration();

      logger.info('=== role → type 迁移完成 ===');
    } catch (error) {
      logger.error('迁移失败:', error);
      throw error;
    }
  }

  async down(): Promise<void> {
    logger.info('=== 开始运行 type → role 回滚 ===');

    try {
      // 回滚：移除 type 字段，保留 role 字段
      const hasTypeColumn = await this.checkColumnExists('messages', 'type');
      
      if (hasTypeColumn) {
        // SQLite 不支持 DROP COLUMN，需要重建表
        await this.rebuildTableWithoutType();
        logger.info('=== type → role 回滚完成 ===');
      } else {
        logger.info('type 字段不存在，无需回滚');
      }
    } catch (error) {
      logger.error('回滚失败:', error);
      throw error;
    }
  }

  private async checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      const tableInfo = await this.db.all(`PRAGMA table_info(${tableName})`);
      return tableInfo.some((column: any) => column.name === columnName);
    } catch (error) {
      logger.error(`检查字段 ${columnName} 失败:`, error);
      return false;
    }
  }

  private async addTypeColumn(): Promise<void> {
    logger.info('添加 type 字段...');
    
    await this.db.run(`
      ALTER TABLE messages 
      ADD COLUMN type TEXT
    `);
    
    logger.info('type 字段添加成功');
  }

  private async migrateData(): Promise<void> {
    logger.info('开始迁移 role → type 数据...');
    
    // 将所有 role 的值拷贝到 type 字段
    const result = await this.db.run(`
      UPDATE messages 
      SET type = role 
      WHERE type IS NULL
    `);
    
    logger.info(`成功迁移 ${result.changes} 笔消息数据`);
  }

  private async updateConstraints(): Promise<void> {
    logger.info('更新约束条件...');
    
    // SQLite 不支持修改约束条件，需要重建表
    await this.rebuildTableWithTypeConstraint();
    
    logger.info('约束条件更新完成');
  }

  private async rebuildTableWithTypeConstraint(): Promise<void> {
    await this.db.beginTransaction();
    
    try {
      // 1. 创建新表结构
      await this.db.run(`
        CREATE TABLE messages_new (
          message_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('user', 'assistant', 'system', 'tool_use', 'thinking', 'output', 'error')),
          content TEXT NOT NULL,
          compressed BOOLEAN DEFAULT FALSE,
          original_size INTEGER,
          compressed_size INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          metadata TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        )
      `);

      // 2. 拷贝数据到新表
      await this.db.run(`
        INSERT INTO messages_new (
          message_id, session_id, type, content, compressed, 
          original_size, compressed_size, timestamp, metadata
        )
        SELECT 
          message_id, session_id, type, content, compressed,
          original_size, compressed_size, timestamp, metadata
        FROM messages
      `);

      // 3. 删除旧表
      await this.db.run(`DROP TABLE messages`);

      // 4. 重命名新表
      await this.db.run(`ALTER TABLE messages_new RENAME TO messages`);

      // 5. 重建索引
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)
      `);
      
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
      `);
      
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)
      `);

      await this.db.commit();
      logger.info('表结构重建完成');
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }

  private async rebuildTableWithoutType(): Promise<void> {
    await this.db.beginTransaction();
    
    try {
      // 1. 创建旧表结构（只有 role）
      await this.db.run(`
        CREATE TABLE messages_old (
          message_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          compressed BOOLEAN DEFAULT FALSE,
          original_size INTEGER,
          compressed_size INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        )
      `);

      // 2. 拷贝数据，将 type 拷贝回 role
      await this.db.run(`
        INSERT INTO messages_old (
          message_id, session_id, role, content, compressed, 
          original_size, compressed_size, timestamp
        )
        SELECT 
          message_id, session_id, 
          CASE 
            WHEN type IN ('user', 'assistant', 'system') THEN type
            ELSE 'assistant'  -- 将添加的类型映射回 assistant
          END as role,
          content, compressed,
          original_size, compressed_size, timestamp
        FROM messages
      `);

      // 3. 删除新表
      await this.db.run(`DROP TABLE messages`);

      // 4. 重命名回原表名
      await this.db.run(`ALTER TABLE messages_old RENAME TO messages`);

      // 5. 重建索引
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)
      `);
      
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
      `);

      await this.db.commit();
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }

  private async validateMigration(): Promise<void> {
    logger.info('验证迁移结果...');
    
    // 检查数据一致性
    const roleTypeMatch = await this.db.get(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE role = type
    `);
    
    const totalMessages = await this.db.get(`
      SELECT COUNT(*) as count 
      FROM messages
    `);
    
    if (roleTypeMatch?.count !== totalMessages?.count) {
      throw new Error(`迁移验证失败: role 与 type 数据不一致`);
    }
    
    // 检查约束条件
    const invalidTypes = await this.db.get(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE type NOT IN ('user', 'assistant', 'system', 'tool_use', 'thinking', 'output', 'error')
    `);
    
    if (invalidTypes?.count > 0) {
      logger.warn(`发现 ${invalidTypes.count} 笔无效的 type 值`);
    }
    
    logger.info(`迁移验证成功: ${totalMessages?.count} 笔消息数据一致`);
  }

  async getStatus(): Promise<{
    hasTypeColumn: boolean;
    hasRoleColumn: boolean;
    totalMessages: number;
    consistentData: number;
  }> {
    const hasTypeColumn = await this.checkColumnExists('messages', 'type');
    const hasRoleColumn = await this.checkColumnExists('messages', 'role');
    
    const totalMessages = await this.db.get(`SELECT COUNT(*) as count FROM messages`);
    
    let consistentData = 0;
    if (hasTypeColumn && hasRoleColumn) {
      const consistent = await this.db.get(`
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE role = type
      `);
      consistentData = consistent?.count || 0;
    }
    
    return {
      hasTypeColumn,
      hasRoleColumn,
      totalMessages: totalMessages?.count || 0,
      consistentData
    };
  }
}