# Script rápido de validación - Sprint 2
# Ejecutar desde la raíz del proyecto: .\backend\test-quick.ps1

Write-Host "=== Validación Rápida Sprint 2 ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar migración
Write-Host "1. Verificando migración Prisma..." -ForegroundColor Yellow
if (Test-Path "backend\prisma\migrations") {
    $migrations = Get-ChildItem "backend\prisma\migrations" -Directory
    Write-Host "   ✓ Encontradas $($migrations.Count) migraciones" -ForegroundColor Green
} else {
    Write-Host "   ✗ No se encontraron migraciones. Ejecuta: npx prisma migrate dev" -ForegroundColor Red
}

# 2. Verificar schema
Write-Host "2. Verificando schema.prisma..." -ForegroundColor Yellow
$schema = Get-Content "backend\prisma\schema.prisma" -Raw
$models = @("User", "Subject", "Enrollment", "Assessment", "TutorAssignment", "ProfessorAssignment")
foreach ($model in $models) {
    if ($schema -match "model $model") {
        Write-Host "   ✓ Modelo $model encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Modelo $model NO encontrado" -ForegroundColor Red
    }
}

# 3. Verificar módulos ETL
Write-Host "3. Verificando módulos ETL..." -ForegroundColor Yellow
$etlFiles = @("csvMapping.ts", "rowSchema.ts", "importDataset.ts")
foreach ($file in $etlFiles) {
    $path = "backend\src\etl\$file"
    if (Test-Path $path) {
        Write-Host "   ✓ $file encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $file NO encontrado" -ForegroundColor Red
    }
}

# 4. Verificar rutas CRUD
Write-Host "4. Verificando rutas CRUD..." -ForegroundColor Yellow
$routes = @("subjects.ts", "enrollments.ts", "assessments.ts")
foreach ($route in $routes) {
    $path = "backend\src\routes\$route"
    if (Test-Path $path) {
        Write-Host "   ✓ $route encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $route NO encontrado" -ForegroundColor Red
    }
}

# 5. Verificar script de importación
Write-Host "5. Verificando package.json..." -ForegroundColor Yellow
$packageJson = Get-Content "backend\package.json" | ConvertFrom-Json
if ($packageJson.scripts.'import:csv') {
    Write-Host "   ✓ Script import:csv encontrado" -ForegroundColor Green
} else {
    Write-Host "   ✗ Script import:csv NO encontrado" -ForegroundColor Red
}

# 6. Verificar dependencias
Write-Host "6. Verificando dependencias..." -ForegroundColor Yellow
if ($packageJson.dependencies.'csv-parse') {
    Write-Host "   ✓ csv-parse encontrado" -ForegroundColor Green
} else {
    Write-Host "   ✗ csv-parse NO encontrado. Ejecuta: npm install" -ForegroundColor Red
}

# 7. Verificar tests
Write-Host "7. Verificando tests..." -ForegroundColor Yellow
$testFiles = Get-ChildItem "backend\src" -Recurse -Filter "*.test.ts" -ErrorAction SilentlyContinue
if ($testFiles) {
    Write-Host "   ✓ Encontrados $($testFiles.Count) archivos de test" -ForegroundColor Green
    foreach ($test in $testFiles) {
        Write-Host "     - $($test.Name)" -ForegroundColor Gray
    }
} else {
    Write-Host "   ✗ No se encontraron tests" -ForegroundColor Red
}

# 8. Verificar CSV
Write-Host "8. Verificando archivo CSV..." -ForegroundColor Yellow
$csvPath = "backend\data\dataset_alumnos.csv"
if (Test-Path $csvPath) {
    $csvLines = (Get-Content $csvPath | Measure-Object -Line).Lines
    Write-Host "   ✓ CSV encontrado con $csvLines líneas" -ForegroundColor Green
} else {
    Write-Host "   ⚠ CSV no encontrado en $csvPath (opcional para pruebas)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Siguientes Pasos ===" -ForegroundColor Cyan
Write-Host "1. Ejecuta migración: cd backend && npx prisma migrate dev --name sprint2_schema" -ForegroundColor White
Write-Host "2. Ejecuta seed: cd backend && npm run prisma:seed" -ForegroundColor White
Write-Host "3. Inicia servidor: cd backend && npm run dev" -ForegroundColor White
Write-Host "4. Prueba importación: cd backend && npm run import:csv" -ForegroundColor White
Write-Host "5. Ejecuta tests: cd backend && npm test" -ForegroundColor White
Write-Host ""
Write-Host "Ver SPRINT2_VALIDATION.md para checklist completo" -ForegroundColor Cyan


