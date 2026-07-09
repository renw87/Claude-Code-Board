import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SessionStatus, ProcessStatus } from '../types/session.types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 格式化日期时间
export function formatDateTime(date: Date | string | number): string {
  try {
    let validDate: Date;
    
    if (date instanceof Date) {
      validDate = date;
    } else {
      validDate = new Date(date);
    }
    
    // 检查是否为有效日期
    if (isNaN(validDate.getTime())) {
      console.warn('Invalid date provided to formatDateTime:', date);
      return '无效时间';
    }
    
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(validDate);
  } catch (error) {
    console.warn('Error formatting date:', date, error);
    return '无效时间';
  }
}

// 格式化相对时间
export function formatRelativeTime(date: Date | string | number): string {
  try {
    let validDate: Date;
    
    if (date instanceof Date) {
      validDate = date;
    } else {
      validDate = new Date(date);
    }
    
    // 检查是否为有效日期
    if (isNaN(validDate.getTime())) {
      console.warn('Invalid date provided to formatRelativeTime:', date);
      return '无效时间';
    }
    
    const now = new Date();
    const diff = now.getTime() - validDate.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes} 分钟前`;
    } else if (hours < 24) {
      return `${hours} 小时前`;
    } else if (days < 7) {
      return `${days} 天前`;
    } else {
      return formatDateTime(validDate);
    }
  } catch (error) {
    console.warn('Error formatting relative time:', date, error);
    return '无效时间';
  }
}

// 格式化持续时间
export function formatDuration(startTime: Date | string | number, endTime?: Date | string | number): string {
  try {
    let validStartTime: Date;
    let validEndTime: Date;
    
    if (startTime instanceof Date) {
      validStartTime = startTime;
    } else {
      validStartTime = new Date(startTime);
    }
    
    if (endTime) {
      if (endTime instanceof Date) {
        validEndTime = endTime;
      } else {
        validEndTime = new Date(endTime);
      }
    } else {
      validEndTime = new Date();
    }
    
    // 检查是否为有效日期
    if (isNaN(validStartTime.getTime()) || isNaN(validEndTime.getTime())) {
      console.warn('Invalid date provided to formatDuration:', startTime, endTime);
      return '无效持续时间';
    }
    
    const diff = validEndTime.getTime() - validStartTime.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `${seconds}s`;
    }
  } catch (error) {
    console.warn('Error formatting duration:', startTime, endTime, error);
    return '无效持续时间';
  }
}

// 获取状态颜色
export function getStatusColor(status: SessionStatus | ProcessStatus): string {
  switch (status) {
    case SessionStatus.PROCESSING:
      return 'text-yellow-600 bg-yellow-100';
    case SessionStatus.IDLE:
    case ProcessStatus.IDLE:
      return 'text-green-600 bg-green-100';
    case SessionStatus.COMPLETED:
    case SessionStatus.INTERRUPTED:
    case ProcessStatus.STOPPED:
      return 'text-blue-600 bg-blue-100';
    case SessionStatus.ERROR:
    case ProcessStatus.ERROR:
    case ProcessStatus.CRASHED:
      return 'text-red-600 bg-red-100';
    case ProcessStatus.RUNNING:
    case ProcessStatus.BUSY:
      return 'text-yellow-600 bg-yellow-100';
    case ProcessStatus.STARTING:
    case ProcessStatus.STOPPING:
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

// 获取 Session 分类
export type SessionCategory = '正在处理' | '闲置' | '已完成';

export function getSessionCategory(status: SessionStatus): SessionCategory {
  switch (status) {
    case SessionStatus.PROCESSING:
      return '正在处理';
    case SessionStatus.IDLE:
      return '闲置';
    case SessionStatus.COMPLETED:
    case SessionStatus.ERROR:
    case SessionStatus.INTERRUPTED:
      return '已完成';
    default:
      return '已完成';
  }
}

// 获取状态文本
export function getStatusText(status: SessionStatus | ProcessStatus): string {
  switch (status) {
    case SessionStatus.PROCESSING:
      return '正在处理';
    case SessionStatus.IDLE:
      return '闲置';
    case SessionStatus.COMPLETED:
      return '已完成';
    case SessionStatus.ERROR:
      return '错误';
    case SessionStatus.INTERRUPTED:
      return '已中断';
    case ProcessStatus.STARTING:
      return '启动中';
    case ProcessStatus.RUNNING:
      return '运行中';
    case ProcessStatus.IDLE:
      return '闲置';
    case ProcessStatus.BUSY:
      return '忙碌';
    case ProcessStatus.STOPPING:
      return '停止中';
    case ProcessStatus.STOPPED:
      return '已停止';
    case ProcessStatus.ERROR:
      return '错误';
    case ProcessStatus.CRASHED:
      return '崩溃';
    default:
      return '未知';
  }
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// 截断文本
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

// 生成随机 ID
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// 延迟函数
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}