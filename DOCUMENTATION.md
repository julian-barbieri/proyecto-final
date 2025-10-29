# Edu Predict MVP - Documentación Completa

## Índice

1. [Descripción General](#descripción-general)
2. [Arquitectura](#arquitectura)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Inicio Rápido](#inicio-rápido)
5. [Configuración Detallada](#configuración-detallada)
6. [Sprint 1: Autenticación y RBAC](#sprint-1-autenticación-y-rbac)
7. [Guía de Testing](#guía-de-testing)
8. [Desarrollo](#desarrollo)
9. [Troubleshooting](#troubleshooting)

---

## Descripción General

Edu Predict MVP es una plataforma de predicción educativa multi-servicio construida con tecnologías modernas.

### Stack Tecnológico

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + React Router
- **Backend**: Node.js + Express + Prisma ORM + PostgreSQL
- **AI Service**: Python + FastAPI + scikit-learn
- **Database**: PostgreSQL
- **Orchestration**: Docker Compose

### Servicios

- **Frontend** (puerto 3000): Aplicación React con UI moderna
- **Backend** (puerto 3001): REST API con autenticación
- **AI Service** (puerto 8000): Predicciones de machine learning
- **Database** (puerto 5432): Base de datos PostgreSQL

---

## Arquitectura

### Diagrama de Arquitectura

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

### Detalles de Servicios

#### Frontend Service
- **Tecnología**: Vite + React + TypeScript
- **Puerto**: 3000
- **UI Framework**: Tailwind CSS
- **Routing**: React Router v6
- **Características**:
  - Dashboard de monitoreo de salud
  - Visualización de estado de servicios
  - Visualización de versión de commit
  - Diseño responsive

#### Backend Service
- **Tecnología**: Node.js + Express + TypeScript
- **Puerto**: 3001
- **Base de Datos**: Prisma ORM + PostgreSQL
- **Autenticación**: JWT con Google OAuth
- **Endpoints**:
  - `GET /health` - Health check con información de versión
  - `POST /api/auth/google` - Autenticación Google OAuth
  - `GET /api/me` - Perfil de usuario autenticado
  - `GET /api/admin/*` - Rutas de administración
  - `GET /api/common/*` - Rutas comunes
- **Características**:
  - RESTful API
  - Migraciones de base de datos
  - Control de acceso basado en roles (RBAC)
  - Rate limiting
  - Logging estructurado

#### AI Service
- **Tecnología**: Python + FastAPI
- **Puerto**: 8000
- **Framework ML**: scikit-learn
- **Endpoints**:
  - `GET /health` - Health check
  - `GET /api/models` - Información de modelos
- **Características**:
  - Manejo asíncrono de requests
  - Placeholder para modelos ML

#### Database Service
- **Tecnología**: PostgreSQL 15
- **Puerto**: 5432
- **Base de Datos**: `edupredict`
- **ORM**: Prisma
- **Schema**: User con roles (DIRECTOR, TUTOR, PROFESOR, ALUMNO)

### Docker Compose Orchestration

#### Health Checks
Todos los servicios incluyen configuraciones de health check:
- Database: comando `pg_isready`
- Backend: HTTP GET a `/health`
- AI Service: HTTP GET a `/health`
- Frontend: Sin health check explícito (rely en estado del contenedor)

#### Dependencias
- Backend depende de: Database (healthy)
- AI Service depende de: Database (healthy)
- Frontend depende de: Backend + AI Service

#### Volúmenes
- Datos PostgreSQL: Volumen persistente
- Código fuente: Montado para hot reload en desarrollo
- node_modules: Volumen separado para prevenir conflictos

---

## Estructura del Proyecto

```
proyecto-final/
├── docker-compose.yml       # Configuración de orquestación Docker
├── start.ps1                # Script PowerShell para iniciar
├── stop.ps1                 # Script PowerShell para detener
│
├── backend/                 # Servicio backend
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                 # Variables de entorno (no versionado)
│   ├── src/
│   │   ├── index.ts         # Punto de entrada principal
│   │   ├── routes/
│   │   │   ├── health.ts    # Endpoint de health check
│   │   │   ├── auth.ts      # Endpoints de autenticación
│   │   │   ├── me.ts        # Endpoint de perfil
│   │   │   ├── admin.ts     # Rutas de administración
│   │   │   └── common.ts    # Rutas comunes
│   │   ├── middleware/
│   │   │   ├── auth.ts      # Middleware de autenticación
│   │   │   ├── rbac.ts      # Control de acceso basado en roles
│   │   │   └── errorHandler.ts
│   │   ├── lib/
│   │   │   ├── google.ts    # Validación de tokens Google
│   │   │   ├── jwt.ts       # Utilidades JWT
│   │   │   └── logger.ts    # Logger Winston
│   │   └── utils/
│   │       └── git.ts       # Utilidades Git
│   └── prisma/
│       ├── schema.prisma    # Schema de base de datos
│       └── migrations/
│           └── 0_init/
│               └── migration.sql
│
├── frontend/                # Servicio frontend
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── .env                 # Variables de entorno (no versionado)
│   ├── index.html
│   └── src/
│       ├── main.tsx         # Punto de entrada React
│       ├── App.tsx          # Componente principal de App
│       ├── index.css        # Estilos globales
│       ├── components/
│       │   ├── PrivateRoute.tsx    # Protección de rutas
│       │   └── RoleGuard.tsx       # Guard basado en roles
│       ├── pages/
│       │   ├── HomePage.tsx
│       │   ├── LoginPage.tsx       # Página de login
│       │   ├── DashboardPage.tsx   # Dashboard principal
│       │   ├── CommonPage.tsx      # Página común
│       │   ├── TutorPage.tsx       # Página de tutor
│       │   ├── DirectorPage.tsx    # Página de director
│       │   ├── ForbiddenPage.tsx   # Error 403
│       │   └── NotFoundPage.tsx   # Error 404
│       ├── store/
│       │   └── useAuthStore.ts     # Store Zustand para autenticación
│       ├── lib/
│       │   └── api.ts              # Cliente API
│       └── types/
│           └── index.ts            # Tipos TypeScript
│
└── ai-service/              # Servicio AI
    ├── Dockerfile
    ├── requirements.txt
    ├── main.py             # Aplicación FastAPI
    └── .gitignore
```

### Convenciones de Nomenclatura

- **Directorios**: kebab-case (`ai-service`)
- **Archivos**: kebab-case (`error-handler.ts`)
- **Componentes**: PascalCase (`HomePage.tsx`)
- **Funciones**: camelCase (`getGitCommit`)
- **Constantes**: UPPER_SNAKE_CASE (`JWT_SECRET`)

---

## Inicio Rápido

### Prerrequisitos

- Docker Desktop instalado y ejecutándose
- Windows PowerShell (para los scripts proporcionados)
- Cuenta de Google Cloud Console (para credenciales OAuth)

### Setup Inicial

1. **Clonar/Navegar al proyecto**:
   ```powershell
   cd C:\Users\Usuario\workspace\proyecto-final
   ```

2. **Configurar variables de entorno** (ver sección de Configuración Detallada):
   - Copiar `backend/env.example` a `backend/.env`
   - Copiar `frontend/env.example` a `frontend/.env`
   - Agregar tu Google OAuth Client ID a ambos archivos

3. **Iniciar todos los servicios**:
   ```powershell
   .\start.ps1
   ```
   
   O manualmente:
   ```powershell
   docker compose up -d --build
   ```

4. **Ejecutar seed de base de datos**:
   ```powershell
   docker compose exec backend npm run prisma:seed
   ```

5. **Acceder a la aplicación**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - AI Service: http://localhost:8000

6. **Probar login**:
   - Click "Sign in with Google"
   - Usar un email @usal.edu.ar

### Detener la Aplicación

```powershell
.\stop.ps1
```

O manualmente:
```powershell
docker compose down
```

Para también remover volúmenes:

```powershell
docker compose down -v
```

---

## Configuración Detallada

### Variables de Entorno

#### Backend (`backend/.env`)
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

#### Frontend (`frontend/.env`)
```env
VITE_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
VITE_API_BASE_URL="http://localhost:3001"
```

### Configuración de Google OAuth

1. Visitar [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un nuevo proyecto o seleccionar uno existente
3. Habilitar Google+ API
4. Crear OAuth 2.0 Client ID (tipo Web application)
5. Agregar orígenes autorizados:
   - `http://localhost:3000`
   - `http://localhost:5173`
6. Copiar el Client ID a ambos archivos `.env`

### Verificar Instalación

Verificar que todos los servicios están ejecutándose:

```powershell
docker compose ps
```

Cada servicio debe mostrar estado "healthy".

### Ver Logs

```powershell
# Todos los servicios
docker compose logs -f

# Servicio específico
docker compose logs -f backend
docker compose logs -f ai-service
docker compose logs -f frontend
```

---

## Sprint 1: Autenticación y RBAC

### Objetivo

Implementar autenticación Google OAuth con autorización basada en JWT y Control de Acceso Basado en Roles (RBAC) para el MVP de Edu Predict.

### Características Completadas

#### Backend
- ✅ Schema de Prisma actualizado con modelo User y enum Role
- ✅ Seed de base de datos con 4 usuarios (Director, Tutor, Profesor, Alumno)
- ✅ Validación de tokens Google OAuth
- ✅ Generación y verificación de tokens JWT
- ✅ Middleware de autenticación
- ✅ Middleware RBAC con enforcement de roles
- ✅ Rutas protegidas (`/api/me`, `/api/admin/*`, `/api/common/*`)
- ✅ Rate limiting en endpoints de autenticación
- ✅ Logging estructurado con Winston
- ✅ Validación de input con Zod
- ✅ Configuración CORS

#### Frontend
- ✅ Integración de Google Identity Services
- ✅ Gestión de estado de autenticación con Zustand
- ✅ Guards de rutas (PrivateRoute, RoleGuard)
- ✅ Página de login con botón Google Sign-In
- ✅ Página de dashboard con visualización de rol
- ✅ Páginas protegidas para diferentes roles
- ✅ Páginas de error (403, 404)
- ✅ Header de navegación con logout
- ✅ Persistencia de token en localStorage

### Cuentas de Prueba

El seed crea 4 usuarios de prueba:
- **Director**: director@usal.edu.ar
- **Tutor**: tutor@usal.edu.ar
- **Profesor**: profesor@usal.edu.ar
- **Alumno**: alumno@usal.edu.ar

### Criterios de Aceptación Cumplidos

✅ Usuario con email @usal.edu.ar puede login con Google  
✅ Usuario recibe JWT y puede acceder a /dashboard  
✅ Usuario con dominio no permitido recibe error en login  
✅ GET /api/me retorna perfil correcto con rol  
✅ GET /api/admin/ping bloquea ALUMNO/PROFESOR, permite DIRECTOR/TUTOR  
✅ Frontend oculta menús para roles no autorizados  
✅ RoleGuard redirige a /403 para acceso no autorizado  
✅ Archivos .env.example creados  
✅ Aplicación inicia con docker compose up  
✅ Migraciones y seed de base de datos funcionan  

### Cambiar Rol de Usuario

Para cambiar el rol de un usuario:

```powershell
docker compose exec backend npm run change-role j.barbieri@usal.edu.ar DIRECTOR
```

### Características de Seguridad

✅ JWT con expiración de 8 horas  
✅ Verificación de dominio (@usal.edu.ar solamente)  
✅ Validación de tokens Google (aud, iss, exp)  
✅ Rate limiting en endpoints de autenticación  
✅ CORS restringido a orígenes permitidos  
✅ No se registran tokens o PII en logs  
✅ Enforcement de middleware RBAC  
✅ Secret seguro desde variables de entorno  

---

## Guía de Testing

### Checklist de Testing Manual

#### Flujo de Autenticación
- [ ] Navegar a http://localhost:3000
- [ ] Debe redirigir a /login
- [ ] Click "Sign in with Google"
- [ ] Autenticarse con email @usal.edu.ar
- [ ] Debe redirigir a /dashboard
- [ ] Dashboard debe mostrar nombre y rol del usuario

#### Protección de Rutas
- [ ] Intentar acceder a /dashboard sin login → debe redirigir a /login
- [ ] Intentar acceder a /common como usuario autenticado → debe funcionar
- [ ] Intentar acceder a /tutor como ALUMNO → debe redirigir a /403
- [ ] Intentar acceder a /director como no-director → debe redirigir a /403

#### Acceso Basado en Roles
- [ ] Login como DIRECTOR → puede acceder a todas las páginas
- [ ] Login como TUTOR → puede acceder a /tutor, no a /director
- [ ] Login como PROFESOR → solo puede acceder a /common y /dashboard
- [ ] Login como ALUMNO → solo puede acceder a /common y /dashboard

#### Endpoints de API
- [ ] `GET /health` → debe retornar estado del servicio
- [ ] `GET /api/me` (con token) → debe retornar perfil de usuario
- [ ] `GET /api/common/ping` (con token) → debe retornar success
- [ ] `GET /api/admin/ping` (como DIRECTOR/TUTOR) → debe retornar success
- [ ] `GET /api/admin/ping` (como ALUMNO/PROFESOR) → debe retornar 403

### Testing de API con curl

```powershell
# Login (reemplazar con id_token real de Google)
curl -X POST http://localhost:3001/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<google-id-token>"}'

# Obtener perfil de usuario
curl http://localhost:3001/api/me \
  -H "Authorization: Bearer <your-jwt-token>"

# Probar endpoint protegido
curl http://localhost:3001/api/common/ping \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Health Checks

#### Backend Health Check
```powershell
curl http://localhost:3001/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "service": "backend",
  "timestamp": "2025-10-27T00:00:00.000Z",
  "commit": "28f9dd6",
  "version": "1.0.0"
}
```

#### AI Service Health Check
```powershell
curl http://localhost:8000/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "service": "ai-service",
  "timestamp": "2025-10-27T00:00:00.000Z",
  "commit": "76cd461",
  "version": "1.0.0"
}
```

### Verificar Estado de Servicios

```powershell
docker compose ps
```

Salida esperada:
- Todos los servicios muestran estado "Up"
- DB: "healthy"
- Backend: "healthy"
- AI Service: "healthy"
- Frontend: "Up" (sin health check explícito)

### Verificar Conexión a Base de Datos

```powershell
docker compose exec db psql -U postgres -d edupredict -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

La salida debe incluir la tabla `User`.

---

## Desarrollo

### Desarrollo del Backend

```powershell
cd backend
npm install
npm run dev
```

### Desarrollo del Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Desarrollo del AI Service

```powershell
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload
```

La base de datos seguirá siendo accedida via contenedor Docker.

### Workflow de Desarrollo

#### Iniciar Desarrollo
```powershell
docker compose up -d
```

Este comando:
1. Construye todas las imágenes Docker
2. Inicia contenedores en orden de dependencias
3. Ejecuta migraciones de base de datos
4. Inicia todos los servicios con hot reload

#### Ver Logs

```powershell
# Todos los servicios
docker compose logs -f

# Servicio específico
docker compose logs -f backend
```

#### Detener Servicios

```powershell
docker compose down
```

### Migraciones de Base de Datos

Las migraciones de Prisma se aplican automáticamente al iniciar el contenedor. Para ejecutar manualmente:

```powershell
cd backend
npm run prisma:migrate
```

Para resetear y re-seedear:

```powershell
docker compose exec backend npx prisma migrate reset
docker compose exec backend npm run prisma:seed
```

---

## Troubleshooting

### Servicios No Inician

```powershell
docker compose down
docker compose up -d --build
```

### Problemas de Migración de Base de Datos

```powershell
docker compose exec backend npx prisma migrate reset
docker compose exec backend npm run prisma:seed
```

### Ver Logs

```powershell
docker compose logs -f backend
docker compose logs -f frontend
```

### Verificar Variables de Entorno

```powershell
docker compose exec backend printenv
```

### Error: "Google Sign-In button no aparece"
- Verificar `VITE_GOOGLE_CLIENT_ID` en `frontend/.env`
- Verificar que Google Script esté cargando (revisar consola del navegador)

### Error: "Domain not allowed"
- Verificar `ALLOWED_EMAIL_DOMAIN` en `backend/.env` coincide con tu dominio de email
- Para testing, puedes cambiarlo temporalmente

### Error: "JWT token invalid"
- Verificar `JWT_SECRET` en `backend/.env`
- Asegurar que el mismo secret se use consistentemente

### Errores CORS
- Agregar tu origen a `ALLOWED_ORIGINS` en `backend/.env`
- Reiniciar el servicio backend

### Conflictos de Puerto

Si los puertos 3000, 3001, 8000, o 5432 están en uso:
- Editar puertos en `docker-compose.yml`

### Reconstruir Servicios

```powershell
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Verificar Docker Desktop

```powershell
docker info
```

### Verificar Red

```powershell
docker network ls | findstr "proyecto-final"
```

---

## Próximos Pasos

### Mejoras Futuras

1. **Autenticación**:
   - [ ] Completar integración Google OAuth (token refresh)
   - [ ] Mecanismo de refresh de tokens
   - [ ] Mejoras en RBAC

2. **Base de Datos**:
   - [ ] Expandir schema con entidades educativas
   - [ ] Agregar índices para performance
   - [ ] Implementar data seeding más completo

3. **AI Service**:
   - [ ] Desplegar modelos ML reales
   - [ ] Versionado de modelos
   - [ ] Endpoints de predicción

4. **Storage**:
   - [ ] Integración MinIO para almacenamiento de archivos
   - [ ] Compatibilidad S3

5. **Monitoreo**:
   - [ ] Application Performance Monitoring (APM)
   - [ ] Agregación de logs
   - [ ] Colección de métricas

6. **CI/CD**:
   - [ ] Testing automatizado
   - [ ] Deployment continuo
   - [ ] Gestión de entornos

7. **UI/UX**:
   - [ ] Implementar shadcn/ui components library
   - [ ] Mejorar componentes existentes
   - [ ] Mejorar mensajes de error

### Sprint 2 Preparación

- [ ] Agregar tests automatizados (Jest + Supertest)
- [ ] Configurar shadcn/ui components
- [ ] Agregar gestión de cursos y calificaciones
- [ ] Implementar endpoints de modelos ML
- [ ] Agregar file upload con MinIO
- [ ] Mejorar UI/UX con mejores componentes

---

## Health Checks

Todos los servicios incluyen endpoints de health check:

- Backend: `GET /health`
- AI Service: `GET /health`

Los health checks retornan estado del servicio, hash de commit, e información de versión.

---

## Licencia

MIT

---

## Recursos Adicionales

- [Documentación de Prisma](https://www.prisma.io/docs)
- [Documentación de FastAPI](https://fastapi.tiangolo.com/)
- [Documentación de React Router](https://reactrouter.com/)
- [Documentación de Tailwind CSS](https://tailwindcss.com/docs)
- [Google Identity Services](https://developers.google.com/identity/gsi/web)

