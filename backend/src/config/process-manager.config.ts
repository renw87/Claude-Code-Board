import { getEnvConfig } from './env.config';

export interface ProcessManagerConfig {
  /**
   * 是否激活性能优化
   */
  enableOptimizations: boolean;
  
  /**
   * 进程启动延迟（毫秒）
   * 某些系统可能需要更长的启动时间
   */
  startupDelay: number;
  
  /**
   * 消息处理超时（毫秒）
   * 如果 Claude 在此时间内没有回应，视为超时
   */
  messageTimeout: number;
}

// 默认配置
export const defaultProcessManagerConfig: ProcessManagerConfig = {
  enableOptimizations: getEnvConfig().process.enableOptimizations,
  startupDelay: getEnvConfig().process.startupDelay,
  messageTimeout: getEnvConfig().process.messageTimeout
};

// 根据环境选择最佳配置
export function getOptimalConfig(): ProcessManagerConfig {
  // Windows 用户可能需要更长的启动时间
  if (process.platform === 'win32') {
    return {
      ...defaultProcessManagerConfig,
      startupDelay: 1000,
      messageTimeout: 180000 // Windows 给予 3 分钟
    };
  }
  
  return defaultProcessManagerConfig;
}