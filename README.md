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

## Sprint 2: Modelo de Datos + Carga Inicial

### Características Implementadas

✅ **Esquema Prisma actualizado** con entidades académicas:
- User (con campos adicionales: gender, birthDate, isTechnicalHS)
- Subject (materias)
- Enrollment (inscripciones)
- Assessment (evaluaciones)
- TutorAssignment y ProfessorAssignment

✅ **ETL/Importador CSV** (`backend/src/etl/`):
- Mapeo flexible de columnas con múltiples aliases
- Validación con Zod
- Procesamiento idempotente (upsert)
- Reporte JSON con métricas y errores
- Soporte para CSV con columnas AM1/AM2

✅ **CRUD Endpoints**:
- `/api/subjects` - Gestión de materias (GET, POST, PUT, DELETE)
- `/api/enrollments` - Gestión de inscripciones (GET, POST, PUT)
- `/api/assessments` - Gestión de evaluaciones (GET, POST, PUT)
- Paginación y filtrado en todos los endpoints

✅ **Migraciones y Seed**:
- Migración Prisma para Sprint 2
- Seed con Subjects AM1 y SN, tutores y profesores

✅ **Tests**:
- Tests unitarios para ETL
- Tests de integración para endpoints API

### Importar Datos desde CSV

1. **Preparar el archivo CSV**:
   - Colocar el archivo en `backend/data/dataset_alumnos.csv`
   - O especificar la ruta con `--file`

2. **Configurar variables de entorno** en `backend/.env`:
   ```env
   DATASET_CSV="./data/dataset_alumnos.csv"
   CSV_DELIMITER=","
   ALLOWED_EMAIL_DOMAIN="usal.edu.ar"
   ```

3. **Ejecutar importación**:
   ```bash
   cd backend
   npm run import:csv
   
   # O con ruta personalizada:
   npm run import:csv -- --file ./data/dataset_alumnosV4.csv
   ```

4. **Ver reporte de importación**:
   - Se genera `import_report.json` en la raíz del backend
   - Incluye métricas: filas procesadas, usuarios creados, errores, etc.

### API Endpoints Sprint 2

#### Subjects

```
GET    /api/subjects?name=AM1&page=1&pageSize=20
GET    /api/subjects/:id
POST   /api/subjects (requiere DIRECTOR/TUTOR)
PUT    /api/subjects/:id (requiere DIRECTOR/TUTOR)
DELETE /api/subjects/:id (requiere DIRECTOR)
```

#### Enrollments

```
GET    /api/enrollments?subjectId=&academicYear=&minAttendance=&risk=dropout
GET    /api/enrollments/:id
POST   /api/enrollments (requiere DIRECTOR/TUTOR)
PUT    /api/enrollments/:id (requiere DIRECTOR/TUTOR/PROFESOR)
```

#### Assessments

```
GET    /api/assessments?enrollmentId=&kind=
GET    /api/assessments/:id
POST   /api/assessments (requiere DIRECTOR/TUTOR/PROFESOR)
PUT    /api/assessments/:id (requiere DIRECTOR/TUTOR/PROFESOR)
```

### Ejecutar Tests

```bash
cd backend
npm test
```

### Migraciones y Seed

```bash
# Crear migración
cd backend
npx prisma migrate dev --name sprint2_schema

# Ejecutar seed
npm run prisma:seed
```

### Estructura ETL

```
backend/src/etl/
├── csvMapping.ts      # Mapeo flexible de columnas
├── rowSchema.ts       # Validación Zod
└── importDataset.ts   # Script principal de importación
```

Ver `DOCUMENTATION.md` para detalles completos.  

## Next Steps

- [ ] Implement Google OAuth authentication
- [ ] Set up shadcn/ui components library
- [ ] Add ML model training endpoints
- [ ] Configure MinIO for file storage
- [ ] Add comprehensive error handling
- [ ] Set up CI/CD pipeline

## License

MIT
