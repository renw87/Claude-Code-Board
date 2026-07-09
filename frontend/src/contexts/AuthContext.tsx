import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  checkAuth: () => Promise<boolean>;
  logout: () => void;
}

// Token 验证缓存
interface TokenCache {
  isValid: boolean;
  timestamp: number;
}

const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const tokenCacheRef = useRef<TokenCache | null>(null);

  const checkAuth = async (): Promise<boolean> => {
    const token = localStorage.getItem('token');
    const tokenExpiry = localStorage.getItem('tokenExpiry');

    if (!token || !tokenExpiry) {
      setIsAuthenticated(false);
      setLoading(false);
      return false;
    }

    // 检查 token 是否过期
    if (Date.now() > parseInt(tokenExpiry)) {
      localStorage.removeItem('token');
      localStorage.removeItem('tokenExpiry');
      setIsAuthenticated(false);
      setLoading(false);
      return false;
    }

    // 检查缓存
    const now = Date.now();
    if (tokenCacheRef.current && 
        now - tokenCacheRef.current.timestamp < TOKEN_CACHE_DURATION) {
      // 使用缓存结果，避免重复 API 请求
      const isValid = tokenCacheRef.current.isValid;
      setIsAuthenticated(isValid);
      setLoading(false);
      return isValid;
    }

    try {
      // 验证 token 是否有效
      const response = await axiosInstance.get('/auth/verify');
      if (response.data.success) {
        // 更新缓存
        tokenCacheRef.current = {
          isValid: true,
          timestamp: now
        };
        setIsAuthenticated(true);
        setLoading(false);
        return true;
      }
    } catch (error) {
      // Token 无效
      localStorage.removeItem('token');
      localStorage.removeItem('tokenExpiry');
      // 清除缓存
      tokenCacheRef.current = {
        isValid: false,
        timestamp: now
      };
      setIsAuthenticated(false);
    }

    setLoading(false);
    return false;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tokenExpiry');
    // 清除 token 缓存
    tokenCacheRef.current = null;
    setIsAuthenticated(false);
    navigate('/login');
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // 设置 axios 拦截器来处理 401 错误
  useEffect(() => {
    const interceptor = axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // 清除 token 缓存
          tokenCacheRef.current = null;
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axiosInstance.interceptors.response.eject(interceptor);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};