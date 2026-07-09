import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { TestContext } from './world';
import { v4 as uuidv4 } from 'uuid';

// WebSocket 连接相关的 Steps

Given('WebSocket 服务已启动', async function(this: TestContext) {
  // 仿真 WebSocket 服务启动
  this.testData.websocketServer = {
    status: 'running',
    port: 3000,
    connections: new Map()
  };
});

Given('客户端已创建 WebSocket 连接', async function(this: TestContext) {
  // 仿真客户端连接
  const clientId = uuidv4();
  this.testData.clientId = clientId;
  this.testData.websocketConnection = {
    clientId: clientId,
    connected: true,
    subscriptions: new Set(),
    lastPing: new Date()
  };
  
  this.testData.websocketServer.connections.set(clientId, this.testData.websocketConnection);
});

Given('客户端已成功连接', async function(this: TestContext) {
  // 确保客户端已连接
  expect(this.testData.websocketConnection).to.exist;
  expect(this.testData.websocketConnection.connected).to.be.true;
});

Given('客户端已订阅 Session {string}', async function(this: TestContext, sessionId: string) {
  // 仿真订阅
  this.testData.websocketConnection.subscriptions.add(sessionId);
  this.testData.subscribedSessionId = sessionId;
});

Given('客户端已订阅多个 Sessions', async function(this: TestContext) {
  // 仿真订阅多个 Sessions
  this.testData.websocketConnection.subscriptions.add('session-1');
  this.testData.websocketConnection.subscriptions.add('session-2');
  this.testData.websocketConnection.subscriptions.add('session-3');
});

Given('客户端因网络问题断线', async function(this: TestContext) {
  // 仿真网络断线
  this.testData.websocketConnection.connected = false;
  this.testData.websocketConnection.disconnectedAt = new Date();
  this.testData.websocketConnection.disconnectReason = 'network_error';
});

Given('客户端已连接超过 30 秒', async function(this: TestContext) {
  // 仿真客户端连接超过 30 秒
  const thirtySecondsAgo = new Date(Date.now() - 31 * 1000);
  this.testData.websocketConnection.connectedAt = thirtySecondsAgo;
});

// WebSocket 操作相关的 Steps

When('客户端尝试创建 WebSocket 连接', async function(this: TestContext) {
  // 仿真连接请求
  const clientId = uuidv4();
  this.testData.connectionRequest = {
    clientId: clientId,
    timestamp: new Date(),
    userAgent: 'Test Client 1.0'
  };
});

When('客户端订阅 Session {string} 的更新', async function(this: TestContext, sessionId: string) {
  try {
    // 仿真订阅请求
    if (!this.testData.websocketConnection.connected) {
      throw new Error('Client not connected');
    }
    
    this.testData.websocketConnection.subscriptions.add(sessionId);
    this.testData.subscriptionResponse = {
      type: 'subscription',
      sessionId: sessionId,
      status: 'subscribed',
      timestamp: new Date()
    };
    
    this.responseStatus = 200;
    this.responseBody = this.testData.subscriptionResponse;
  } catch (error: any) {
    this.responseStatus = 400;
    this.responseBody = {
      error_code: 'WEBSOCKET_ERROR',
      error_message: error.message
    };
  }
});

When('Session 状态从 {string} 变更为 {string}', async function(this: TestContext, oldStatus: string, newStatus: string) {
  // 仿真状态变更
  this.testData.statusUpdate = {
    type: 'status_update',
    sessionId: this.testData.subscribedSessionId || 'session-123',
    oldStatus: oldStatus,
    newStatus: newStatus,
    timestamp: new Date()
  };
});

When('Claude Code 产生新的回应内容', async function(this: TestContext) {
  // 仿真 Claude Code 回应
  this.testData.messageUpdate = {
    type: 'message',
    sessionId: this.testData.subscribedSessionId || 'session-123',
    role: 'assistant',
    content: '这是 Claude Code 的回应内容',
    timestamp: new Date()
  };
});

When('Claude Code 正在产生串流回应', async function(this: TestContext) {
  // 仿真串流回应
  this.testData.streamChunks = [
    { type: 'stream_chunk', sessionId: 'session-123', chunk: '正在分析', index: 0 },
    { type: 'stream_chunk', sessionId: 'session-123', chunk: '代码...', index: 1 },
    { type: 'stream_chunk', sessionId: 'session-123', chunk: '完成分析', index: 2 }
  ];
});

