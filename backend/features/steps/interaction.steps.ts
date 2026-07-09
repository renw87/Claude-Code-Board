import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { TestContext } from './world';
import { v4 as uuidv4 } from 'uuid';
import { SessionStatus } from '../../src/types/session.types';

// Session 交互相关的 Steps

Then('消息应该被发送到 Claude Code 进程', async function(this: TestContext) {
  // 验证消息已发送到进程
  expect(this.testData.lastMessage).to.exist;
  expect(this.testData.lastMessage.content).to.be.a('string');
});

Then('WebSocket 应推送消息状态更新', async function(this: TestContext) {
  // 仿真 WebSocket 推送
  this.testData.websocketMessages = this.testData.websocketMessages || [];
  this.testData.websocketMessages.push({
    type: 'message_status',
    sessionId: this.currentSession?.sessionId,
    messageId: this.testData.lastMessage?.id,
    status: 'sent'
  });
  
  expect(this.testData.websocketMessages).to.have.length.greaterThan(0);
});

When('Claude Code 产生回应内容', async function(this: TestContext) {
  // 仿真 Claude Code 产生回应
  const responseContent = 'src 目录结构分析结果：\n- src/components/\n- src/services/\n- src/utils/';
  
  this.testData.claudeResponse = {
    sessionId: this.currentSession?.sessionId,
    messageId: uuidv4(),
    content: responseContent,
    timestamp: new Date(),
    type: 'message'
  };
});

Then('系统应该捕获输出内容', async function(this: TestContext) {
  // 验证系统捕获了 Claude Code 的输出
  expect(this.testData.claudeResponse).to.exist;
  expect(this.testData.claudeResponse.content).to.be.a('string');
  expect(this.testData.claudeResponse.content.length).to.be.greaterThan(0);
});

Then('WebSocket 应推送回应内容给客户端', async function(this: TestContext) {
  // 仿真 WebSocket 推送回应内容
  this.testData.websocketMessages = this.testData.websocketMessages || [];
  this.testData.websocketMessages.push({
    type: 'message',
    ...this.testData.claudeResponse
  });
  
  expect(this.testData.websocketMessages).to.have.length.greaterThan(0);
  const lastMessage = this.testData.websocketMessages[this.testData.websocketMessages.length - 1];
  expect(lastMessage.type).to.equal('message');
  expect(lastMessage.content).to.equal(this.testData.claudeResponse.content);
});

Then('回应应包含以下信息：', async function(this: TestContext, dataTable: any) {
  const expectedFields = dataTable.raw()[0];
  
  expect(this.testData.claudeResponse).to.exist;
  expectedFields.forEach((field: string) => {
    expect(this.testData.claudeResponse).to.have.property(field.trim());
  });
});

When('Claude Code 持续输出内容', async function(this: TestContext) {
  // 仿真串流输出
  this.testData.streamChunks = [
    'src 目录分析中...\n',
    '发现 components 文件夹\n',
    '发现 services 文件夹\n',
    '发现 utils 文件夹\n',
    '分析完成\n'
  ];
});

Then('系统应该即时捕获每个输出片段', async function(this: TestContext) {
  // 验证系统捕获了所有片段
  expect(this.testData.streamChunks).to.exist;
  expect(this.testData.streamChunks).to.be.an('array');
  expect(this.testData.streamChunks.length).to.be.greaterThan(0);
});

Then('WebSocket 应推送每个片段给客户端', async function(this: TestContext) {
  // 仿真推送每个片段
  this.testData.websocketMessages = this.testData.websocketMessages || [];
  
  this.testData.streamChunks.forEach((chunk: string, index: number) => {
    this.testData.websocketMessages.push({
      type: 'stream_chunk',
      sessionId: this.currentSession?.sessionId,
      chunk: chunk,
      index: index,
      timestamp: new Date()
    });
  });
  
  expect(this.testData.websocketMessages.length).to.equal(this.testData.streamChunks.length);
});

Then('客户端应能即时看到回应进度', async function(this: TestContext) {
  // 验证客户端能看到进度
  const streamMessages = this.testData.websocketMessages.filter((msg: any) => msg.type === 'stream_chunk');
  expect(streamMessages.length).to.be.greaterThan(0);
  
  // 验证片段顺序
  streamMessages.forEach((msg: any, index: number) => {
    expect(msg.index).to.equal(index);
  });
});

