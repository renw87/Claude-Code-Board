import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface LayoutProps {
  children: React.ReactNode;
  onCreateSession?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onCreateSession }) => {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex h-screen relative">
      {/* 侧边栏 - 只在非手机版显示 */}
      {!isMobile && <Sidebar onCreateSession={onCreateSession} />}

      {/* 主要内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden relative main-content-bg">
        <Header />
        <main className={`flex-1 overflow-auto ${isMobile ? 'pb-16' : ''}`}>
          {children}
        </main>
        
        {/* 底部导航 - 只在手机版显示 */}
        {isMobile && <MobileNav onCreateSession={onCreateSession} />}
      </div>
    </div>
  );
};