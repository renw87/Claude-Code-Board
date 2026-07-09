/**
 * 统一处理器配置
 * 
 * 用于解决 Claude Code stream JSON 重复保存问题
 */

import { getEnvConfig } from './env.config';

export interface UnifiedProcessorConfig {
  // 是否激活统一处理器
  enabled: boolean;
  
  // 消息去重配置
  deduplication: {
    // 是否使用 message ID 去重
    useMessageId: boolean;
    // 保留的已处理消息 ID 数量
    maxProcessedIds: number;
    // 内容比对去重的时间窗口（毫秒）
    contentDedupeWindow: number;
  };
  
  // 消息过滤配置
  filtering: {
    // 忽略的消息类型
    ignoreTypes: string[];
    // 是否忽略空白消息
    ignoreEmpty: boolean;
  };
  
  // 缓冲配置
  buffering: {
    // 最大缓冲消息数量
    maxBufferSize: number;
    // 缓冲超时时间（毫秒）
    bufferTimeout: number;
  };
  
  // 性能配置
  performance: {
    // 是否并行处理工具使用
    parallelToolProcessing: boolean;
    // 是否激活批量保存
    batchSave: boolean;
    // 批量大小
    batchSize: number;
  };
  
  // 兼容性配置
  compatibility: {
    // 是否激活旧版串流处理器后备
    enableStreamFallback: boolean;
    // 是否激活批量处理后备
    enableBatchFallback: boolean;
  };
  
  // 调试配置
  debug: {
    // 是否记录详细日志
    verbose: boolean;
    // 是否记录消息 ID
    logMessageIds: boolean;
    // 是否记录重复检测
    logDuplicates: boolean;
  };
}

/**
 * 默认配置
 */
export const defaultUnifiedProcessorConfig: UnifiedProcessorConfig = {
  enabled: true,
  
  deduplication: {
    useMessageId: true,
    maxProcessedIds: 1000,
    contentDedupeWindow: 2000 // 2秒
  },
  
  filtering: {
    ignoreTypes: ['result', 'echo'], // 学习 vibe-kanban
    ignoreEmpty: true
  },
  
  buffering: {
    maxBufferSize: 100,
    bufferTimeout: 5000 // 5秒
  },
  
  performance: {
    parallelToolProcessing: true,
    batchSave: false, // 先保持单一保存，确保稳定性
    batchSize: 10
  },
  
  compatibility: {
    enableStreamFallback: true,
    enableBatchFallback: true
  },
  
  debug: {
    verbose: getEnvConfig().nodeEnv === 'development',
    logMessageIds: getEnvConfig().nodeEnv === 'development',
    logDuplicates: true
  }
};

/**
 * 生产环境配置
 */
export const productionUnifiedProcessorConfig: UnifiedProcessorConfig = {
  ...defaultUnifiedProcessorConfig,
  
  debug: {
    verbose: false,
    logMessageIds: false,
    logDuplicates: false
  },
  
  performance: {
    ...defaultUnifiedProcessorConfig.performance,
    batchSave: true, // 生产环境激活批量保存
  }
};

/**
 * 开发环境配置
 */
export const developmentUnifiedProcessorConfig: UnifiedProcessorConfig = {
  ...defaultUnifiedProcessorConfig,
  
  debug: {
    verbose: true,
    logMessageIds: true,
    logDuplicates: true
  },
  
  deduplication: {
    ...defaultUnifiedProcessorConfig.deduplication,
    maxProcessedIds: 100 // 开发时保持较小的内存使用
  }
};

/**
 * 获取当前环境配置
 */
export function getUnifiedProcessorConfig(): UnifiedProcessorConfig {
  const env = getEnvConfig().nodeEnv;
  
  switch (env) {
    case 'production':
      return productionUnifiedProcessorConfig;
    case 'development':
    case 'test':
    default:
      return developmentUnifiedProcessorConfig;
  }
}

/**
 * 配置验证
 */
export function validateUnifiedProcessorConfig(config: UnifiedProcessorConfig): boolean {
  // 基本验证
  if (!config || typeof config !== 'object') {
    return false;
  }
  
  // 验证数值范围
  if (config.deduplication.maxProcessedIds < 10 || config.deduplication.maxProcessedIds > 10000) {
    console.warn('UnifiedProcessor: maxProcessedIds should be between 10 and 10000, using default');
    config.deduplication.maxProcessedIds = 1000;
  }
  
  if (config.deduplication.contentDedupeWindow < 100 || config.deduplication.contentDedupeWindow > 60000) {
    console.warn('UnifiedProcessor: contentDedupeWindow should be between 100ms and 60s, using default');
    config.deduplication.contentDedupeWindow = 2000;
  }
  
  if (config.buffering.maxBufferSize < 1 || config.buffering.maxBufferSize > 1000) {
    console.warn('UnifiedProcessor: maxBufferSize should be between 1 and 1000, using default');
    config.buffering.maxBufferSize = 100;
  }
  
  return true;
}