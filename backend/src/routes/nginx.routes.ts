import { Router, Request, Response } from 'express';
import { ServiceInspectorService } from '../services/ServiceInspectorService';

const router = Router();
const serviceInspector = new ServiceInspectorService();

// GET /api/nginx/config
router.get('/config', async (_req: Request, res: Response, next: any) => {
  try {
    const config = await serviceInspector.getNginxConfig();
    res.json(config);
  } catch (e) {
    next(e);
  }
});

// GET /api/nginx/file?path=...
router.get('/file', async (req: Request, res: Response, next: any) => {
  try {
    const relPath = req.query.path as string | undefined;
    if (!relPath) {
      res.status(400).json({ error: 'path parameter required' });
      return;
    }
    const result = await serviceInspector.readNginxFile(relPath);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export { router as nginxRouter };