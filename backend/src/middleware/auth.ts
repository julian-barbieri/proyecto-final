import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../lib/jwt';
import { logger } from '../lib/logger';

export interface AuthRequest extends Request {
  user?: {
    sub: string;
    email: string;
    role: string;
    orgDomain: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const payload = verifyJwt(token);

    // Attach user to request
    req.user = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      orgDomain: payload.orgDomain,
    };

    next();
  } catch (error) {
    if (error instanceof Error) {
      logger.warn('Authentication failed', { error: error.message });
      return res.status(401).json({ error: error.message });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

