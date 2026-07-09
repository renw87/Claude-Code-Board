import { When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { TestContext } from './world';
import { SessionService } from '../../src/services/SessionService';
import { ProcessManager } from '../../src/services/ProcessManager';
import { CreateSessionRequest, SessionStatus } from '../../src/types/session.types';

// Mock ProcessManager for testing
class MockProcessManager extends ProcessManager {
  private testContext: TestContext;
  
  constructor(context: TestContext) {
    super();
    this.testContext = context;
  }
  
  async startClaudeProcess(session: any): Promise<number> {
    const mockPid = Math.floor(Math.random() * 10000) + 1000;
    this.testContext.mockProcesses.set(mockPid.toString(), {
      sessionId: session.sessionId,
      pid: mockPid,
      status: 'processing'
    });
    return mockPid;
  }
}

// 注入服务 (在实际实作中会使用依赖注入)
let sessionService: SessionService;

When('用户创建新 Session，设置如下：', async function(this: TestContext, dataTable: any) {
  const data = dataTable.rowsHash();
  
  const request: CreateSessionRequest = {
    name: data['name'],
    workingDir: data['workingDir'],
    task: data['task'],
    continueChat: data['continueChat'] === 'true',
    previousSessionId: data['previousSessionId'],
    dangerouslySkipPermissions: data['dangerouslySkipPermissions'] === 'true'
  };
  
  try {
    // 调用服务层
    if (!sessionService) {
      sessionService = new SessionService();
      // 注入 Mock ProcessManager
      (sessionService as any).processManager = new MockProcessManager(this);
    }
    
    const result = await sessionService.createSession(request);
    
    this.responseStatus = 201;
    this.responseBody = result;
    this.currentSession = result;
    this.sessions.set(result.sessionId, result);
  } catch (error: any) {
    this.responseStatus = error.statusCode || 500;
    this.responseBody = {
      error_code: error.code || 'INTERNAL_ERROR',
      error_message: error.message
    };
  }
});

Then('response 应包含 status {string}', async function(this: TestContext, status: string) {
  expect(this.responseBody).to.have.property('status', status);
});

Then('response 应包含 dangerouslySkipPermissions {string}', async function(this: TestContext, value: string) {
  const expectedValue = value === 'true';
  expect(this.responseBody).to.have.property('dangerouslySkipPermissions', expectedValue);
});

Then('系统应该启动一个新的 Claude Code 进程', async function(this: TestContext) {
  // 验证进程已启动
  expect(this.currentSession).to.exist;
  expect(this.currentSession?.processId).to.be.a('number');
  expect(this.currentSession?.processId).to.be.greaterThan(0);
  
  // 验证进程存在于仿真进程列表中
  const processId = this.currentSession?.processId;
  if (processId) {
    expect(this.mockProcesses.has(processId.toString())).to.be.true;
  }
});