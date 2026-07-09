export interface AuthConfig {
  username: string;
  password: string;
  jwtSecret: string;
}

export interface ClaudeConfig {
  executable: string;
  timeout: number;
}

export interface SecurityConfig {
  allowedDirs: string[];
}

export interface ProcessConfig {
  enableOptimizations: boolean;
  startupDelay: number;
  messageTimeout: number;
}

export interface EnvConfig {
  port: number;
  databasePath: string;
  auth: AuthConfig;
  claude: ClaudeConfig;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  security: SecurityConfig;
  process: ProcessConfig;
  nodeEnv: 'development' | 'production' | 'test';
}

export const getEnvConfig = (): EnvConfig => {
  return {
    // 基础设置
    port: parseInt(process.env.BACKEND_PORT || '8905', 10),
    databasePath: process.env.DATABASE_PATH || './data/sessions.db',
    
    // 安全设置
    auth: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin',
      jwtSecret: process.env.JWT_SECRET || 'dev-secret-key'
    },
    
    // Claude 设置
    claude: {
      executable: process.env.CLAUDE_EXECUTABLE || 'claude',
      timeout: parseInt(process.env.CLAUDE_TIMEOUT || '300000', 10)
    },
    
    // 日志设置
    logLevel: (process.env.LOG_LEVEL as EnvConfig['logLevel']) || 'info',
    
    // 安全设置
    security: {
      allowedDirs: process.env.ALLOWED_DIRS?.split(',') || ['/tmp', '/workspace']
    },
    
    // 处理进程设置
    process: {
      enableOptimizations: process.env.ENABLE_PROCESS_OPTIMIZATIONS !== 'false',
      startupDelay: parseInt(process.env.PROCESS_STARTUP_DELAY || '500', 10),
      messageTimeout: parseInt(process.env.PROCESS_MESSAGE_TIMEOUT || '120000', 10)
    },
    
    // 环境模式
    nodeEnv: (process.env.NODE_ENV as EnvConfig['nodeEnv']) || 'development'
  };
};