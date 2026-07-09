export interface ProcessInfo {
  sessionId: string;
  pid: number;
  startTime: Date;
  status: ProcessStatus;
  memoryUsage: number; // MB
  cpuUsage: number; // %
  workingDirectory: string;
  commandArgs: string[];
  lastActivityTime: Date;
}

export enum ProcessStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  IDLE = 'idle',
  BUSY = 'busy',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
  CRASHED = 'crashed'
}

export interface ProcessMessage {
  sessionId: string;
  type: 'stdin' | 'stdout' | 'stderr' | 'status';
  content: string;
  timestamp: Date;
  metadata?: any;
}

// Claude 特定的消息类型
export interface ClaudeStreamMessage {
  sessionId: string;
  type: 'assistant' | 'user' | 'system' | 'tool_use' | 'thinking' | 'error' | 'result';
  content: string;
  timestamp: Date;
  metadata?: {
    // 消息识别
    messageId?: string;
    
    // 工具使用相关
    toolName?: string;
    toolInput?: any;
    toolOutput?: any;
    toolStatus?: 'start' | 'complete' | 'error';
    toolId?: string;
    isError?: boolean;
    
    // 思考过程
    isThinking?: boolean;
    thinkingDepth?: number;
    
    // 文件操作
    fileOperation?: 'read' | 'write' | 'edit' | 'delete' | 'list' | 'search';
    filePath?: string;
    fileContent?: string;
    lineNumbers?: { start: number; end: number };
    
    // 串流相关
    isPartial?: boolean;
    sequenceId?: string;
    isComplete?: boolean;
    isStreaming?: boolean;
    
    // 原始 JSON 数据
    raw?: any;
  };
}

// 工具使用记录
export interface ToolUsageRecord {
  toolName: string;
  timestamp: Date;
  input?: any;
  output?: any;
  duration?: number;
  status: 'success' | 'error';
  error?: string;
}

export interface ProcessMetrics {
  sessionId: string;
  timestamp: Date;
  memoryUsage: {
    rss: number; // Resident Set Size
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  uptime: number; // seconds
}

export interface ClaudeCodeConfig {
  executablePath: string;
  defaultTimeout: number; // milliseconds
  maxConcurrentProcesses: number;
  healthCheckInterval: number; // milliseconds
  maxIdleTime: number; // milliseconds
  maxMemoryUsage: number; // MB
  enableMetrics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface StartProcessOptions {
  workingDirectory: string;
  continueChat?: boolean;
  previousSessionPath?: string;
  initialTask?: string;
  timeout?: number;
  environment?: Record<string, string>;
  maxMemory?: number;
  priority?: 'low' | 'normal' | 'high';
}