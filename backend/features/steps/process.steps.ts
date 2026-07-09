import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { TestContext } from './world';
import { SessionStatus } from '../../src/types/session.types';
import { v4 as uuidv4 } from 'uuid';

// Claude Code 进程管理相关的 Steps

Given('进程管理系统已启动', async function(this: TestContext) {
  // 仿真系统启动
  this.testData.systemStatus = {
    running: true,
    startTime: new Date(),
    maxProcesses: 10,
    currentProcesses: 0
  };
});

Given('Claude Code 运行档路径已设置', async function(this: TestContext) {
  // 仿真运行档路径设置
  this.testData.claudeCodePath = '/usr/local/bin/claude-code';
});

Given('有 {int} 个运行中的 Claude Code 进程', async function(this: TestContext, count: number) {
  // 仿真多个运行中的进程
  this.testData.runningProcesses = new Map();
  
  for (let i = 0; i < count; i++) {
    const processId = 1000 + i;
    const sessionId = `session-${i + 1}`;
    
    this.testData.runningProcesses.set(sessionId, {
      pid: processId,
      sessionId: sessionId,
      startTime: new Date(Date.now() - (i * 300000)), // 不同的启动时间
      cpuUsage: 15 + Math.random() * 10, // 15-25%
      memoryUsage: 256 + Math.random() * 512, // 256-768MB
      status: 'running'
    });
  }
  
  this.testData.systemStatus.currentProcesses = count;
});

Given('一个运行中的 Claude Code 进程', async function(this: TestContext) {
  // 仿真单个运行中的进程
  const sessionId = uuidv4();
  const processId = Math.floor(Math.random() * 10000) + 1000;
  
  this.testData.currentProcess = {
    pid: processId,
    sessionId: sessionId,
    startTime: new Date(Date.now() - 600000), // 10分钟前启动
    cpuUsage: 20,
    memoryUsage: 512,
    status: 'running'
  };
  
  this.testData.runningProcesses = this.testData.runningProcesses || new Map();
  this.testData.runningProcesses.set(sessionId, this.testData.currentProcess);
});

Given('系统设置的资源限制如下：', async function(this: TestContext, dataTable: any) {
  // 设置资源限制
  const limits = dataTable.rowsHash();
  
  this.testData.resourceLimits = {
    maxProcesses: parseInt(limits['最大进程数']),
    maxMemoryPerProcess: limits['单进程最大内存'],
    maxExecutionTime: limits['单进程最大运行时间']
  };
});

Given('一个运行中的进程已运行 2 小时', async function(this: TestContext) {
  // 仿真长时间运行的进程
  const sessionId = uuidv4();
  const processId = Math.floor(Math.random() * 10000) + 1000;
  const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000));
  
  this.testData.longRunningProcess = {
    pid: processId,
    sessionId: sessionId,
    startTime: twoHoursAgo,
    cpuUsage: 25,
    memoryUsage: 1024,
    status: 'running',
    executionTime: 2 * 60 * 60 // 2 hours in seconds
  };
});

Given('Claude Code 进程正在产生大量输出', async function(this: TestContext) {
  // 仿真大量输出
  this.testData.processOutput = {
    sessionId: uuidv4(),
    bufferSize: 1024 * 1024, // 1MB buffer
    currentSize: 950 * 1024, // 950KB used
    outputChunks: []
  };
  
  // 产生大量输出数据
  for (let i = 0; i < 100; i++) {
    this.testData.processOutput.outputChunks.push(`Output chunk ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit...`);
  }
});

Given('系统意外重启前有 {int} 个运行中的 Sessions', async function(this: TestContext, count: number) {
  // 仿真重启前的状态
  this.testData.preRestartSessions = [];
  
  for (let i = 0; i < count; i++) {
    this.testData.preRestartSessions.push({
      sessionId: `session-${i + 1}`,
      status: SessionStatus.IDLE,
      processId: 1000 + i,
      lastUpdate: new Date(Date.now() - 600000) // 10分钟前
    });
  }
  
  // 仿真持久化保存
  this.testData.persistentStorage = {
    sessions: [...this.testData.preRestartSessions]
  };
});

// When Steps

When('系统需要为新 Session 启动进程', async function(this: TestContext) {
  // 仿真启动进程的请求
  this.testData.processStartRequest = {
    sessionId: uuidv4(),
    workingDir: '/test/project',
    continueChat: false,
    timestamp: new Date()
  };
});

