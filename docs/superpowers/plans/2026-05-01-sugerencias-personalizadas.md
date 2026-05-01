# Sugerencias Personalizadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un endpoint `GET /api/sugerencias/:alumnoId?materiaId=Y` en Express que recopila el perfil completo del alumno y genera un párrafo narrativo de sugerencias pedagógicas usando Claude API (Haiku), mostrado en un modal en PanelPredicciones.

**Architecture:** Un servicio `sugerencias.service.js` recopila datos del alumno (perfil, variables de predicción, historial de cursadas/exámenes) y llama a Claude API. Una ruta `sugerencias.routes.js` maneja el endpoint con caché en memoria (TTL 1h). En el frontend, un botón "Ver sugerencias" en cada fila del panel abre un modal con los tres estados: loading, success, error.

**Tech Stack:** Node.js/Express (backend), `@anthropic-ai/sdk`, better-sqlite3, Jest (tests de funciones puras), React + Tailwind CSS (frontend).

---

## File Map

**Crear:**
- `backend/src/services/sugerencias.service.js` — recopila datos del alumno, arma el prompt, llama a Claude
- `backend/src/routes/sugerencias.routes.js` — endpoint REST con caché TTL
- `backend/src/services/sugerencias.service.test.js` — tests de funciones puras

**Modificar:**
- `backend/package.json` — agregar `@anthropic-ai/sdk` (dep) y `jest` (devDep)
- `backend/.env` — agregar `ANTHROPIC_API_KEY`
- `backend/src/app.js` — registrar la nueva ruta
- `frontend/src/pages/PanelPredicciones.jsx` — modal + botón + estado

---

## Task 1: Instalar dependencias y configurar entorno

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.env` (o `.env.example`)

- [ ] **Step 1: Instalar @anthropic-ai/sdk y jest en backend**

Correr en la carpeta `backend/`:
```bash
npm install @anthropic-ai/sdk
npm install --save-dev jest
```

- [ ] **Step 2: Agregar script de tests en package.json**

En `backend/package.json`, agregar dentro de `"scripts"`:
```json
"test": "jest"
```

El archivo queda:
```json
{
  "name": "backend",
  "version": "1.0.0",
  "private": true,
  "main": "src/app.js",
  "scripts": {
    "dev": "nodemon src/app.js",
    "start": "node src/app.js",
    "seed": "node src/db/seed.js",
    "test": "jest"
  },
  ...
}
```

- [ ] **Step 3: Agregar ANTHROPIC_API_KEY al archivo .env**

En `backend/.env`, agregar la línea:
```
ANTHROPIC_API_KEY=sk-ant-REEMPLAZAR_CON_TU_KEY
```

Reemplazar `sk-ant-REEMPLAZAR_CON_TU_KEY` con la API key real de Anthropic.

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: add @anthropic-ai/sdk and jest to backend"
```

---

## Task 2: Servicio de sugerencias (TDD de funciones puras)

**Files:**
- Create: `backend/src/services/sugerencias.service.test.js`
- Create: `backend/src/services/sugerencias.service.js`

### 2a — Tests primero

- [ ] **Step 1: Crear el archivo de tests**

