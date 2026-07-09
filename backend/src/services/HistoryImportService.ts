import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { SessionRepository } from '../repositories/SessionRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { Session, SessionStatus } from '../types/session.types';
import { logger } from '../utils/logger';

export interface HistoryImportSummary {
  imported: number;          // 新导入的会话数
  backfilled: number;        // 已有会话补导消息的会话数
  skipped: number;           // 已有会话且已有消息，跳过
  messagesImported: number;  // 本次写入的消息总条数
  errors: Array<{ file: string; error: string }>;
  projectsDir: string;
}

interface ParsedMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'thinking' | 'output' | 'error';
  content: string;
  metadata?: any;
  timestamp: Date;
}

interface ParsedTranscript {
  claudeSessionId: string;
  workingDir: string | null;
  firstUserText: string | null;
  lastUserText: string | null;
  messageCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  messages: ParsedMessage[];
}

type MessageType = ParsedMessage['type'];

/**
 * 只读扫描 ~/.claude/projects/ 下的 Claude Code 历史会话 transcript，
 * 把元数据 + 消息体导入 Board 自己的库，使历史会话在 UI 列表与详情页可完整浏览。
 *
 * 严格只读：只 readdir / createReadStream，绝不写入或修改任何 jsonl 原文件。
 * 去重：按 claude_session_id（jsonl 文件名）查会话；已存在且已有消息则跳过，
 *       已存在但 0 消息则回填消息（Phase A 只导元数据的会话会被补齐）。
 */
export class HistoryImportService {
  private sessionRepository: SessionRepository;
  private messageRepository: MessageRepository;

  constructor() {
    this.sessionRepository = new SessionRepository();
    this.messageRepository = new MessageRepository();
  }

