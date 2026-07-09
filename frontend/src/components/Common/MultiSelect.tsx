import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Plus } from 'lucide-react';
import { cn } from '../../utils';

interface Option {
  value: string;
  label: string;
  color?: string;
  icon?: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  onCreateNew?: (name: string) => Promise<void>;
  createNewPlaceholder?: string;
  className?: string;
  maxHeight?: number;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '选择项目...',
  disabled = false,
  loading = false,
  onCreateNew,
  createNewPlaceholder = '创建新项目',
  className,
  maxHeight = 200,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setNewItemName('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 筛选选项
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  // 获取已选项目的详细信息
  const selectedOptions = value.map(val => options.find(opt => opt.value === val)).filter(Boolean) as Option[];

  const handleSelect = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optionValue));
  };

  const handleCreateNew = async () => {
    if (!newItemName.trim() || !onCreateNew) return;

    try {
      setIsLoading(true);
      await onCreateNew(newItemName.trim());
      setNewItemName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create new item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* 选择器主体 */}
      <div
        className={cn(
          'min-h-[38px] px-3 py-2 border rounded-lg cursor-pointer transition-colors',
          'flex items-center gap-2 flex-wrap',
          disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white hover:border-gray-400',
          isOpen ? 'border-blue-500' : 'border-gray-300'
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {/* 已选项目 */}
        {selectedOptions.length > 0 ? (
          selectedOptions.map(option => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-md"
              style={{ backgroundColor: option.color ? `${option.color}20` : '#E5E7EB' }}
            >
              {option.icon && <span className="text-xs">{option.icon}</span>}
              <span style={{ color: option.color || '#374151' }}>{option.label}</span>
              {!disabled && (
                <X
                  className="w-3 h-3 cursor-pointer hover:text-red-600"
                  onClick={(e) => handleRemove(option.value, e)}
                />
              )}
            </span>
          ))
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}

        {/* 下拉箭头 */}
        <ChevronDown className={cn(
          'w-4 h-4 ml-auto text-gray-400 transition-transform',
          isOpen && 'transform rotate-180'
        )} />
      </div>

      {/* 下拉列表 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* 搜索框 */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="搜索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* 选项列表 */}
          <div className="overflow-y-auto" style={{ maxHeight }}>
            {loading ? (
              <div className="px-3 py-8 text-center text-gray-500">
                加载中...
              </div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map(option => {
                const isSelected = value.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className={cn(
                      'px-3 py-2 cursor-pointer transition-colors flex items-center gap-2',
                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    )}
                    onClick={() => handleSelect(option.value)}
                  >
                    {/* 勾选框 */}
                    <div className={cn(
                      'w-4 h-4 border-2 rounded flex items-center justify-center',
                      isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    )}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* 选项内容 */}
                    <div className="flex items-center gap-2 flex-1">
                      {option.icon && <span className="text-sm">{option.icon}</span>}
                      <span 
                        className="text-sm"
                        style={{ color: option.color || '#374151' }}
                      >
                        {option.label}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                没有找到符合的项目
              </div>
            )}

            {/* 创建新项目 */}
            {onCreateNew && (
              <div className="border-t border-gray-100">
                {isCreating ? (
                  <div className="p-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={createNewPlaceholder}
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateNew()}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                        onClick={handleCreateNew}
                        disabled={!newItemName.trim() || loading || isLoading}
                      >
                        {isLoading ? '创建中...' : '创建'}
                      </button>
                      <button
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                        onClick={() => {
                          setIsCreating(false);
                          setNewItemName('');
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="px-3 py-2 cursor-pointer hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                    onClick={() => setIsCreating(true)}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">{createNewPlaceholder}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};