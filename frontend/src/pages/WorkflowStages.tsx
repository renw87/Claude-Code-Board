import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Workflow,
  ListTodo,
  Palette,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { workflowStageService, WorkflowStage } from '../services/workflowStageService';
import { agentPromptService, AgentListItem } from '../services/agentPromptService';
import toast from 'react-hot-toast';

export const WorkflowStages: React.FC = () => {
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<WorkflowStage>>({});
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  
  // Agent 相关状态
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [promptSource, setPromptSource] = useState<'custom' | 'agent'>('custom');
  const [agentError, setAgentError] = useState<string>('');
  const [isAgentConfigured, setIsAgentConfigured] = useState(false);

  useEffect(() => {
    loadStages();
    loadAgentConfig();
  }, []);

  const loadAgentConfig = async () => {
    try {
      const config = await agentPromptService.getConfig();
      setIsAgentConfigured(config.configured);
      if (config.configured) {
        const agentList = await agentPromptService.listAgents();
        setAgents(agentList);
      }
    } catch (error) {
      console.error('Failed to load agent config:', error);
    }
  };

  const loadStages = async () => {
    try {
      setLoading(true);
      const data = await workflowStageService.getAllStages();
      setStages(data);
    } catch (error) {
      toast.error('加载工作流程阶段失败');
      console.error('Failed to load workflow stages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setPromptSource('custom');
    setAgentError('');
    setFormData({
      name: '',
      description: '',
      system_prompt: '',
      agent_ref: '',
      suggested_tasks: [],
      color: '#8B5CF6',
      icon: 'workflow',
      is_active: true
    });
  };

  const handleEdit = (stage: WorkflowStage) => {
    setEditingStage(stage.stage_id);
    setPromptSource(stage.agent_ref ? 'agent' : 'custom');
    setAgentError('');
    setFormData({
      ...stage,
      suggested_tasks: stage.suggested_tasks || []
    });
  };

  // Agent 验证逻辑
  const validateAgent = async (agentName: string): Promise<boolean> => {
    if (!agentName) return true;
    
    try {
      const exists = await workflowStageService.checkAgentExists(agentName);
      if (!exists) {
        setAgentError(`Agent "${agentName}" 文件不存在！请检查 .claude 路径设置或选择其他 Agent。`);
        return false;
      }
      setAgentError('');
      return true;
    } catch (error) {
      setAgentError('验证 Agent 时发生错误');
      return false;
    }
  };

  const handlePromptSourceChange = (source: 'custom' | 'agent') => {
    setPromptSource(source);
    setAgentError('');
    
    if (source === 'agent') {
      // 切换到 Agent 模式时，清空自订提示词，保留 agent_ref
      setFormData(prev => ({ 
        ...prev, 
        system_prompt: '' 
      }));
    } else {
      // 切换到自订模式时，清空 agent_ref
      setFormData(prev => ({ 
        ...prev, 
        agent_ref: '' 
      }));
    }
  };

  const handleAgentChange = async (agentName: string) => {
    setFormData(prev => ({ ...prev, agent_ref: agentName }));
    
    if (agentName) {
      await validateAgent(agentName);
    } else {
      setAgentError('');
    }
  };

  const handleSave = async () => {
    try {
      if (isCreating) {
        // 验证必要字段
        if (!formData.name) {
          toast.error('请填写阶段名称');
          return;
        }

        // 根据提示词来源验证
        if (promptSource === 'custom') {
          if (!formData.system_prompt) {
            toast.error('请填写自订提示词');
            return;
          }
        } else {
          if (!formData.agent_ref) {
            toast.error('请选择 Agent');
            return;
          }
          
          // 验证 Agent 存在性
          const agentValid = await validateAgent(formData.agent_ref);
          if (!agentValid) {
            return;
          }
        }

        // 如果有 Agent 错误，阻止保存
        if (agentError) {
          toast.error('请先解决 Agent 设置问题');
          return;
        }
        await workflowStageService.createStage({
          name: formData.name!,
          description: formData.description,
          system_prompt: promptSource === 'custom' ? formData.system_prompt! : '',
          agent_ref: promptSource === 'agent' ? formData.agent_ref : '',
          suggested_tasks: formData.suggested_tasks,
          color: formData.color,
          icon: formData.icon
        });
        toast.success('工作流程阶段创建成功');
      } else if (editingStage) {
        // 同样的验证逻辑
        if (!formData.name) {
          toast.error('请填写阶段名称');
          return;
        }

        if (promptSource === 'custom') {
          if (!formData.system_prompt) {
            toast.error('请填写自订提示词');
            return;
          }
        } else {
          if (!formData.agent_ref) {
            toast.error('请选择 Agent');
            return;
          }
          
          const agentValid = await validateAgent(formData.agent_ref);
          if (!agentValid) {
            return;
          }
        }

        if (agentError) {
          toast.error('请先解决 Agent 设置问题');
          return;
        }

        await workflowStageService.updateStage(editingStage, {
          name: formData.name,
          description: formData.description,
          system_prompt: promptSource === 'custom' ? formData.system_prompt! : '',
          agent_ref: promptSource === 'agent' ? formData.agent_ref : '',
          suggested_tasks: formData.suggested_tasks,
          color: formData.color,
          icon: formData.icon,
          is_active: formData.is_active
        });
        toast.success('工作流程阶段更新成功');
      }
      setIsCreating(false);
      setEditingStage(null);
      setFormData({});
      setAgentError('');
      loadStages();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '操作失败';
      toast.error(errorMessage);
      console.error('Failed to save stage:', error);
      
      // 如果是 Agent 相关错误，显示在 agentError 中
      if (errorMessage.includes('Agent') && errorMessage.includes('不存在')) {
        setAgentError(errorMessage);
      }
    }
  };

  const handleDelete = async (stageId: string) => {
    if (!confirm('确定要删除这个工作流程阶段吗？')) {
      return;
    }
    try {
      await workflowStageService.deleteStage(stageId);
      toast.success('工作流程阶段已删除');
      loadStages();
    } catch (error) {
      toast.error('删除失败');
      console.error('Failed to delete workflow stage:', error);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingStage(null);
    setFormData({});
  };

  const handleTaskChange = (index: number, value: string) => {
    const tasks = [...(formData.suggested_tasks || [])];
    tasks[index] = value;
    setFormData({ ...formData, suggested_tasks: tasks });
  };

  const addTask = () => {
    const tasks = [...(formData.suggested_tasks || []), ''];
    setFormData({ ...formData, suggested_tasks: tasks });
  };

  const removeTask = (index: number) => {
    const tasks = (formData.suggested_tasks || []).filter((_, i) => i !== index);
    setFormData({ ...formData, suggested_tasks: tasks });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="glass-card rounded-xl p-4 flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-blue">
              <Workflow className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                工作流程阶段管理
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">配置 AI 工作流程的专业化阶段</p>
            </div>
            {stages.length > 0 && (
              <span className="px-3 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-sm font-medium">
                {stages.length} 个阶段
              </span>
            )}
          </div>

          <button
            onClick={handleCreate}
            className="flex items-center gap-2 btn-primary"
          >
            <Plus className="w-4 h-4" />
            添加阶段
          </button>
        </div>

        {/* 添加表单 - 玻璃卡片 */}
        {isCreating && (
          <div className="glass-card rounded-xl p-5 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">添加工作流程阶段</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名称 *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="例如：需求分析"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  placeholder="简短描述这个阶段的目的"
                />
              </div>
              {/* 提示词来源选择 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  提示词来源 *
                </label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="custom"
                      checked={promptSource === 'custom'}
                      onChange={() => handlePromptSourceChange('custom')}
                      className="mr-2"
                    />
                    <span className="text-sm">自订提示词</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="agent"
                      checked={promptSource === 'agent'}
                      onChange={() => handlePromptSourceChange('agent')}
                      disabled={!isAgentConfigured}
                      className="mr-2"
                    />
                    <span className={`text-sm ${!isAgentConfigured ? 'text-gray-400' : ''}`}>
                      使用 Agent
                    </span>
                    {!isAgentConfigured && (
                      <span className="ml-2 text-xs text-gray-500">
                        (请先设置 Agent 路径)
                      </span>
                    )}
                  </label>
                </div>

                {/* 根据选择显示不同的输入界面 */}
                {promptSource === 'custom' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      系统提示词 (System Prompt) *
                    </label>
                    <textarea
                      value={formData.system_prompt || ''}
                      onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                      rows={4}
                      className="input"
                      placeholder="定义 AI Agent 在这个阶段的行为和角色..."
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      选择 Agent *
                    </label>
                    <select
                      value={formData.agent_ref || ''}
                      onChange={(e) => handleAgentChange(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        agentError ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">选择一个 Agent...</option>
                      {agents.map(agent => (
                        <option key={agent.name} value={agent.name}>
                          {agent.name} ({agent.fileName})
                        </option>
                      ))}
                    </select>
                    
                    {/* Agent 错误提示 */}
                    {agentError && (
                      <div className="mt-2 p-3 bg-red-50 border-l-4 border-red-400 rounded">
                        <div className="flex">
                          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                          <div className="ml-2">
                            <p className="text-sm text-red-700">{agentError}</p>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => window.location.href = '/agent-prompts'}
                                className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
                              >
                                检查 Agent 设置
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePromptSourceChange('custom')}
                                className="text-sm bg-gray-100 text-gray-800 px-3 py-1 rounded hover:bg-gray-200"
                              >
                                改用自订提示词
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 显示当前 Agent */}
                    {formData.agent_ref && !agentError && (
                      <p className="mt-2 text-sm text-gray-600">
                        <FileText className="inline w-4 h-4 mr-1" />
                        将使用{' '}
                        <a
                          href={`/agent-prompts/${formData.agent_ref}`}
                          className="bg-gray-100 px-1 py-0.5 rounded hover:bg-gray-200 text-blue-600 hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            window.location.href = `/agent-prompts/${formData.agent_ref}`;
                          }}
                        >
                          {formData.agent_ref}.md
                        </a>
                        {' '}的提示词
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Palette className="inline w-4 h-4 mr-1" />
                  颜色
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <ListTodo className="inline w-4 h-4 mr-1" />
                  建议任务
                </label>
                <div className="space-y-2">
                  {(formData.suggested_tasks || []).map((task, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={task}
                        onChange={(e) => handleTaskChange(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="输入建议任务..."
                      />
                      <button
                        onClick={() => removeTask(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addTask}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + 添加建议任务
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleCancel}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 btn-primary"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        )}
        

        {/* 阶段列表 - 列表模式 */}
        <div className="space-y-3">
          {stages.map((stage) => (
            <div
              key={stage.stage_id}
              className="glass-card rounded-lg overflow-hidden hover:shadow-soft-md transition-all duration-200"
            >
              {editingStage === stage.stage_id ? (
                // 编辑模式 - 列表适配表单
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-4">编辑工作流程阶段</h4>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 左侧基本信息 */}
                    <div className="space-y-3">
                      {/* 名称和描述 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">名称 *</label>
                          <input
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="阶段名称"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">颜色</label>
                          <input
                            type="color"
                            value={formData.color || '#8B5CF6'}
                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                            className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">描述</label>
                        <input
                          type="text"
                          value={formData.description || ''}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="简短描述这个阶段的目的"
                        />
                      </div>

                      {/* 提示词来源切换 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">提示词来源 *</label>
                        <div className="flex gap-4 mb-3">
                          <label className="flex items-center text-sm">
                            <input
                              type="radio"
                              value="custom"
                              checked={promptSource === 'custom'}
                              onChange={() => handlePromptSourceChange('custom')}
                              className="mr-2"
                            />
                            自订提示词
                          </label>
                          <label className="flex items-center text-sm">
                            <input
                              type="radio"
                              value="agent"
                              checked={promptSource === 'agent'}
                              onChange={() => handlePromptSourceChange('agent')}
                              disabled={!isAgentConfigured}
                              className="mr-2"
                            />
                            使用 Agent
                          </label>
                        </div>

                        {/* 根据选择显示不同输入 */}
                        {promptSource === 'agent' ? (
                          <div>
                            <select
                              value={formData.agent_ref || ''}
                              onChange={(e) => handleAgentChange(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">选择 Agent...</option>
                              {agents.map(agent => (
                                <option key={agent.name} value={agent.name}>
                                  {agent.name}
                                </option>
                              ))}
                            </select>
                            {agentError && (
                              <p className="mt-1 text-xs text-red-600">{agentError}</p>
                            )}
                          </div>
                        ) : (
                          <textarea
                            value={formData.system_prompt || ''}
                            onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                            rows={4}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="定义 AI Agent 在这个阶段的行为和角色..."
                          />
                        )}
                      </div>
                    </div>

                    {/* 右侧建议任务 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">建议任务</label>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(formData.suggested_tasks || []).map((task, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={task}
                              onChange={(e) => {
                                const tasks = [...(formData.suggested_tasks || [])];
                                tasks[index] = e.target.value;
                                setFormData({ ...formData, suggested_tasks: tasks });
                              }}
                              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="建议任务描述..."
                            />
                            <button
                              onClick={() => {
                                const tasks = (formData.suggested_tasks || []).filter((_, i) => i !== index);
                                setFormData({ ...formData, suggested_tasks: tasks });
                              }}
                              className="px-2 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const tasks = [...(formData.suggested_tasks || []), ''];
                            setFormData({ ...formData, suggested_tasks: tasks });
                          }}
                          className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all border border-dashed border-blue-300 hover:border-blue-400"
                        >
                          + 添加建议任务
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 按钮组 */}
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:shadow-blue transition-all"
                    >
                      保存变更
                    </button>
                  </div>
                </div>
              ) : (
                // 紧凑列表显示模式
                <div className="px-4 py-3">
                  <div className="flex items-center gap-4">
                    {/* 阶段基本信息 */}
                    <div className="flex items-center gap-3 min-w-0 flex-shrink-0" style={{ width: '200px' }}>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {stage.name}
                        </h3>
                        {stage.description && (
                          <p className="text-xs text-gray-500 truncate">{stage.description}</p>
                        )}
                      </div>
                    </div>

                    {/* 提示词来源 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {stage.agent_ref ? '🤖' : '📝'}
                        </span>
                        {stage.agent_ref ? (
                          <a
                            href={`/agent-prompts/${stage.agent_ref}`}
                            className="text-sm bg-primary-50 text-primary-700 px-2 py-0.5 rounded hover:bg-primary-100 transition-all cursor-pointer flex-shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              window.location.href = `/agent-prompts/${stage.agent_ref}`;
                            }}
                          >
                            {stage.agent_ref}.md
                          </a>
                        ) : (
                          <p className="text-sm text-gray-700 truncate">
                            {stage.system_prompt}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 建议任务 */}
                    <div className="flex items-center gap-2 min-w-0" style={{ width: '250px' }}>
                      {stage.suggested_tasks && stage.suggested_tasks.length > 0 ? (
                        <>
                          <span className="text-xs text-gray-500 flex-shrink-0">💡</span>
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <span className="text-sm text-gray-700 truncate">
                              {stage.suggested_tasks[0]}
                            </span>
                            {stage.suggested_tasks.length > 1 && (
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedTasks);
                                  if (expandedTasks.has(stage.stage_id)) {
                                    newExpanded.delete(stage.stage_id);
                                  } else {
                                    newExpanded.add(stage.stage_id);
                                  }
                                  setExpandedTasks(newExpanded);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 flex-shrink-0"
                              >
                                +{stage.suggested_tasks.length - 1}
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">无建议任务</span>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(stage)}
                        className="p-1.5 text-gray-600 hover:bg-white/60 rounded transition-all hover:shadow-soft-sm"
                        title="编辑"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(stage.stage_id)}
                        className="p-1.5 text-danger-600 hover:bg-danger-50 rounded transition-all hover:shadow-soft-sm"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 展开的建议任务 */}
                  {expandedTasks.has(stage.stage_id) && stage.suggested_tasks && stage.suggested_tasks.length > 1 && (
                    <div className="mt-2 ml-6 pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-1">所有建议任务：</div>
                      <ul className="text-sm text-gray-700 space-y-0.5">
                        {stage.suggested_tasks.map((task, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-1.5 text-gray-400">•</span>
                            <span>{task}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};