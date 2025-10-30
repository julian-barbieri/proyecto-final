import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { logger } from '../lib/logger';

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      logger.warn('Access denied', { 
        user: req.user.email, 
        role: userRole, 
        required: allowedRoles 
      });
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Required roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

