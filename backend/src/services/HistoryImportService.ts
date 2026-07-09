import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { SessionRepository } from '../repositories/SessionRepository';
import { Session, SessionStatus } from '../types/session.types';
import { logger } from '../utils/logger';

export interface HistoryImportSummary {
  imported: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
  projectsDir: string;
}

interface ParsedTranscript {
  claudeSessionId: string;
  workingDir: string | null;
  firstUserText: string | null;
  lastUserText: string | null;
  messageCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * 只读扫描 ~/.claude/projects/ 下的 Claude Code 历史会话 transcript，
 * 把元数据导入 Board 自己的 sessions 表，使历史会话出现在 UI 列表。
 *
 * 严格只读：只 readdir / createReadStream，绝不写入或修改任何 jsonl 原文件。
 * 去重：按 claude_session_id（jsonl 文件名）查库，已存在则跳过（非破坏）。
 */
export class HistoryImportService {
  private sessionRepository: SessionRepository;

  constructor() {
    this.sessionRepository = new SessionRepository();
  }

  async importHistory(): Promise<HistoryImportSummary> {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    const summary: HistoryImportSummary = { imported: 0, skipped: 0, errors: [], projectsDir };

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
            // 没有时间戳的 transcript 无法定位，跳过
            summary.skipped++;
            continue;
          }

          // 去重：claude_session_id 已在库则跳过
          if (parsed.claudeSessionId) {
            const existing = await this.sessionRepository.findByClaudeSessionId(parsed.claudeSessionId);
            if (existing) {
              summary.skipped++;
              continue;
            }
          }

          const session = this.buildSession(parsed);
          await this.sessionRepository.save(session);
          summary.imported++;
        } catch (e) {
          summary.errors.push({ file: filePath, error: (e as Error).message });
        }
      }
    }

    logger.info(`History import done: imported=${summary.imported} skipped=${summary.skipped} errors=${summary.errors.length}`);
    return summary;
  }

  /**
   * 流式解析单个 jsonl transcript，提取元数据。
   * 只读：createReadStream + readline。
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
        }
      }
    }

    if (firstTs) result.createdAt = new Date(firstTs);
    if (lastTs) result.updatedAt = new Date(lastTs);

    return result;
  }

  /**
   * 从 user 消息的 content 里提取可读文本。
   * content 可能是字符串（含 <command-*> XML）或 content block 数组。
   * 优先取 <command-args>（用户真实输入），其次 <command-name>，再次去标签纯文本。
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
