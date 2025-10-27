# Stop script for Edu Predict MVP

Write-Host "Stopping Edu Predict MVP services..." -ForegroundColor Yellow

docker compose down

Write-Host "Services stopped." -ForegroundColor Green

# Optional: Remove volumes
$removeVolumes = Read-Host "Do you want to remove volumes? (y/N)"
if ($removeVolumes -eq 'y' -or $removeVolumes -eq 'Y') {
    docker compose down -v
    Write-Host "Volumes removed." -ForegroundColor Green
}

