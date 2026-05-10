# Render Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar los 3 servicios (frontend, backend, ai-service) a producción en Render de forma gratuita usando un Blueprint (`render.yaml`).

**Architecture:** Frontend como Render Static Site (CDN, nunca se apaga). Backend como Free Web Service Node.js. ai-service como Free Web Service Docker. Un `render.yaml` en la raíz define los 3. Un único cambio de código: la cookie de sesión del backend debe ser env-aware para funcionar cross-origin en HTTPS.

**Tech Stack:** Render Blueprint (render.yaml), Node.js/Express, React/Vite, Python/FastAPI/Docker.

---

## Archivos a modificar o crear

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/src/app.js` | Modificar líneas 49-54 | Cookie de sesión env-aware para HTTPS cross-origin |
| `render.yaml` | Crear (raíz del repo) | Blueprint que define los 3 servicios en Render |

---

### Task 1: Fix session cookie para producción cross-origin

**Files:**
- Modify: `backend/src/app.js:49-54`

Las cookies de sesión hoy tienen `secure: false` y `sameSite: "lax"` hardcodeados. En producción, el frontend (`pf-frontend.onrender.com`) y el backend (`pf-backend.onrender.com`) son orígenes distintos — la cookie del OAuth flow de Google no viajará sin `SameSite=None; Secure`.

- [ ] **Step 1: Abrir `backend/src/app.js` y localizar el bloque `cookie`**

El bloque está dentro de `app.use(session({ ... }))`, aproximadamente en la línea 44. Se ve así:

```js
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60,
    },
  }),
);
```

- [ ] **Step 2: Reemplazar el bloque `cookie` con la versión env-aware**

```js
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60,
    },
  }),
);
```

- [ ] **Step 3: Verificar que el backend arranca localmente sin errores**

Desde `backend/`:

```bash
npm start
```

Resultado esperado:
```
Backend running on http://localhost:3001
```

Detener con Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.js
git commit -m "fix: make session cookie env-aware for production cross-origin HTTPS"
```

---

### Task 2: Crear `render.yaml` en la raíz del repo

**Files:**
- Create: `render.yaml`

Este archivo le dice a Render cómo construir y desplegar los 3 servicios. Las variables con `sync: false` son secretos que se cargan manualmente en el dashboard (no van al repo).

- [ ] **Step 1: Crear `render.yaml` en la raíz del repo con este contenido exacto**

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

- [ ] **Step 2: Verificar que el archivo está en la raíz**

```bash
ls render.yaml
```

Resultado esperado: `render.yaml`

- [ ] **Step 3: Commit**

```bash
git add render.yaml
git commit -m "feat: add render.yaml Blueprint for production deployment"
```

- [ ] **Step 4: Push de la rama al remoto**

```bash
git push origin develop-materias
```

---

### Task 3: Configurar Google OAuth para producción

**Estos pasos se hacen en el navegador, no en el código.**

- [ ] **Step 1: Ir a Google Cloud Console**

Navegar a: https://console.cloud.google.com/apis/credentials

Seleccionar el proyecto que tiene las credenciales OAuth usadas en el sistema.

- [ ] **Step 2: Editar el OAuth 2.0 Client ID existente**

Hacer clic en el Client ID que usa el sistema → "Edit".

En la sección **"Authorized redirect URIs"**, agregar:

```
https://pf-backend.onrender.com/api/auth/google/callback
```

Hacer clic en "Save".

- [ ] **Step 3: Verificar que los valores están guardados**

Confirmar que la URI aparece listada en "Authorized redirect URIs".

---

### Task 4: Crear el Blueprint en Render y cargar secretos

**Estos pasos se hacen en el dashboard de Render.**

- [ ] **Step 1: Crear el Blueprint**

1. Ir a https://dashboard.render.com
2. Click en **"New"** → **"Blueprint"**
3. Conectar el repo de GitHub si no está conectado
4. Seleccionar el repo `proyecto-final`
5. Render detecta el `render.yaml` automáticamente — confirmar los 3 servicios
6. Click en **"Apply"**

Render iniciará el build de los 3 servicios en paralelo. El primer build del ai-service puede tardar varios minutos (descarga imagen Docker + instala dependencias Python).

- [ ] **Step 2: Cargar las variables secretas en pf-backend**

Una vez que los servicios están creados (pueden estar todavía en build):

1. Ir a **pf-backend** → **"Environment"**
2. Agregar las siguientes variables con sus valores reales:

| Variable | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | El Client ID del OAuth App en Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | El Client Secret del OAuth App |
| `GEMINI_API_KEY` | La API key de Gemini |

3. Click en **"Save Changes"**

Esto triggerea un redeploy automático del backend.

- [ ] **Step 3: Verificar que los 3 servicios están en "Live"**

En el dashboard de Render, los 3 servicios deben mostrar estado **"Live"** (verde).

- [ ] **Step 4: Smoke test del frontend**

1. Abrir https://pf-frontend.onrender.com
2. Debe cargar el login del sistema.

- [ ] **Step 5: Smoke test del backend**

```bash
curl https://pf-backend.onrender.com/health
```

Resultado esperado:
```json
{"status":"ok","service":"backend"}
```

(La primera request puede tardar ~30s si el servicio estaba dormido.)

- [ ] **Step 6: Smoke test del ai-service**

```bash
curl https://pf-ai.onrender.com/health
```

Resultado esperado (puede tardar 1-2 min en responder la primera vez):
```json
{"status":"ok","modelos_cargados":{"alumno":{...},"materia":{...},"examen":{...}}}
```

- [ ] **Step 7: Verificar login con usuario local**

En https://pf-frontend.onrender.com/login, iniciar sesión con un usuario del seed (ej. `admin` / `admin123` o el que esté configurado en `backend/src/db/seed.js`).

- [ ] **Step 8: Verificar login con Google OAuth**

Hacer clic en "Iniciar sesión con Google" y completar el flujo con una cuenta `@usal.edu.ar`. Debe redirigir al dashboard sin errores.

---

## Notas para la demo

**Calentamiento previo:** Los servicios se apagan tras 15 min de inactividad. Antes de la presentación, hacer estas requests para despertarlos:

```bash
curl https://pf-backend.onrender.com/health
curl https://pf-ai.onrender.com/health
```

Esperar a que ambas respondan antes de abrir el frontend ante la audiencia.
