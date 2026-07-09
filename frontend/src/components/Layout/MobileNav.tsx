import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Plus,
  Settings
} from 'lucide-react';
import { useSessions } from '../../hooks/useSessions';
import { cn } from '../../utils';
import { SettingsModal } from '../Settings/SettingsModal';

interface MobileNavProps {
  onCreateSession?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onCreateSession }) => {
  const location = useLocation();
  const { sessionsByStatus } = useSessions();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const totalSessions = sessionsByStatus.idle.length + 
    sessionsByStatus.completed.length + 
    sessionsByStatus.error.length + 
    sessionsByStatus.interrupted.length + 
    sessionsByStatus.processing.length;

  return (
    <>
      {/* 底部导航栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-30">
        <div className="flex items-center justify-center relative">
          {/* 左侧容器 */}
          <div className="flex-1 flex justify-center">
            <Link
              to="/"
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-lg transition-colors',
                location.pathname === '/'
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <div className="relative">
                <Home className="w-6 h-6" />
                {totalSessions > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
                    {totalSessions > 99 ? '99+' : totalSessions}
                  </span>
                )}
              </div>
              <span className="text-xs mt-1">Sessions</span>
            </Link>
          </div>

          {/* 创建按钮 - 浮动操作按钮风格，绝对定位置中 */}
          <button
            onClick={onCreateSession}
            className="absolute left-1/2 transform -translate-x-1/2 -top-4 flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-10"
          >
            <Plus className="w-6 h-6" />
          </button>

          {/* 中间占位空间 */}
          <div className="w-14 h-14"></div>

          {/* 右侧容器 */}
          <div className="flex-1 flex justify-center">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex flex-col items-center justify-center p-2 rounded-lg text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Settings className="w-6 h-6" />
              <span className="text-xs mt-1">设置</span>
            </button>
          </div>
        </div>
      </div>

      {/* 设置模态窗口 */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};