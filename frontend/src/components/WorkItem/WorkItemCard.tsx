import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Briefcase,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  MoreVertical,
  Calendar
} from 'lucide-react';
import { WorkItem } from '../../types/workitem';

interface WorkItemCardProps {
  workItem: WorkItem;
  onEdit?: (workItem: WorkItem) => void;
  onDelete?: (workItemId: string) => void;
  onStatusChange?: (workItemId: string, status: WorkItem['status']) => void;
}

export const WorkItemCard: React.FC<WorkItemCardProps> = ({
  workItem,
  onEdit,
  onDelete,
  onStatusChange
}) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleCardClick = (e: React.MouseEvent) => {
    // 不要在点击菜单区域时导航
    if ((e.target as HTMLElement).closest('.menu-area')) {
      return;
    }
    navigate(`/work-items/${workItem.work_item_id}`);
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const statusConfig = {
    planning: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: '规划中' },
    in_progress: { icon: Play, color: 'text-blue-500', bg: 'bg-blue-100', label: '进行中' },
    completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', label: '已完成' },
    cancelled: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', label: '已取消' }
  };


  const status = statusConfig[workItem.status];
  const StatusIcon = status.icon;

  // 计算进度
  const progress = workItem.progress || 0;
  const sessionCount = workItem.session_count || 0;
  const completedSessionCount = workItem.completed_session_count || 0;

  return (
    <div
      className="glass-card rounded-xl hover:shadow-soft-md transition-all duration-200 cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2 flex-1">
            <Briefcase className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900 truncate">{workItem.title}</h3>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Status Badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
            
            {/* Menu Button */}
            <div className="relative menu-area" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <MoreVertical className="w-4 h-4 text-gray-500" />
              </button>
              
              {menuOpen && (
                <div 
                  className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onEdit(workItem);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      编辑
                    </button>
                  )}
                  
                  {workItem.status === 'planning' && onStatusChange && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onStatusChange(workItem.work_item_id, 'in_progress');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      开始运行
                    </button>
                  )}
                  
                  {workItem.status === 'in_progress' && onStatusChange && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onStatusChange(workItem.work_item_id, 'completed');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      标记完成
                    </button>
                  )}
                  
                  {(workItem.status === 'planning' || workItem.status === 'in_progress') && onStatusChange && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onStatusChange(workItem.work_item_id, 'cancelled');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      取消
                    </button>
                  )}
                  
                  {onDelete && (
                    <>
                      <div className="border-t border-gray-100"></div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onDelete(workItem.work_item_id);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {workItem.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {workItem.description}
          </p>
        )}
        
        {/* Workspace Path */}
        {workItem.workspace_path && (
          <p className="text-xs text-gray-500 mb-3 truncate">
            📁 {workItem.workspace_path}
          </p>
        )}


        {/* Progress */}
        {sessionCount > 0 && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-500">
                Sessions: {completedSessionCount}/{sessionCount}
              </span>
              <span className="text-xs text-gray-500">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>
              创建于 {formatDistanceToNow(new Date(workItem.created_at), { locale: zhTW, addSuffix: true })}
            </span>
          </div>
          
          {workItem.completed_at && (
            <span className="text-green-600">
              完成于 {formatDistanceToNow(new Date(workItem.completed_at), { locale: zhTW, addSuffix: true })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};