Crear `backend/src/services/sugerencias.service.test.js`:
```js
const { getNivelRiesgo, generarPrompt } = require('./sugerencias.service');

describe('getNivelRiesgo', () => {
  test('retorna ALTO cuando probabilidad >= 0.7', () => {
    expect(getNivelRiesgo(0.7)).toBe('ALTO');
    expect(getNivelRiesgo(0.85)).toBe('ALTO');
    expect(getNivelRiesgo(1.0)).toBe('ALTO');
  });

  test('retorna MEDIO cuando probabilidad >= 0.5 y < 0.7', () => {
    expect(getNivelRiesgo(0.5)).toBe('MEDIO');
    expect(getNivelRiesgo(0.65)).toBe('MEDIO');
    expect(getNivelRiesgo(0.699)).toBe('MEDIO');
  });

  test('retorna BAJO cuando probabilidad < 0.5', () => {
    expect(getNivelRiesgo(0.0)).toBe('BAJO');
    expect(getNivelRiesgo(0.3)).toBe('BAJO');
    expect(getNivelRiesgo(0.499)).toBe('BAJO');
  });
});

describe('generarPrompt', () => {
  const datosMock = {
    alumno: { nombre_completo: 'Ana García', anio_ingreso: 2022, promedio_colegio: 7 },
    materia: { nombre: 'Análisis Matemático I' },
    vars: { PromedioNota: 5.5, PromedioAsistencia: 0.72, CantRecursa: 1 },
    cursadaActual: { anio: 2024, asistencia: 0.68 },
    vecesCursada: 2,
    parcialesRendidos: 1,
    totalParciales: 2,
    historialCursadas: [
      { anio: 2023, estado: 'recursada', materia_nombre: 'Análisis Matemático I' },
    ],
    ultimosExamenes: [
      { anio: 2024, tipo: 'Parcial', nota: 4, materia_nombre: 'Análisis Matemático I' },
    ],
  };

  const prediccionesMock = {
    abandono: { probabilidad: 0.72 },
    recursado: { probabilidad: 0.45 },
    nota: { nota: 5.2 },
  };

  test('incluye el nombre del alumno en el prompt', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('Ana García');
  });

  test('incluye el nombre de la materia', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('Análisis Matemático I');
  });

  test('incluye la probabilidad de abandono formateada como porcentaje', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('72%');
    expect(prompt).toContain('ALTO');
  });

  test('incluye la probabilidad de recursado', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('45%');
    expect(prompt).toContain('BAJO');
  });

  test('incluye la nota esperada', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('5.2');
  });

  test('incluye los parciales rendidos', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('1');
    expect(prompt).toContain('2');
  });

  test('funciona sin predicciones de abandono', () => {
    const sinAbandono = { ...prediccionesMock, abandono: null };
    const prompt = generarPrompt(datosMock, sinAbandono);
    expect(prompt).toContain('no disponible');
  });
});
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
cd backend && npm test
```

Resultado esperado: FAIL — "Cannot find module './sugerencias.service'"

### 2b — Implementar el servicio

- [ ] **Step 3: Crear sugerencias.service.js**

Crear `backend/src/services/sugerencias.service.js`:
```js
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db/database');
const { calcularVariablesAbandono } = require('./prediction-variables.service');
const { precalcularPrediccionesCompletas } = require('./panel-predicciones.service');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getNivelRiesgo(prob) {
  if (prob >= 0.7) return 'ALTO';
  if (prob >= 0.5) return 'MEDIO';
  return 'BAJO';
}

function generarPrompt(datos, predicciones) {
  const {
    alumno, materia, vars, cursadaActual,
    vecesCursada, parcialesRendidos, totalParciales,
    historialCursadas, ultimosExamenes,
  } = datos;

  const probAbandono = predicciones?.abandono?.probabilidad ?? null;
  const probRecursado = predicciones?.recursado?.probabilidad ?? null;
  const notaEsperada = predicciones?.nota?.nota ?? null;

  const asistenciaPct = cursadaActual?.asistencia != null
    ? Math.round(cursadaActual.asistencia * 100)
    : Math.round((vars.PromedioAsistencia || 0) * 100);

  const historialTexto = historialCursadas.length > 0
    ? historialCursadas.map((h) => `- ${h.anio}: ${h.materia_nombre} (${h.estado})`).join('\n')
    : 'Sin historial registrado';

  const examenesTexto = ultimosExamenes.length > 0
    ? ultimosExamenes.map((e) => `- ${e.anio} ${e.materia_nombre}: ${e.tipo} → ${e.nota}`).join('\n')
    : 'Sin exámenes registrados';

  const lineaAbandono = probAbandono != null
    ? `- Probabilidad de abandono: ${Math.round(probAbandono * 100)}% (riesgo ${getNivelRiesgo(probAbandono)})`
    : '- Probabilidad de abandono: no disponible';

  const lineaRecursado = probRecursado != null
    ? `- Probabilidad de recursado: ${Math.round(probRecursado * 100)}% (riesgo ${getNivelRiesgo(probRecursado)})`
    : '- Probabilidad de recursado: no disponible';

  const lineaNota = notaEsperada != null
    ? `- Nota esperada próximo examen: ${Number(notaEsperada).toFixed(1)}`
    : '- Nota esperada: no disponible';

  return `Sos un asistente académico que ayuda a docentes universitarios.
