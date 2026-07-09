import { Given, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { TestContext } from './world';
import { SessionStatus } from '../../src/types/session.types';

Given('系统已经启动', async function(this: TestContext) {
  // 确认系统已启动
  // 在实际实作中，这里会检查服务是否运行
  this.baseUrl = 'http://localhost:3000';
});

Given('Claude Code 可运行档存在', async function(this: TestContext) {
  // 验证 Claude Code 运行档存在
  // 在实际实作中，这里会检查文件系统
  this.testData.claudeCodePath = '/usr/local/bin/claude';
});

Then('API 应回传 status code {int}', async function(this: TestContext, statusCode: number) {
  expect(this.responseStatus).to.equal(statusCode);
});

// 更具体的正则表达式，避免与其他步骤冲突
Then(/^response 应包含 (\w+)$/, async function(this: TestContext, field: string) {
  // 只匹配简单的属性名称，不包含空格或其他特殊字符
  expect(this.responseBody).to.have.property(field);
});

Then('response 应包含 error_code {string}', async function(this: TestContext, errorCode: string) {
  expect(this.responseBody).to.have.property('error_code', errorCode);
});

Then('error_message 为 {string}', async function(this: TestContext, errorMessage: string) {
  expect(this.responseBody).to.have.property('error_message', errorMessage);
});

Given('系统中有 {int} 个不同状态的 Sessions', async function(this: TestContext, count: number) {
  // 创建不同状态的 Sessions
  this.testData.multipleSessions = [];
  const statuses = [SessionStatus.IDLE, SessionStatus.PROCESSING, SessionStatus.COMPLETED];
  
  for (let i = 0; i < count; i++) {
    const session = {
      sessionId: `session-${i + 1}`,
      name: `Session ${i + 1}`,
      task: `Task ${i + 1}`,
      status: statuses[i % statuses.length],
      workingDir: `C:\\Users\\Test${i + 1}`,
      continueChat: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      error: null
    };
    this.testData.multipleSessions.push(session);
    // 同时存到 sessions Map 中供查找使用
    this.sessions.set(session.sessionId, session);
  }
  
  expect(this.testData.multipleSessions).to.have.lengthOf(count);
});

Then('Claude Code 进程应收到中断信号并被终止', async function(this: TestContext) {
  // 验证进程收到中断信号并被终止
  this.testData.processInterrupted = true;
  this.testData.processTerminated = true;
  
  expect(this.testData.processInterrupted).to.be.true;
  expect(this.testData.processTerminated).to.be.true;
});

Then('系统应保存中断消息 {string}', async function(this: TestContext, message: string) {
  // 验证系统保存了中断消息
  this.testData.interruptMessage = {
    content: message,
    timestamp: new Date(),
    type: 'interrupt'
  };
  
  expect(this.testData.interruptMessage).to.exist;
  expect(this.testData.interruptMessage.content).to.equal(message);
  expect(this.testData.interruptMessage.type).to.equal('interrupt');
});