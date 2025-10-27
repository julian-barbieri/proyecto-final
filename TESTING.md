# Testing Guide - Edu Predict MVP

## Manual Testing Checklist

### Sprint 0 Acceptance Criteria

#### 1. Docker Compose Startup
- [ ] Run `docker compose up -d`
- [ ] All services start without errors
- [ ] All health checks pass

#### 2. Backend Health Check
- [ ] Navigate to http://localhost:3001/health
- [ ] Response includes:
  - `status: "healthy"`
  - `service: "backend"`
  - `commit: "28f9dd6"` (or current commit hash)
  - `version: "1.0.0"`

#### 3. AI Service Health Check
- [ ] Navigate to http://localhost:8000/health
- [ ] Response includes:
  - `status: "healthy"`
  - `service: "ai-service"`
  - `commit: "76cd461"` (or current commit hash)
  - `version: "1.0.0"`

#### 4. Frontend Display
- [ ] Navigate to http://localhost:3000
- [ ] Display shows "✅ It Works!" message
- [ ] Backend service card displays with commit hash
- [ ] AI service card displays with commit hash
- [ ] Page is responsive and styled with Tailwind

#### 5. Database Migration
- [ ] Database schema is created on startup
- [ ] User table exists
- [ ] No migration errors in logs

## Test Commands

### Check Service Status
```powershell
docker compose ps
```

Expected output:
- All services show "Up" status
- DB: "healthy"
- Backend: "healthy"
- AI Service: "healthy"
- Frontend: "Up" (no health check)

### Check Health Endpoints
```powershell
# Backend
curl http://localhost:3001/health

# AI Service
curl http://localhost:8000/health
```

### View Logs
```powershell
# All services
docker compose logs

# Specific service
docker compose logs backend
docker compose logs ai-service
docker compose logs frontend
```

### Test Database Connection
```powershell
docker compose exec db psql -U postgres -d edupredict -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

Expected output should include the `User` table.

## Troubleshooting Tests

### Test 1: Verify Docker Images
```powershell
docker images | findstr "edu-predict"
```

Should show built images for each service.

### Test 2: Verify Network
```powershell
docker network ls | findstr "proyecto-final"
```

### Test 3: Check Container Logs for Errors
```powershell
docker compose logs | findstr "error"
```

Should be empty or only show expected warnings.

### Test 4: Test Inter-Service Communication
```powershell
docker compose exec backend ping -c 1 db
docker compose exec ai-service ping -c 1 db
```

### Test 5: Verify Port Exposure
```powershell
netstat -ano | findstr ":3000"
netstat -ano | findstr ":3001"
netstat -ano | findstr ":8000"
netstat -ano | findstr ":5432"
```

## Performance Tests

### Load Test (Optional)
```powershell
# Test backend
for ($i=1; $i -le 100; $i++) {
    Invoke-WebRequest -Uri "http://localhost:3001/health"
}

# Test AI service
for ($i=1; $i -le 100; $i++) {
    Invoke-WebRequest -Uri "http://localhost:8000/health"
}
```

## Expected Results

### Backend Health Response
```json
{
  "status": "healthy",
  "service": "backend",
  "timestamp": "2025-10-27T00:00:00.000Z",
  "commit": "28f9dd6",
  "version": "1.0.0"
}
```

### AI Service Health Response
```json
{
  "status": "healthy",
  "service": "ai-service",
  "timestamp": "2025-10-27T00:00:00.000Z",
  "commit": "76cd461",
  "version": "1.0.0"
}
```

### Frontend Display
- White centered card with blue/indigo gradient background
- Service cards showing green/purple borders
- Commit hashes displayed (7 characters)
- Responsive design on mobile and desktop

## Common Issues

### Issue: Services not starting
**Test**: Check Docker Desktop is running
```powershell
docker info
```

### Issue: Port already in use
**Test**: Check which process is using the port
```powershell
netstat -ano | findstr ":3000"
```

### Issue: Database connection refused
**Test**: Check if database is healthy
```powershell
docker compose exec db pg_isready -U postgres
```

### Issue: Build errors
**Test**: Rebuild images
```powershell
docker compose build --no-cache
```

## Checklist for Pull Request

Before submitting Sprint 0 for review, ensure:

- [ ] All services start with `docker compose up -d`
- [ ] Health checks return correct responses
- [ ] Frontend displays "It works" message
- [ ] Commit hashes are displayed correctly
- [ ] No errors in container logs
- [ ] Database migrations run automatically
- [ ] Documentation is complete (README, QUICKSTART, ARCHITECTURE)
- [ ] .gitignore files are configured
- [ ] Docker Compose configuration is correct

## Next Sprint Tests

### Sprint 1 Preparation
- Google OAuth integration tests
- shadcn/ui component tests
- Model deployment tests
- User authentication tests