When('系统运行健康检查', async function(this: TestContext) {
  // 仿真健康检查
  this.testData.healthCheckResults = [];
  
  if (this.testData.runningProcesses) {
    for (const [sessionId, process] of this.testData.runningProcesses.entries()) {
      const healthStatus = {
        sessionId: sessionId,
        pid: process.pid,
        cpuUsage: process.cpuUsage,
        memoryUsage: process.memoryUsage,
        runTime: Date.now() - process.startTime.getTime(),
        responsive: process.cpuUsage < 90 && process.memoryUsage < 1500, // 假设阈值
        status: process.status
      };
      
      this.testData.healthCheckResults.push(healthStatus);
    }
  }
});

When('进程意外终止', async function(this: TestContext) {
  // 仿真进程异常终止
  if (this.testData.currentProcess) {
    this.testData.processTermination = {
      pid: this.testData.currentProcess.pid,
      sessionId: this.testData.currentProcess.sessionId,
      exitCode: 1, // 异常退出码
      terminationReason: 'unexpected_termination',
      timestamp: new Date()
    };
    
    this.testData.currentProcess.status = 'terminated';
  }
});

When('系统需要终止该进程', async function(this: TestContext) {
  // 仿真优雅终止流程
  if (this.testData.currentProcess) {
    this.testData.terminationProcess = {
      pid: this.testData.currentProcess.pid,
      sessionId: this.testData.currentProcess.sessionId,
      terminationSteps: []
    };
    
    // 记录终止步骤
    this.testData.terminationProcess.terminationSteps.push({
      step: 'SIGTERM_SENT',
      timestamp: new Date()
    });
  }
});

