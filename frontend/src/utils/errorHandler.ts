import { AxiosError } from 'axios';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * 从 Axios 错误中提取错误消息
 * @param error - Axios 错误对象
 * @param defaultMessage - 默认错误消息
 * @returns 错误消息字符串
 */
export const getErrorMessage = (error: unknown, defaultMessage = '操作失败，请稍后再试'): string => {
  if (error instanceof AxiosError) {
    // 处理 API 回传的错误
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    
    // 处理网络错误
    if (error.code === 'ECONNABORTED') {
      return '请求超时，请检查网络连接';
    }
    
    if (error.code === 'ERR_NETWORK') {
      return '网络连接失败，请检查网络设置';
    }
    
    // 处理 HTTP 状态码
    if (error.response?.status) {
      switch (error.response.status) {
        case 400:
          return '请求参数错误';
        case 401:
          return '认证失败，请重新登录';
        case 403:
          return '您没有权限运行此操作';
        case 404:
          return '请求的资源不存在';
        case 500:
          return '服务器错误，请稍后再试';
        case 502:
        case 503:
          return '服务器暂时无法提供服务';
        default:
          return defaultMessage;
      }
    }
  }
  
  // 处理一般错误
  if (error instanceof Error) {
    return error.message;
  }
  
  return defaultMessage;
};