interface EnvConfig {
  NODE_ENV: 'development' | 'production';
  API_BASE_URL: string;
  WS_URL: string;
}

export const getEnvConfig = (): EnvConfig => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
  
  // 自动从 API URL 推导 WebSocket URL
  let wsUrl = import.meta.env.VITE_WS_URL || '';
  if (!wsUrl && apiBaseUrl) {
    // 将 http:// 或 https:// 替换为 ws:// 或 wss://
    wsUrl = apiBaseUrl
      .replace(/^http:\/\//, 'ws://')
      .replace(/^https:\/\//, 'wss://');
  }
  
  return {
    NODE_ENV: (import.meta.env.VITE_NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
    API_BASE_URL: apiBaseUrl,
    WS_URL: wsUrl
  };
};

export const config = getEnvConfig();
export const API_BASE_URL = config.API_BASE_URL;