Analizá la siguiente información de un alumno y redactá UN párrafo narrativo (150-200 palabras) dirigido al docente/coordinador, explicando la situación del alumno y qué acciones concretas se recomiendan. Sé específico, usa los datos provistos.

--- DATOS DEL ALUMNO ---
Nombre: ${alumno.nombre_completo}
Materia: ${materia.nombre}
Año de ingreso: ${alumno.anio_ingreso ?? 'desconocido'}

PREDICCIONES:
${lineaAbandono}
${lineaRecursado}
${lineaNota}

VARIABLES CLAVE:
- Asistencia actual: ${asistenciaPct}%
- Promedio general de notas: ${Number(vars.PromedioNota || 0).toFixed(2)}
- Veces que cursó esta materia: ${vecesCursada}
- Parciales rendidos: ${parcialesRendidos} de ${totalParciales || '?'}

HISTORIAL DE CURSADAS:
${historialTexto}

ÚLTIMOS EXÁMENES:
${examenesTexto}`;
}

function obtenerDatosAlumno(alumnoId, materiaId) {
  const alumno = db
    .prepare(
      `SELECT id, COALESCE(nombre_completo, username) AS nombre_completo,
              anio_ingreso, promedio_colegio
       FROM users WHERE id = ? AND role = 'alumno' LIMIT 1`,
    )
    .get(alumnoId);

  if (!alumno) return null;

  const materia = db
    .prepare('SELECT nombre FROM materias WHERE id = ? LIMIT 1')
    .get(materiaId);

  if (!materia) return null;

  let vars;
  try {
    vars = calcularVariablesAbandono(alumnoId);
  } catch {
    vars = { PromedioAsistencia: 0, PromedioNota: 0, CantRecursa: 0 };
  }

  const cursadaActual = db
    .prepare(
      `SELECT anio, asistencia FROM cursadas
       WHERE alumno_id = ? AND materia_id = ?
       ORDER BY anio DESC LIMIT 1`,
    )
    .get(alumnoId, materiaId);

  const vecesCursada =
    db
      .prepare('SELECT COUNT(*) AS cnt FROM cursadas WHERE alumno_id = ? AND materia_id = ?')
      .get(alumnoId, materiaId)?.cnt ?? 0;

  let parcialesRendidos = 0;
  let totalParciales = 0;
  if (cursadaActual) {
    parcialesRendidos =
      db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM examenes
           WHERE alumno_id = ? AND materia_id = ? AND anio = ? AND tipo = 'Parcial' AND rendido = 1`,
        )
        .get(alumnoId, materiaId, cursadaActual.anio)?.cnt ?? 0;

    totalParciales =
      db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM examenes
           WHERE alumno_id = ? AND materia_id = ? AND anio = ? AND tipo = 'Parcial'`,
        )
        .get(alumnoId, materiaId, cursadaActual.anio)?.cnt ?? 0;
  }

  const historialCursadas = db
    .prepare(
      `SELECT c.anio, c.estado, m.nombre AS materia_nombre
       FROM cursadas c JOIN materias m ON m.id = c.materia_id
       WHERE c.alumno_id = ?
       ORDER BY c.anio DESC
       LIMIT 8`,
    )
    .all(alumnoId);

  const ultimosExamenes = db
    .prepare(
      `SELECT e.tipo, e.nota, e.anio, m.nombre AS materia_nombre
       FROM examenes e JOIN materias m ON m.id = e.materia_id
       WHERE e.alumno_id = ? AND e.rendido = 1 AND e.nota IS NOT NULL
       ORDER BY e.anio DESC
       LIMIT 8`,
    )
    .all(alumnoId);

  return {
    alumno,
    materia,
    vars,
    cursadaActual,
    vecesCursada,
    parcialesRendidos,
    totalParciales,
    historialCursadas,
    ultimosExamenes,
  };
}

async function generarSugerencia(alumnoId, materiaId) {
  const datos = obtenerDatosAlumno(alumnoId, materiaId);
  if (!datos) return null;

  const prediccionesMap = await precalcularPrediccionesCompletas([alumnoId], materiaId);
  const predicciones = prediccionesMap[alumnoId] || {};

  const prompt = generarPrompt(datos, predicciones);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0]?.text ?? null;
}

module.exports = { getNivelRiesgo, generarPrompt, obtenerDatosAlumno, generarSugerencia };
```

