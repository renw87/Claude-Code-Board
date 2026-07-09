import React from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';

export const Header: React.FC = () => {
  const isMobile = useIsMobile();

  // 手机版才显示 Header
  if (!isMobile) {
    return null;
  }

  return (
    <header className="relative">
      {/* 玻璃背景层 */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-white/20 to-white/30 backdrop-blur-xl border-b border-white/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />

      {/* 内容层 */}
      <div className="relative z-10 px-4 py-3">
        <div className="flex items-center">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg backdrop-blur-sm">
              <img
                src="/asset/logo.png"
                alt="Claude Logo"
                className="w-5 h-5"
              />
            </div>
            <h1 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Claude Code
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
};