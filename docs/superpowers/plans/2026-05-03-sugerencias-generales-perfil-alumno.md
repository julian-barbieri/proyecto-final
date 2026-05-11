# Sugerencias Generales en Perfil del Alumno — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un botón "✨ Sugerencias" en el header del Perfil del Alumno que genera, mediante IA, sugerencias holísticas considerando todo el historial académico, info personal y predicciones del alumno.

**Architecture:** El endpoint existente `GET /api/sugerencias/:alumnoId` se extiende para operar sin `materiaId` (modo "global"). El backend añade `obtenerDatosAlumnoGlobal` y `generarPromptGlobal` al servicio de sugerencias. En el frontend, `ModalSugerencia` y `SugerenciaContent` se extraen a un componente compartido y se reutilizan en `AlumnoPerfil`.

**Tech Stack:** Node.js/Express, better-sqlite3, @google/genai (Gemini), React, TailwindCSS, Jest (backend tests)

---

## File Map

| Archivo | Cambio |
|---|---|
| `backend/src/services/sugerencias.service.js` | Modificar: agregar `obtenerDatosAlumnoGlobal`, `generarPromptGlobal`, actualizar `generarSugerencia` |
| `backend/src/routes/sugerencias.routes.js` | Modificar: permitir `materiaId` opcional, bloquear docentes en modo global |
| `backend/src/services/sugerencias.service.test.js` | Modificar: agregar tests para las nuevas funciones |
| `frontend/src/components/ModalSugerencia.jsx` | Crear: extracción de `SugerenciaContent` y `ModalSugerencia` |
| `frontend/src/pages/PanelPredicciones.jsx` | Modificar: importar desde componente compartido |
| `frontend/src/pages/AlumnoPerfil.jsx` | Modificar: botón, estado, handler, modal |

---

## Task 1: `obtenerDatosAlumnoGlobal` en el servicio

**Files:**
- Modify: `backend/src/services/sugerencias.service.js`
- Test: `backend/src/services/sugerencias.service.test.js`

- [ ] **Step 1: Escribir el test fallido**

Al final de `backend/src/services/sugerencias.service.test.js`, agregar:

```js
describe('generarPromptGlobal', () => {
  const datosGlobalMock = {
    alumno: {
      nombre_completo: 'Ana García',
      anio_ingreso: 2022,
      promedio_colegio: 7.5,
      ayuda_financiera: 1,
    },
    indicadores: {
      total_cursadas: 5,
      aprobadas: 2,
      recursadas: 2,
      cursando: 1,
      abandonadas: 0,
      promedio_notas: 5.8,
      asistencia_promedio: 0.74,
    },
    materiasEnCurso: [{ nombre: 'Análisis II' }, { nombre: 'Física I' }],
    historialTexto: '- Análisis I (aprobada)\n- Álgebra (recursada)',
  };

  const prediccionesMock = {
    abandono: { probabilidad: 0.72 },
  };

  test('incluye el nombre del alumno', () => {
    const { generarPromptGlobal } = require('./sugerencias.service');
    const prompt = generarPromptGlobal(datosGlobalMock, prediccionesMock, 'admin');
    expect(prompt).toContain('Ana García');
  });

  test('incluye abandono cuando rol es admin', () => {
    const { generarPromptGlobal } = require('./sugerencias.service');
    const prompt = generarPromptGlobal(datosGlobalMock, prediccionesMock, 'admin');
    expect(prompt).toContain('72%');
    expect(prompt).toContain('ALTO');
  });

  test('NO incluye abandono cuando rol es docente', () => {
    const { generarPromptGlobal } = require('./sugerencias.service');
    const prompt = generarPromptGlobal(datosGlobalMock, prediccionesMock, 'docente');
    expect(prompt).not.toContain('Probabilidad de abandono');
  });

  test('incluye materias en curso', () => {
    const { generarPromptGlobal } = require('./sugerencias.service');
    const prompt = generarPromptGlobal(datosGlobalMock, prediccionesMock, 'admin');
    expect(prompt).toContain('Análisis II');
    expect(prompt).toContain('Física I');
  });

  test('incluye instrucción de formato con Resumen y bullets', () => {
    const { generarPromptGlobal } = require('./sugerencias.service');
    const prompt = generarPromptGlobal(datosGlobalMock, prediccionesMock, 'admin');
    expect(prompt).toContain('**Resumen:**');
    expect(prompt).toContain('80 palabras');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```
