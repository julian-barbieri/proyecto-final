import request from 'supertest';
import express from 'express';
import enrollmentsRouter from '../enrollments';

const createApp = () => {
  const app = express();
  app.use(express.json());
  
  app.use((req: any, res: any, next: any) => {
    req.user = {
      sub: 'test-user-id',
      email: 'tutor@usal.edu.ar',
      role: 'TUTOR',
      orgDomain: 'usal.edu.ar',
    };
    next();
  });
  
  app.use('/api/enrollments', enrollmentsRouter);
  return app;
};

describe('Enrollments API', () => {
  const app = createApp();

  describe('GET /api/enrollments', () => {
    it('should return paginated enrollments', async () => {
      const res = await request(app)
        .get('/api/enrollments')
        .query({ page: 1, pageSize: 20 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('total');
    });

    it('should filter by academic year', async () => {
      const res = await request(app)
        .get('/api/enrollments')
        .query({ academicYear: 2024 });

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        expect(res.body.data.every((e: any) => e.academicYear === 2024)).toBe(true);
      }
    });

    it('should filter by min attendance', async () => {
      const res = await request(app)
        .get('/api/enrollments')
        .query({ minAttendance: 70 });

      expect(res.status).toBe(200);
    });

    it('should filter by risk=dropout', async () => {
      const res = await request(app)
        .get('/api/enrollments')
        .query({ risk: 'dropout' });

      expect(res.status).toBe(200);
      // If any enrollments returned, they should have dropoutFlag=true
      if (res.body.data.length > 0) {
        expect(res.body.data.every((e: any) => e.dropoutFlag === true)).toBe(true);
      }
    });
  });
});


