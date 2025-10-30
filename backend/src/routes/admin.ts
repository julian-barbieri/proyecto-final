import express, { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/ping', (req: AuthRequest, res: Response) => {
  res.json({
    message: 'Admin endpoint is accessible',
    user: req.user,
  });
});

export default router;