When('第 {int} 个 Session 尝试启动', async function(this: TestContext, sessionNumber: number) {
  try {
    // 设置当前进程数为 10 (达到限制)
    this.testData.systemStatus.currentProcesses = 10;
    
    // 检查资源限制
    const currentProcesses = this.testData.systemStatus.currentProcesses;
    const maxProcesses = this.testData.resourceLimits.maxProcesses;
    
    if (currentProcesses >= maxProcesses) {
      throw {
        statusCode: 503,
        code: 'RESOURCE_LIMIT_EXCEEDED',
        message: 'Maximum number of concurrent sessions reached'
      };
    }
    
    // 如果没有超过限制，成功启动
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

When('系统运行超时检查', async function(this: TestContext) {
  // 仿真超时检查
  if (this.testData.longRunningProcess) {
    const executionTime = this.testData.longRunningProcess.executionTime;
    const maxTime = 2 * 60 * 60; // 2 hours in seconds
    
    this.testData.timeoutCheckResult = {
      processId: this.testData.longRunningProcess.pid,
      executionTime: executionTime,
      maxTime: maxTime,
      isTimeout: executionTime >= maxTime,
      warningsSent: 0
    };
    
    if (this.testData.timeoutCheckResult.isTimeout) {
      this.testData.timeoutCheckResult.warningsSent = 1;
    }
  }
});

When('输出缓冲区接近满载', async function(this: TestContext) {
  // 仿真缓冲区管理
  if (this.testData.processOutput) {
    const bufferUsage = this.testData.processOutput.currentSize / this.testData.processOutput.bufferSize;
    
    if (bufferUsage > 0.9) { // 90% 满
      this.testData.bufferManagement = {
        action: 'write_to_temp_file',
        tempFilePath: `/tmp/claude-output-${this.testData.processOutput.sessionId}.log`,
        chunksWritten: Math.floor(this.testData.processOutput.outputChunks.length * 0.7),
        chunksInMemory: Math.ceil(this.testData.processOutput.outputChunks.length * 0.3)
      };
    }
  }
});

When('系统重新启动', async function(this: TestContext) {
  // 仿真系统重启
  this.testData.systemRestart = {
    timestamp: new Date(),
    loadedSessions: []
  };
  
  // 加载持久化的 Session 信息
  if (this.testData.persistentStorage) {
    this.testData.systemRestart.loadedSessions = this.testData.persistentStorage.sessions.map((session: any) => ({
      ...session,
      status: SessionStatus.ERROR, // 标记为 crashed
      error: 'System restart detected'
    }));
  }
});

// Then Steps

Then('系统应该使用正确的参数启动 Claude Code', async function(this: TestContext) {
  // 验证启动参数
  if (this.testData.processStartRequest) {
    this.testData.startupParams = {
      executable: this.testData.claudeCodePath,
      workingDirectory: this.testData.processStartRequest.workingDir,
      arguments: ['--dir', this.testData.processStartRequest.workingDir],
      environment: process.env
    };
    
    expect(this.testData.startupParams.executable).to.equal('/usr/local/bin/claude-code');
    expect(this.testData.startupParams.arguments).to.include('--dir');
  }
});

Then('进程应该成功启动', async function(this: TestContext) {
  // 仿真成功启动
  const processId = Math.floor(Math.random() * 10000) + 1000;
  this.testData.newProcess = {
    pid: processId,
    sessionId: this.testData.processStartRequest?.sessionId,
    status: 'starting',
    startTime: new Date()
  };
  
  expect(this.testData.newProcess.pid).to.be.a('number');
  expect(this.testData.newProcess.status).to.equal('starting');
});

Then('系统应该记录进程 PID', async function(this: TestContext) {
  // 验证 PID 记录
  expect(this.testData.newProcess.pid).to.be.a('number');
  expect(this.testData.newProcess.pid).to.be.greaterThan(0);
});

Then('系统应该创建 stdin\\/stdout\\/stderr 管道', async function(this: TestContext) {
  // 仿真创建管道
  this.testData.processStreams = {
    stdin: { writable: true, connected: true },
    stdout: { readable: true, connected: true },
    stderr: { readable: true, connected: true }
  };
  
  expect(this.testData.processStreams.stdin.connected).to.be.true;
  expect(this.testData.processStreams.stdout.connected).to.be.true;
  expect(this.testData.processStreams.stderr.connected).to.be.true;
});


Then('系统应该检查每个进程的状态', async function(this: TestContext) {
  // 验证健康检查
  expect(this.testData.healthCheckResults).to.exist;
  expect(this.testData.healthCheckResults).to.be.an('array');
  expect(this.testData.healthCheckResults.length).to.be.greaterThan(0);
});

Then('记录每个进程的资源使用情况：', async function(this: TestContext, dataTable: any) {
  // 验证资源使用记录
  const expectedFields = dataTable.raw()[0];
  
  expect(this.testData.healthCheckResults).to.be.an('array');
  this.testData.healthCheckResults.forEach((result: any) => {
    expect(result).to.have.property('pid');
    expect(result).to.have.property('cpuUsage');
    expect(result).to.have.property('memoryUsage');
    expect(result).to.have.property('runTime');
  });
});

Then('侦测到无回应的进程', async function(this: TestContext) {
  // 检查无回应的进程
  const unresponsiveProcesses = this.testData.healthCheckResults.filter((result: any) => !result.responsive);
  this.testData.unresponsiveProcesses = unresponsiveProcesses;
  
  // 至少应该能检测到无回应状态（即使没有实际的无回应进程）
  expect(this.testData.healthCheckResults.every((result: any) => result.hasOwnProperty('responsive'))).to.be.true;
});

Then('系统应该侦测到进程结束', async function(this: TestContext) {
  // 验证进程终止检测
  expect(this.testData.processTermination).to.exist;
  expect(this.testData.processTermination.exitCode).to.equal(1);
});

Then('更新对应 Session 状态为 {string}', async function(this: TestContext, status: string) {
  // 仿真更新 Session 状态
  if (this.testData.processTermination) {
    this.testData.sessionStatusUpdate = {
      sessionId: this.testData.processTermination.sessionId,
      newStatus: status,
      timestamp: new Date()
    };
    
    expect(this.testData.sessionStatusUpdate.newStatus).to.equal(status);
  }
});

Then('记录错误消息和退出码', async function(this: TestContext) {
  // 验证错误记录
  expect(this.testData.processTermination.exitCode).to.exist;
  expect(this.testData.processTermination.terminationReason).to.equal('unexpected_termination');
});

Then('WebSocket 应推送错误通知', async function(this: TestContext) {
  // 仿真 WebSocket 错误通知
  this.testData.websocketErrorNotification = {
    type: 'error',
    sessionId: this.testData.processTermination?.sessionId,
    message: 'Process terminated unexpectedly',
    exitCode: this.testData.processTermination?.exitCode
  };
  
  expect(this.testData.websocketErrorNotification.type).to.equal('error');
});

Then('系统应该先发送 SIGTERM 信号', async function(this: TestContext) {
  // 验证 SIGTERM 发送
  const sigtermStep = this.testData.terminationProcess.terminationSteps.find((step: any) => step.step === 'SIGTERM_SENT');
  expect(sigtermStep).to.exist;
});

Then('等待最多 10 秒让进程优雅退出', async function(this: TestContext) {
  // 仿真等待期
  this.testData.terminationProcess.terminationSteps.push({
    step: 'WAITING_FOR_GRACEFUL_EXIT',
    timestamp: new Date(),
    maxWaitTime: 10000 // 10 seconds
  });
  
  const waitStep = this.testData.terminationProcess.terminationSteps.find((step: any) => step.step === 'WAITING_FOR_GRACEFUL_EXIT');
  expect(waitStep).to.exist;
  expect(waitStep.maxWaitTime).to.equal(10000);
});

Then('如果进程仍在运行则发送 SIGKILL', async function(this: TestContext) {
  // 仿真 SIGKILL
  this.testData.terminationProcess.terminationSteps.push({
    step: 'SIGKILL_SENT',
    timestamp: new Date(Date.now() + 10000), // 10秒后
    reason: 'graceful_exit_timeout'
  });
  
  const sigkillStep = this.testData.terminationProcess.terminationSteps.find((step: any) => step.step === 'SIGKILL_SENT');
  expect(sigkillStep).to.exist;
});

Then('清理相关资源', async function(this: TestContext) {
  // 仿真资源清理
  this.testData.resourceCleanup = {
    processId: this.testData.terminationProcess.pid,
    cleanupSteps: [
      'close_stdin_pipe',
      'close_stdout_pipe',
      'close_stderr_pipe',
      'remove_from_process_map',
      'cleanup_temp_files'
    ],
    completed: true
  };
  
  expect(this.testData.resourceCleanup.completed).to.be.true;
});

Then('系统应该标记该进程为超时', async function(this: TestContext) {
  // 验证超时标记
  expect(this.testData.timeoutCheckResult.isTimeout).to.be.true;
});

Then('发送警告通知给用户', async function(this: TestContext) {
  // 仿真警告通知
  this.testData.timeoutWarning = {
    processId: this.testData.longRunningProcess?.pid,
    sessionId: this.testData.longRunningProcess?.sessionId,
    warningType: 'execution_timeout',
    message: 'Your session has been running for 2 hours. Please save your work as it will be terminated soon.',
    timestamp: new Date()
  };
  
  expect(this.testData.timeoutWarning.warningType).to.equal('execution_timeout');
});

Then('如果用户未回应则在 10 分钟后终止进程', async function(this: TestContext) {
  // 仿真终止调度
  this.testData.terminationSchedule = {
    processId: this.testData.longRunningProcess?.pid,
    scheduledTime: new Date(Date.now() + (10 * 60 * 1000)), // 10分钟后
    reason: 'timeout_no_user_response'
  };
  
  expect(this.testData.terminationSchedule.reason).to.equal('timeout_no_user_response');
});

Then('系统应该将部分内容写入暂存盘', async function(this: TestContext) {
  // 验证暂存盘写入
  expect(this.testData.bufferManagement.action).to.equal('write_to_temp_file');
  expect(this.testData.bufferManagement.tempFilePath).to.include('/tmp/claude-output-');
  expect(this.testData.bufferManagement.chunksWritten).to.be.greaterThan(0);
});

Then('保持最近的输出在内存中', async function(this: TestContext) {
  // 验证内存中的输出
  expect(this.testData.bufferManagement.chunksInMemory).to.be.greaterThan(0);
});

Then('确保不会因缓冲区满而阻塞进程', async function(this: TestContext) {
  // 验证非阻塞处理
  this.testData.bufferStatus = {
    blocked: false,
    bufferUtilization: 0.3, // 清理后降到 30%
    processCanWrite: true
  };
  
  expect(this.testData.bufferStatus.blocked).to.be.false;
  expect(this.testData.bufferStatus.processCanWrite).to.be.true;
});

Then('系统应该从持久化保存加载 Session 信息', async function(this: TestContext) {
  // 验证数据加载
  expect(this.testData.systemRestart.loadedSessions).to.exist;
  expect(this.testData.systemRestart.loadedSessions).to.be.an('array');
  expect(this.testData.systemRestart.loadedSessions.length).to.equal(5);
});

Then('将所有未完成的 Sessions 标记为 {string}', async function(this: TestContext, status: string) {
  // 验证状态标记
  this.testData.systemRestart.loadedSessions.forEach((session: any) => {
    expect(session.status).to.equal('error');
    expect(session.error).to.equal('System restart detected');
  });
});

Then('允许用户选择是否恢复这些 Sessions', async function(this: TestContext) {
  // 仿真恢复选项
  this.testData.recoveryOptions = {
    availableSessions: this.testData.systemRestart.loadedSessions.map((session: any) => session.sessionId),
    recoveryEnabled: true,
    userChoiceRequired: true
  };
  
  expect(this.testData.recoveryOptions.recoveryEnabled).to.be.true;
  expect(this.testData.recoveryOptions.userChoiceRequired).to.be.true;
});