- [ ] **Step 4: Correr tests — deben pasar**

```bash
cd backend && npm test
```

Resultado esperado:
```
PASS  src/services/sugerencias.service.test.js
  getNivelRiesgo
    ✓ retorna ALTO cuando probabilidad >= 0.7
    ✓ retorna MEDIO cuando probabilidad >= 0.5 y < 0.7
    ✓ retorna BAJO cuando probabilidad < 0.5
  generarPrompt
    ✓ incluye el nombre del alumno en el prompt
    ✓ incluye el nombre de la materia
    ✓ incluye la probabilidad de abandono formateada como porcentaje
    ✓ incluye la probabilidad de recursado
    ✓ incluye la nota esperada
    ✓ incluye los parciales rendidos
    ✓ funciona sin predicciones de abandono

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/sugerencias.service.js backend/src/services/sugerencias.service.test.js
git commit -m "feat: add sugerencias service with Claude API integration"
```

---

## Task 3: Ruta de sugerencias

**Files:**
- Create: `backend/src/routes/sugerencias.routes.js`

- [ ] **Step 1: Crear sugerencias.routes.js**

Crear `backend/src/routes/sugerencias.routes.js`:
```js
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { generarSugerencia } = require('../services/sugerencias.service');

const router = express.Router();

const CACHE_TTL_MS = 60 * 60 * 1000;
const sugerenciasCache = new Map();

function getCached(key) {
  const entry = sugerenciasCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    sugerenciasCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  sugerenciasCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

router.get(
  '/:alumnoId',
  authenticate,
  authorize('admin', 'coordinador', 'docente'),
  async (req, res) => {
    const alumnoId = toPositiveInt(req.params.alumnoId);
    const materiaId = toPositiveInt(req.query.materiaId);

    if (!alumnoId || !materiaId) {
      return res.status(400).json({ error: 'alumnoId y materiaId son requeridos.' });
    }

    const cacheKey = `${alumnoId}_${materiaId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.status(200).json({ sugerencia: cached });

    try {
      const sugerencia = await generarSugerencia(alumnoId, materiaId);
      if (!sugerencia) {
        return res.status(404).json({ error: 'No hay suficiente información para generar sugerencias.' });
      }
      setCached(cacheKey, sugerencia);
      return res.status(200).json({ sugerencia });
    } catch (error) {
      console.error('Error generando sugerencia:', error.message);
      return res.status(503).json({ error: 'No se pudo generar la sugerencia, intente nuevamente.' });
    }
  },
);

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/sugerencias.routes.js
git commit -m "feat: add sugerencias route with 1h in-memory cache"
```

---

## Task 4: Registrar la ruta en app.js

**Files:**
- Modify: `backend/src/app.js`

- [ ] **Step 1: Agregar el import de la nueva ruta**

En `backend/src/app.js`, agregar después de la línea `const notasRoutes = require("./routes/notas.routes");`:
```js
const sugerenciasRoutes = require("./routes/sugerencias.routes");
```

- [ ] **Step 2: Montar la ruta**

En `backend/src/app.js`, agregar después de `app.use("/api/notas", authenticate, notasRoutes);`:
```js
app.use("/api/sugerencias", sugerenciasRoutes);
```

(El middleware de autenticación y autorización ya está dentro de la ruta.)

- [ ] **Step 3: Verificar que el servidor arranca sin errores**

```bash
cd backend && npm run dev
```

Resultado esperado: `Backend running on http://localhost:3001` sin errores.

