import { Session, SessionStatus } from '../types/session.types';

export type SortType = 
  | 'created_desc'  // 最新创建优先
  | 'created_asc'   // 最旧创建优先
  | 'updated_desc'  // 最近更新优先
  | 'updated_asc'   // 最久未更新优先
  | 'name_asc'      // 名称 A-Z
  | 'name_desc'     // 名称 Z-A
  | 'status'        // 状态分组（进行中优先）
  | 'messages_desc' // 消息数量多优先
  | 'messages_asc'; // 消息数量少优先

export const sortSessions = (sessions: Session[], sortType: SortType): Session[] => {
  const sorted = [...sessions];
  
  switch (sortType) {
    case 'created_desc':
      return sorted.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
    case 'created_asc':
      return sorted.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
    case 'updated_desc':
      return sorted.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      
    case 'updated_asc':
      return sorted.sort((a, b) => 
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      );
      
    case 'name_asc':
      return sorted.sort((a, b) => 
        a.name.localeCompare(b.name, 'zh-CN')
      );
      
    case 'name_desc':
      return sorted.sort((a, b) => 
        b.name.localeCompare(a.name, 'zh-CN')
      );
      
    case 'status':
      // 状态优先级：processing > idle > completed > error > interrupted
      const statusPriority: Record<SessionStatus, number> = {
        [SessionStatus.PROCESSING]: 1,
        [SessionStatus.IDLE]: 2,
        [SessionStatus.COMPLETED]: 3,
        [SessionStatus.ERROR]: 4,
        [SessionStatus.INTERRUPTED]: 5
      };
      
      return sorted.sort((a, b) => {
        const priorityA = statusPriority[a.status] || 999;
        const priorityB = statusPriority[b.status] || 999;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // 如果状态相同，按更新时间排序
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      
    case 'messages_desc':
      return sorted.sort((a, b) => 
        (b.messageCount || 0) - (a.messageCount || 0)
      );
      
    case 'messages_asc':
      return sorted.sort((a, b) => 
        (a.messageCount || 0) - (b.messageCount || 0)
      );
      
    default:
      return sorted;
  }
};

export const getSortOptions = () => [
  { value: 'updated_desc', label: '最近更新' },
  { value: 'created_desc', label: '最新创建' },
  { value: 'created_asc', label: '最旧创建' },
  { value: 'name_asc', label: '名称 A-Z' },
  { value: 'name_desc', label: '名称 Z-A' },
  { value: 'status', label: '状态优先' },
  { value: 'messages_desc', label: '消息数多' },
  { value: 'messages_asc', label: '消息数少' }
];