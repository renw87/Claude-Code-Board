import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { TestContext } from './world';
import axios from 'axios';
import jwt from 'jsonwebtoken';

// 认证相关的步骤定义

When('用户使用正确的帐号密码登录：', async function(this: TestContext, dataTable: any) {
  const credentials = dataTable.rowsHash();
  
  try {
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: credentials.username,
      password: credentials.password
    });
    
    this.responseStatus = response.status;
    this.responseBody = response.data;
    
    // 保存 token 供后续测试使用
    if (response.data.token) {
      this.testData.authToken = response.data.token;
    }
  } catch (error: any) {
    this.responseStatus = error.response?.status || 500;
    this.responseBody = error.response?.data || {};
  }
});

When('用户尝试登录：', async function(this: TestContext, dataTable: any) {
  const credentials = dataTable.rowsHash();
  
  try {
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: credentials.username || '',
      password: credentials.password || ''
    });
    
    this.responseStatus = response.status;
    this.responseBody = response.data;
  } catch (error: any) {
    this.responseStatus = error.response?.status || 500;
    this.responseBody = error.response?.data || {};
  }
});

Given('用户已经成功登录并获得 token', async function(this: TestContext) {
  const response = await axios.post('http://localhost:3001/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  
  expect(response.status).to.equal(200);
  expect(response.data.token).to.exist;
  
  this.testData.authToken = response.data.token;
});

When('用户使用该 token 验证身份', async function(this: TestContext) {
  try {
    const response = await axios.get('http://localhost:3001/api/auth/verify', {
      headers: {
        Authorization: `Bearer ${this.testData.authToken}`
      }
    });
    
    this.responseStatus = response.status;
    this.responseBody = response.data;
  } catch (error: any) {
    this.responseStatus = error.response?.status || 500;
    this.responseBody = error.response?.data || {};
  }
});

When('用户使用无效的 token 验证身份', async function(this: TestContext) {
  try {
    const response = await axios.get('http://localhost:3001/api/auth/verify', {
      headers: {
        Authorization: 'Bearer invalid-token-12345'
      }
    });
    
    this.responseStatus = response.status;
    this.responseBody = response.data;
  } catch (error: any) {
    this.responseStatus = error.response?.status || 500;
    this.responseBody = error.response?.data || {};
  }
});

When('用户在没有 token 的情况下尝试验证身份', async function(this: TestContext) {
  try {
    const response = await axios.get('http://localhost:3001/api/auth/verify');
    
    this.responseStatus = response.status;
    this.responseBody = response.data;
  } catch (error: any) {
    this.responseStatus = error.response?.status || 500;
    this.responseBody = error.response?.data || {};
  }
});

Given('用户有一个有效的 token', async function(this: TestContext) {
  // 生成一个有效的 token
  const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-key';
  this.testData.authToken = jwt.sign(
    { username: 'admin', timestamp: Date.now() },
    jwtSecret,
    { expiresIn: '7d' }
  );
});

When('用户携带 token 访问受保护的 API', async function(this: TestContext) {
  // 测试一个受保护的端点（例如：获取所有 sessions）
  try {
    const response = await axios.get('http://localhost:3001/api/sessions', {
      headers: {
        Authorization: `Bearer ${this.testData.authToken}`
      }
    });
    
    this.responseStatus = response.status;
    this.responseBody = response.data;
    // 只有成功时才设置这个标记
    if (response.status === 200) {
      this.testData.protectedApiAccessed = true;
    }
  } catch (error: any) {
    console.log('Protected API error:', error.response?.status, error.response?.data);
    this.responseStatus = error.response?.status || 500;
    this.responseBody = error.response?.data || {};
    this.testData.protectedApiAccessed = false;
  }
});

When('用户在没有 token 的情况下访问受保护的 API', async function(this: TestContext) {
  try {
    const response = await axios.get('http://localhost:3001/api/sessions');
    
    this.responseStatus = response.status;
    this.responseBody = response.data;
  } catch (error: any) {
    this.responseStatus = error.response?.status || 500;
    this.responseBody = error.response?.data || {};
  }
});

Given('用户有一个已过期的 token', async function(this: TestContext) {
  // 生成一个已过期的 token
  const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-key';
  this.testData.authToken = jwt.sign(
    { username: 'admin', timestamp: Date.now() },
    jwtSecret,
    { expiresIn: '-1h' } // 已过期 1 小时
  );
});

When('用户携带过期 token 访问受保护的 API', async function(this: TestContext) {
  try {
    const response = await axios.get('http://localhost:3001/api/sessions', {
      headers: {
        Authorization: `Bearer ${this.testData.authToken}`
      }
    });
    
    this.responseStatus = response.status;
    this.responseBody = response.data;
  } catch (error: any) {
    this.responseStatus = error.response?.status || 500;
    this.responseBody = error.response?.data || {};
  }
});

// Then 步骤

Then('response 应包含 success 为 {word}', async function(this: TestContext, value: string) {
  const expectedValue = value === 'true';
  expect(this.responseBody.success).to.equal(expectedValue);
});

// Removed - using generic step from common.steps.ts instead

// Removed - using generic step from common.steps.ts instead

Then('response 应包含 message {string}', async function(this: TestContext, expectedMessage: string) {
  expect(this.responseBody.message).to.equal(expectedMessage);
});

Then('response 应包含 decoded 信息', async function(this: TestContext) {
  expect(this.responseBody.decoded).to.exist;
  expect(this.responseBody.decoded.username).to.exist;
  expect(this.responseBody.decoded.timestamp).to.exist;
});

Then('请求应该被允许通过', async function(this: TestContext) {
  expect(this.testData.protectedApiAccessed).to.be.true;
  // 如果是受保护的 API，成功的状态码应该是 200
  expect(this.responseStatus).to.be.lessThan(400);
});

Then('用户信息应该被附加到请求对象', async function(this: TestContext) {
  // 这个验证通常在中间件内部发生
  // 我们通过成功访问受保护的 API 来间接验证
  expect(this.testData.protectedApiAccessed).to.be.true;
});