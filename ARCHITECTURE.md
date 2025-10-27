# Architecture Documentation - Edu Predict MVP

## System Overview

Edu Predict MVP is a multi-service application designed for educational prediction and analysis. The architecture follows a microservices pattern with clear separation of concerns.

## Service Architecture

```
┌─────────────────┐
│    Frontend     │  ← React + TypeScript + Tailwind
│   Port: 3000    │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
┌────────▼────────┐  ┌─────▼──────────┐
│    Backend      │  │   AI Service   │
│   Port: 3001    │  │   Port: 8000   │
│ Node + Express  │  │  Python FastAPI│
└────────┬────────┘  └────────────────┘
         │
         │
┌────────▼────────┐
│   PostgreSQL    │
│   Port: 5432    │
└─────────────────┘
```

## Service Details

### Frontend Service
- **Technology**: Vite + React + TypeScript
- **Port**: 3000
- **UI Framework**: Tailwind CSS
- **Routing**: React Router v6
- **Features**:
  - Health monitoring dashboard
  - Service status display
  - Commit version display
  - Responsive design

### Backend Service
- **Technology**: Node.js + Express + TypeScript
- **Port**: 3001
- **Database**: Prisma ORM + PostgreSQL
- **Authentication**: JWT-based (placeholder)
- **Endpoints**:
  - `GET /health` - Health check with version info
  - `POST /api/auth/google` - Google OAuth (placeholder)
- **Features**:
  - RESTful API
  - Database migrations
  - Domain-based access control

### AI Service
- **Technology**: Python + FastAPI
- **Port**: 8000
- **ML Framework**: scikit-learn (placeholder)
- **Endpoints**:
  - `GET /health` - Health check
  - `GET /api/models` - Model information
- **Features**:
  - Async request handling
  - Placeholder for ML models

### Database Service
- **Technology**: PostgreSQL 15
- **Port**: 5432
- **Database**: `edupredict`
- **ORM**: Prisma
- **Schema**: Initial User table

## Docker Compose Orchestration

### Health Checks
All services include health check configurations:
- Database: `pg_isready` command
- Backend: HTTP GET to `/health`
- AI Service: HTTP GET to `/health`
- Frontend: No explicit health check (relies on container status)

### Dependencies
- Backend depends on: Database (healthy)
- AI Service depends on: Database (healthy)
- Frontend depends on: Backend + AI Service

### Volume Management
- PostgreSQL data: Persistent volume
- Source code: Mounted for hot reload in development
- node_modules: Separate volume to prevent conflicts

## Development Workflow

### Starting Development
```powershell
docker compose up -d
```

This command:
1. Builds all Docker images
2. Starts containers in dependency order
3. Runs database migrations
4. Starts all services with hot reload

### Viewing Logs
```powershell
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
```

### Stopping Services
```powershell
docker compose down
```

## Database Schema

### Current Schema (Sprint 0)
```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

The schema is minimal for Sprint 0 and will be expanded in future sprints.

## Environment Variables

### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token signing
- `ALLOWED_DOMAINS`: Comma-separated list of allowed email domains
- `NODE_ENV`: Environment (development/production)

### AI Service
- `DATABASE_URL`: PostgreSQL connection string (future use)

### Frontend
- `VITE_API_URL`: Backend API URL

## Network Architecture

All services run in the same Docker network (`proyecto-final_default`), allowing:
- Service-to-service communication using service names
- Database access from backend and ai-service
- External access via exposed ports

## Security Considerations (Sprint 0)

- **JWT Secret**: Placeholder secret, must be changed in production
- **OAuth**: Placeholder Google OAuth implementation
- **CORS**: Currently open, will be restricted in production
- **Database**: No authentication, suitable for local development only

## Future Enhancements

1. **Authentication**:
   - Complete Google OAuth integration
   - Token refresh mechanism
   - Role-based access control

2. **Database**:
   - Expand schema with educational entities
   - Add indexes for performance
   - Implement data seeding

3. **AI Service**:
   - Deploy actual ML models
   - Model versioning
   - Prediction endpoints

4. **Storage**:
   - MinIO integration for file storage
   - S3 compatibility

5. **Monitoring**:
   - Application performance monitoring (APM)
   - Log aggregation
   - Metrics collection

6. **CI/CD**:
   - Automated testing
   - Continuous deployment
   - Environment management

## Sprint 0 Goals ✅

- [x] Docker Compose orchestration
- [x] Health checks for all services
- [x] Database migrations on startup
- [x] Frontend "It works" screen
- [x] Version display using git commit
- [x] Service-to-service communication

