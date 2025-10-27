# Quick Start Guide - Edu Predict MVP

## Prerequisites

- Docker Desktop installed and running
- Windows PowerShell (for the provided scripts)

## Initial Setup

1. **Clone/Navigate to the project**:
   ```powershell
   cd C:\Users\Usuario\workspace\proyecto-final
   ```

2. **Start all services**:
   ```powershell
   .\start.ps1
   ```
   
   Or manually:
   ```powershell
   docker compose up -d
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/health
   - AI Service: http://localhost:8000/health

## Verify Installation

Check that all services are running:

```powershell
docker compose ps
```

Each service should show "healthy" status.

## View Logs

```powershell
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f ai-service
docker compose logs -f frontend
```

## Stop Services

```powershell
.\stop.ps1
```

Or manually:
```powershell
docker compose down
```

## Services Configuration

### Backend (Port 3001)
- Express + TypeScript
- Prisma ORM
- Health endpoint: `/health`
- Auth endpoint: `/api/auth/google`

### AI Service (Port 8000)
- FastAPI
- scikit-learn
- Health endpoint: `/health`

### Frontend (Port 3000)
- Vite + React + TypeScript
- Tailwind CSS
- Displays service health and commit versions

### Database (Port 5432)
- PostgreSQL
- Auto-migration on startup
- Database: `edupredict`

## Troubleshooting

### Services not starting
```powershell
docker compose logs [service-name]
```

### Database connection issues
- Check PostgreSQL is healthy: `docker compose ps db`
- Verify DATABASE_URL in docker-compose.yml

### Port conflicts
- Edit ports in `docker-compose.yml` if 3000, 3001, 8000, or 5432 are in use

### Rebuild services
```powershell
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Development

### Backend Development

```powershell
cd backend
npm install
npm run dev
```

### Frontend Development

```powershell
cd frontend
npm install
npm run dev
```

### AI Service Development

```powershell
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload
```

## Next Steps

After Sprint 0 completion, the next features to implement:
- Google OAuth integration
- shadcn/ui component library setup
- ML model training endpoints
- User management
- File upload with MinIO

