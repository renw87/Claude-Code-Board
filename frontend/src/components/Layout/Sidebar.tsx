import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Plus,
  Settings,
  LogOut,
  Workflow,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  FileText,
  Server
} from 'lucide-react';
import { useSessions } from '../../hooks/useSessions';
import { cn } from '../../utils';
import { SettingsModal } from '../Settings/SettingsModal';
import { useAuth } from '../../contexts/AuthContext';
import { Tooltip } from '../Common/Tooltip';

interface SidebarProps {
  onCreateSession?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCreateSession }) => {
  const location = useLocation();
  const { sessionsByStatus, loading } = useSessions();
  const { logout } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // 从 localStorage 读取侧边栏状态
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // 切换侧边栏状态并保存到 localStorage
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  const totalSessions = sessionsByStatus.idle.length + 
    sessionsByStatus.completed.length + 
    sessionsByStatus.error.length + 
    sessionsByStatus.interrupted.length + 
    sessionsByStatus.processing.length;

  return (
    <div className={cn(
      "flex flex-col h-screen bg-gradient-to-br from-blue-100/60 via-purple-100/50 to-cyan-100/60 backdrop-blur-md border-r border-white/20",
      "transition-[width] duration-300 ease-in-out",
      isCollapsed ? "w-20" : "w-72"
    )}>
      {/* 悬浮卡片 */}
      <div className={cn(
        "glass-extreme rounded-2xl flex flex-col border border-white/70 backdrop-blur-2xl bg-white/30 h-full",
        "transition-[margin,background-color,border-color] duration-300 ease-in-out !shadow-none",
        isCollapsed ? "m-2" : "m-4"
      )}>
        {/* Logo */}
        <div className={cn(
          "relative transition-[padding] duration-300 ease-in-out",
          isCollapsed ? "p-3" : "p-6"
        )}>
          <div className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "space-x-3"
          )}>
            <img
              src="/asset/logo.png"
              alt="Claude Logo"
              className={cn(
                "drop-shadow-md transition-[width,height] duration-300 ease-in-out",
                isCollapsed ? "w-6 h-6" : "w-8 h-8"
              )}
            />
            {!isCollapsed && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 drop-shadow-sm">Claude Code</h2>
                <p className="text-xs text-gray-600">Session Manager</p>
              </div>
            )}
          </div>

          {/* 收合/展开按钮 */}
          <button
            onClick={toggleSidebar}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 glass-card rounded-full hover:shadow-soft-lg transition-all z-30 border border-white/50 bg-white/20 hover:bg-white/30",
              isCollapsed ? "-right-1 p-1.5" : "-right-2 p-2"
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3 h-3 text-gray-700" />
            ) : (
              <ChevronLeft className="w-3 h-3 text-gray-700" />
            )}
          </button>

          {/* 装饰性分隔线 */}
          <div className={cn(
            "w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent",
            isCollapsed ? "mt-2" : "mt-4"
          )}></div>
        </div>
      

        {/* Navigation */}
        <nav className={cn(
          "flex-1 transition-[padding] duration-300 ease-in-out",
          isCollapsed ? "space-y-1 p-2" : "space-y-1.5 p-4"
        )}>
          {isCollapsed ? (
            <Tooltip content="所有 Sessions" side="right">
              <Link
                to="/"
                className={cn(
                  'flex items-center justify-center p-2.5 rounded-lg text-sm font-medium transition-colors duration-200 relative group mx-1',
                  location.pathname === '/'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft-lg backdrop-blur-sm border border-blue-400/30'
                    : 'text-gray-600 hover:bg-white/40 hover:shadow-soft-md hover:backdrop-blur-sm hover:border hover:border-white/40 hover:text-gray-800'
                )}
              >
                <Home className="w-4 h-4 text-current transition-transform group-hover:scale-110" />
                {totalSessions > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white shadow-md border border-red-400 min-w-[16px] h-4">
                    {totalSessions > 99 ? '99+' : totalSessions}
                  </span>
                )}
              </Link>
            </Tooltip>
          ) : (
            <Link
              to="/"
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group',
                location.pathname === '/'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft-lg backdrop-blur-sm border border-blue-400/30'
                  : 'text-gray-600 hover:bg-white/40 hover:shadow-soft-md hover:backdrop-blur-sm hover:border hover:border-white/40 hover:text-gray-800'
              )}
            >
              <div className="flex items-center space-x-3">
                <Home className="w-5 h-5 text-current transition-transform group-hover:scale-110" />
                <span className="font-medium">所有 Sessions</span>
              </div>
              {totalSessions > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full transition-all',
                  location.pathname === '/'
                    ? 'bg-white/95 text-blue-600 border border-white/70 shadow-sm'
                    : 'bg-white/60 text-gray-700 border border-white/50 group-hover:bg-white/80'
                )}>
                  {totalSessions}
                </span>
              )}
            </Link>
          )}

          {isCollapsed ? (
            <Tooltip content="Work Items" side="right">
              <Link
                to="/work-items"
                className={cn(
                  'flex items-center justify-center p-2.5 rounded-lg text-sm font-medium transition-all duration-200 group mx-1',
                  location.pathname === '/work-items'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft-lg backdrop-blur-sm border border-blue-400/30'
                    : 'text-gray-600 hover:bg-white/40 hover:shadow-soft-md hover:backdrop-blur-sm hover:border hover:border-white/40 hover:text-gray-800'
                )}
              >
                <Briefcase className="w-4 h-4 text-current transition-transform group-hover:scale-110" />
              </Link>
            </Tooltip>
          ) : (
            <Link
              to="/work-items"
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group',
                location.pathname === '/work-items'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft-lg backdrop-blur-sm border border-blue-400/30'
                  : 'text-gray-600 hover:bg-white/40 hover:shadow-soft-md hover:backdrop-blur-sm hover:border hover:border-white/40 hover:text-gray-800'
              )}
            >
              <div className="flex items-center space-x-3">
                <Briefcase className="w-5 h-5 text-current transition-transform group-hover:scale-110" />
                <span className="font-medium">Work Items</span>
              </div>
            </Link>
          )}

          {isCollapsed ? (
            <Tooltip content="工作流程阶段" side="right">
              <Link
                to="/workflow-stages"
                className={cn(
                  'flex items-center justify-center p-2.5 rounded-lg text-sm font-medium transition-all duration-200 group mx-1',
                  location.pathname === '/workflow-stages'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft-lg backdrop-blur-sm border border-blue-400/30'
                    : 'text-gray-600 hover:bg-white/40 hover:shadow-soft-md hover:backdrop-blur-sm hover:border hover:border-white/40 hover:text-gray-800'
                )}
              >
                <Workflow className="w-4 h-4 text-current transition-transform group-hover:scale-110" />
              </Link>
            </Tooltip>
          ) : (
            <Link
              to="/workflow-stages"
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group',
                location.pathname === '/workflow-stages'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft-lg backdrop-blur-sm border border-blue-400/30'
                  : 'text-gray-600 hover:bg-white/40 hover:shadow-soft-md hover:backdrop-blur-sm hover:border hover:border-white/40 hover:text-gray-800'
              )}
            >
              <div className="flex items-center space-x-3">
                <Workflow className="w-5 h-5 text-current transition-transform group-hover:scale-110" />
                <span className="font-medium">工作流程阶段</span>
              </div>
            </Link>
          )}

          {isCollapsed ? (
            <Tooltip content="Agent 提示词" side="right">
              <Link
                to="/agent-prompts"
                className={cn(
                  'flex items-center justify-center p-2.5 rounded-lg text-sm font-medium transition-all duration-200 group mx-1',
                  location.pathname.startsWith('/agent-prompts')
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft-lg backdrop-blur-sm border border-blue-400/30'
                    : 'text-gray-600 hover:bg-white/40 hover:shadow-soft-md hover:backdrop-blur-sm hover:border hover:border-white/40 hover:text-gray-800'
                )}
              >
                <FileText className="w-4 h-4 text-current transition-transform group-hover:scale-110" />
              </Link>
            </Tooltip>
          ) : (
            <Link
              to="/agent-prompts"
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group',
                location.pathname.startsWith('/agent-prompts')
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft-lg backdrop-blur-sm border border-blue-400/30'
                  : 'text-gray-600 hover:bg-white/40 hover:shadow-soft-md hover:backdrop-blur-sm hover:border hover:border-white/40 hover:text-gray-800'
              )}
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-current transition-transform group-hover:scale-110" />
                <span className="font-medium">Agent 提示词</span>
              </div>
            </Link>
          )}

          {isCollapsed ? (
            <Tooltip content="服务与 Nginx" side="right">
              <Link
                to="/services"
                className={cn(
                  'flex items-center justify-center p-2.5 rounded-lg text-sm font-medium transition-all duration-200 group mx-1',
                  location.pathname === '/services'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft-lg backdrop-blur-sm border border-blue-400/30'
                    : 'text-gray-600 hover:bg-white/40 hover:shadow-soft-md hover:backdrop-blur-sm hover:border hover:border-white/40 hover:text-gray-800'
                )}
              >
                <Server className="w-4 h-4 text-current transition-transform group-hover:scale-110" />
              </Link>
            </Tooltip>
          ) : (
            <Link
              to="/services"
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group',
                location.pathname === '/services'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft-lg backdrop-blur-sm border border-blue-400/30'
                  : 'text-gray-600 hover:bg-white/40 hover:shadow-soft-md hover:backdrop-blur-sm hover:border hover:border-white/40 hover:text-gray-800'
              )}
            >
              <div className="flex items-center space-x-3">
                <Server className="w-5 h-5 text-current transition-transform group-hover:scale-110" />
                <span className="font-medium">服务与 Nginx</span>
              </div>
            </Link>
          )}
      </nav>

        {/* 底部操作区 */}
        <div className={cn(
          "space-y-2 mt-2 transition-[padding] duration-300 ease-in-out",
          isCollapsed ? "p-2" : "p-4"
        )}>
          {/* 装饰性分隔线 */}
          <div className={cn(
            "w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent",
            isCollapsed ? "mb-2" : "mb-3"
          )}></div>
          {isCollapsed ? (
            <>
              <Tooltip content="创建 Session" side="right">
                <button
                  onClick={onCreateSession}
                  className="w-full flex items-center justify-center p-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 shadow-soft-md hover:shadow-soft-lg transition-all duration-200 border border-green-400/30 backdrop-blur-sm group mx-1"
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:scale-110" />
                </button>
              </Tooltip>

              <Tooltip content="设置" side="right">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-full flex items-center justify-center p-2.5 bg-white/20 text-gray-700 rounded-lg hover:bg-white/30 shadow-soft-md hover:shadow-soft-lg transition-all duration-200 border border-white/40 backdrop-blur-sm group mx-1"
                >
                  <Settings className="w-4 h-4 transition-transform group-hover:scale-110" />
                </button>
              </Tooltip>

              <Tooltip content="注销" side="right">
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center p-2.5 bg-red-50/80 text-red-600 rounded-lg hover:bg-red-100/80 shadow-soft-md hover:shadow-soft-lg transition-all duration-200 border border-red-200/50 backdrop-blur-sm group mx-1"
                >
                  <LogOut className="w-4 h-4 transition-transform group-hover:scale-110" />
                </button>
              </Tooltip>
            </>
          ) : (
            <>
              <button
                onClick={onCreateSession}
                className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 shadow-soft-md hover:shadow-soft-lg transition-all duration-200 border border-green-400/30 backdrop-blur-sm group font-medium"
              >
                <Plus className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
                创建 Session
              </button>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-full flex items-center justify-center px-4 py-3 bg-white/20 text-gray-700 rounded-xl hover:bg-white/30 shadow-soft-md hover:shadow-soft-lg transition-all duration-200 border border-white/40 backdrop-blur-sm group font-medium"
              >
                <Settings className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
                设置
              </button>

              <button
                onClick={logout}
                className="w-full flex items-center justify-center px-4 py-3 bg-red-50/80 text-red-600 rounded-xl hover:bg-red-100/80 shadow-soft-md hover:shadow-soft-lg transition-all duration-200 border border-red-200/50 backdrop-blur-sm group font-medium"
              >
                <LogOut className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
                注销
              </button>
            </>
          )}
        
          {loading && !isCollapsed && (
            <div className="mt-3 flex items-center justify-center text-xs text-gray-500">
              <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full mr-2"></div>
              加载中...
            </div>
          )}
        </div>
      </div>

      {/* 设置模态窗口 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};