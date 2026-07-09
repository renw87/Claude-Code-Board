import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Calendar,
  FolderOpen
} from 'lucide-react';
import { WorkItem } from '../../types/workitem';

interface WorkItemRowProps {
  workItem: WorkItem;
  onEdit?: (workItem: WorkItem) => void;
  onDelete?: (workItemId: string) => void;
  onStatusChange?: (workItemId: string, status: WorkItem['status']) => void;
}

export const WorkItemRow: React.FC<WorkItemRowProps> = ({
  workItem,
  onEdit,
  onDelete,
  onStatusChange
}) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleRowClick = (e: React.MouseEvent) => {
    // 不要在点击菜单区域时导航
    if ((e.target as HTMLElement).closest('.menu-area')) {
      return;
    }
    navigate(`/work-items/${workItem.work_item_id}`);
  };

  // 计算菜单位置
  const getMenuPosition = () => {
    if (!buttonRef.current) return { top: 0, left: 0 };

    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 192; // w-48 = 12rem = 192px
    const viewportWidth = window.innerWidth;

    let left = rect.right - menuWidth;
    let top = rect.bottom + 8;

    // 确保不超出窗口边界
    if (left < 8) left = 8;
    if (left + menuWidth > viewportWidth - 8) left = viewportWidth - menuWidth - 8;

    return { top, left };
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
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
    planning: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100', label: '规划中', emoji: '📋' },
    in_progress: { icon: Play, color: 'text-blue-600', bg: 'bg-blue-100', label: '进行中', emoji: '🚀' },
    completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: '已完成', emoji: '✅' },
    cancelled: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: '已取消', emoji: '❌' }
  };

  const status = statusConfig[workItem.status];

  // 仅保留状态相关的变量

  return (
    <div
      className="glass-card hover:shadow-soft-md transition-all duration-200 cursor-pointer border-l-4 border-l-gray-300"
      onClick={handleRowClick}
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-4">
          {/* WorkItem 基本信息 */}
          <div className="flex items-center gap-3 min-w-0" style={{ width: '250px' }}>
            <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {workItem.title}
              </h3>
              {workItem.workspace_path && (
                <div className="flex items-center gap-1 mt-0.5">
                  <FolderOpen className="w-3 h-3 text-gray-400" />
                  <p className="text-xs text-gray-500 truncate">
                    {workItem.workspace_path.split(/[\\/]/).pop()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 描述 */}
          <div className="flex-1 min-w-0">
            {workItem.description ? (
              <p className="text-sm text-gray-700 truncate">
                {workItem.description}
              </p>
            ) : (
              <span className="text-sm text-gray-400 italic">无描述</span>
            )}
          </div>


          {/* 状态 */}
          <div className="flex items-center" style={{ width: '120px' }}>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
              <span>{status.emoji}</span>
              {status.label}
            </span>
          </div>

          {/* 时间信息 */}
          <div className="flex items-center gap-1 text-xs text-gray-500" style={{ width: '150px' }}>
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {workItem.completed_at
                ? `完成 ${formatDistanceToNow(new Date(workItem.completed_at), { locale: zhTW, addSuffix: true })}`
                : `创建 ${formatDistanceToNow(new Date(workItem.created_at), { locale: zhTW, addSuffix: true })}`
              }
            </span>
          </div>

          {/* 操作菜单 */}
          <div className="relative menu-area flex-shrink-0">
            <button
              ref={buttonRef}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1.5 hover:bg-white/60 rounded transition-all hover:shadow-soft-sm"
              title="更多操作"
            >
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Portal 菜单 */}
      {menuOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed bg-white rounded-lg shadow-lg border border-gray-200 z-[99999] w-48"
          style={getMenuPosition()}
          onClick={(e) => e.stopPropagation()}
        >
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onEdit(workItem);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg"
            >
              📝 编辑
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
              🚀 开始运行
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
              ✅ 标记完成
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
              ❌ 取消
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
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 last:rounded-b-lg"
              >
                🗑️ 删除
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};