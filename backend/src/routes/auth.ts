import express, { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { verifyGoogleToken } from '../lib/google';
import { signJwt } from '../lib/jwt';
import { logger } from '../lib/logger';
import rateLimit from 'express-rate-limit';

const router = express.Router();
const prisma = new PrismaClient();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

router.post('/google', authLimiter, async (req: Request, res: Response) => {
  try {
    // Validate input
    const { idToken } = googleAuthSchema.parse(req.body);

    // Get environment variables
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'usal.edu.ar';

    if (!GOOGLE_CLIENT_ID) {
      logger.error('GOOGLE_CLIENT_ID not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Verify Google token
    const googleData = await verifyGoogleToken(idToken, GOOGLE_CLIENT_ID);

    // Extract domain from email
    const domain = googleData.email.split('@')[1];

    // Verify domain is allowed
    if (domain !== ALLOWED_EMAIL_DOMAIN) {
      logger.warn('Domain not allowed', { email: googleData.email, domain });
      return res.status(403).json({ 
        error: 'Domain not allowed',
        message: `Only emails from @${ALLOWED_EMAIL_DOMAIN} are allowed`
      });
    }

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { email: googleData.email },
      update: {
        name: googleData.name,
        // Picture could be stored if needed
      },
      create: {
        email: googleData.email,
        name: googleData.name,
        role: 'ALUMNO', // Default role
      },
    });

    // Create JWT with user claims
    const token = signJwt({
      sub: user.id,
      email: user.email,
      role: user.role,
      orgDomain: domain,
    });

    logger.info('User authenticated successfully', { 
      email: user.email, 
      role: user.role 
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation error', { errors: error.errors });
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    
    if (error instanceof Error) {
      logger.error('Authentication error', { error: error.message });
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: error.message 
      });
    }

    logger.error('Unexpected error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    // Extract token from header if present (optional - frontend may call without auth)
    const authHeader = req.headers.authorization;
    let userEmail = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const { verifyJwt } = await import('../lib/jwt');
        const payload = verifyJwt(token);
        userEmail = payload.email;
        
        logger.info('User logout', { 
          email: userEmail,
          role: payload.role 
        });
      } catch (error) {
        // Token invalid or expired - still allow logout
        logger.warn('Logout with invalid token');
      }
    }

    // Logout is primarily client-side (token removed from localStorage)
    // Server-side: Log the logout event
    // Future: Could implement token blacklisting here
    
    res.json({ 
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Even if there's an error, allow logout (client-side operation)
    res.json({ 
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