cd backend && npx jest sugerencias.service.test.js --no-coverage
```

Resultado esperado: FAIL — `generarPromptGlobal is not a function`

- [ ] **Step 3: Implementar `obtenerDatosAlumnoGlobal` y `generarPromptGlobal`**

En `backend/src/services/sugerencias.service.js`, agregar después de `obtenerDatosAlumno` (antes de `generarSugerencia`):

```js
function obtenerDatosAlumnoGlobal(alumnoId) {
  const alumno = db
    .prepare(
      `SELECT id, COALESCE(nombre_completo, username) AS nombre_completo,
              anio_ingreso, promedio_colegio, ayuda_financiera, colegio_tecnico
       FROM users WHERE id = ? AND role = 'alumno' LIMIT 1`,
    )
    .get(alumnoId);

  if (!alumno) return null;

  const todasCursadas = db
    .prepare(
      `SELECT c.estado, c.asistencia, c.anio, m.nombre AS materia_nombre
       FROM cursadas c JOIN materias m ON m.id = c.materia_id
       WHERE c.alumno_id = ?
       ORDER BY c.anio DESC`,
    )
    .all(alumnoId);

  const aprobadas = todasCursadas.filter((c) => c.estado === 'aprobada');
  const recursadas = todasCursadas.filter((c) => c.estado === 'recursada');
  const cursando = todasCursadas.filter((c) => c.estado === 'cursando');
  const abandonadas = todasCursadas.filter((c) => c.estado === 'abandonada');

  const examenesConNota = db
    .prepare(
      `SELECT e.nota FROM examenes e
       WHERE e.alumno_id = ? AND e.rendido = 1 AND e.nota IS NOT NULL`,
    )
    .all(alumnoId);

  const promedio_notas =
    examenesConNota.length > 0
      ? examenesConNota.reduce((s, e) => s + Number(e.nota), 0) / examenesConNota.length
      : null;

  const asistencia_promedio =
    todasCursadas.length > 0
      ? todasCursadas.reduce((s, c) => s + Number(c.asistencia || 0), 0) / todasCursadas.length
      : null;

  const historialTexto =
    todasCursadas.length > 0
      ? todasCursadas
          .slice(0, 10)
          .map((c) => `- ${c.anio}: ${c.materia_nombre} (${c.estado})`)
          .join('\n')
      : 'Sin historial registrado';

  return {
    alumno,
    indicadores: {
      total_cursadas: todasCursadas.length,
      aprobadas: aprobadas.length,
      recursadas: recursadas.length,
      cursando: cursando.length,
      abandonadas: abandonadas.length,
      promedio_notas: promedio_notas != null ? Number(promedio_notas.toFixed(2)) : null,
      asistencia_promedio,
    },
    materiasEnCurso: cursando.map((c) => ({ nombre: c.materia_nombre })),
    historialTexto,
  };
}

