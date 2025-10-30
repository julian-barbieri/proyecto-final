import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import commonRouter from './routes/common';
import subjectsRouter from './routes/subjects';
import enrollmentsRouter from './routes/enrollments';
import assessmentsRouter from './routes/assessments';
import { authenticate } from './middleware/auth';
import { requireRole } from './middleware/rbac';
import { getMe } from './routes/me';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());

// Public routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);

// Protected routes
app.get('/api/me', authenticate, getMe);

// Admin routes (only for DIRECTOR and TUTOR)
app.use('/api/admin', authenticate, requireRole('DIRECTOR', 'TUTOR'), adminRouter);

// Common routes (any authenticated user)
app.use('/api/common', authenticate, commonRouter);

// Academic routes (any authenticated user, with role-based restrictions)
app.use('/api/subjects', authenticate, subjectsRouter);
app.use('/api/enrollments', authenticate, enrollmentsRouter);
app.use('/api/assessments', authenticate, assessmentsRouter);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

