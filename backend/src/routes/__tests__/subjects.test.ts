import request from 'supertest';
import express from 'express';
import subjectsRouter from '../subjects';
import { authenticate } from '../../middleware/auth';

// Mock app for testing
const createApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock auth middleware
  app.use((req: any, res: any, next: any) => {
    req.user = {
      sub: 'test-user-id',
      email: 'director@usal.edu.ar',
      role: 'DIRECTOR',
      orgDomain: 'usal.edu.ar',
    };
    next();
  });
  
  app.use('/api/subjects', subjectsRouter);
  return app;
};

describe('Subjects API', () => {
  const app = createApp();

  describe('GET /api/subjects', () => {
    it('should return paginated subjects', async () => {
      const res = await request(app)
        .get('/api/subjects')
        .query({ page: 1, pageSize: 20 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('pageSize');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by name', async () => {
      const res = await request(app)
        .get('/api/subjects')
        .query({ name: 'AM1' });

      expect(res.status).toBe(200);
      expect(res.body.data.every((s: any) => 
        s.name.toLowerCase().includes('am1')
      )).toBe(true);
    });
  });

  describe('POST /api/subjects', () => {
    it('should create a new subject', async () => {
      const subjectData = {
        name: 'Test Subject',
        year: 1,
        kind: 'inicial',
        modality: 'presencial',
        hasTutor: false,
      };

      const res = await request(app)
        .post('/api/subjects')
        .send(subjectData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(subjectData.name);
    });

    it('should reject invalid data', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .send({ name: '' }); // Invalid: empty name

      expect(res.status).toBe(400);
    });
  });
});


