import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// 创建 axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 3600000, // 1小时超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('token');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    
    // 检查 token 是否过期
    if (token && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    // 处理 401 错误
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      // 清除本地保存的认证信息
      localStorage.removeItem('token');
      localStorage.removeItem('tokenExpiry');
      
      // 重定向到登录页面
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;