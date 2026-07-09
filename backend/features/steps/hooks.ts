import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { TestContext } from './world';
import { Database } from '../../src/database/database';

// 全域设置
BeforeAll(async function() {
  console.log('Starting test suite...');
  
  // 初始化测试数据库
  const db = Database.getInstance();
  await db.initialize();
  console.log('Test database initialized');
});

AfterAll(async function() {
  console.log('Test suite completed.');
  
  // 关闭数据库连接
  const db = Database.getInstance();
  await db.close();
  console.log('Test database closed');
});

// 每个 Scenario 前的设置
Before(async function(this: TestContext) {
  await this.cleanup();
  
  // 清理测试数据库数据
  const db = Database.getInstance();
  await db.run('DELETE FROM messages');
  await db.run('DELETE FROM session_status_history');
  await db.run('DELETE FROM sessions');
});

// 每个 Scenario 后的清理
After(async function(this: TestContext) {
  // 清理测试产生的数据
  for (const [sessionId, session] of this.sessions) {
    // 这里会清理实际的进程等资源
    console.log(`Cleaning up session: ${sessionId}`);
  }
  
  await this.cleanup();
});