# Project Structure - Edu Predict MVP

## Root Directory

```
proyecto-final/
├── docker-compose.yml       # Docker orchestration configuration
├── README.md                # Main project documentation
├── QUICKSTART.md            # Quick start guide
├── ARCHITECTURE.md          # Architecture documentation
├── TESTING.md               # Testing guide
├── start.ps1                # PowerShell start script
├── stop.ps1                 # PowerShell stop script
├── .gitignore              # Root gitignore
│
├── backend/                # Backend service
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── .gitignore
│   ├── .dockerignore
│   ├── src/
│   │   ├── index.ts        # Main entry point
│   │   ├── routes/
│   │   │   ├── health.ts   # Health check endpoint
│   │   │   └── auth.ts     # Authentication endpoints
│   │   ├── middleware/
│   │   │   └── errorHandler.ts
│   │   └── utils/
│   │       └── git.ts      # Git utilities
│   └── prisma/
│       ├── schema.prisma   # Database schema
│       └── migrations/
│           └── 0_init/
│               └── migration.sql
│
├── frontend/               # Frontend service
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── .eslintrc.cjs
│   ├── .gitignore
│   ├── .dockerignore
│   ├── index.html
│   └── src/
│       ├── main.tsx        # React entry point
│       ├── App.tsx         # Main App component
│       ├── index.css       # Global styles
│       ├── vite-env.d.ts   # Vite types
│       └── pages/
│           └── HomePage.tsx # Home page component
│
└── ai-service/             # AI service
    ├── Dockerfile
    ├── requirements.txt
    ├── main.py             # FastAPI application
    ├── .gitignore
    ├── .dockerignore
    └── .gitkeep
```

## Service Directories

### Backend (`/backend`)

**Purpose**: REST API server handling authentication and business logic

**Key Files**:
- `src/index.ts`: Express server setup and route registration
- `src/routes/health.ts`: Health check endpoint returning service status
- `src/routes/auth.ts`: Authentication endpoints (Google OAuth placeholder)
- `prisma/schema.prisma`: Database schema definition

**Technologies**:
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL

### Frontend (`/frontend`)

**Purpose**: User interface displaying service status and health information

**Key Files**:
- `src/App.tsx`: Main application component with routing
- `src/pages/HomePage.tsx`: Home page with service health display
- `index.html`: HTML entry point

**Technologies**:
- React
- Vite
- TypeScript
- Tailwind CSS
- React Router

### AI Service (`/ai-service`)

**Purpose**: Machine learning prediction service (placeholder)

**Key Files**:
- `main.py`: FastAPI application with health endpoint

**Technologies**:
- FastAPI
- Python
- scikit-learn (placeholder)

## Configuration Files

### Docker Compose (`docker-compose.yml`)
- Orchestrates all services
- Defines dependencies between services
- Configures health checks
- Sets up volume mounts for development

### TypeScript Configuration
- `backend/tsconfig.json`: Backend TypeScript settings
- `frontend/tsconfig.json`: Frontend TypeScript settings
- `frontend/tsconfig.node.json`: Vite-specific TypeScript settings

### Build Tools
- `frontend/vite.config.ts`: Vite build configuration
- `frontend/tailwind.config.js`: Tailwind CSS configuration
- `frontend/postcss.config.js`: PostCSS configuration

## Environment Files (Not Committed)

- `backend/.env`: Backend environment variables
- `.env`: Root-level environment variables

Use `.env.example` files for reference (not created in Sprint 0).

## Git Repositories

Each service has its own git repository for version tracking:
- `backend/.git`
- `frontend/.git`
- `ai-service/.git`

These are used to extract commit hashes for the health check display.

## Docker Volumes

- `postgres_data`: Persistent PostgreSQL data
- `/app/node_modules`: Node modules in containers
- Source code mounted for hot reload in development

## Network

All services run in the `proyecto-final_default` Docker network, allowing:
- Inter-service communication using service names
- Database access: `db:5432`
- Backend API: `http://backend:3001`
- AI Service API: `http://ai-service:8000`

## Port Mapping

- `3000`: Frontend (external → internal)
- `3001`: Backend (external → internal)
- `8000`: AI Service (external → internal)
- `5432`: PostgreSQL (external → internal)

## Development vs Production

**Current Setup**: Development mode
- Hot reload enabled
- Source code mounted as volumes
- Debugging enabled
- No production optimizations

**Production** would require:
- Build steps for compiled code
- No volume mounts
- Environment-specific configurations
- Production-optimized Docker images

## File Size Guidelines

- Keep individual files under 300 lines
- Split large components/services into modules
- Use dependency injection for testability
- Follow single responsibility principle

## Naming Conventions

- **Directories**: kebab-case (`ai-service`)
- **Files**: kebab-case (`error-handler.ts`)
- **Components**: PascalCase (`HomePage.tsx`)
- **Functions**: camelCase (`getGitCommit`)
- **Constants**: UPPER_SNAKE_CASE (`JWT_SECRET`)

