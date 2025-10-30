import express, { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/ping', (req: AuthRequest, res: Response) => {
  res.json({
    message: 'Common endpoint is accessible to all authenticated users',
    user: req.user,
  });
});

export default router;