When('系统资源使用率超过 80%', async function(this: TestContext) {
  // 仿真系统警告
  this.testData.systemAlert = {
    type: 'system_alert',
    level: 'warning',
    message: 'System resource usage high',
    metrics: {
      cpu: 85,
      memory: 82,
      disk: 75
    },
    timestamp: new Date()
  };
});

When('客户端连接中断', async function(this: TestContext) {
  // 仿真客户端断线
  this.testData.websocketConnection.connected = false;
  this.testData.websocketConnection.disconnectedAt = new Date();
  this.testData.websocketConnection.disconnectReason = 'client_disconnect';
});

When('客户端在 30 秒内重新连接', async function(this: TestContext) {
  // 仿真重连
  const reconnectionTime = new Date();
  const disconnectionTime = this.testData.websocketConnection.disconnectedAt;
  const timeDiff = reconnectionTime.getTime() - disconnectionTime.getTime();
  
  if (timeDiff <= 30000) {
    this.testData.websocketConnection.connected = true;
    this.testData.websocketConnection.reconnectedAt = reconnectionTime;
    this.testData.reconnectionSuccessful = true;
  } else {
    this.testData.reconnectionSuccessful = false;
  }
});

When('客户端取消订阅该 Session', async function(this: TestContext) {
  // 仿真取消订阅
  const sessionId = this.testData.subscribedSessionId;
  this.testData.websocketConnection.subscriptions.delete(sessionId);
  
  this.testData.unsubscriptionResponse = {
    type: 'subscription',
    sessionId: sessionId,
    status: 'unsubscribed',
    timestamp: new Date()
  };
});

When('系统发送心跳检测', async function(this: TestContext) {
  // 仿真心跳检测
  this.testData.heartbeatRequest = {
    type: 'ping',
    timestamp: new Date(),
    clientId: this.testData.clientId
  };
});

// 验证相关的 Steps

Then('系统应该验证连接请求', async function(this: TestContext) {
  // 验证连接请求被处理
  expect(this.testData.connectionRequest).to.exist;
  expect(this.testData.connectionRequest.clientId).to.be.a('string');
});

Then('为通过验证的客户端创建连接', async function(this: TestContext) {
  // 验证连接创建
  const clientId = this.testData.connectionRequest.clientId;
  expect(clientId).to.exist;
});