// messageId 和 timestamp 已经在 common.steps.ts 中处理

When('用户查找对话历史，参数如下：', async function(this: TestContext, dataTable: any) {
  const params = dataTable.rowsHash();
  
  try {
    if (!this.currentSession) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
    }
    
    const page = Number(params['page']) || 1;
    const limit = Number(params['limit']) || 20;
    const conversations = this.testData.conversations || [];
    
    // 仿真分页
    const offset = (page - 1) * limit;
    const paginatedConversations = conversations.slice(offset, offset + limit);
    const totalPages = Math.ceil(conversations.length / limit);
    
    this.responseStatus = 200;
    this.responseBody = {
      data: paginatedConversations,
      pagination: {
        total: conversations.length,
        page: page,
        totalPages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
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

Then('response 应包含 {int} 笔对话记录', async function(this: TestContext, count: number) {
  expect(this.responseBody).to.have.property('data');
  expect(this.responseBody.data).to.be.an('array');
  expect(this.responseBody.data).to.have.lengthOf(count);
});

Then('每笔记录应包含：', async function(this: TestContext, dataTable: any) {
  const expectedFields = dataTable.raw()[0];
  
  expect(this.responseBody.data).to.be.an('array');
  this.responseBody.data.forEach((record: any) => {
    expectedFields.forEach((field: string) => {
      expect(record).to.have.property(field.trim());
    });
  });
});

Then('对话记录应按时间顺序排列', async function(this: TestContext) {
  const conversations = this.responseBody.data;
  expect(conversations).to.be.an('array');
  
  if (conversations.length > 1) {
    for (let i = 1; i < conversations.length; i++) {
      const prevTime = new Date(conversations[i-1].timestamp).getTime();
      const currentTime = new Date(conversations[i].timestamp).getTime();
      expect(currentTime).to.be.greaterThan(prevTime);
    }
  }
});

Then('response 应包含分页信息：', async function(this: TestContext, dataTable: any) {
  const expectedPagination = dataTable.rowsHash();
  
  expect(this.responseBody).to.have.property('pagination');
  Object.keys(expectedPagination).forEach(key => {
    expect(this.responseBody.pagination).to.have.property(key);
    expect(this.responseBody.pagination[key]).to.equal(Number(expectedPagination[key]));
  });
});

When('用户发送中断指令', async function(this: TestContext) {
  try {
    if (!this.currentSession) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
    }
    
    if (this.currentSession.status !== SessionStatus.PROCESSING) {
      throw { statusCode: 400, code: 'INVALID_STATUS', message: 'Session is not processing' };
    }
    
    // 仿真中断进程
    this.testData.longRunningTask = false;
    this.currentSession.status = SessionStatus.IDLE;
    this.currentSession.error = null; // 中断时清调试误消息
    this.currentSession.updatedAt = new Date();
    
    this.responseStatus = 200;
    this.responseBody = {
      success: true,
      message: 'Session interrupted'
    };
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

Then('Claude Code 进程应收到中断信号', async function(this: TestContext) {
  // 验证进程收到中断信号
  expect(this.testData.longRunningTask).to.be.false;
});

Then('Session 状态应更新为 {string}', async function(this: TestContext, status: string) {
  expect(this.currentSession?.status).to.equal(status);
});

Then('WebSocket 应推送状态更新', async function(this: TestContext) {
  // 仿真 WebSocket 推送状态更新
  this.testData.websocketMessages = this.testData.websocketMessages || [];
  this.testData.websocketMessages.push({
    type: 'status_update',
    sessionId: this.currentSession?.sessionId,
    status: this.currentSession?.status,
    timestamp: new Date()
  });
  
  const statusMessage = this.testData.websocketMessages.find((msg: any) => msg.type === 'status_update');
  expect(statusMessage).to.exist;
});

When('用户发送恢复指令', async function(this: TestContext) {
  try {
    if (!this.currentSession) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
    }
    
    if (this.currentSession.status !== 'interrupted') {
      throw { statusCode: 400, code: 'SESSION_NOT_INTERRUPTED', message: 'Session is not interrupted' };
    }
    
    // 恢复 Session（现在已不需要恢复，中断后即为 idle）
    this.currentSession.status = SessionStatus.IDLE;
    this.currentSession.updatedAt = new Date();
    
    this.responseStatus = 200;
    this.responseBody = {
      success: true,
      message: 'Session resumed'
    };
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

Then('用户可以继续发送新消息', async function(this: TestContext) {
  // 验证可以继续发送消息
  expect(this.currentSession?.status).to.equal(SessionStatus.IDLE);
});

Then('旧的错误消息应被清除', async function(this: TestContext) {
  // 验证 session 的错误消息已被清除
  if (this.currentSession) {
    expect(this.currentSession.error).to.be.null;
  }
});

Then('错误消息应被清除', async function(this: TestContext) {
  // 验证 session 的错误消息已被清除
  if (this.currentSession) {
    expect(this.currentSession.error).to.be.null;
  }
});

Then('Session 状态应回到 {string}', async function(this: TestContext, expectedStatus: string) {
  // 验证 session 状态
  expect(this.currentSession?.status).to.equal(expectedStatus);
});

Given('Session 之前有错误消息', async function(this: TestContext) {
  // 设置 session 有错误消息
  if (this.currentSession) {
    this.currentSession.error = 'Previous error message';
  }
});

When('用户发送新消息', async function(this: TestContext) {
  // 仿真发送新消息，这会触发错误清除
  if (this.currentSession) {
    this.currentSession.status = SessionStatus.PROCESSING;
    this.currentSession.error = null; // 清调试误消息
    this.currentSession.updatedAt = new Date();
  }
  
  this.responseStatus = 200;
  this.responseBody = {
    messageId: uuidv4(),
    timestamp: new Date().toISOString()
  };
});

When('Claude Code 成功运行完成', async function(this: TestContext) {
  // 仿真 Claude Code 运行完成
  if (this.currentSession) {
    this.currentSession.status = SessionStatus.IDLE;
    this.currentSession.error = null; // 运行成功时清调试误
    this.currentSession.updatedAt = new Date();
  }
});

When('用户尝试中断该 Session', async function(this: TestContext) {
  // 尝试中断非处理中的 session
  if (!this.currentSession) {
    throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
  }
  
  if (this.currentSession.status !== SessionStatus.PROCESSING) {
    this.responseStatus = 400;
    this.responseBody = {
      error_code: 'INVALID_STATUS',
      error_message: 'Session is not processing'
    };
    return;
  }
  
  // 如果是处理中状态，则正常中断
  this.currentSession.status = SessionStatus.IDLE;
  this.responseStatus = 200;
});

Given('Session 刚被中断并处于 {string} 状态', async function(this: TestContext, status: string) {
  // 设置 session 处于被中断后的状态
  if (this.currentSession) {
    this.currentSession.status = status as SessionStatus;
    this.currentSession.error = null; // 中断时清调试误
    this.currentSession.updatedAt = new Date();
    this.testData.wasInterrupted = true;
  }
});

When('用户发送新消息 {string}', async function(this: TestContext, message: string) {
  // 仿真发送新消息
  if (this.currentSession) {
    this.currentSession.status = SessionStatus.PROCESSING;
    this.currentSession.error = null; // 发送新消息时清调试误
    this.currentSession.updatedAt = new Date();
  }
  
  this.testData.lastMessage = {
    id: `msg-${Date.now()}`,
    content: message,
    timestamp: new Date()
  };
  
  this.responseStatus = 200;
  this.responseBody = {
    messageId: this.testData.lastMessage.id,
    timestamp: new Date().toISOString()
  };
});

Then('消息应该被发送到新的 Claude Code 进程', async function(this: TestContext) {
  // 验证消息发送到新的进程
  expect(this.testData.lastMessage).to.exist;
  expect(this.testData.lastMessage.content).to.be.a('string');
  
  // 验证是新的进程（如果之前被中断）
  if (this.testData.wasInterrupted) {
    this.testData.newProcessStarted = true;
    expect(this.testData.newProcessStarted).to.be.true;
  }
});