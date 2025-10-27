# Start script for Edu Predict MVP
# This script starts all services using Docker Compose

Write-Host "Starting Edu Predict MVP services..." -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "Error: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Start services
Write-Host "Starting Docker Compose..." -ForegroundColor Yellow
docker compose up -d

# Wait a moment for services to start
Start-Sleep -Seconds 5

# Check service status
Write-Host "`nChecking service health..." -ForegroundColor Yellow

try {
    $backendHealth = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing
    $backendData = $backendHealth.Content | ConvertFrom-Json
    Write-Host "✓ Backend is healthy" -ForegroundColor Green
    Write-Host "  Commit: $($backendData.commit)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Backend health check failed" -ForegroundColor Red
}

try {
    $aiHealth = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing
    $aiData = $aiHealth.Content | ConvertFrom-Json
    Write-Host "✓ AI Service is healthy" -ForegroundColor Green
    Write-Host "  Commit: $($aiData.commit)" -ForegroundColor Gray
} catch {
    Write-Host "✗ AI Service health check failed" -ForegroundColor Red
}

Write-Host "`nServices are starting..." -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "AI Service: http://localhost:8000" -ForegroundColor Cyan

Write-Host "`nTo view logs: docker compose logs -f" -ForegroundColor Gray
Write-Host "To stop services: docker compose down" -ForegroundColor Gray

