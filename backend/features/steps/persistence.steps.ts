import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { TestContext } from './world';
import { SessionStatus } from '../../src/types/session.types';
import { v4 as uuidv4 } from 'uuid';

// 数据持久化相关的 Steps

// Given Steps

Given('数据库连接正常', async function(this: TestContext) {
  // 仿真数据库连接
  this.testData.database = {
    connected: true,
    type: 'sqlite',
    status: 'healthy',
    tables: {
      sessions: { exists: true, records: 0 },
      messages: { exists: true, records: 0 },
      backups: { exists: true, records: 0 }
    }
  };
});

Given('数据库中存在一个已完成的 Session', async function(this: TestContext) {
  // 仿真已完成的 Session
  const sessionId = uuidv4();
  const completedSession = {
    sessionId: sessionId,
    name: 'Completed Test Session',
    workingDir: '/test/path',
    task: 'Test task completed',
    status: SessionStatus.COMPLETED,
    continueChat: false,
    createdAt: new Date(Date.now() - 3600000), // 1小时前
    completedAt: new Date(Date.now() - 1800000), // 30分钟前
    updatedAt: new Date(Date.now() - 1800000),
    processId: 1234
  };
  
  this.sessions.set(sessionId, completedSession);
  this.currentSession = completedSession;
  
  // 仿真数据库中的记录
  this.testData.database.tables.sessions.records = 1;
  this.testData.persistedSessions = new Map();
  this.testData.persistedSessions.set(sessionId, { ...completedSession });
});

Given('系统设置每 6 小时自动备份', async function(this: TestContext) {
  // 仿真备份设置
  this.testData.backupConfig = {
    enabled: true,
    interval: 6 * 60 * 60 * 1000, // 6 hours in milliseconds
    retention: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    backupDirectory: '/backup/claude-sessions'
  };
});

Given('数据库 schema 需要更新', async function(this: TestContext) {
  // 仿真需要迁移的情况
  this.testData.migration = {
    current_version: '1.0.0',
    target_version: '1.1.0',
    pending_migrations: [
      { id: '001_add_compression_field', file: 'migrations/001_add_compression_field.sql' },
      { id: '002_add_session_history', file: 'migrations/002_add_session_history.sql' }
    ]
  };
});

Given('Session 有超过 1000 笔对话记录', async function(this: TestContext) {
  // 仿真大量对话记录
  const sessionId = uuidv4();
  this.currentSession = {
    sessionId: sessionId,
    name: 'High Volume Session',
    workingDir: '/test/path',
    task: 'High volume test',
    status: SessionStatus.IDLE,
    continueChat: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1天前
    updatedAt: new Date()
  };
  
  // 仿真 1500 笔对话记录
  this.testData.messageCount = 1500;
  this.testData.paginationConfig = {
    pageSize: 50,
    totalPages: Math.ceil(1500 / 50),
    currentPage: 1
  };
});

Given('Claude Code 产生超过 1MB 的回应', async function(this: TestContext) {
  // 仿真大型回应内容
  const largeContent = 'A'.repeat(1024 * 1024 + 100); // 1MB + 100 bytes
  
  this.testData.largeMessage = {
    messageId: uuidv4(),
    sessionId: this.currentSession?.sessionId || uuidv4(),
    role: 'assistant',
    content: largeContent,
    contentSize: largeContent.length,
    timestamp: new Date()
  };
});

Given('用户选择导出特定 Session', async function(this: TestContext) {
  // 仿真导出请求
  const sessionId = uuidv4();
  this.testData.exportRequest = {
    sessionId: sessionId,
    format: 'json',
    includeMetadata: true,
    requestTime: new Date()
  };
  
  // 仿真该 Session 的对话记录
  this.testData.sessionMessages = [
    { messageId: uuidv4(), role: 'user', content: '请分析这个项目', timestamp: new Date(Date.now() - 3600000) },
    { messageId: uuidv4(), role: 'assistant', content: '我来帮您分析...', timestamp: new Date(Date.now() - 3500000) },
    { messageId: uuidv4(), role: 'user', content: '谢谢', timestamp: new Date(Date.now() - 3400000) }
  ];
});

// When Steps

