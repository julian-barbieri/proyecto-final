# Sprint 1 Setup Guide

## Quick Start

### 1. Configure Environment Variables

Create `.env` files in `backend/` and `frontend/` directories using the provided `env.example` files.

**Backend** (`backend/.env`):
```env
DATABASE_URL="postgresql://postgres:postgres@db:5432/edupredict"
JWT_SECRET="your-super-secure-secret-key-12345"
ALLOWED_EMAIL_DOMAIN="usal.edu.ar"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_AUDIENCE="your-client-id.apps.googleusercontent.com"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
PORT=3001
NODE_ENV="development"
LOG_LEVEL="info"
```

**Frontend** (`frontend/.env`):
```env
VITE_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
VITE_API_BASE_URL="http://localhost:3001"
```

### 2. Get Google OAuth Credentials

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 Client ID (Web application type)
5. Add authorized origins:
   - `http://localhost:3000`
   - `http://localhost:5173`
6. Copy Client ID to both `.env` files

### 3. Start the Application

```powershell
docker compose up -d --build
```

This will:
- Build all Docker images
- Start PostgreSQL database
- Run Prisma migrations automatically
- Start backend service
- Start frontend service
- Start AI service (if needed)

### 4. Run Database Seed

```powershell
docker compose exec backend npm run prisma:seed
```

This creates 4 test users:
- director@usal.edu.ar (DIRECTOR)
- tutor@usal.edu.ar (TUTOR)
- profesor@usal.edu.ar (PROFESOR)
- j.barbieri@usal.edu.ar (ALUMNO)

### 5. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- AI Service: http://localhost:8000

## What to Test

### Scenario 1: Successful Login
1. Open http://localhost:3000
2. Click "Sign in with Google"
3. Sign in with an @usal.edu.ar email
4. Should redirect to dashboard
5. Dashboard shows your name and role

### Scenario 2: Domain Validation (MEJORAR EL CARTEL DEL ERROR)
1. Try to sign in with a non-@usal.edu.ar email
2. Should receive "Domain not allowed" error

### Scenario 3: Route Protection
1. Try accessing http://localhost:3000/dashboard without login
2. Should redirect to /login

### Scenario 4: Role-Based Access
1. Login as DIRECTOR → can access all pages
2. Login as TUTOR → can access /tutor but not /director
3. Login as ALUMNO → can only access /common and /dashboard

###For chaging role run: 
"docker compose exec backend npm run change-role j.barbieri@usal.edu.ar DIRECTOR"


## Troubleshooting

### Services not starting
```powershell
docker compose down
docker compose up -d --build
```

### Database migration issues
```powershell
docker compose exec backend npx prisma migrate reset
docker compose exec backend npm run prisma:seed
```

### Check logs
```powershell
docker compose logs -f backend
docker compose logs -f frontend
```

### Verify environment variables
```powershell
docker compose exec backend printenv
```

## Development Mode

To run services in development mode with hot reload:

```powershell
# Backend
cd backend
npm install
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Database will still be accessed via Docker container.

## Next Steps

See `SPRINT1_README.md` for detailed testing instructions and acceptance criteria.

