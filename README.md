# Edu Predict MVP

Multi-service educational prediction platform built with modern technologies.

## Architecture

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + React Router
- **Backend**: Node.js + Express + Prisma ORM + PostgreSQL
- **AI Service**: Python + FastAPI + scikit-learn
- **Database**: PostgreSQL
- **Orchestration**: Docker Compose

## Services

- **Frontend** (port 3000): React application with modern UI
- **Backend** (port 3001): REST API with authentication
- **AI Service** (port 8000): Machine learning predictions
- **Database** (port 5432): PostgreSQL database

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Google Cloud Console account (for OAuth credentials)

### Setup Instructions

1. **Configure environment variables** (see `SETUP_SPRINT1.md` for details):
   - Copy `backend/env.example` to `backend/.env`
   - Copy `frontend/env.example` to `frontend/.env`
   - Add your Google OAuth Client ID to both files

2. **Start services**:
   ```powershell
   docker compose up -d --build
   ```

3. **Seed the database**:
   ```powershell
   docker compose exec backend npm run prisma:seed
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - AI Service: http://localhost:8000

5. **Test login**:
   - Click "Sign in with Google"
   - Use an @usal.edu.ar email address

### Stopping the Application

```powershell
docker compose down
```

To also remove volumes:

```powershell
docker compose down -v
```

## Project Structure

```
proyecto-final/
├── frontend/          # React application
├── backend/           # Node.js API
├── ai-service/        # Python FastAPI service
├── docker-compose.yml # Orchestration
└── README.md
```

## Development

### Backend Development

```bash
cd backend
npm install
npm run dev
```

### AI Service Development

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## Health Checks

All services include health check endpoints:

- Backend: `GET /health`
- AI Service: `GET /health`

Health checks return service status, commit hash, and version information.

## Environment Variables

Create `.env` files in each service directory as needed:

### Backend (.env)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/edupredict
JWT_SECRET=your-secret-key
ALLOWED_DOMAINS=gmail.com
```

## Database Migration

Prisma migrations are automatically applied on container startup. To manually run migrations:

```bash
cd backend
npm run prisma:migrate
```

## Sprint 1: Authentication & RBAC

✅ Google OAuth integration  
✅ JWT-based authentication  
✅ Role-Based Access Control (RBAC)  
✅ Protected routes and role guards  
✅ Database with user roles  
✅ Seed data for testing

See `SPRINT1_README.md` for complete details.  

## Next Steps

- [ ] Implement Google OAuth authentication
- [ ] Set up shadcn/ui components library
- [ ] Add ML model training endpoints
- [ ] Configure MinIO for file storage
- [ ] Add comprehensive error handling
- [ ] Set up CI/CD pipeline

## License

MIT
