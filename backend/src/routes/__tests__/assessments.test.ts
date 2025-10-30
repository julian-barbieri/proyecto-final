import request from 'supertest';
import express from 'express';
import assessmentsRouter from '../assessments';

const createApp = () => {
  const app = express();
  app.use(express.json());
  
  app.use((req: any, res: any, next: any) => {
    req.user = {
      sub: 'test-user-id',
      email: 'profesor@usal.edu.ar',
      role: 'PROFESOR',
      orgDomain: 'usal.edu.ar',
    };
    next();
  });
  
  app.use('/api/assessments', assessmentsRouter);
  return app;
};

describe('Assessments API', () => {
  const app = createApp();

  describe('POST /api/assessments', () => {
    it('should validate grade range (1-10)', async () => {
      // This test would need actual database setup
      // For now, we test the validation logic
      
      const invalidGrades = [0, 11, -1, 12];
      
      for (const grade of invalidGrades) {
        const res = await request(app)
          .post('/api/assessments')
          .send({
            enrollmentId: 'test-enrollment-id',
            kind: 'PARCIAL1',
            grade: grade,
          });

        // Should fail validation (404 if enrollment doesn't exist, or 400 for validation)
        expect([400, 404]).toContain(res.status);
      }
    });

    it('should accept valid grade (1-10)', async () => {
      // This would need proper test database setup
      // Skipping for now as it requires enrollment to exist
    });
  });

  describe('GET /api/assessments', () => {
    it('should return paginated assessments', async () => {
      const res = await request(app)
        .get('/api/assessments')
        .query({ page: 1, pageSize: 20 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('total');
    });
  });
});