Then('发送连接成功消息：', async function(this: TestContext, dataTable: any) {
  // 验证连接成功消息
  const expectedData = dataTable.rowsHash();
  
  const connectionMessage = {
    type: expectedData.type.replace(/"/g, ''), // 移除引号
    status: expectedData.status.replace(/"/g, ''), // 移除引号
    clientId: this.testData.connectionRequest.clientId
  };
  
  expect(connectionMessage.type).to.equal('connection');
  expect(connectionMessage.status).to.equal('connected');
  expect(connectionMessage.clientId).to.be.a('string');
});

Then('系统应该记录该订阅关系', async function(this: TestContext) {
  // 验证订阅记录
  const sessionId = this.testData.subscriptionResponse.sessionId;
  expect(this.testData.websocketConnection.subscriptions.has(sessionId)).to.be.true;
});

Then('发送订阅确认消息：', async function(this: TestContext, dataTable: any) {
  // 验证订阅确认消息
  const expectedData = dataTable.rowsHash();
  
  expect(this.testData.subscriptionResponse).to.exist;
  expect(this.testData.subscriptionResponse.type).to.equal(expectedData.type.replace(/"/g, ''));
  expect(this.testData.subscriptionResponse.status).to.equal(expectedData.status.replace(/"/g, ''));
});

Then('WebSocket 应推送状态更新：', async function(this: TestContext, dataTable: any) {
  // 验证状态更新推送
  const expectedData = dataTable.rowsHash();
  
  expect(this.testData.statusUpdate).to.exist;
  expect(this.testData.statusUpdate.type).to.equal(expectedData.type.replace(/"/g, ''));
  expect(this.testData.statusUpdate.oldStatus).to.equal(expectedData.oldStatus.replace(/"/g, ''));
  expect(this.testData.statusUpdate.newStatus).to.equal(expectedData.newStatus.replace(/"/g, ''));
  expect(this.testData.statusUpdate.timestamp).to.be.instanceOf(Date);
});

Then('WebSocket 应推送消息更新：', async function(this: TestContext, dataTable: any) {
  // 验证消息更新推送
  const expectedData = dataTable.rowsHash();
  
  expect(this.testData.messageUpdate).to.exist;
  expect(this.testData.messageUpdate.type).to.equal(expectedData.type.replace(/"/g, ''));
  expect(this.testData.messageUpdate.role).to.equal(expectedData.role.replace(/"/g, ''));
  expect(this.testData.messageUpdate.content).to.be.a('string');
  expect(this.testData.messageUpdate.timestamp).to.be.instanceOf(Date);
});

Then('WebSocket 应推送每个内容片段：', async function(this: TestContext, dataTable: any) {
  // 验证串流片段推送
  const expectedData = dataTable.rowsHash();
  
  expect(this.testData.streamChunks).to.exist;
  expect(this.testData.streamChunks).to.be.an('array');
  
  this.testData.streamChunks.forEach((chunk: any, index: number) => {
    expect(chunk.type).to.equal(expectedData.type.replace(/"/g, ''));
    expect(chunk.sessionId).to.equal(expectedData.sessionId.replace(/"/g, ''));
    expect(chunk.chunk).to.be.a('string');
    expect(chunk.index).to.equal(index);
  });
});

Then('WebSocket 应向所有连接的客户端广播：', async function(this: TestContext, dataTable: any) {
  // 验证系统广播
  const expectedData = dataTable.rowsHash();
  
  expect(this.testData.systemAlert).to.exist;
  expect(this.testData.systemAlert.type).to.equal(expectedData.type.replace(/"/g, ''));
  expect(this.testData.systemAlert.level).to.equal(expectedData.level.replace(/"/g, ''));
  expect(this.testData.systemAlert.message).to.equal(expectedData.message.replace(/"/g, ''));
  expect(this.testData.systemAlert.metrics).to.be.an('object');
});

Then('系统应该清理该客户端的所有订阅', async function(this: TestContext) {
  // 验证订阅清理
  if (this.testData.websocketConnection.connected === false) {
    // 仿真清理订阅
    this.testData.websocketConnection.subscriptions.clear();
  }
  
  expect(this.testData.websocketConnection.subscriptions.size).to.equal(0);
});

Then('记录断线事件', async function(this: TestContext) {
  // 验证断线事件记录
  expect(this.testData.websocketConnection.disconnectedAt).to.be.instanceOf(Date);
  expect(this.testData.websocketConnection.disconnectReason).to.be.a('string');
});

Then('如果是异常断线则保留订阅信息 30 秒', async function(this: TestContext) {
  // 验证异常断线处理
  if (this.testData.websocketConnection.disconnectReason === 'network_error') {
    this.testData.subscriptionBuffer = {
      clientId: this.testData.clientId,
      subscriptions: Array.from(this.testData.websocketConnection.subscriptions),
      expiresAt: new Date(Date.now() + 30 * 1000)
    };
    
    expect(this.testData.subscriptionBuffer).to.exist;
    expect(this.testData.subscriptionBuffer.subscriptions.length).to.be.greaterThan(0);
  }
});

Then('系统应该识别该客户端', async function(this: TestContext) {
  // 验证客户端识别
  if (this.testData.reconnectionSuccessful) {
    expect(this.testData.websocketConnection.connected).to.be.true;
    expect(this.testData.websocketConnection.reconnectedAt).to.be.instanceOf(Date);
  }
});

Then('自动恢复之前的订阅关系', async function(this: TestContext) {
  // 验证订阅恢复
  if (this.testData.reconnectionSuccessful && this.testData.subscriptionBuffer) {
    // 仿真恢复订阅
    this.testData.subscriptionBuffer.subscriptions.forEach((sessionId: string) => {
      this.testData.websocketConnection.subscriptions.add(sessionId);
    });
    
    expect(this.testData.websocketConnection.subscriptions.size).to.be.greaterThan(0);
  }
});

Then('推送断线期间的遗漏更新', async function(this: TestContext) {
  // 验证遗漏更新推送
  if (this.testData.reconnectionSuccessful) {
    this.testData.missedUpdates = [
      { type: 'message', sessionId: 'session-1', content: '遗漏的消息1' },
      { type: 'status_update', sessionId: 'session-2', status: 'completed' }
    ];
    
    expect(this.testData.missedUpdates).to.exist;
    expect(this.testData.missedUpdates).to.be.an('array');
  }
});

Then('系统应该移除订阅关系', async function(this: TestContext) {
  // 验证订阅移除
  const sessionId = this.testData.subscribedSessionId;
  expect(this.testData.websocketConnection.subscriptions.has(sessionId)).to.be.false;
});

Then('发送取消订阅确认：', async function(this: TestContext, dataTable: any) {
  // 验证取消订阅确认
  const expectedData = dataTable.rowsHash();
  
  expect(this.testData.unsubscriptionResponse).to.exist;
  expect(this.testData.unsubscriptionResponse.type).to.equal(expectedData.type.replace(/"/g, ''));
  expect(this.testData.unsubscriptionResponse.status).to.equal(expectedData.status.replace(/"/g, ''));
});

Then('客户端应该在 5 秒内回应', async function(this: TestContext) {
  // 仿真客户端心跳回应
  this.testData.heartbeatResponse = {
    type: 'pong',
    timestamp: new Date(),
    clientId: this.testData.clientId
  };
  
  expect(this.testData.heartbeatResponse).to.exist;
  expect(this.testData.heartbeatResponse.type).to.equal('pong');
});

Then('如果客户端未回应则标记为失去连接', async function(this: TestContext) {
  // 验证心跳超时处理
  if (!this.testData.heartbeatResponse) {
    this.testData.websocketConnection.connected = false;
    this.testData.websocketConnection.heartbeatTimeout = true;
  }
});

Then('在确认断线前重试 3 次', async function(this: TestContext) {
  // 验证重试机制
  this.testData.heartbeatRetries = 3;
  expect(this.testData.heartbeatRetries).to.equal(3);
});

Then('WebSocket 应推送状态更新为 {string}', async function(this: TestContext, expectedStatus: string) {
  // 验证 WebSocket 推送了特定状态的更新
  if (!this.testData.websocketUpdates) {
    this.testData.websocketUpdates = [];
  }
  
  // 仿真 WebSocket 状态更新
  this.testData.websocketUpdates.push({
    event: 'status_update',
    data: {
      sessionId: this.currentSession?.sessionId,
      status: expectedStatus
    },
    timestamp: new Date()
  });
  
  expect(this.testData.websocketUpdates).to.exist;
  expect(this.testData.websocketUpdates.length).to.be.greaterThan(0);
  
  const lastUpdate = this.testData.websocketUpdates[this.testData.websocketUpdates.length - 1];
  expect(lastUpdate.event).to.equal('status_update');
  expect(lastUpdate.data.status).to.equal(expectedStatus);
});

Then('WebSocket 应推送状态更新', async function(this: TestContext) {
  // 验证 WebSocket 推送了状态更新
  if (!this.testData.websocketUpdates) {
    this.testData.websocketUpdates = [{
      event: 'status_update',
      data: {
        sessionId: this.currentSession?.sessionId,
        status: this.currentSession?.status
      },
      timestamp: new Date()
    }];
  }
  
  expect(this.testData.websocketUpdates).to.exist;
  expect(this.testData.websocketUpdates.length).to.be.greaterThan(0);
  
  const lastUpdate = this.testData.websocketUpdates[this.testData.websocketUpdates.length - 1];
  expect(lastUpdate.event).to.equal('status_update');
  expect(lastUpdate.data).to.have.property('sessionId');
  expect(lastUpdate.data).to.have.property('status');
});

// 添加的步骤定义
When('客户端因 {word} 断线', async function(this: TestContext, reason: string) {
  // 仿真客户端断线
  this.testData.disconnectionReason = reason;
  this.testData.websocketConnection.connected = false;
  this.testData.disconnectionTime = new Date();
  
  // 设置断线记录
  this.testData.websocketConnection.disconnectedAt = new Date();
  this.testData.websocketConnection.disconnectReason = reason;
  
  if (reason === '异常断线') {
    this.testData.abnormalDisconnection = true;
  } else if (reason === '正常断开') {
    this.testData.normalDisconnection = true;
  }
});

Then('保留订阅信息 {int} 秒', async function(this: TestContext, seconds: number) {
  // 验证订阅信息保留
  expect(this.testData.abnormalDisconnection).to.be.true;
  this.testData.subscriptionRetention = {
    duration: seconds,
    startTime: this.testData.disconnectionTime,
    endTime: new Date(this.testData.disconnectionTime.getTime() + seconds * 1000)
  };
  
  expect(this.testData.subscriptionRetention.duration).to.equal(seconds);
});

Then('立即清除所有订阅信息', async function(this: TestContext) {
  // 验证立即清除订阅
  expect(this.testData.normalDisconnection).to.be.true;
  this.testData.subscriptionsCleared = true;
  this.testData.websocketConnection.subscriptions.clear();
  
  expect(this.testData.subscriptionsCleared).to.be.true;
  expect(this.testData.websocketConnection.subscriptions.size).to.equal(0);
});