function generarPromptGlobal(datos, predicciones, rol) {
  const { alumno, indicadores, materiasEnCurso, historialTexto } = datos;

  const probAbandono = predicciones?.abandono?.probabilidad ?? null;
  const showAbandono = rol === 'admin' || rol === 'coordinador';

  const lineaAbandono = showAbandono
    ? (probAbandono != null
        ? `- Probabilidad de abandono: ${Math.round(probAbandono * 100)}% (riesgo ${getNivelRiesgo(probAbandono)})`
        : '- Probabilidad de abandono: no disponible')
    : '';

  const materiasEnCursoTexto =
    materiasEnCurso.length > 0
      ? materiasEnCurso.map((m) => `- ${m.nombre}`).join('\n')
      : 'Ninguna';

  const promedioTexto =
    indicadores.promedio_notas != null
      ? indicadores.promedio_notas.toFixed(2)
      : 'no disponible';

  const asistenciaTexto =
    indicadores.asistencia_promedio != null
      ? `${Math.round(indicadores.asistencia_promedio * 100)}%`
      : 'no disponible';

  return `Sos un asistente académico que ayuda a coordinadores universitarios.
Analizá la siguiente información general de un alumno y respondé SOLO con este formato exacto, sin explicaciones adicionales:
**Resumen:** [una oración que describa la situación global del alumno]
• [acción concreta 1]
• [acción concreta 2]
• [acción concreta 3 — opcional]
Máximo 80 palabras en total.

--- DATOS DEL ALUMNO ---
Nombre: ${alumno.nombre_completo}
Año de ingreso: ${alumno.anio_ingreso ?? 'desconocido'}
Promedio colegio: ${alumno.promedio_colegio ?? 'desconocido'}
Ayuda financiera: ${alumno.ayuda_financiera ? 'sí' : 'no'}

INDICADORES GLOBALES:
- Total materias cursadas: ${indicadores.total_cursadas}
- Aprobadas: ${indicadores.aprobadas} | Recursadas: ${indicadores.recursadas} | Abandonadas: ${indicadores.abandonadas} | En curso: ${indicadores.cursando}
- Promedio de notas: ${promedioTexto}
- Asistencia promedio: ${asistenciaTexto}

MATERIAS EN CURSO:
${materiasEnCursoTexto}

PREDICCIONES:
${[lineaAbandono].filter(Boolean).join('\n') || '- Sin predicciones disponibles'}

HISTORIAL (últimas 10 cursadas):
${historialTexto}`;
}
```

Agregar `obtenerDatosAlumnoGlobal` y `generarPromptGlobal` al `module.exports` al final del archivo:

```js
module.exports = {
  getNivelRiesgo,
  generarPrompt,
  obtenerDatosAlumno,
  obtenerDatosAlumnoGlobal,
  generarPromptGlobal,
  generarSugerencia,
};
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```
cd backend && npx jest sugerencias.service.test.js --no-coverage
```

Resultado esperado: todos los tests PASS (los anteriores + los nuevos de `generarPromptGlobal`)

- [ ] **Step 5: Commit**

```
git add backend/src/services/sugerencias.service.js backend/src/services/sugerencias.service.test.js
git commit -m "feat: add obtenerDatosAlumnoGlobal and generarPromptGlobal to sugerencias service"
```

---

## Task 2: Modo global en `generarSugerencia` y la ruta

**Files:**
- Modify: `backend/src/services/sugerencias.service.js`
- Modify: `backend/src/routes/sugerencias.routes.js`

- [ ] **Step 1: Actualizar `generarSugerencia` para bifurcar en modo global**

En `backend/src/services/sugerencias.service.js`, reemplazar la función `generarSugerencia` existente (líneas 171–186) por:

```js
async function generarSugerencia(alumnoId, materiaId, rol) {
  if (materiaId == null) {
    const datos = obtenerDatosAlumnoGlobal(alumnoId);
    if (!datos) return null;

    const prediccionesMap = await precalcularPrediccionesCompletas([alumnoId], null);
    const predicciones = prediccionesMap[alumnoId] || {};

    const prompt = generarPromptGlobal(datos, predicciones, rol);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });
    return response.text ?? null;
  }

  const datos = obtenerDatosAlumno(alumnoId, materiaId);
  if (!datos) return null;

  const prediccionesMap = await precalcularPrediccionesCompletas([alumnoId], materiaId);
  const predicciones = prediccionesMap[alumnoId] || {};

  const prompt = generarPrompt(datos, predicciones, rol);
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
  });
  return response.text ?? null;
}
```

- [ ] **Step 2: Actualizar la ruta para permitir `materiaId` opcional**

En `backend/src/routes/sugerencias.routes.js`, reemplazar el bloque del handler del GET (líneas 29–73) por:

