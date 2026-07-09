import express from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { getEnvConfig } from '../config/env.config';

const router = express.Router();

// 登录 API
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    // 从统一配置获取帐号密码
    const config = getEnvConfig();
    const adminUsername = config.auth.username;
    const adminPassword = config.auth.password;
    const jwtSecret = config.auth.jwtSecret;

    // 验证帐号密码
    if (username !== adminUsername || password !== adminPassword) {
      return res.status(401).json({
        success: false,
        message: '帐号或密码错误'
      });
    }

    // 生成 JWT token（7天有效期）
    const token = jwt.sign(
      { username, timestamp: Date.now() },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      expiresIn: 7 * 24 * 60 * 60 * 1000, // 7天的毫秒数
      message: '登录成功'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: '登录时发生错误'
    });
  }
});

// 验证 token API（用于检查 token 是否有效）
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供 token'
    });
  }

  try {
    const jwtSecret = getEnvConfig().auth.jwtSecret;
    const decoded = jwt.verify(token, jwtSecret);
    
    res.json({
      success: true,
      message: 'Token 有效',
      decoded
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token 无效或已过期'
    });
  }
});

export default router;