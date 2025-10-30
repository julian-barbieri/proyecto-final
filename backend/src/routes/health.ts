import express, { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Get git commit hash
    let commitHash = 'unknown';
    try {
      const { stdout } = await execAsync('git rev-parse HEAD');
      commitHash = stdout.trim();
    } catch (error) {
      // Ignore if git is not available
    }

    res.json({
      status: 'healthy',
      service: 'backend',
      timestamp: new Date().toISOString(),
      commit: commitHash.substring(0, 7),
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: 'Unable to get version info' });
  }
});

export default router;
