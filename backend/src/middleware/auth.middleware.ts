import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getEnvConfig } from '../config/env.config';

// 扩展 Request 接口以包含 user 属性
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 从 header 中获取 token
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证 token'
      });
    }

    // 验证 token
    const jwtSecret = getEnvConfig().auth.jwtSecret;
    const decoded = jwt.verify(token, jwtSecret);
    
    // 将解码后的用户信息附加到 request 对象
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token 已过期，请重新登录'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Token 无效'
    });
  }
};