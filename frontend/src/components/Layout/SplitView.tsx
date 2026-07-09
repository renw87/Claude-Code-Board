import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { SessionList } from '../Session/SessionList';
import { SessionDetail } from '../Session/SessionDetail';
import { X, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';
import { cn } from '../../utils';
import { Tooltip } from '../Common/Tooltip';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useSessionsContext } from '../../contexts/SessionsContext';

interface SplitViewProps {
  onCreateSession: () => void;
}

export const SplitView: React.FC<SplitViewProps> = ({ onCreateSession }) => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(50); // 百分比
  const [dragWidth, setDragWidth] = useState<number | null>(null); // 拖曳时的临时宽度
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null); // requestAnimationFrame ID
  const isMobile = useIsMobile();
  const { sessions } = useSessionsContext();

  // 当路由变化时，只重置全屏状态，保持用户调整的宽度
  useEffect(() => {
    if (sessionId) {
      setIsFullScreen(false);
      // 不再重置宽度，保持用户的偏好设置
    }
  }, [sessionId]);

  // 监听 sessions 变化，检查当前 session 是否还存在
  useEffect(() => {
    if (sessionId) {
      const sessionExists = sessions.some(session => session.sessionId === sessionId);
      if (!sessionExists) {
        // 如果当前 session 已被删除，关闭右侧面板
        navigate('/');
      }
    }
  }, [sessions, sessionId, navigate]);

  const handleClose = () => {
    const from = searchParams.get('from');
    const workItemId = searchParams.get('workItemId');
    
    if (from === 'work-item' && workItemId) {
      // 如果是从 Work Item 页面来的，返回到 Work Item 页面
      navigate(`/work-items/${workItemId}`);
    } else {
      // 否则返回到主页面
      navigate('/');
    }
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    // 开始拖曳时设置初始 dragWidth
    setDragWidth(rightPanelWidth);
  }, [rightPanelWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      // 使用 requestAnimationFrame 来节流更新
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const newRightWidth = ((containerRect.right - e.clientX) / containerRect.width) * 100;
        
        // 限制宽度在 30% 到 70% 之间（确保两边都至少有 30%）
        const clampedWidth = Math.min(70, Math.max(30, newRightWidth));
        setDragWidth(clampedWidth); // 只更新临时宽度
      });
    };

    const handleMouseUp = () => {
      // 拖曳结束时，将临时宽度设为最终宽度
      if (dragWidth !== null) {
        setRightPanelWidth(dragWidth);
      }
      setDragWidth(null);
      setIsDragging(false);
      
      // 清理 requestAnimationFrame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // 清理 requestAnimationFrame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isDragging, dragWidth]);

  return (
    <div ref={containerRef} className="flex h-full w-full relative">
      {/* 左侧 SessionList - 固定宽度，可滚动 */}
      <div 
        className={cn(
          "h-full overflow-hidden",
          sessionId && (isFullScreen || isMobile) ? "hidden" : "block",
          isDragging ? "" : "transition-all duration-300"
        )}
        style={{
          width: isMobile ? '100%' : (sessionId && !isFullScreen ? `${100 - (dragWidth ?? rightPanelWidth)}%` : '100%')
        }}
      >
        <SessionList onCreateSession={onCreateSession} />
      </div>

      {/* 右侧 SessionDetail - 当有 sessionId 时显示 */}
      {sessionId && !isFullScreen && (
        <>
          {/* 可拖曳的分隔线 - 只在非手机版显示 */}
          {!isMobile && (
            <div
              className="w-2 hover:w-3 bg-gray-200 hover:bg-blue-400 cursor-col-resize relative flex-shrink-0 group transition-all"
              onMouseDown={handleMouseDown}
              style={{ 
                backgroundColor: isDragging ? '#3b82f6' : undefined,
                width: isDragging ? '3px' : undefined
              }}
            >
              <div className="absolute inset-y-0 -left-2 -right-2" />
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1">
                <div className="w-1 h-6 bg-gray-400 group-hover:bg-white rounded-full opacity-60" />
                <div className="w-1 h-6 bg-gray-400 group-hover:bg-white rounded-full opacity-60" />
                <div className="w-1 h-6 bg-gray-400 group-hover:bg-white rounded-full opacity-60" />
              </div>
            </div>
          )}
          
          {/* SessionDetail 面板 */}
          <div 
            className={cn(
              "h-full bg-white shadow-lg overflow-hidden flex flex-col relative",
              isMobile ? "fixed inset-0 z-40" : "",
              isDragging ? "" : "transition-all duration-300"
            )}
            style={{ width: isMobile ? '100%' : `${dragWidth ?? rightPanelWidth}%` }}
          >
            {/* 面板控制按钮 - 左上角 */}
            <div className="absolute top-4 left-4 z-10 flex items-center space-x-2">
              {isMobile ? (
                <Tooltip content={searchParams.get('from') === 'work-item' ? "返回 Work Item" : "返回列表"}>
                  <button
                    onClick={handleClose}
                    className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-600" />
                  </button>
                </Tooltip>
              ) : (
                <>
                  {searchParams.get('from') === 'work-item' && (
                    <Tooltip content="返回 Work Item">
                      <button
                        onClick={handleClose}
                        className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
                      >
                        <ArrowLeft className="w-4 h-4 text-gray-600" />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content="全屏">
                    <button
                      onClick={toggleFullScreen}
                      className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
                    >
                      <Maximize2 className="w-4 h-4 text-gray-600" />
                    </button>
                  </Tooltip>
                  <Tooltip content="关闭">
                    <button
                      onClick={() => navigate('/')}
                      className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </Tooltip>
                </>
              )}
            </div>

            {/* SessionDetail 内容 */}
            <SessionDetail />
          </div>
        </>
      )}

      {/* 全屏模式 */}
      {sessionId && isFullScreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* 面板控制按钮 - 左上角 */}
          <div className="absolute top-4 left-4 z-10 flex items-center space-x-2">
            {searchParams.get('from') === 'work-item' && (
              <Tooltip content="返回 Work Item">
                <button
                  onClick={handleClose}
                  className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-600" />
                </button>
              </Tooltip>
            )}
            <Tooltip content="还原">
              <button
                onClick={toggleFullScreen}
                className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
              >
                <Minimize2 className="w-4 h-4 text-gray-600" />
              </button>
            </Tooltip>
            <Tooltip content="关闭">
              <button
                onClick={() => navigate('/')}
                className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </Tooltip>
          </div>

          {/* SessionDetail 内容 */}
          <SessionDetail />
        </div>
      )}
    </div>
  );
};