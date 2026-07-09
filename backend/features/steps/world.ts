import { World, setWorldConstructor } from '@cucumber/cucumber';
import { Session, SessionStatus } from '../../src/types/session.types';

export interface TestContext extends World {
  // API 相关
  baseUrl: string;
  response?: any;
  responseStatus?: number;
  responseBody?: any;
  responseHeaders?: any;
  requestOptions?: any;
  
  // Session 相关
  currentSession?: Session;
  sessions: Map<string, Session>;
  
  // Process 相关
  mockProcesses: Map<string, any>;
  
  // 测试数据
  testData: any;
  
  // 断言工具
  assert: any;
  
  // 方法
  cleanup(): Promise<void>;
  makeRequest(method: string, path: string, data?: any): Promise<any>;
  redactSensitiveInfo(content: string): string;
}

class CustomWorld extends World implements TestContext {
  baseUrl: string = 'http://localhost:3000';
  response?: any;
  responseStatus?: number;
  responseBody?: any;
  responseHeaders?: any;
  requestOptions: any = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  currentSession?: Session;
  sessions: Map<string, Session> = new Map();
  
  mockProcesses: Map<string, any> = new Map();
  
  testData: any = {};
  
  assert = require('assert');
  
  constructor(options: any) {
    super(options);
  }
  
  // 清理函数
  async cleanup() {
    this.sessions.clear();
    this.mockProcesses.clear();
    this.testData = {};
    this.currentSession = undefined;
    this.response = undefined;
    this.responseStatus = undefined;
    this.responseBody = undefined;
    this.responseHeaders = undefined;
    this.requestOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  async makeRequest(method: string, path: string, data?: any): Promise<any> {
    // 仿真 HTTP 请求
    // 在实际测试中，这里会使用真正的 HTTP 客户端如 axios
    return {
      status: 200,
      data: data || {},
      headers: {}
    };
  }

  redactSensitiveInfo(content: string): string {
    const sensitivePatterns = [
      /\b[A-Za-z0-9]{32,}\b/g,  // API 密钥模式
      /password\s*[:=]\s*["']?([^"'\s]+)["']?/gi,
      /token\s*[:=]\s*["']?([^"'\s]+)["']?/gi,
      /api_key\s*[:=]\s*["']?([^"'\s]+)["']?/gi,
      /secret\s*[:=]\s*["']?([^"'\s]+)["']?/gi
    ];

    let redacted = content;
    sensitivePatterns.forEach(pattern => {
      redacted = redacted.replace(pattern, '[REDACTED]');
    });

    return redacted;
  }
}

setWorldConstructor(CustomWorld);