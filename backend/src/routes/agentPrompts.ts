import { Router, Request, Response } from 'express';
import { agentPromptService } from '../services/AgentPromptService';

const router = Router();

/**
 * GET /api/agent-prompts/config
 * 取得当前 Claude agents 路径设置
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const path = await agentPromptService.getClaudePath();
    res.json({ 
      configured: !!path,
      path: path 
    });
  } catch (error) {
    console.error('Failed to get Claude path:', error);
    res.status(500).json({ 
      error: 'Failed to get configuration' 
    });
  }
});

/**
 * PUT /api/agent-prompts/config
 * 设置 Claude agents 路径
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const { path } = req.body;
    
    if (!path) {
      return res.status(400).json({ 
        error: 'Path is required' 
      });
    }

    await agentPromptService.setClaudePath(path);
    res.json({ 
      success: true,
      message: 'Path configured successfully' 
    });
  } catch (error: any) {
    console.error('Failed to set Claude path:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to set configuration' 
    });
  }
});

/**
 * GET /api/agent-prompts
 * 列出所有 agent 文件
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const agents = await agentPromptService.listAgents();
    res.json(agents);
  } catch (error) {
    console.error('Failed to list agents:', error);
    res.status(500).json({ 
      error: 'Failed to list agents' 
    });
  }
});

/**
 * GET /api/agent-prompts/:name
 * 取得单一 agent 的详细内容
 */
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({ 
        error: 'Agent name is required' 
      });
    }

    const agent = await agentPromptService.getAgentContent(name);
    
    if (!agent) {
      return res.status(404).json({ 
        error: 'Agent not found' 
      });
    }

    res.json(agent);
  } catch (error: any) {
    console.error(`Failed to get agent ${req.params.name}:`, error);
    res.status(400).json({ 
      error: error.message || 'Failed to get agent content' 
    });
  }
});

export default router;