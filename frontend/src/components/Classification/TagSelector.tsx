import React, { useState, useEffect } from 'react';
import { tagApi } from '../../services/api';
import { Tag } from '../../types/classification.types';
import { MultiSelect } from '../Common/MultiSelect';
import toast from 'react-hot-toast';

interface TagSelectorProps {
  sessionId: string;
  selectedTags: string[];
  onTagsChange: (tagIds: string[]) => void;
  tagType?: 'general' | 'topic' | 'department';
  className?: string;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  sessionId,
  selectedTags,
  onTagsChange,
  tagType = 'general',
  className,
}) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 加载标签
  useEffect(() => {
    loadTags();
  }, [tagType]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const allTags = tagType ? await tagApi.getTagsByType(tagType) : await tagApi.getAllTags();
      setTags(allTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
      toast.error('加载标签失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理标签变更
  const handleTagsChange = async (newTagIds: string[]) => {
    try {
      setSaving(true);
      await tagApi.updateSessionTags(sessionId, newTagIds);
      onTagsChange(newTagIds);
      toast.success('标签已更新');
    } catch (error) {
      console.error('Failed to update tags:', error);
      toast.error('更新标签失败');
    } finally {
      setSaving(false);
    }
  };

  // 创建新标签
  const handleCreateTag = async (name: string) => {
    try {
      const newTag = await tagApi.createTag({
        name,
        type: tagType,
        color: '#' + Math.floor(Math.random()*16777215).toString(16), // 随机颜色
      });
      
      // 重新加载标签列表
      await loadTags();
      
      // 自动选择新创建的标签
      const newTagIds = [...selectedTags, newTag.tag_id];
      await handleTagsChange(newTagIds);
      
      toast.success('标签已创建');
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error('创建标签失败');
      throw error;
    }
  };

  // 转换标签为选项格式
  const options = tags.map(tag => ({
    value: tag.tag_id,
    label: tag.name,
    color: tag.color,
  }));

  // 根据标签类型显示不同的标题
  const getLabel = () => {
    switch (tagType) {
      case 'topic':
        return '主题';
      case 'department':
        return '部门';
      default:
        return '标签';
    }
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {getLabel()}
      </label>
      <MultiSelect
        options={options}
        value={selectedTags}
        onChange={handleTagsChange}
        placeholder={`选择${getLabel()}...`}
        disabled={saving}
        loading={loading}
        onCreateNew={handleCreateTag}
        createNewPlaceholder={`创建新${getLabel()}`}
      />
    </div>
  );
};