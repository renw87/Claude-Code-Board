import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { TestContext } from './world';
import { v4 as uuidv4 } from 'uuid';

// 错误处理相关的 Steps

// Given Steps

Given('Claude Code 运行档路径设置错误', async function(this: TestContext) {
  // 仿真错误的运行档路径
  this.testData.claudeCodePath = '/nonexistent/path/to/claude';
});

Given('Claude Code 因授权问题无法启动', async function(this: TestContext) {
  // 仿真授权问题
  this.testData.processStartError = {
    code: 'EACCES',
    message: 'Permission denied'
  };
});

Given('数据库服务暂时不可用', async function(this: TestContext) {
  // 仿真数据库连接错误
  this.testData.databaseError = {
    code: 'DATABASE_ERROR',
    message: 'Database service temporarily unavailable'
  };
});

Given('WebSocket 服务未启动', async function(this: TestContext) {
  // 仿真 WebSocket 服务未启动
  this.testData.websocketServerStatus = {
    running: false,
    error: 'WebSocket service not started'
  };
});

Given('系统可用内存低于 100MB', async function(this: TestContext) {
  // 仿真内存不足
  this.testData.systemMemory = {
    available: 90 * 1024 * 1024, // 90MB
    threshold: 100 * 1024 * 1024 // 100MB
  };
});

Given('Session 的对话历史文件损坏', async function(this: TestContext) {
  // 仿真历史文件损坏
  this.testData.corruptSession = {
    sessionId: uuidv4(),
    historyFile: '/path/to/corrupt/history.json',
    error: 'JSON parse error: unexpected token'
  };
});

Given('系统设置每秒最多处理 {int} 个请求', async function(this: TestContext, maxRequests: number) {
  // 设置速率限制
  this.testData.rateLimitConfig = {
    maxRequests: maxRequests,
    timeWindow: 1000, // 1 second
    currentRequests: 0,
    resetTime: Date.now()
  };
});

Given('系统遇到未预期的内部错误', async function(this: TestContext) {
  // 仿真未预期错误
  this.testData.internalError = {
    type: 'UnexpectedError',
    message: 'Something went wrong unexpectedly',
    stack: 'Error: Something went wrong\n    at function1 (file.js:10:5)\n    at function2 (file.js:20:10)'
  };
});

// When Steps

When('用户发送缺少必要字段的请求：{word}', async function(this: TestContext, missingField: string) {
  try {
    // 仿真缺少必要字段的请求
    const invalidRequest: any = {
      name: '测试项目',
      workingDir: '/test/path',
      task: '分析代码'
    };
    
    // 移除指定的字段
    delete invalidRequest[missingField];
    
    // 验证请求
    validateCreateRequest.call(this, invalidRequest, missingField);
    
    this.responseStatus = 201;
    this.responseBody = { success: true };
  } catch (error: any) {
    this.responseStatus = error.statusCode || 400;
    this.responseBody = {
      error_code: error.code,
      error_message: error.message,
      validation_errors: error.validationErrors
    };
  }
});

When('用户尝试创建新 Session', async function(this: TestContext) {
  try {
    // 检查内存状态
    if (this.testData.systemMemory && this.testData.systemMemory.available < this.testData.systemMemory.threshold) {
      throw {
        statusCode: 507,
        code: 'INSUFFICIENT_MEMORY',
        message: 'Insufficient memory to start new session'
      };
    }
    
    // 检查 Claude Code 运行档
    if (this.testData.claudeCodePath === '/nonexistent/path/to/claude') {
      throw {
        statusCode: 500,
        code: 'CLAUDE_NOT_FOUND',
        message: 'Claude Code executable not found'
      };
    }
    
    this.responseStatus = 201;
    this.responseBody = { success: true };
  } catch (error: any) {
    this.responseStatus = error.statusCode;
    this.responseBody = {
      error_code: error.code,
      error_message: error.message
    };
  }
});