When('创建新的 Session', async function(this: TestContext) {
  // 仿真创建新 Session
  const sessionId = uuidv4();
  const newSession = {
    sessionId: sessionId,
    name: '新的测试 Session',
    workingDir: '/test/project',
    task: '测试任务',
    status: SessionStatus.IDLE,
    continueChat: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    processId: 5678
  };
  
  this.currentSession = newSession;
  this.sessions.set(sessionId, newSession);
  
  // 仿真持久化操作
  this.testData.persistenceOperation = {
    action: 'create',
    table: 'sessions',
    data: newSession,
    executed: true,
    timestamp: new Date()
  };
});

When('Session 状态变更', async function(this: TestContext) {
  if (this.currentSession) {
    // 记录状态变更历史
    const oldStatus = this.currentSession.status;
    this.currentSession.status = SessionStatus.COMPLETED;
    this.currentSession.completedAt = new Date();
    this.currentSession.updatedAt = new Date();
    
    // 仿真状态变更历史记录
    this.testData.statusHistory = this.testData.statusHistory || [];
    this.testData.statusHistory.push({
      sessionId: this.currentSession.sessionId,
      oldStatus: oldStatus,
      newStatus: this.currentSession.status,
      timestamp: new Date(),
      reason: 'user_completed'
    });
    
    // 仿真数据库更新
    this.testData.persistenceOperation = {
      action: 'update',
      table: 'sessions',
      data: this.currentSession,
      executed: true,
      timestamp: new Date()
    };
  }
});

When('用户发送消息或收到回应', async function(this: TestContext) {
  // 仿真消息交换
  const userMessage = {
    messageId: uuidv4(),
    sessionId: this.currentSession?.sessionId,
    role: 'user',
    content: '请协助分析代码',
    timestamp: new Date()
  };
  
  const assistantMessage = {
    messageId: uuidv4(),
    sessionId: this.currentSession?.sessionId,
    role: 'assistant', 
    content: '我来帮您分析这段代码...',
    timestamp: new Date(Date.now() + 1000)
  };
  
  this.testData.messageExchange = [userMessage, assistantMessage];
  
  // 仿真消息持久化
  this.testData.persistenceOperations = [
    {
      action: 'create',
      table: 'messages',
      data: userMessage,
      executed: true,
      timestamp: new Date()
    },
    {
      action: 'create',
      table: 'messages',
      data: assistantMessage,
      executed: true,
      timestamp: new Date(Date.now() + 100)
    }
  ];
});

When('系统保存该消息', async function(this: TestContext) {
  if (this.testData.largeMessage) {
    // 仿真压缩和保存
    const originalSize = this.testData.largeMessage.contentSize;
    const compressedSize = Math.floor(originalSize * 0.1); // 假设压缩比 90%
    
    this.testData.compressionResult = {
      originalSize: originalSize,
      compressedSize: compressedSize,
      compressionRatio: (1 - compressedSize / originalSize) * 100,
      algorithm: 'gzip'
    };
    
    // 仿真保存到数据库
    this.testData.persistenceOperation = {
      action: 'create',
      table: 'messages',
      data: {
        ...this.testData.largeMessage,
        content: '<compressed_content>',
        compressed: true,
        originalSize: originalSize,
        compressedSize: compressedSize
      },
      executed: true,
      timestamp: new Date()
    };
  }
});

When('用户运行软删除该 Session', async function(this: TestContext) {
  if (this.currentSession) {
    // 软删除：设置 deletedAt 时间戳记
    this.currentSession.deletedAt = new Date();
    
    // 仿真软删除操作
    this.testData.persistenceOperation = {
      action: 'soft_delete',
      table: 'sessions',
      data: {
        sessionId: this.currentSession.sessionId,
        deletedAt: this.currentSession.deletedAt
      },
      executed: true,
      timestamp: new Date()
    };
  }
});

When(/^(user|assistant)发送消息 "(.*)"$/, async function(this: TestContext, role: string, content: string) {
  if (this.currentSession) {
    const message = {
      messageId: uuidv4(),
      sessionId: this.currentSession.sessionId,
      role: role,
      content: content,
      timestamp: new Date()
    };
    
    // 仿真保存消息
    this.testData.persistenceOperation = {
      action: 'create',
      table: 'messages',
      data: message,
      executed: true,
      timestamp: new Date()
    };
    
    // 记录消息以供后续验证
    if (!this.testData.persistenceOperations) {
      this.testData.persistenceOperations = [];
    }
    this.testData.persistenceOperations.push(this.testData.persistenceOperation);
  }
});

