import { Router, Request, Response } from 'express';
import { ServiceInspectorService } from '../services/ServiceInspectorService';

const router = Router();
const serviceInspector = new ServiceInspectorService();

// GET /api/services/overview
router.get('/overview', async (_req: Request, res: Response, next: any) => {
  try {
    const snapshot = await serviceInspector.getOverview();
    res.json(snapshot);
  } catch (e) {
    next(e);
  }
});

// GET /api/services/by-cwd?path=...
router.get('/by-cwd', async (req: Request, res: Response, next: any) => {
  try {
    const dir = req.query.path as string | undefined;
    if (!dir || !dir.startsWith('/')) {
      res.status(400).json({ error: 'path parameter required, must be absolute path' });
      return;
    }
    const result = await serviceInspector.getServicesByCwd(dir);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export { router as serviceRouter };