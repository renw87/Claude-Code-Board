import { useSessionsContext } from '../contexts/SessionsContext';

// 这个 hook 现在只是一个简单的 wrapper，为了保持向后兼容
export const useSessions = () => {
  return useSessionsContext();
};