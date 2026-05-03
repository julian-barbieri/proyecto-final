# Sugerencias: restricción por rol y formato simplificado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restringir datos de abandono en sugerencias para docentes y cambiar el formato del texto generado a 1 oración de resumen + 2-3 bullets de acción concretos.

**Architecture:** Se agrega el parámetro `rol` a `generarPrompt` y `generarSugerencia`. La ruta extrae `req.user.role` del JWT (ya disponible por el middleware de auth) y lo pasa al servicio. La clave de cache pasa de `alumnoId_materiaId` a `alumnoId_materiaId_{docente|full}`. En el frontend, un nuevo componente `SugerenciaContent` parsea el formato estructurado y lo renderiza como resumen + lista de bullets.

**Tech Stack:** Node.js + Express + Jest (backend), React + Tailwind CSS (frontend)

---

### Task 1: Actualizar tests de `generarPrompt` (TDD first)

**Files:**
- Modify: `backend/src/services/sugerencias.service.test.js`

- [ ] **Step 1: Reemplazar el archivo de tests completo**

```javascript
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
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('Ana García');
  });

  test('incluye el nombre de la materia', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('Análisis Matemático I');
  });

  test('incluye la probabilidad de abandono cuando rol es admin', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('72%');
    expect(prompt).toContain('ALTO');
  });

  test('incluye la probabilidad de abandono cuando rol es coordinador', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'coordinador');
    expect(prompt).toContain('72%');
  });

  test('NO incluye datos de abandono cuando rol es docente', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'docente');
    expect(prompt).not.toContain('abandono');
    expect(prompt).not.toContain('72%');
  });

  test('incluye la probabilidad de recursado', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('45%');
    expect(prompt).toContain('BAJO');
  });

  test('incluye la nota esperada', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('5.2');
  });

  test('incluye los parciales rendidos', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('1');
    expect(prompt).toContain('2');
  });

  test('incluye instrucción de formato con Resumen y bullets', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('**Resumen:**');
    expect(prompt).toContain('•');
    expect(prompt).toContain('80 palabras');
  });

  test('admin sin datos de abandono muestra no disponible', () => {
    const sinAbandono = { ...prediccionesMock, abandono: null };
    const prompt = generarPrompt(datosMock, sinAbandono, 'admin');
    expect(prompt).toContain('no disponible');
  });
});
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
cd backend && npm test -- --testPathPattern=sugerencias.service.test.js
```

Expected: FAIL — los tests nuevos fallan porque `generarPrompt` todavía no acepta `rol` y el formato del prompt no cambió aún.

---

### Task 2: Implementar `generarPrompt(datos, predicciones, rol)`

**Files:**
- Modify: `backend/src/services/sugerencias.service.js` — función `generarPrompt` (líneas 14-73)

- [ ] **Step 1: Reemplazar la función `generarPrompt`**

En `backend/src/services/sugerencias.service.js`, reemplazar desde `function generarPrompt(datos, predicciones) {` hasta el cierre de la función (líneas 14-73) con:

```javascript
function generarPrompt(datos, predicciones, rol) {
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

  const lineaAbandono = rol !== 'docente'
    ? (probAbandono != null
        ? `- Probabilidad de abandono: ${Math.round(probAbandono * 100)}% (riesgo ${getNivelRiesgo(probAbandono)})\n`
        : '- Probabilidad de abandono: no disponible\n')
    : '';

  const lineaRecursado = probRecursado != null
    ? `- Probabilidad de recursado: ${Math.round(probRecursado * 100)}% (riesgo ${getNivelRiesgo(probRecursado)})`
    : '- Probabilidad de recursado: no disponible';

  const lineaNota = notaEsperada != null
    ? `- Nota esperada próximo examen: ${Number(notaEsperada).toFixed(1)}`
    : '- Nota esperada: no disponible';

  return `Sos un asistente académico que ayuda a docentes universitarios.
Analizá la siguiente información de un alumno y respondé SOLO con este formato exacto, sin explicaciones adicionales:
**Resumen:** [una oración que describa la situación del alumno]
• [acción concreta 1]
• [acción concreta 2]
• [acción concreta 3 — opcional]
Máximo 80 palabras en total.

--- DATOS DEL ALUMNO ---
Nombre: ${alumno.nombre_completo}
Materia: ${materia.nombre}
Año de ingreso: ${alumno.anio_ingreso ?? 'desconocido'}

PREDICCIONES:
${lineaAbandono}${lineaRecursado}
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
```

- [ ] **Step 2: Correr tests — deben pasar**

```bash
cd backend && npm test -- --testPathPattern=sugerencias.service.test.js
```

Expected: PASS — todos los tests en verde.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/sugerencias.service.js backend/src/services/sugerencias.service.test.js
git commit -m "feat: add role-based prompt variant and structured format to generarPrompt"
```

---

### Task 3: Actualizar `generarSugerencia` y la clave de cache en la ruta

**Files:**
- Modify: `backend/src/services/sugerencias.service.js` — función `generarSugerencia` (líneas 165-180)
- Modify: `backend/src/routes/sugerencias.routes.js` — handler de la ruta (líneas 29-57)

- [ ] **Step 1: Actualizar `generarSugerencia` para aceptar y propagar `rol`**

En `sugerencias.service.js`, reemplazar la función `generarSugerencia` (líneas 165-180):

```javascript
async function generarSugerencia(alumnoId, materiaId, rol) {
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

- [ ] **Step 2: Actualizar el handler de la ruta para extraer el rol y usar la nueva clave de cache**

En `sugerencias.routes.js`, reemplazar el handler `router.get` completo (líneas 29-57):

```javascript
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

    const rol = req.user.role;
    const cacheRol = rol === 'docente' ? 'docente' : 'full';
    const cacheKey = `${alumnoId}_${materiaId}_${cacheRol}`;
    const cached = getCached(cacheKey);
    if (cached) return res.status(200).json({ sugerencia: cached });

    try {
      const sugerencia = await generarSugerencia(alumnoId, materiaId, rol);
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

```bash
cd backend && npm test
```

Expected: PASS — sin regresiones.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/sugerencias.service.js backend/src/routes/sugerencias.routes.js
git commit -m "feat: pass role to generarSugerencia and use role-scoped cache key"
```

---

### Task 4: Actualizar `ModalSugerencia` en el frontend

**Files:**
- Modify: `frontend/src/pages/PanelPredicciones.jsx` — líneas 152-202

- [ ] **Step 1: Agregar el componente `SugerenciaContent` antes de `ModalSugerencia`**

Insertar este nuevo componente inmediatamente antes de la línea `// ─── Modal de sugerencias IA ───` (línea 152):

```jsx
function SugerenciaContent({ texto }) {
  const lines = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  const resumenLine = lines.find((l) => l.startsWith('**Resumen:**'));
  const bullets = lines
    .filter((l) => l.startsWith('•'))
    .map((l) => l.replace(/^•\s*/, ''));
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
```

- [ ] **Step 2: Reemplazar el bloque `estado.status === 'success'` en `ModalSugerencia`**

En `ModalSugerencia` (líneas 181-185), reemplazar:

```jsx
        {estado.status === 'success' && (
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
            {estado.texto}
          </p>
        )}
```

por:

```jsx
        {estado.status === 'success' && (
          <SugerenciaContent texto={estado.texto} />
        )}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PanelPredicciones.jsx
git commit -m "feat: render sugerencias as structured summary + bullet list"
```
