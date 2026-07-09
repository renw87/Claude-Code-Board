import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { logger } from '../utils/logger';
import { getEnvConfig } from '../config/env.config';

// JWT 认证中间件
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error_code: 'UNAUTHORIZED',
      error_message: 'Authentication required'
    });
  }

  const secret = getEnvConfig().auth.jwtSecret;
  
  jwt.verify(token, secret, (err, user) => {
    if (err) {
      return res.status(403).json({
        error_code: 'FORBIDDEN_TOKEN',
        error_message: 'Invalid or expired token'
      });
    }
    
    (req as any).user = user;
    next();
  });
};

// 工作目录访问限制
export const validateWorkingDirectory = (req: Request, res: Response, next: NextFunction) => {
  const { workingDir } = req.body;
  
  if (workingDir) {
    const allowedDirs = getEnvConfig().security.allowedDirs;
    const isAllowed = allowedDirs.some(dir => workingDir.startsWith(dir));
    
    if (!isAllowed) {
      logger.warn(`Unauthorized directory access attempt: ${workingDir}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(403).json({
        error_code: 'FORBIDDEN_PATH',
        error_message: 'Access to this directory is not allowed'
      });
    }
  }
  
  next();
};

// 命令注入防护
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const dangerousChars = [';', '|', '&', '$', '`', '(', ')', '{', '}', '[', ']', '<', '>', '\\'];
  
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;
    
    // 转义危险字符
    let sanitized = str;
    dangerousChars.forEach(char => {
      sanitized = sanitized.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
    });
    
    return sanitized;
  };

  // 递归处理对象
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitizedObj: any = {};
      Object.keys(obj).forEach(key => {
        sanitizedObj[key] = sanitizeObject(obj[key]);
      });
      return sanitizedObj;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  next();
};

// XSS 防护
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  const xssPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  
  const cleanXSS = (str: string): string => {
    if (typeof str !== 'string') return str;
    
    // 移除 script 标签
    let cleaned = str.replace(xssPattern, '');
    
    // 转义 HTML 特殊字符
    cleaned = cleaned
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
    
    return cleaned;
  };

  const cleanObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return cleanXSS(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(cleanObject);
    }
    
    if (obj && typeof obj === 'object') {
      const cleanedObj: any = {};
      Object.keys(obj).forEach(key => {
        cleanedObj[key] = cleanObject(obj[key]);
      });
      return cleanedObj;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = cleanObject(req.body);
  }
  
  next();
};

// Session 隔离检查
export const checkSessionAccess = (req: Request, res: Response, next: NextFunction) => {
  const { sessionId } = req.params;
  const user = (req as any).user;
  
  // 仿真检查：假设 user.id 和 session owner 需要匹配
  // 在实际实作中，需要查找数据库确认 session 所有者
  if (sessionId && user) {
    // 这里应该查找数据库确认 session 所有者
    // 暂时跳过实际检查，因为我们没有用户系统
  }
  
  next();
};

// 敏感信息过滤
export const redactSensitiveInfo = (content: string): string => {
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
};

// Rate limiting
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 分钟
  max: 1000, // 每分钟最多 1000 次请求
  message: {
    error_code: 'RATE_LIMIT_EXCEEDED',
    error_message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error_code: 'RATE_LIMIT_EXCEEDED',
      error_message: 'Too many requests, please try again later'
    });
  }
});

// 安全标头设置
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  }
});

// 稽核日志记录
export const auditLog = (req: Request, res: Response, next: NextFunction) => {
  const auditData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: (req as any).user?.id || 'anonymous'
  };

  logger.info('API Request', auditData);
  
  // 记录回应时间
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.info('API Response', {
      ...auditData,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`
    });
  });
  
  next();
};