```js
router.get(
  '/:alumnoId',
  authenticate,
  authorize('admin', 'coordinador', 'docente'),
  async (req, res) => {
    const alumnoId = toPositiveInt(req.params.alumnoId);
    const materiaId = toPositiveInt(req.query.materiaId);

    if (!alumnoId) {
      return res.status(400).json({ error: 'alumnoId es requerido.' });
    }

    const { role: rol, id: userId } = req.user;

    if (rol === 'docente') {
      if (!materiaId) {
        return res.status(403).json({ error: 'Docentes deben especificar una materia.' });
      }
      const db = require('../db/database');
      const tieneAcceso = db
        .prepare(
          `SELECT 1 FROM docente_materia dm
           JOIN cursadas c ON c.materia_id = dm.materia_id AND c.alumno_id = ?
           WHERE dm.docente_id = ? AND dm.activo = 1 LIMIT 1`,
        )
        .get(alumnoId, userId);
      if (!tieneAcceso) {
        return res.status(403).json({ error: 'No tenés acceso a este alumno.' });
      }
    }

    const cacheRol = rol === 'docente' ? 'docente' : 'full';
    const cacheKey = `${alumnoId}_${materiaId ?? 'global'}_${cacheRol}`;
    const cached = getCached(cacheKey);
    if (cached) return res.status(200).json({ sugerencia: cached });

    try {
      const sugerencia = await generarSugerencia(alumnoId, materiaId ?? null, rol);
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
```

- [ ] **Step 3: Correr todos los tests del backend**

```
cd backend && npx jest --no-coverage
```

Resultado esperado: PASS en todos los tests existentes (el cambio en la ruta no rompe nada)

- [ ] **Step 4: Commit**

```
git add backend/src/services/sugerencias.service.js backend/src/routes/sugerencias.routes.js
git commit -m "feat: support global mode in generarSugerencia and sugerencias route"
```

---

## Task 3: Extraer `ModalSugerencia` a componente compartido

**Files:**
- Create: `frontend/src/components/ModalSugerencia.jsx`
- Modify: `frontend/src/pages/PanelPredicciones.jsx`

- [ ] **Step 1: Crear el archivo compartido**

Crear `frontend/src/components/ModalSugerencia.jsx` con el siguiente contenido (copiado exactamente de las líneas 154–233 de `PanelPredicciones.jsx`):

```jsx
export function SugerenciaContent({ texto }) {
  const lines = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  const resumenLine = lines.find((l) => l.startsWith('**Resumen:**'));
  const bullets = lines
    .filter((l) => /^[•\-*–◦]/.test(l) && !l.startsWith('**Resumen:**'))
    .map((l) => l.replace(/^[•\-*–◦]\s*/, ''));
  const resumen = resumenLine ? resumenLine.replace(/^\*\*Resumen:\*\*\s*/, '') : null;

  if (bullets.length > 0) {
    return (
      <div className="space-y-3">
        {resumen && (
          <p className="text-sm font-semibold text-slate-800">{resumen}</p>
        )}
        <ul className="space-y-1.5 pl-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-0.5 text-blue-500 flex-shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{texto}</p>
  );
}

export default function ModalSugerencia({ alumnoNombre, estado, onClose, onRetry }) {
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
          <SugerenciaContent texto={estado.texto} />
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

- [ ] **Step 2: Actualizar `PanelPredicciones.jsx` para importar desde el componente compartido**

En `frontend/src/pages/PanelPredicciones.jsx`:

1. Agregar el import al inicio del archivo (después de los imports existentes):

```js
import ModalSugerencia from "../components/ModalSugerencia";
```

2. Eliminar las definiciones inline de `SugerenciaContent` (líneas 154–183) y `ModalSugerencia` (líneas 187–233) — el archivo ahora las importa.

- [ ] **Step 3: Verificar que el frontend compila sin errores**

```
cd frontend && npm run build 2>&1 | tail -20
```

Resultado esperado: Build exitoso, sin errores de TypeScript/JSX ni imports faltantes.

- [ ] **Step 4: Commit**

```
git add frontend/src/components/ModalSugerencia.jsx frontend/src/pages/PanelPredicciones.jsx
git commit -m "refactor: extract ModalSugerencia and SugerenciaContent to shared component"
```

---

## Task 4: Botón y modal de Sugerencias en `AlumnoPerfil`

**Files:**
- Modify: `frontend/src/pages/AlumnoPerfil.jsx`

- [ ] **Step 1: Agregar el import del componente compartido**

En `frontend/src/pages/AlumnoPerfil.jsx`, agregar al bloque de imports al inicio (después de `import api from "../api/axios";`):

```js
import ModalSugerencia from "../components/ModalSugerencia";
```

- [ ] **Step 2: Agregar el estado para sugerencias**

En `frontend/src/pages/AlumnoPerfil.jsx`, dentro de la función `AlumnoPerfil`, después de la declaración de estado `busquedaAcademica` (línea ~199), agregar:

```js
const [sugerenciaEstado, setSugerenciaEstado] = useState(null);
```

`null` significa modal cerrado. Cuando se abre, el valor es un objeto `{ status: 'loading' | 'success' | 'error', texto: string | null }`.

- [ ] **Step 3: Agregar la función `handleVerSugerencias`**

En `AlumnoPerfil.jsx`, después del estado nuevo del paso anterior, agregar:

```js
const handleVerSugerencias = async () => {
  setSugerenciaEstado({ status: 'loading', texto: null });
  try {
    const res = await api.get(`/api/sugerencias/${alumnoId}`);
    setSugerenciaEstado({ status: 'success', texto: res.data.sugerencia });
  } catch {
    setSugerenciaEstado({ status: 'error', texto: 'No se pudieron cargar las sugerencias.' });
  }
};
```

- [ ] **Step 4: Agregar el botón en el header del perfil**

En `AlumnoPerfil.jsx`, localizar el bloque del header (el `<div className="flex-1 min-w-0">` que contiene `{alumno.nombre_completo}`, línea ~971). Reemplazar:

```jsx
<div className="flex-1 min-w-0">
  <h1 className="text-xl font-medium text-gray-900">
    {alumno.nombre_completo}
  </h1>
