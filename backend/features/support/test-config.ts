// 测试环境配置
export const testConfig = {
  // API 配置
  api: {
    baseUrl: process.env.TEST_API_URL || 'http://localhost:3000',
    timeout: 5000
  },
  
  // Claude Code 配置
  claudeCode: {
    mockPath: '/usr/local/bin/claude',
    defaultWorkingDir: '/test/workspace',
    processTimeout: 10000
  },
  
  // 测试数据配置
  testData: {
    defaultSessionName: 'Test Session',
    defaultTask: 'Test task',
    cleanupAfterTest: true
  },
  
  // 资源限制配置（用于测试）
  resourceLimits: {
    maxConcurrentSessions: 10,
    maxMemoryPerSession: '2GB',
    sessionTimeout: 7200 // 2 小时
  }
};

// 测试用的错误码定义
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_STILL_RUNNING = 'SESSION_STILL_RUNNING',
  SESSION_NOT_ACTIVE = 'SESSION_NOT_ACTIVE',
  RESOURCE_LIMIT_EXCEEDED = 'RESOURCE_LIMIT_EXCEEDED',
  CLAUDE_NOT_FOUND = 'CLAUDE_NOT_FOUND',
  INVALID_WORKING_DIR = 'INVALID_WORKING_DIR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INSUFFICIENT_MEMORY = 'INSUFFICIENT_MEMORY',
  CORRUPT_HISTORY = 'CORRUPT_HISTORY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TOKEN_MISSING = 'TOKEN_MISSING',
  TOKEN_INVALID = 'TOKEN_INVALID',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN_PATH = 'FORBIDDEN_PATH',
  ACCESS_DENIED = 'ACCESS_DENIED'
}

// 测试用的状态码对应
export const errorStatusCodes: { [key: string]: number } = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.SESSION_NOT_FOUND]: 404,
  [ErrorCode.SESSION_STILL_RUNNING]: 400,
  [ErrorCode.SESSION_NOT_ACTIVE]: 400,
  [ErrorCode.RESOURCE_LIMIT_EXCEEDED]: 503,
  [ErrorCode.CLAUDE_NOT_FOUND]: 500,
  [ErrorCode.INVALID_WORKING_DIR]: 400,
  [ErrorCode.DATABASE_ERROR]: 503,
  [ErrorCode.INSUFFICIENT_MEMORY]: 507,
  [ErrorCode.CORRUPT_HISTORY]: 500,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.TOKEN_MISSING]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN_PATH]: 403,
  [ErrorCode.ACCESS_DENIED]: 403
};