  async importHistory(): Promise<HistoryImportSummary> {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    const summary: HistoryImportSummary = {
      imported: 0, backfilled: 0, skipped: 0, messagesImported: 0, errors: [], projectsDir,
    };

    if (!fs.existsSync(projectsDir) || !fs.statSync(projectsDir).isDirectory()) {
      logger.warn(`History import: projects dir not found: ${projectsDir}`);
      return summary;
    }

    let projectDirs: string[] = [];
    try {
      projectDirs = fs.readdirSync(projectsDir).filter(name => {
        const p = path.join(projectsDir, name);
        return fs.statSync(p).isDirectory();
      });
    } catch (e) {
      summary.errors.push({ file: projectsDir, error: `readdir failed: ${(e as Error).message}` });
      return summary;
    }

    for (const dir of projectDirs) {
      const dirPath = path.join(projectsDir, dir);
      let files: string[];
      try {
        files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
      } catch (e) {
        summary.errors.push({ file: dirPath, error: `readdir failed: ${(e as Error).message}` });
        continue;
      }

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          const parsed = await this.parseTranscript(filePath);
          if (!parsed.createdAt || !parsed.updatedAt) {
            summary.skipped++;
            continue;
          }

          const existing = parsed.claudeSessionId
            ? await this.sessionRepository.findByClaudeSessionId(parsed.claudeSessionId)
            : null;

          if (!existing) {
            // 新会话：元数据 + 消息
            const session = this.buildSession(parsed);
            await this.sessionRepository.save(session);
            const n = await this.saveMessages(session.sessionId, parsed.messages);
            summary.imported++;
            summary.messagesImported += n;
          } else {
            // 已有会话：若 0 消息则回填，否则跳过
            const count = await this.messageRepository.countBySessionId(existing.sessionId);
            if (count === 0) {
              const n = await this.saveMessages(existing.sessionId, parsed.messages);
              summary.backfilled++;
              summary.messagesImported += n;
            } else {
              summary.skipped++;
            }
          }
        } catch (e) {
          summary.errors.push({ file: filePath, error: (e as Error).message });
        }
      }
    }

    logger.info(
      `History import done: imported=${summary.imported} backfilled=${summary.backfilled} ` +
      `skipped=${summary.skipped} messages=${summary.messagesImported} errors=${summary.errors.length}`
    );
    return summary;
  }

  /**
   * 流式解析单个 jsonl transcript，提取元数据 + 消息列表。
   * 只读：createReadStream + readline。消息按出现顺序收集（与对话时序一致）。
   */
  private async parseTranscript(filePath: string): Promise<ParsedTranscript> {
    const claudeSessionId = path.basename(filePath, '.jsonl');
    const result: ParsedTranscript = {
      claudeSessionId,
      workingDir: null,
      firstUserText: null,
      lastUserText: null,
      messageCount: 0,
      createdAt: null,
      updatedAt: null,
      messages: [],
    };

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let firstTs: string | null = null;
    let lastTs: string | null = null;

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let d: any;
      try {
        d = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (!d || typeof d !== 'object') continue;

      const ts = d.timestamp;
      if (typeof ts === 'string') {
        if (!firstTs) firstTs = ts;
        lastTs = ts;
      }

      if (!result.workingDir && typeof d.cwd === 'string' && d.cwd) {
        result.workingDir = d.cwd;
      }

      const type = d.type;
      if (type === 'user' || type === 'assistant') {
        result.messageCount++;
      }
      if (type === 'user') {
        const text = this.extractUserText(d.message?.content);
        if (text) {
          if (result.firstUserText === null) result.firstUserText = text;
          result.lastUserText = text;
          this.pushMessage(result.messages, 'user', text, { claudeMessageId: d.uuid }, ts);
        }
      } else if (type === 'assistant') {
        this.collectAssistantMessages(result.messages, d.message?.content, d.uuid, ts);
      }
    }

    if (firstTs) result.createdAt = new Date(firstTs);
    if (lastTs) result.updatedAt = new Date(lastTs);

    return result;
  }

  /** 从 assistant 消息的 content 数组/字符串里收集 text/thinking/tool_use 消息。 */
  private collectAssistantMessages(out: ParsedMessage[], content: unknown, uuid: any, ts: string | undefined): void {
    if (typeof content === 'string') {
      this.pushMessage(out, 'assistant', content, { claudeMessageId: uuid }, ts);
      return;
    }
    if (!Array.isArray(content)) return;
    for (const block of content) {
      if (!block || typeof block !== 'object') continue;
      const meta = { claudeMessageId: uuid };
      if (block.type === 'text' && typeof block.text === 'string') {
        this.pushMessage(out, 'assistant', block.text, meta, ts);
      } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
        this.pushMessage(out, 'thinking', block.thinking, meta, ts);
      } else if (block.type === 'tool_use' && typeof block.name === 'string') {
        const summary = `Tool: ${block.name}`;
        this.pushMessage(out, 'tool_use', summary, { ...meta, toolName: block.name }, ts);
      }
    }
  }

  private pushMessage(
    out: ParsedMessage[],
    type: MessageType,
    content: string,
    metadata: any,
    ts: string | undefined
  ): void {
    const text = typeof content === 'string' ? content : '';
    if (!text.trim()) return;
    let timestamp: Date;
    try {
      timestamp = ts ? new Date(ts) : new Date();
    } catch {
      timestamp = new Date();
    }
    if (isNaN(timestamp.getTime())) timestamp = new Date();
    out.push({ type, content: text, metadata, timestamp });
  }

  /**
   * 从 user 消息的 content 里提取可读文本。
   * content 可能是字符串（含 <command-*> XML）或 content block 数组。
   * 优先取 <command-args>（用户真实输入），其次 <command-name>，再次去标签纯文本。
   * 数组取首个 text block（tool_result 等无 text 的 user 消息返回 null，被跳过）。
   */
  private extractUserText(content: unknown): string | null {
    let raw: string | null = null;
    if (typeof content === 'string') {
      raw = content;
    } else if (Array.isArray(content)) {
      const textBlock = content.find((b: any) => b && b.type === 'text' && typeof b.text === 'string');
      if (textBlock) raw = textBlock.text;
    }
    if (!raw) return null;

    const argsMatch = raw.match(/<command-args>([\s\S]*?)<\/command-args>/);
    if (argsMatch) return this.clean(argsMatch[1]);
    const nameMatch = raw.match(/<command-name>([\s\S]*?)<\/command-name>/);
    if (nameMatch) return this.clean(nameMatch[1]);
    const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return stripped ? this.clean(stripped) : null;
  }

  private clean(s: string): string {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > 60 ? t.slice(0, 60) : t;
  }

  /** 批量写入消息（保留原始时间戳），返回写入条数。 */
  private async saveMessages(sessionId: string, messages: ParsedMessage[]): Promise<number> {
    let n = 0;
    for (const m of messages) {
      try {
        await this.messageRepository.save({
          sessionId,
          type: m.type,
          content: m.content,
          metadata: m.metadata,
          timestamp: m.timestamp,
        });
        n++;
      } catch (e) {
        logger.warn(`Failed to save imported message for ${sessionId}: ${(e as Error).message}`);
      }
    }
    return n;
  }

  private buildSession(p: ParsedTranscript): Session {
    const now = new Date();
    const createdAt = p.createdAt ?? now;
    const updatedAt = p.updatedAt ?? now;
    const displayText = p.firstUserText ?? '';
    const cwdBase = p.workingDir ? path.basename(p.workingDir) : 'unknown';
    const name = displayText || `${cwdBase} ${createdAt.toISOString().slice(0, 10)}`;
    const task = displayText || 'Imported historical session';

    return {
      sessionId: uuidv4(),
      name,
      workingDir: p.workingDir ?? path.join(os.homedir(), '.claude', 'projects'),
      task,
      status: SessionStatus.COMPLETED,
      continueChat: false,
      claudeSessionId: p.claudeSessionId,
      lastUserMessage: p.lastUserText ?? undefined,
      messageCount: p.messageCount,
      createdAt,
      updatedAt,
      completedAt: updatedAt,
      deletedAt: undefined,
    };
  }
}
