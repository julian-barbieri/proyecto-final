# Diseño: Deploy a producción en Render

**Fecha:** 2026-05-10
**Rama:** develop-materias
**Objetivo:** Llevar los 3 servicios (frontend, backend, ai-service) a producción en Render sin costo.

---

## Contexto

Sistema académico con 3 servicios:

- **frontend** — React + Vite + Tailwind, build estático
- **backend** — Node.js + Express + SQLite (`better-sqlite3`), JWT + Google OAuth
- **ai-service** — Python FastAPI con modelos ML (.pkl) bundled en imagen Docker

**Caso de uso:** demo/presentación académica. Los datos son efímeros (SQLite se resetea en cada redeploy); el seed se corre automáticamente al iniciar el backend, lo cual es aceptable.

---

## Arquitectura

```
[Usuario]
   │
   ▼
[pf-frontend] ── Render Static Site (CDN, nunca se apaga)
   │ HTTPS + JWT Bearer token
   ▼
[pf-backend] ── Render Free Web Service (Node.js)
   │            Se apaga tras 15 min de inactividad (~30s cold start)
   │ HTTP
   ▼
[pf-ai] ── Render Free Web Service (Docker, FastAPI)
           Se apaga tras 15 min de inactividad (~1-2 min cold start)
```

### URLs de producción

| Servicio    | Nombre Render | URL                              |
|-------------|---------------|----------------------------------|
| frontend    | `pf-frontend` | https://pf-frontend.onrender.com |
| backend     | `pf-backend`  | https://pf-backend.onrender.com  |
| ai-service  | `pf-ai`       | https://pf-ai.onrender.com       |

---

## Configuración de servicios (`render.yaml`)

Archivo en la raíz del repo. Define los 3 servicios como código (Blueprint).

```yaml
services:
  - type: web
    name: pf-frontend
    env: static
    buildCommand: cd frontend && npm install && npm run build
    staticPublishPath: frontend/dist
    envVars:
      - key: VITE_API_URL
        value: https://pf-backend.onrender.com

  - type: web
    name: pf-backend
    env: node
    rootDir: backend
    buildCommand: npm install
    startCommand: node src/app.js
    plan: free
    envVars:
      - key: NODE_ENV
        value: production
      - key: FRONTEND_URL
        value: https://pf-frontend.onrender.com
      - key: AI_SERVICE_URL
        value: https://pf-ai.onrender.com
      - key: GOOGLE_CALLBACK_URL
        value: https://pf-backend.onrender.com/api/auth/google/callback
      - key: UPLOADS_BASE_URL
        value: https://pf-backend.onrender.com/uploads
      - key: JWT_SECRET
        generateValue: true
      - key: SESSION_SECRET
        generateValue: true
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET
        sync: false
      - key: GEMINI_API_KEY
        sync: false

  - type: web
    name: pf-ai
    env: docker
    rootDir: ai-service
    dockerfilePath: ./Dockerfile
    plan: free
```

Las variables con `sync: false` se cargan manualmente en el dashboard de Render (son secretos que no van al repo).

---

## Cambios de código necesarios

### 1. `backend/src/app.js` — cookie de sesión cross-origin

Frontend y backend están en orígenes distintos (subdominios diferentes de onrender.com). Las cookies de sesión del OAuth flow de Google necesitan `SameSite=None; Secure` en producción para viajar cross-origin por HTTPS.

```js
// Antes (hardcodeado para desarrollo)
cookie: {
  secure: false,
  httpOnly: true,
  sameSite: "lax",
  maxAge: 1000 * 60 * 60,
}

// Después (env-aware)
cookie: {
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 1000 * 60 * 60,
}
```

### 2. `render.yaml` — archivo nuevo en raíz del repo

Ver sección anterior. No hay más cambios de código.

---

## Pasos manuales (fuera del repo)

1. **Google Cloud Console**: agregar `https://pf-backend.onrender.com/api/auth/google/callback` como URI de redirección autorizada en la OAuth App.
2. **Render**: conectar el repo de GitHub → "New Blueprint" → apuntar al `render.yaml`.
3. **Variables secretas**: tras el primer deploy, cargar en el dashboard de Render:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GEMINI_API_KEY`

---

## Consideraciones sobre cold starts

El free tier de Render apaga los web services tras 15 minutos de inactividad:

- **pf-backend**: ~30 segundos para despertar.
- **pf-ai**: ~1-2 minutos para despertar (imagen Docker con Python + modelos .pkl).
- **pf-frontend**: nunca se apaga (Static Site en CDN).

**Mitigación para demo:** hacer una request a `/health` de cada servicio antes de la presentación para que estén calientes.

---

## Qué NO cambia

- El frontend ya usa `import.meta.env.VITE_API_URL || "http://localhost:3001"` — no hay cambio.
- El backend ya usa `process.env.AI_SERVICE_URL || "http://localhost:8000"` — no hay cambio.
- El backend ya usa `process.env.GOOGLE_CALLBACK_URL` — no hay cambio.
- El `Dockerfile` del ai-service ya bundlea los modelos — no hay cambio.
- La base de datos SQLite se reinicializa con seed al arrancar — comportamiento existente, aceptable para demo.
