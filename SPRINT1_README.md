# Sprint 1: Authentication & RBAC

## 🎯 Objective

Implement Google OAuth authentication with JWT-based authorization and Role-Based Access Control (RBAC) for the Edu Predict MVP.

## ✅ Completed Features

### Backend
- ✅ Prisma schema updated with User model and Role enum
- ✅ Database seed with 4 users (Director, Tutor, Profesor, Alumno)
- ✅ Google OAuth token validation
- ✅ JWT token generation and verification
- ✅ Authentication middleware
- ✅ RBAC middleware with role enforcement
- ✅ Protected routes (`/api/me`, `/api/admin/*`, `/api/common/*`)
- ✅ Rate limiting on auth endpoints
- ✅ Structured logging with Winston
- ✅ Input validation with Zod
- ✅ CORS configuration

### Frontend
- ✅ Google Identity Services integration
- ✅ Auth state management with Zustand
- ✅ Route guards (PrivateRoute, RoleGuard)
- ✅ Login page with Google Sign-In button
- ✅ Dashboard page with role display
- ✅ Protected pages for different roles
- ✅ Error pages (403, 404)
- ✅ Navigation header with logout
- ✅ Token persistence in localStorage

## 🚀 Setup Instructions

### 1. Environment Configuration

Create `.env` files in each service directory:

**backend/.env**:
```env
DATABASE_URL="postgresql://postgres:postgres@db:5432/edupredict"
JWT_SECRET="your-secure-random-secret-key-here"
ALLOWED_EMAIL_DOMAIN="usal.edu.ar"
GOOGLE_CLIENT_ID="<your-google-client-id>"
GOOGLE_AUDIENCE="<same-as-client-id>"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
PORT=3001
NODE_ENV="development"
LOG_LEVEL="info"
```

**frontend/.env**:
```env
VITE_GOOGLE_CLIENT_ID="<your-google-client-id>"
VITE_API_BASE_URL="http://localhost:3001"
```

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Set Application type to "Web application"
6. Add authorized JavaScript origins:
   - `http://localhost:3000`
   - `http://localhost:5173`
7. Copy the Client ID to your `.env` files

### 3. Start Services

```powershell
docker compose up -d --build
```

### 4. Run Database Migrations & Seed

```powershell
# Migrations run automatically on backend startup
# Run seed manually if needed
docker compose exec backend npm run prisma:seed
```

## 📋 Test Accounts

The seed creates 4 test users:
- **Director**: director@usal.edu.ar
- **Tutor**: tutor@usal.edu.ar
- **Professor**: profesor@usal.edu.ar
- **Student**: alumno@usal.edu.ar

## 🧪 Testing

### Manual Testing Checklist

#### Authentication Flow
- [ ] Navigate to http://localhost:3000
- [ ] Should redirect to /login
- [ ] Click "Sign in with Google"
- [ ] Authenticate with @usal.edu.ar email
- [ ] Should redirect to /dashboard
- [ ] Dashboard should show user name and role

#### Route Protection
- [ ] Try to access /dashboard without login → should redirect to /login
- [ ] Try to access /common as authenticated user → should work
- [ ] Try to access /tutor as ALUMNO → should redirect to /403
- [ ] Try to access /director as non-director → should redirect to /403

#### Role-Based Access
- [ ] Login as DIRECTOR → can access all pages
- [ ] Login as TUTOR → can access /tutor, not /director
- [ ] Login as PROFESOR → can only access /common and /dashboard
- [ ] Login as ALUMNO → can only access /common and /dashboard

#### API Endpoints
- [ ] `GET /health` → should return service status
- [ ] `GET /api/me` (with token) → should return user profile
- [ ] `GET /api/common/ping` (with token) → should return success
- [ ] `GET /api/admin/ping` (as DIRECTOR/TUTOR) → should return success
- [ ] `GET /api/admin/ping` (as ALUMNO/PROFESOR) → should return 403

### API Testing with curl

```powershell
# Login (replace with actual id_token from Google)
curl -X POST http://localhost:3001/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<google-id-token>"}'

# Get user profile
curl http://localhost:3001/api/me \
  -H "Authorization: Bearer <your-jwt-token>"

# Test protected endpoint
curl http://localhost:3001/api/common/ping \
  -H "Authorization: Bearer <your-jwt-token>"
```

## 🔒 Security Features

✅ JWT with 8-hour expiration  
✅ Domain verification (@usal.edu.ar only)  
✅ Google token validation (aud, iss, exp)  
✅ Rate limiting on auth endpoints  
✅ CORS restricted to allowed origins  
✅ No logging of tokens or PII  
✅ RBAC middleware enforcement  
✅ Secure secret from environment variables  

## 📁 File Structure

```
backend/
├── src/
│   ├── lib/
│   │   ├── google.ts      # Google token validation
│   │   ├── jwt.ts         # JWT utilities
│   │   └── logger.ts      # Winston logger
│   ├── middleware/
│   │   ├── auth.ts        # Authentication middleware
│   │   └── rbac.ts        # Role-based access control
│   ├── routes/
│   │   ├── auth.ts        # Auth routes (/google, /logout)
│   │   ├── me.ts          # User profile endpoint
│   │   ├── admin.ts       # Admin routes
│   │   └── common.ts      # Common routes
│   └── index.ts           # Express app setup
└── prisma/
    ├── schema.prisma      # Updated with User & Role
    └── seed.ts            # 4 test users

frontend/
├── src/
│   ├── components/
│   │   ├── PrivateRoute.tsx    # Route protection
│   │   └── RoleGuard.tsx      # Role-based guard
│   ├── lib/
│   │   └── api.ts              # API client
│   ├── pages/
│   │   ├── LoginPage.tsx      # Google Sign-In
│   │   ├── DashboardPage.tsx  # Main dashboard
│   │   ├── CommonPage.tsx     # All users
│   │   ├── TutorPage.tsx      # Tutor+Director
│   │   ├── DirectorPage.tsx   # Director only
│   │   ├── ForbiddenPage.tsx  # 403 error
│   │   └── NotFoundPage.tsx  # 404 error
│   ├── store/
│   │   └── useAuthStore.ts    # Zustand auth state
│   └── types/
│       └── index.ts            # TypeScript types
```

## 🎯 Acceptance Criteria Met

✅ User with @usal.edu.ar email can login with Google  
✅ User receives JWT and can access /dashboard  
✅ User with non-allowed domain gets error on login  
✅ GET /api/me returns correct profile with role  
✅ GET /api/admin/ping blocks ALUMNO/PROFESOR, allows DIRECTOR/TUTOR  
✅ Frontend hides menus for unauthorized roles  
✅ RoleGuard redirects to /403 for unauthorized access  
✅ .env.example files created  
✅ Application starts with docker compose up  
✅ Database migrations and seed work  

## 🐛 Troubleshooting

### "Google Sign-In button not appearing"
- Check VITE_GOOGLE_CLIENT_ID in frontend/.env
- Verify Google Script is loading (check browser console)

### "Domain not allowed" error
- Verify ALLOWED_EMAIL_DOMAIN in backend/.env matches your email domain
- For testing, you can temporarily change it

### "JWT token invalid"
- Check JWT_SECRET in backend/.env
- Ensure same secret is used consistently

### CORS errors
- Add your origin to ALLOWED_ORIGINS in backend/.env
- Restart the backend service

## 📝 Next Sprint (Sprint 2)

- [ ] Add automated tests (Jest + Supertest)
- [ ] Implement shadcn/ui components
- [ ] Add course and grade management
- [ ] Implement ML model endpoints
- [ ] Add file upload with MinIO
- [ ] Enhance UI/UX with better components

