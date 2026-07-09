import { Database } from '../database/database';
import { v4 as uuidv4 } from 'uuid';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface Message {
  messageId: string;
  sessionId: string;
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'thinking' | 'output' | 'error';
  content: string;
  compressed?: boolean;
  originalSize?: number;
  compressedSize?: number;
  timestamp: Date;
  metadata?: any;
}

interface MessageRow {
  message_id: string;
  session_id: string;
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'thinking' | 'output' | 'error';
  content: string;
  compressed: number;
  original_size?: number;
  compressed_size?: number;
  timestamp: string;
  metadata?: string;
}

export class MessageRepository {
  private db: Database;
  private compressionThreshold: number = 1024; // 1KB
  
  constructor() {
    this.db = Database.getInstance();
  }
  
  private mapRowToMessage(row: MessageRow): Message {
    return {
      messageId: row.message_id,
      sessionId: row.session_id,
      type: row.type,
      content: row.content,
      compressed: Boolean(row.compressed),
      originalSize: row.original_size,
      compressedSize: row.compressed_size,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }
  
  async save(message: Omit<Message, 'messageId' | 'timestamp'>): Promise<Message> {
    const messageId = uuidv4();
    const timestamp = new Date();
    const originalSize = Buffer.byteLength(message.content, 'utf8');
    
    let content = message.content;
    let compressed = false;
    let compressedSize = originalSize;
    
    // Compress if content is large
    if (originalSize > this.compressionThreshold) {
      try {
        const compressedBuffer = await gzip(message.content);
        content = compressedBuffer.toString('base64');
        compressed = true;
        compressedSize = compressedBuffer.length;
      } catch (error) {
        console.warn('Failed to compress message content:', error);
        // Continue without compression
      }
    }
    
    const sql = `
      INSERT INTO messages (
        message_id, session_id, role, type, content, compressed,
        original_size, compressed_size, timestamp, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // legacy role 列仍为 NOT NULL + CHECK('user','assistant')（role→type 迁移因启动顺序
    // 未真正重建表），这里按 type 派生一个合法 role 值以满足约束；应用读取一律走 type。
    const legacyRole = message.type === 'user' ? 'user' : 'assistant';

    const params = [
      messageId,
      message.sessionId,
      legacyRole,
      message.type,
      content,
      compressed ? 1 : 0,
      originalSize,
      compressedSize,
      timestamp.toISOString(),
      message.metadata ? JSON.stringify(message.metadata) : null
    ];
    
    await this.db.run(sql, params);
    
    return {
      messageId,
      sessionId: message.sessionId,
      type: message.type,
      content: message.content, // Return original uncompressed content
      compressed,
      originalSize,
      compressedSize,
      timestamp,
      metadata: message.metadata
    };
  }
  
  async findById(messageId: string): Promise<Message | null> {
    const sql = `SELECT * FROM messages WHERE message_id = ?`;
    const row = await this.db.get<MessageRow>(sql, [messageId]);
    
    if (!row) return null;
    
    let content = row.content;
    
    // Decompress if needed
    if (row.compressed) {
      try {
        const compressedBuffer = Buffer.from(row.content, 'base64');
        const decompressedBuffer = await gunzip(compressedBuffer);
        content = decompressedBuffer.toString('utf8');
      } catch (error) {
        console.error('Failed to decompress message content:', error);
        throw new Error('Failed to retrieve message content');
      }
    }
    
    return {
      ...this.mapRowToMessage(row),
      content
    };
  }
  
  async findBySessionId(
    sessionId: string, 
    page: number = 1, 
    limit: number = 50
  ): Promise<{
    messages: Message[];
    pagination: {
      total: number;
      page: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM messages WHERE session_id = ?`;
    const countResult = await this.db.get<{total: number}>(countSql, [sessionId]);
    const total = countResult?.total || 0;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    
    // Get paginated messages
    const sql = `
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC 
      LIMIT ? OFFSET ?
    `;
    
    const rows = await this.db.all<MessageRow>(sql, [sessionId, limit, offset]);
    
    // Decompress messages if needed
    const messages = await Promise.all(
      rows.map(async (row) => {
        let content = row.content;
        
        if (row.compressed) {
          try {
            const compressedBuffer = Buffer.from(row.content, 'base64');
            const decompressedBuffer = await gunzip(compressedBuffer);
            content = decompressedBuffer.toString('utf8');
          } catch (error) {
            console.error('Failed to decompress message:', error);
            content = '[Failed to decompress content]';
          }
        }
        
        return {
          ...this.mapRowToMessage(row),
          content
        };
      })
    );
    
    return {
      messages,
      pagination: {
        total,
        page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }
  
  async getRecentMessages(sessionId: string, count: number = 10): Promise<Message[]> {
    const sql = `
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
    
    const rows = await this.db.all<MessageRow>(sql, [sessionId, count]);
    
    // Decompress messages if needed
    const messages = await Promise.all(
      rows.map(async (row) => {
        let content = row.content;
        
        if (row.compressed) {
          try {
            const compressedBuffer = Buffer.from(row.content, 'base64');
            const decompressedBuffer = await gunzip(compressedBuffer);
            content = decompressedBuffer.toString('utf8');
          } catch (error) {
            console.error('Failed to decompress message:', error);
            content = '[Failed to decompress content]';
          }
        }
        
        return {
          ...this.mapRowToMessage(row),
          content
        };
      })
    );
    
    return messages.reverse(); // Return in chronological order
  }
  
  async deleteBySessionId(sessionId: string): Promise<number> {
    const result = await this.db.run(
      `DELETE FROM messages WHERE session_id = ?`,
      [sessionId]
    );
    
    return result.changes || 0;
  }
  
  async getStorageStats(): Promise<{
    totalMessages: number;
    compressedMessages: number;
    totalSize: number;
    compressedSize: number;
    compressionRatio: number;
  }> {
    const stats = await this.db.get<any>(`
      SELECT 
        COUNT(*) as totalMessages,
        SUM(CASE WHEN compressed = 1 THEN 1 ELSE 0 END) as compressedMessages,
        SUM(original_size) as totalSize,
        SUM(compressed_size) as compressedSize
      FROM messages
    `);
    
    const totalSize = stats.totalSize || 0;
    const compressedSize = stats.compressedSize || 0;
    const compressionRatio = totalSize > 0 ? ((totalSize - compressedSize) / totalSize) * 100 : 0;
    
    return {
      totalMessages: stats.totalMessages || 0,
      compressedMessages: stats.compressedMessages || 0,
      totalSize,
      compressedSize,
      compressionRatio: Math.round(compressionRatio * 100) / 100
    };
  }
  
  // Cleanup old messages
  async cleanupOldMessages(sessionId: string, keepCount: number = 1000): Promise<number> {
    const sql = `
      DELETE FROM messages 
      WHERE session_id = ? 
      AND message_id NOT IN (
        SELECT message_id FROM messages 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      )
    `;
    
    const result = await this.db.run(sql, [sessionId, sessionId, keepCount]);
    return result.changes || 0;
  }
  
  // Export session conversation
  async exportSessionConversation(sessionId: string, format: 'json' | 'markdown' | 'csv' = 'json'): Promise<string> {
    const sql = `
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `;
    
    const rows = await this.db.all<MessageRow>(sql, [sessionId]);
    
    // Decompress messages
    const messages = await Promise.all(
      rows.map(async (row) => {
        let content = row.content;
        
        if (row.compressed) {
          try {
            const compressedBuffer = Buffer.from(row.content, 'base64');
            const decompressedBuffer = await gunzip(compressedBuffer);
            content = decompressedBuffer.toString('utf8');
          } catch (error) {
            console.error('Failed to decompress message:', error);
            content = '[Failed to decompress content]';
          }
        }
        
        return {
          ...this.mapRowToMessage(row),
          content
        };
      })
    );
    
    switch (format) {
      case 'json':
        return JSON.stringify({
          sessionId,
          exportedAt: new Date().toISOString(),
          messageCount: messages.length,
          messages
        }, null, 2);
        
      case 'markdown':
        let markdown = `# Session Conversation\n\n`;
        markdown += `**Session ID:** ${sessionId}\n`;
        markdown += `**Exported:** ${new Date().toISOString()}\n`;
        markdown += `**Messages:** ${messages.length}\n\n---\n\n`;
        
        messages.forEach((message, index) => {
          const role = message.type === 'user' ? '👤 User' : '🤖 Assistant';
          markdown += `## ${index + 1}. ${role}\n`;
          markdown += `**Time:** ${message.timestamp.toISOString()}\n\n`;
          markdown += `${message.content}\n\n---\n\n`;
        });
        
        return markdown;
        
      case 'csv':
        let csv = 'Index,Role,Timestamp,Content\n';
        messages.forEach((message, index) => {
          const content = message.content.replace(/"/g, '""');
          csv += `${index + 1},"${message.type}","${message.timestamp.toISOString()}","${content}"\n`;
        });
        
        return csv;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}