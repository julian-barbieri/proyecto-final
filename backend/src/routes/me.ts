import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
      id: req.user.sub,
      email: req.user.email,
      role: req.user.role,
      orgDomain: req.user.orgDomain,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