```

por:

```jsx
<div className="flex-1 min-w-0">
  <div className="flex items-center justify-between gap-3">
    <h1 className="text-xl font-medium text-gray-900">
      {alumno.nombre_completo}
    </h1>
    {!isDocente && (
      <button
        type="button"
        onClick={handleVerSugerencias}
        className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
      >
        ✨ Sugerencias
      </button>
    )}
  </div>
```

- [ ] **Step 5: Montar el modal al final del JSX**

En `AlumnoPerfil.jsx`, antes del `return` cierre del componente (justo antes del último `</div>` que cierra el contenedor principal), agregar:

```jsx
{sugerenciaEstado && (
  <ModalSugerencia
    alumnoNombre={alumno?.nombre_completo}
    estado={sugerenciaEstado}
    onClose={() => setSugerenciaEstado(null)}
    onRetry={handleVerSugerencias}
  />
)}
```

- [ ] **Step 6: Verificar que el frontend compila sin errores**

```
cd frontend && npm run build 2>&1 | tail -20
```

Resultado esperado: Build exitoso, sin errores.

- [ ] **Step 7: Commit**

```
git add frontend/src/pages/AlumnoPerfil.jsx
git commit -m "feat: add sugerencias button and modal to AlumnoPerfil"
```

---

## Task 5: Verificación funcional en el navegador

- [ ] **Step 1: Levantar backend y frontend**

```
cd backend && node src/index.js
cd frontend && npm run dev
```

- [ ] **Step 2: Verificar el botón aparece para admin/coordinador**

Navegar a un Perfil de Alumno como usuario admin o coordinador. Verificar que aparece el botón "✨ Sugerencias" en el header, a la derecha del nombre.

- [ ] **Step 3: Verificar que el botón NO aparece para docente**

Loguearse como docente, navegar al Perfil de un Alumno de su materia. Verificar que el botón no es visible.

- [ ] **Step 4: Verificar el modal de carga**

Como admin, hacer click en "✨ Sugerencias". Verificar que el modal aparece con el spinner de carga ("Analizando perfil del alumno...").

- [ ] **Step 5: Verificar respuesta exitosa**

Esperar la respuesta de Gemini. Verificar que el modal muestra el resumen en negrita y los bullets correctamente formateados.

- [ ] **Step 6: Verificar que PanelPredicciones no se rompió**

Navegar a PanelPredicciones y abrir el modal de Sugerencias de un alumno desde allí. Verificar que sigue funcionando igual que antes.

- [ ] **Step 7: Commit final**

```
git add -A
git commit -m "feat: sugerencias generales en perfil del alumno — feature complete"
```