- [ ] **Step 4: Probar el endpoint manualmente**

Con el servidor corriendo y un token JWT válido (obtenido del login):
```bash
curl -H "Authorization: Bearer TU_TOKEN_AQUI" \
  "http://localhost:3001/api/sugerencias/1?materiaId=1"
```

Resultado esperado: `{"sugerencia": "El alumno ..."}`

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.js
git commit -m "feat: register sugerencias route in Express app"
```

---

## Task 5: Frontend — modal y estado de sugerencias

**Files:**
- Modify: `frontend/src/pages/PanelPredicciones.jsx`

### 5a — Componente ModalSugerencia

- [ ] **Step 1: Agregar ModalSugerencia al inicio del archivo**

En `frontend/src/pages/PanelPredicciones.jsx`, agregar el componente `ModalSugerencia` después del bloque de helpers (después de la función `getSortIcon` o antes de `TablaAlumnos`):

```jsx
function ModalSugerencia({ alumnoNombre, estado, onClose, onRetry }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 text-lg leading-none"
        >
          ✕
        </button>

        <h2 className="mb-1 text-base font-semibold text-slate-900">
          Sugerencias para {alumnoNombre}
        </h2>
        <p className="mb-4 text-xs text-slate-400">Generado por IA · Solo orientativo</p>

        {estado.status === 'loading' && (
          <div className="flex items-center gap-3 py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent flex-shrink-0" />
            <p className="text-sm text-slate-600">Analizando perfil del alumno...</p>
          </div>
        )}

        {estado.status === 'success' && (
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
            {estado.texto}
          </p>
        )}

        {estado.status === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{estado.texto}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 5b — Estado y handlers en PanelPredicciones

- [ ] **Step 2: Agregar estado de sugerencias en PanelPredicciones**

En la función `export default function PanelPredicciones()`, agregar dos nuevos estados después de los `useState` existentes (después de `const [filtroRiesgo, setFiltroRiesgo] = useState("todos");`):

```jsx
const [sugerencias, setSugerencias] = useState({});
const [modalAlumnoId, setModalAlumnoId] = useState(null);
```

- [ ] **Step 3: Agregar la función handleVerSugerencias**

En `PanelPredicciones`, agregar después de la función `cargarAlumnos`:

```jsx
const handleVerSugerencias = async (alumnoId) => {
  setModalAlumnoId(alumnoId);
  if (sugerencias[alumnoId]?.status === 'success') return;

  setSugerencias((prev) => ({ ...prev, [alumnoId]: { status: 'loading', texto: '' } }));
  try {
    const resp = await api.get(`/api/sugerencias/${alumnoId}?materiaId=${materiaActiva.id}`);
    setSugerencias((prev) => ({
      ...prev,
      [alumnoId]: { status: 'success', texto: resp.data.sugerencia },
    }));
  } catch (err) {
    setSugerencias((prev) => ({
      ...prev,
      [alumnoId]: { status: 'error', texto: err.message || 'No se pudo generar la sugerencia.' },
    }));
  }
};

const handleRetrySugerencia = (alumnoId) => {
  setSugerencias((prev) => ({ ...prev, [alumnoId]: undefined }));
  handleVerSugerencias(alumnoId);
};
```

- [ ] **Step 4: Renderizar el modal en el JSX de PanelPredicciones**

En el JSX de `PanelPredicciones`, agregar el modal antes del `return` final (antes del `</div>` de cierre) — añadir justo antes del último `</div>`:

```jsx
{modalAlumnoId && sugerencias[modalAlumnoId] && (
  <ModalSugerencia
    alumnoNombre={
      datos?.cursando?.find((a) => a.id === modalAlumnoId)?.nombre_completo ?? 'Alumno'
    }
    estado={sugerencias[modalAlumnoId]}
    onClose={() => setModalAlumnoId(null)}
    onRetry={() => handleRetrySugerencia(modalAlumnoId)}
  />
)}
```

- [ ] **Step 5: Commit parcial**

```bash
git add frontend/src/pages/PanelPredicciones.jsx
git commit -m "feat: add ModalSugerencia component and sugerencias state to PanelPredicciones"
```

---

## Task 6: Frontend — botón "Ver sugerencias" en la tabla

**Files:**
- Modify: `frontend/src/pages/PanelPredicciones.jsx`

- [ ] **Step 1: Agregar onVerSugerencias como prop de TablaAlumnos**

Buscar la definición de `TablaAlumnos`:
```jsx
function TablaAlumnos({ alumnos, predicciones, loadingPredicciones, onViewDetail, userRole, getRiskFn }) {
```

Cambiarla por:
```jsx
function TablaAlumnos({ alumnos, predicciones, loadingPredicciones, onViewDetail, onVerSugerencias, userRole, getRiskFn }) {
```

- [ ] **Step 2: Agregar el botón "Ver sugerencias" en la celda de acciones**

En `TablaAlumnos`, buscar la celda de acciones que contiene el botón "Ver detalles →":
```jsx
{/* Acción */}
<td className="px-4 py-3 text-right">
  <button
    type="button"
    onClick={() => onViewDetail(alumno.id)}
    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
  >
    Ver detalles →
  </button>
</td>
```

Reemplazarla por:
```jsx
{/* Acción */}
<td className="px-4 py-3 text-right">
  <div className="flex items-center justify-end gap-2">
    <button
      type="button"
      onClick={() => onVerSugerencias(alumno.id)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700 transition-colors whitespace-nowrap"
    >
      Sugerencias ✨
    </button>
    <button
      type="button"
      onClick={() => onViewDetail(alumno.id)}
      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
    >
      Ver detalles →
    </button>
  </div>
</td>
```

- [ ] **Step 3: Pasar onVerSugerencias desde PanelPredicciones a TablaAlumnos**

En el JSX de `PanelPredicciones`, buscar donde se usa `<TablaAlumnos`:
```jsx
<TablaAlumnos
  alumnos={alumnosFiltrados}
  predicciones={predicciones}
  loadingPredicciones={loadingPredicciones}
  onViewDetail={(id) => navigate(`/alumnos/${id}`)}
  userRole={user?.role}
  getRiskFn={getRiskFn}
/>
```

Agregar la prop `onVerSugerencias`:
```jsx
<TablaAlumnos
  alumnos={alumnosFiltrados}
  predicciones={predicciones}
  loadingPredicciones={loadingPredicciones}
  onViewDetail={(id) => navigate(`/alumnos/${id}`)}
  onVerSugerencias={handleVerSugerencias}
  userRole={user?.role}
  getRiskFn={getRiskFn}
/>
```

- [ ] **Step 4: Verificar en el browser**

Con backend y frontend corriendo:
1. Navegar a `/panel-predicciones`
2. Seleccionar una materia con alumnos
3. Hacer click en "Sugerencias ✨" para un alumno
4. Verificar que aparece el modal con spinner "Analizando perfil del alumno..."
5. Esperar la respuesta de Claude (2-5 segundos) y verificar el párrafo narrativo
6. Cerrar el modal y volver a abrirlo — verificar que NO hace un segundo fetch (usa el estado local)
7. Verificar que si la API falla, aparece el botón "Reintentar"

- [ ] **Step 5: Commit final**

```bash
git add frontend/src/pages/PanelPredicciones.jsx
git commit -m "feat: add 'Ver sugerencias' button and modal to PanelPredicciones"
```