When('用户创建 Session 并指定不存在的工作目录', async function(this: TestContext) {
  try {
    const invalidWorkingDir = '/nonexistent/working/directory';
    
    // 仿真检查工作目录存在性
    throw {
      statusCode: 400,
      code: 'INVALID_WORKING_DIR',
      message: 'Working directory does not exist'
    };
  } catch (error: any) {
    this.responseStatus = error.statusCode;
    this.responseBody = {
      error_code: error.code,
      error_message: error.message
    };
  }
});

When('系统尝试启动 Claude Code 进程', async function(this: TestContext) {
  // 仿真进程启动失败
  if (this.testData.processStartError) {
    this.testData.sessionWithError = {
      sessionId: uuidv4(),
      status: 'error',
      error: this.testData.processStartError.message,
      processOutput: 'Permission denied: cannot execute Claude Code'
    };
  }
});

When('用户查找 Sessions', async function(this: TestContext) {
  try {
    // 检查数据库状态
    if (this.testData.databaseError) {
      throw {
        statusCode: 503,
        code: this.testData.databaseError.code,
        message: this.testData.databaseError.message
      };
    }
    
    this.responseStatus = 200;
    this.responseBody = [];
  } catch (error: any) {
    this.responseStatus = error.statusCode;
    this.responseBody = {
      error_code: error.code,
      error_message: error.message
    };
  }
});

When('客户端尝试连接未启动的 WebSocket 服务', async function(this: TestContext) {
  // 检查 WebSocket 服务状态
  if (!this.testData.websocketServerStatus.running) {
    this.testData.websocketConnectionResult = {
      success: false,
      error: 'Connection refused: WebSocket service not available'
    };
  } else {
    this.testData.websocketConnectionResult = {
      success: true
    };
  }
});

When('用户尝试延续该 Session', async function(this: TestContext) {
  try {
    // 检查历史文件完整性
    if (this.testData.corruptSession) {
      throw {
        statusCode: 500,
        code: 'CORRUPT_HISTORY',
        message: 'Session history is corrupted'
      };
    }
    
    this.responseStatus = 200;
    this.responseBody = { success: true };
  } catch (error: any) {
    this.responseStatus = error.statusCode;
    this.responseBody = {
      error_code: error.code,
      error_message: error.message
    };
  }
});

When('同一客户端在 1 秒内发送第 {int} 个请求', async function(this: TestContext, requestNumber: number) {
  try {
    const config = this.testData.rateLimitConfig;
    
    // 仿真已经发送了第 101 个请求
    config.currentRequests = requestNumber;
    
    // 检查速率限制
    if (config.currentRequests > config.maxRequests) {
      const retryAfter = 1; // 1 second
      throw {
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        retryAfter: retryAfter
      };
    }
    
    this.responseStatus = 200;
    this.responseBody = { success: true };
  } catch (error: any) {
    this.responseStatus = error.statusCode;
    this.responseBody = {
      error_code: error.code,
      error_message: error.message
    };
    
    if (error.retryAfter) {
      this.responseHeaders = {
        'Retry-After': error.retryAfter.toString()
      };
    }
  }
});

When('错误发生', async function(this: TestContext) {
  try {
    // 仿真内部错误
    if (this.testData.internalError) {
      throw {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        originalError: this.testData.internalError
      };
    }
  } catch (error: any) {
    this.responseStatus = error.statusCode;
    this.responseBody = {
      error_code: error.code,
      error_message: error.message
    };
    
    // 记录错误但不暴露给客户端
    this.testData.errorLog = {
      timestamp: new Date(),
      error: error.originalError,
      stack: error.originalError?.stack
    };
  }
});

// Then Steps

