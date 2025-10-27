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
- Git

### Running the Application

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd proyecto-final
   ```

2. Start all services with Docker Compose:
   ```bash
   docker compose up -d
   ```

3. The application will be available at:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - AI Service: http://localhost:8000

4. Check health status:
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:8000/health
   ```

### Stopping the Application

```bash
docker compose down
```

To also remove volumes:

```bash
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

## Sprint 0 Goal

✅ Health checks operational in backend and ai-service  
✅ Database migrated (empty schema)  
✅ Frontend serving "It works" screen with commit version  

## Next Steps

- [ ] Implement Google OAuth authentication
- [ ] Set up shadcn/ui components library
- [ ] Add ML model training endpoints
- [ ] Configure MinIO for file storage
- [ ] Add comprehensive error handling
- [ ] Set up CI/CD pipeline

## License

MIT