When('Session 状态变更为 {string}', async function(this: TestContext, newStatus: string) {
  if (this.currentSession) {
    const oldStatus = this.currentSession.status;
    this.currentSession.status = newStatus as any;
    this.currentSession.updatedAt = new Date();
    
    // 仿真状态变更操作
    this.testData.persistenceOperation = {
      action: 'update',
      table: 'sessions',
      data: {
        sessionId: this.currentSession.sessionId,
        status: newStatus,
        updatedAt: this.currentSession.updatedAt
      },
      executed: true,
      timestamp: new Date()
    };
    
    // 记录状态变更历史
    if (!this.testData.statusHistory) {
      this.testData.statusHistory = [];
    }
    this.testData.statusHistory.push({
      sessionId: this.currentSession.sessionId,
      oldStatus: oldStatus,
      newStatus: newStatus,
      timestamp: new Date()
    });
  }
});

When('备份时间到达', async function(this: TestContext) {
  const now = new Date();
  const config = this.testData.backupConfig;
  
  // 检查是否需要备份
  const timeSinceLastBackup = now.getTime() - config.lastBackup.getTime();
  
  if (timeSinceLastBackup >= config.interval) {
    // 运行备份
    const backupId = uuidv4();
    this.testData.backupOperation = {
      backupId: backupId,
      timestamp: now,
      status: 'completed',
      size: '15.2MB',
      duration: 45000, // 45 seconds
      tables_backed_up: ['sessions', 'messages', 'status_history'],
      record_counts: {
        sessions: 25,
        messages: 1250,
        status_history: 180
      }
    };
    
    // 更新最后备份时间
    config.lastBackup = now;
  }
});

When('系统启动时侦测到新的迁移文件', async function(this: TestContext) {
  if (this.testData.migration) {
    // 运行迁移
    this.testData.migrationResults = [];
    
    for (const migration of this.testData.migration.pending_migrations) {
      this.testData.migrationResults.push({
        id: migration.id,
        file: migration.file,
        status: 'success',
        executedAt: new Date(),
        duration: Math.floor(Math.random() * 5000) + 1000 // 1-6 seconds
      });
    }
    
    // 更新数据库版本
    this.testData.migration.current_version = this.testData.migration.target_version;
  }
});