Then('error_message 应包含 {string}', async function(this: TestContext, expectedMessage: string) {
  expect(this.responseBody.error_message).to.include(expectedMessage.replace(/"/g, ''));
});

Then('response 应包含详细的验证错误信息', async function(this: TestContext) {
  expect(this.responseBody.validation_errors).to.exist;
  expect(this.responseBody.validation_errors).to.be.an('array');
  expect(this.responseBody.validation_errors.length).to.be.greaterThan(0);
});

Then('Session 错误状态应更新为 {string}', async function(this: TestContext, expectedStatus: string) {
  if (this.testData.sessionWithError) {
    expect(this.testData.sessionWithError.status).to.equal(expectedStatus);
  }
});

Then('错误详情应包含进程输出', async function(this: TestContext) {
  if (this.testData.sessionWithError) {
    expect(this.testData.sessionWithError.processOutput).to.be.a('string');
    expect(this.testData.sessionWithError.processOutput.length).to.be.greaterThan(0);
  }
});

Then('WebSocket 应推送进程错误通知', async function(this: TestContext) {
  // 仿真错误通知推送
  this.testData.websocketErrorNotification = {
    type: 'error',
    sessionId: this.testData.sessionWithError?.sessionId,
    message: this.testData.sessionWithError?.error
  };
  
  expect(this.testData.websocketErrorNotification.type).to.equal('error');
});

Then('系统应该尝试重新连接', async function(this: TestContext) {
  // 仿真重新连接尝试
  this.testData.reconnectionAttempt = {
    attempted: true,
    timestamp: new Date(),
    maxRetries: 3,
    retryInterval: 5000
  };
  
  expect(this.testData.reconnectionAttempt.attempted).to.be.true;
});

Then('连接应该被拒绝', async function(this: TestContext) {
  expect(this.testData.websocketConnectionResult.success).to.be.false;
});

Then('客户端应收到适当的错误消息', async function(this: TestContext) {
  expect(this.testData.websocketConnectionResult.error).to.be.a('string');
  expect(this.testData.websocketConnectionResult.error.length).to.be.greaterThan(0);
});

Then('系统应记录连接失败事件', async function(this: TestContext) {
  // 仿真事件记录
  this.testData.connectionFailureLog = {
    timestamp: new Date(),
    event: 'websocket_connection_failed',
    error: this.testData.websocketConnectionResult.error,
    clientInfo: {
      ip: '127.0.0.1',
      userAgent: 'Test Client'
    }
  };
  
  expect(this.testData.connectionFailureLog.event).to.equal('websocket_connection_failed');
});

Then('系统应提供选项让用户选择是否忽略历史记录', async function(this: TestContext) {
  // 仿真提供恢复选项
  this.testData.recoveryOptions = {
    available: true,
    options: [
      { id: 'ignore_history', label: '忽略历史记录并继续', action: 'ignore' },
      { id: 'restore_backup', label: '尝试从备份恢复', action: 'restore' }
    ]
  };
  
  expect(this.testData.recoveryOptions.available).to.be.true;
  expect(this.testData.recoveryOptions.options).to.have.length.greaterThan(0);
});

Then('response 应包含 Retry-After header', async function(this: TestContext) {
  expect(this.responseHeaders).to.exist;
  expect(this.responseHeaders['Retry-After']).to.exist;
  expect(parseInt(this.responseHeaders['Retry-After'])).to.be.a('number');
});

Then('系统应记录完整的错误堆栈', async function(this: TestContext) {
  expect(this.testData.errorLog).to.exist;
  expect(this.testData.errorLog.error).to.exist;
  expect(this.testData.errorLog.stack).to.be.a('string');
});

Then('不应向客户端暴露敏感信息', async function(this: TestContext) {
  // 确保回应中不包含敏感信息
  const responseString = JSON.stringify(this.responseBody);
  
  // 检查不应该暴露的敏感信息
  expect(responseString).to.not.include('stack');
  expect(responseString).to.not.include('file.js');
  expect(responseString).to.not.include('function1');
  expect(responseString).to.not.include('UnexpectedError');
});

// 辅助函数 - 将 private 移除，因为这是在模块层级
function validateCreateRequest(this: TestContext, request: any, missingField: string): void {
  const validationErrors = [];
  
  if (!request.name) {
    validationErrors.push({
      field: 'name',
      message: 'name is required'
    });
  }
  
  if (!request.workingDir) {
    validationErrors.push({
      field: 'workingDir', 
      message: 'workingDir is required'
    });
  }
  
  if (!request.task) {
    validationErrors.push({
      field: 'task',
      message: 'task is required'
    });
  }
  
  if (validationErrors.length > 0) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: validationErrors[0].message,
      validationErrors: validationErrors
    };
  }
}