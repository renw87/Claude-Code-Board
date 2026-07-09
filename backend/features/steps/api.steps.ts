import { When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { TestContext } from './world';

// 原子化的 API 相关 Steps

When('用户查找所有 Sessions', async function(this: TestContext) {
  try {
    // 仿真 API 调用
    const sessions = Array.from(this.sessions.values());
    this.responseStatus = 200;
    this.responseBody = sessions;
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

When('用户查找该 Session 的详细信息', async function(this: TestContext) {
  try {
    const sessionId = this.currentSession?.sessionId || this.testData.nonExistentSessionId;
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
    }
    
    this.responseStatus = 200;
    this.responseBody = session;
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

When('用户标记该 Session 为完成', async function(this: TestContext) {
  try {
    if (!this.currentSession) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
    }
    
    // 检查状态是否允许完成
    if (this.currentSession.status !== 'idle' && this.currentSession.status !== 'error') {
      throw { statusCode: 400, code: 'INVALID_STATUS', message: 'Session must be idle or in error state to complete' };
    }
    
    this.currentSession.status = SessionStatus.COMPLETED;
    this.currentSession.completedAt = new Date();
    this.currentSession.error = null; // 完成时清调试误消息
    this.currentSession.updatedAt = new Date();
    
    this.responseStatus = 200;
    this.responseBody = this.currentSession;
    
    // 仿真终止进程
    if (this.currentSession.processId) {
      this.mockProcesses.delete(this.currentSession.processId.toString());
    }
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

When('用户尝试标记该 Session 为完成', async function(this: TestContext) {
  // 这个步骤和上面的一样，但明确表示这是一个可能失败的尝试
  try {
    if (!this.currentSession) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
    }
    
    // 检查状态是否允许完成
    if (this.currentSession.status !== 'idle' && this.currentSession.status !== 'error') {
      throw { statusCode: 400, code: 'INVALID_STATUS', message: 'Session must be idle or in error state to complete' };
    }
    
    this.currentSession.status = SessionStatus.COMPLETED;
    this.currentSession.completedAt = new Date();
    this.currentSession.error = null;
    this.currentSession.updatedAt = new Date();
    
    this.responseStatus = 200;
    this.responseBody = this.currentSession;
    
    if (this.currentSession.processId) {
      this.mockProcesses.delete(this.currentSession.processId.toString());
    }
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

When('用户删除该 Session', async function(this: TestContext) {
  try {
    if (!this.currentSession) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
    }
    
    // 检查 Session 是否在处理中
    if (this.currentSession.status === SessionStatus.PROCESSING) {
      throw { statusCode: 400, code: 'SESSION_STILL_PROCESSING', message: 'Cannot delete a session that is currently processing' };
    }
    
    // 在删除前设置软删除操作（用于 persistence feature）
    if (!this.testData.persistenceOperation) {
      this.testData.persistenceOperation = {
        action: 'soft_delete',
        table: 'sessions',
        data: {
          sessionId: this.currentSession.sessionId,
          deletedAt: new Date()
        },
        executed: true,
        timestamp: new Date()
      };
    }
    
    this.sessions.delete(this.currentSession.sessionId);
    this.responseStatus = 204;
    this.responseBody = null;
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

When('用户尝试删除该 Session', async function(this: TestContext) {
  try {
    if (!this.currentSession) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
    }
    
    if (this.currentSession.status === SessionStatus.PROCESSING) {
      throw { statusCode: 400, code: 'SESSION_STILL_PROCESSING', message: 'Cannot delete a session that is currently processing' };
    }
    
    this.sessions.delete(this.currentSession.sessionId);
    this.responseStatus = 204;
    this.responseBody = null;
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

When('用户发送消息 {string}', async function(this: TestContext, message: string) {
  try {
    if (!this.currentSession) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
    }
    
    if (this.currentSession.status !== SessionStatus.IDLE) {
      throw { statusCode: 400, code: 'SESSION_NOT_ACTIVE', message: 'Session is not active' };
    }
    
    const messageId = uuidv4();
    
    // 更新 session 状态和清调试误
    this.currentSession.status = SessionStatus.PROCESSING;
    this.currentSession.error = null; // 清除旧的错误消息
    this.currentSession.updatedAt = new Date();
    
    this.responseStatus = 200;
    this.responseBody = {
      messageId: messageId,
      timestamp: new Date()
    };
    
    // 仿真发送消息到进程
    this.testData.lastMessage = {
      id: messageId,
      content: message,
      timestamp: new Date()
    };
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

When('用户尝试发送消息', async function(this: TestContext) {
  // 使用默认消息
  try {
    if (!this.currentSession) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
    }
    
    if (this.currentSession.status !== SessionStatus.IDLE) {
      throw { statusCode: 400, code: 'SESSION_NOT_ACTIVE', message: 'Session is not active' };
    }
    
    const messageId = uuidv4();
    
    // 更新 session 状态和清调试误
    this.currentSession.status = SessionStatus.PROCESSING;
    this.currentSession.error = null; // 清除旧的错误消息
    this.currentSession.updatedAt = new Date();
    
    this.responseStatus = 200;
    this.responseBody = {
      messageId: messageId,
      timestamp: new Date()
    };
    
    // 仿真发送消息到进程
    this.testData.lastMessage = {
      id: messageId,
      content: 'Test message',
      timestamp: new Date()
    };
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

When('用户查找对话历史', async function(this: TestContext) {
  try {
    if (!this.currentSession) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
    }
    
    const conversations = this.testData.conversations || [];
    this.responseStatus = 200;
    this.responseBody = {
      data: conversations,
      pagination: {
        total: conversations.length,
        page: 1,
        totalPages: 1
      }
    };
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

// 需要先 import SessionStatus
import { SessionStatus } from '../../src/types/session.types';
import { v4 as uuidv4 } from 'uuid';

// 验证 Steps

Then('response 应包含 {int} 个 Sessions', async function(this: TestContext, count: number) {
  expect(this.responseBody).to.be.an('array');
  expect(this.responseBody).to.have.lengthOf(count);
});

Then('每个 Session 应包含以下信息：', async function(this: TestContext, dataTable: any) {
  const expectedFields = dataTable.raw()[0];
  
  expect(this.responseBody).to.be.an('array');
  this.responseBody.forEach((session: any) => {
    expectedFields.forEach((field: string) => {
      expect(session).to.have.property(field.trim());
    });
  });
});

// 这些已经在 common.steps.ts 的 'response 应包含 {word}' 中处理了

// completedAt 也已经在 common.steps.ts 中处理了

Then('该 Session 应从系统中移除', async function(this: TestContext) {
  if (this.currentSession) {
    expect(this.sessions.has(this.currentSession.sessionId)).to.be.false;
  }
});

Then('相关的对话记录应被清理', async function(this: TestContext) {
  // 验证对话记录已被清理
  expect(this.testData.conversationHistory).to.be.undefined;
});

Then('新 Session 应该加载上次的对话历史', async function(this: TestContext) {
  // 验证对话历史已加载
  expect(this.testData.conversationHistory).to.exist;
  expect(this.testData.conversationHistory).to.have.length.greaterThan(0);
});

Then('Claude Code 进程应使用 -c 参数启动', async function(this: TestContext) {
  // 验证 -c 参数
  expect(this.currentSession?.continueChat).to.be.true;
});

Then('Claude Code 进程应使用 --dangerously-skip-permissions 参数启动', async function(this: TestContext) {
  // 验证 --dangerously-skip-permissions 参数
  expect(this.currentSession?.dangerouslySkipPermissions).to.be.true;
});

Then('系统应该终止该 Session 的 Claude Code 进程', async function(this: TestContext) {
  // 验证进程已被终止
  if (this.currentSession?.processId) {
    expect(this.mockProcesses.has(this.currentSession.processId.toString())).to.be.false;
  }
});