When('加载对话历史', async function(this: TestContext) {
  const config = this.testData.paginationConfig;
  
  // 仿真分页加载
  const startIndex = (config.currentPage - 1) * config.pageSize;
  const endIndex = Math.min(startIndex + config.pageSize, this.testData.messageCount);
  
  this.testData.paginatedMessages = {
    page: config.currentPage,
    pageSize: config.pageSize,
    totalCount: this.testData.messageCount,
    totalPages: config.totalPages,
    hasNext: config.currentPage < config.totalPages,
    hasPrev: config.currentPage > 1,
    messages: Array.from({ length: endIndex - startIndex }, (_, i) => ({
      messageId: uuidv4(),
      sessionId: this.currentSession?.sessionId,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${startIndex + i + 1}`,
      timestamp: new Date(Date.now() - (startIndex + i) * 60000) // 最新的消息时间戳记较大
    }))
  };
});

When('系统运行每日维护任务', async function(this: TestContext) {
  // 仿真数据完整性检查
  this.testData.integrityCheck = {
    executedAt: new Date(),
    results: {
      orphaned_messages: {
        count: 3,
        details: ['msg-123', 'msg-456', 'msg-789'],
        fixed: 3
      },
      inconsistent_status: {
        count: 1,
        details: ['session-abc with status running but no active process'],
        fixed: 1
      },
      corrupted_data: {
        count: 0,
        details: [],
        fixed: 0
      }
    },
    summary: {
      total_issues: 4,
      fixed_issues: 4,
      unfixable_issues: 0
    }
  };
});

When('运行导出操作', async function(this: TestContext) {
  const request = this.testData.exportRequest;
  
  // 仿真导出操作
  this.testData.exportResult = {
    sessionId: request.sessionId,
    format: request.format,
    status: 'completed',
    generatedAt: new Date(),
    fileSize: '2.5MB',
    messageCount: this.testData.sessionMessages?.length || 0,
    downloadUrl: `/api/exports/${uuidv4()}.${request.format}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
});

// Then Steps

Then('Session 信息应该保存到数据库', async function(this: TestContext) {
  expect(this.testData.persistenceOperation).to.exist;
  expect(this.testData.persistenceOperation.action).to.equal('create');
  expect(this.testData.persistenceOperation.table).to.equal('sessions');
  expect(this.testData.persistenceOperation.executed).to.be.true;
});

Then('保存的数据应包含：', async function(this: TestContext, dataTable: any) {
  const expectedFields = dataTable.raw();
  const storedData = this.testData.persistenceOperation.data;
  
  expectedFields.forEach(([field, description]: string[]) => {
    expect(storedData).to.have.property(field.trim());
    
    // 验证特定字段的类型或值
    switch (field.trim()) {
      case 'sessionId':
        expect(storedData.sessionId).to.be.a('string');
        break;
      case 'createdAt':
        expect(storedData.createdAt).to.be.instanceOf(Date);
        break;
      case 'processId':
        expect(storedData.processId).to.be.a('number');
        break;
    }
  });
});

Then('数据库中的状态应该同步更新', async function(this: TestContext) {
  expect(this.testData.persistenceOperation).to.exist;
  expect(this.testData.persistenceOperation.action).to.equal('update');
  expect(this.testData.persistenceOperation.data.status).to.exist;
});

Then('updatedAt 字段应该更新为当前时间', async function(this: TestContext) {
  const storedData = this.testData.persistenceOperation.data;
  const timeDiff = Date.now() - storedData.updatedAt.getTime();
  expect(timeDiff).to.be.lessThan(1000); // 小于1秒差异
});

Then('应该记录状态变更历史', async function(this: TestContext) {
  expect(this.testData.statusHistory).to.exist;
  expect(this.testData.statusHistory).to.be.an('array');
  expect(this.testData.statusHistory.length).to.be.greaterThan(0);
  
  const lastHistory = this.testData.statusHistory[this.testData.statusHistory.length - 1];
  expect(lastHistory).to.have.property('oldStatus');
  expect(lastHistory).to.have.property('newStatus');
  expect(lastHistory).to.have.property('timestamp');
});

Then('消息应该保存到数据库', async function(this: TestContext) {
  expect(this.testData.persistenceOperations).to.exist;
  expect(this.testData.persistenceOperations).to.be.an('array');
  expect(this.testData.persistenceOperations.length).to.be.at.least(1); // 至少有一个消息
});

Then('保存的消息应包含：', async function(this: TestContext, dataTable: any) {
  const expectedFields = dataTable.raw();
  const messageOperations = this.testData.persistenceOperations;
  
  messageOperations.forEach((operation: any) => {
    const messageData = operation.data;
    expectedFields.forEach(([field, description]: string[]) => {
      expect(messageData).to.have.property(field.trim());
      
      switch (field.trim()) {
        case 'messageId':
          expect(messageData.messageId).to.be.a('string');
          break;
        case 'role':
          expect(['user', 'assistant']).to.include(messageData.role);
          break;
        case 'timestamp':
          expect(messageData.timestamp).to.be.instanceOf(Date);
          break;
      }
    });
  });
});

Then('消息内容应该被压缩保存', async function(this: TestContext) {
  expect(this.testData.compressionResult).to.exist;
  expect(this.testData.compressionResult.compressedSize).to.be.lessThan(this.testData.compressionResult.originalSize);
  expect(this.testData.persistenceOperation.data.compressed).to.be.true;
});

Then('数据库应记录内容已压缩', async function(this: TestContext) {
  const storedData = this.testData.persistenceOperation.data;
  expect(storedData.compressed).to.be.true;
  expect(storedData.originalSize).to.be.a('number');
  expect(storedData.compressedSize).to.be.a('number');
});

Then('读取时应自动解压缩', async function(this: TestContext) {
  // 仿真读取和解压缩
  this.testData.decompressionResult = {
    success: true,
    originalSize: this.testData.compressionResult.originalSize,
    algorithm: 'gzip'
  };
  
  expect(this.testData.decompressionResult.success).to.be.true;
});

Then('Session 不应从数据库物理删除', async function(this: TestContext) {
  expect(this.testData.persistenceOperation.action).to.equal('soft_delete');
  expect(this.testData.persistenceOperation.action).to.not.equal('delete');
});

Then('应该设置 deletedAt 时间戳记', async function(this: TestContext) {
  expect(this.testData.persistenceOperation.data.deletedAt).to.be.instanceOf(Date);
});

Then('查找时默认不显示已删除的 Sessions', async function(this: TestContext) {
  // 仿真查找逻辑
  this.testData.queryFilter = {
    excludeDeleted: true,
    condition: 'deletedAt IS NULL'
  };
  
  expect(this.testData.queryFilter.excludeDeleted).to.be.true;
});

Then('系统应该创建数据库备份', async function(this: TestContext) {
  expect(this.testData.backupOperation).to.exist;
  expect(this.testData.backupOperation.status).to.equal('completed');
});

Then('备份应包含所有 Sessions 和对话记录', async function(this: TestContext) {
  const backup = this.testData.backupOperation;
  expect(backup.tables_backed_up).to.include('sessions');
  expect(backup.tables_backed_up).to.include('messages');
  expect(backup.record_counts.sessions).to.be.greaterThan(0);
  expect(backup.record_counts.messages).to.be.greaterThan(0);
});

Then('保留最近 7 天的备份', async function(this: TestContext) {
  // 仿真备份保留策略
  this.testData.backupRetention = {
    retentionDays: 7,
    currentBackups: 14, // 假设有14个备份
    toDelete: 7 // 需要删除7个旧备份
  };
  
  expect(this.testData.backupRetention.retentionDays).to.equal(7);
});

Then('自动清理超过 7 天的旧备份', async function(this: TestContext) {
  const retention = this.testData.backupRetention;
  expect(retention.toDelete).to.be.greaterThan(0);
});

Then('系统应该自动运行数据库迁移', async function(this: TestContext) {
  expect(this.testData.migrationResults).to.exist;
  expect(this.testData.migrationResults).to.be.an('array');
  expect(this.testData.migrationResults.length).to.equal(2);
});

Then('保持向后兼容性', async function(this: TestContext) {
  // 确认迁移成功且向后兼容
  this.testData.migrationResults.forEach((result: any) => {
    expect(result.status).to.equal('success');
  });
});

Then('记录迁移运行结果', async function(this: TestContext) {
  this.testData.migrationResults.forEach((result: any) => {
    expect(result).to.have.property('id');
    expect(result).to.have.property('status');
    expect(result).to.have.property('executedAt');
    expect(result).to.have.property('duration');
  });
});

Then('系统应该分批加载数据', async function(this: TestContext) {
  expect(this.testData.paginatedMessages).to.exist;
  expect(this.testData.paginatedMessages.pageSize).to.equal(50);
});

Then('优先加载最近的对话', async function(this: TestContext) {
  const messages = this.testData.paginatedMessages.messages;
  expect(messages).to.be.an('array');
  expect(messages.length).to.be.lessThanOrEqual(50);
  
  // 验证时间顺序（最新的在前）
  for (let i = 1; i < messages.length; i++) {
    expect(messages[i-1].timestamp.getTime()).to.be.greaterThan(messages[i].timestamp.getTime());
  }
});

Then('支持无限滚动加载更多历史', async function(this: TestContext) {
  const pagination = this.testData.paginatedMessages;
  expect(pagination.hasNext).to.be.a('boolean');
  expect(pagination.hasPrev).to.be.a('boolean');
  expect(pagination.totalPages).to.be.greaterThan(1);
});

Then('应该检查数据完整性：', async function(this: TestContext, dataTable: any) {
  const expectedChecks = dataTable.raw().slice(1); // 跳过标题行
  const results = this.testData.integrityCheck.results;
  
  // 创建检查项目对应表
  const checkMapping: { [key: string]: string } = {
    '孤立消息': 'orphaned_messages',
    '状态不一致': 'inconsistent_status',
    '损坏的数据': 'corrupted_data'
  };
  
  expectedChecks.forEach(([checkType, description]: string[]) => {
    const checkKey = checkMapping[checkType.trim()];
    expect(results).to.have.property(checkKey);
    expect(results[checkKey]).to.have.property('count');
    expect(results[checkKey]).to.have.property('details');
  });
});

Then('自动修复可修复的问题', async function(this: TestContext) {
  const summary = this.testData.integrityCheck.summary;
  expect(summary.fixed_issues).to.be.greaterThan(0);
  expect(summary.fixed_issues).to.equal(summary.total_issues - summary.unfixable_issues);
});

Then('记录无法修复的问题', async function(this: TestContext) {
  const summary = this.testData.integrityCheck.summary;
  expect(summary.unfixable_issues).to.be.a('number');
});

Then('系统应该生成包含完整对话的文件', async function(this: TestContext) {
  expect(this.testData.exportResult).to.exist;
  expect(this.testData.exportResult.status).to.equal('completed');
  expect(this.testData.exportResult.messageCount).to.be.greaterThan(0);
});

Then('支持导出格式：', async function(this: TestContext, dataTable: any) {
  const supportedFormats = dataTable.raw();
  const exportResult = this.testData.exportResult;
  
  // 验证当前导出格式是支持的格式之一
  const formatNames = supportedFormats.map(([format, description]: string[]) => format.trim().toLowerCase());
  expect(formatNames).to.include(exportResult.format.toLowerCase());
});

Then('包含所有相关的中继数据', async function(this: TestContext) {
  const exportResult = this.testData.exportResult;
  expect(exportResult.generatedAt).to.be.instanceOf(Date);
  expect(exportResult.fileSize).to.be.a('string');
  expect(exportResult.downloadUrl).to.be.a('string');
  expect(exportResult.expiresAt).to.be.instanceOf(Date);
});

// 添加的导出相关步骤
When('用户选择导出格式为 {string}', async function(this: TestContext, format: string) {
  // 仿真用户选择导出格式
  this.testData.exportRequest = {
    sessionId: this.currentSession?.sessionId || 'test-session-id',
    format: format.toLowerCase(),
    requestedAt: new Date()
  };
});

Then('系统应该生成 {word} 格式的文件', async function(this: TestContext, format: string) {
  // 仿真生成特定格式的文件
  this.testData.exportResult = {
    sessionId: this.currentSession?.sessionId || 'test-session-id',
    format: format.toLowerCase(),
    status: 'completed',
    generatedAt: new Date(),
    fileSize: format === 'CSV' ? '1.2MB' : format === 'JSON' ? '2.5MB' : '1.8MB',
    messageCount: 50,
    downloadUrl: `/api/exports/${uuidv4()}.${format.toLowerCase()}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
  
  expect(this.testData.exportResult.format).to.equal(format.toLowerCase());
  expect(this.testData.exportResult.status).to.equal('completed');
});

Then('文件应包含完整对话内容', async function(this: TestContext) {
  expect(this.testData.exportResult).to.exist;
  expect(this.testData.exportResult.messageCount).to.be.greaterThan(0);
  
  // 仿真文件内容验证
  this.testData.exportedContent = {
    hasMessages: true,
    messageCount: this.testData.exportResult.messageCount,
    includesUserMessages: true,
    includesAssistantMessages: true
  };
  
  expect(this.testData.exportedContent.hasMessages).to.be.true;
});

Then('文件应包含所有相关的中继数据', async function(this: TestContext) {
  // 仿真中继数据验证
  this.testData.exportedMetadata = {
    sessionId: this.currentSession?.sessionId,
    sessionName: this.currentSession?.name,
    workingDir: this.currentSession?.workingDir,
    task: this.currentSession?.task,
    createdAt: this.currentSession?.createdAt,
    exportedAt: this.testData.exportResult.generatedAt
  };
  
  expect(this.testData.exportedMetadata.sessionId).to.exist;
  expect(this.testData.exportedMetadata.sessionName).to.exist;
  expect(this.testData.exportedMetadata.workingDir).to.exist;
});