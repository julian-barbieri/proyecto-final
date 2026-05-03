# Sugerencias Generales en Perfil del Alumno

**Fecha:** 2026-05-03  
**Roles afectados:** admin, coordinador  
**Branch:** develop-materias

---

## Contexto

El sistema ya genera sugerencias IA por alumno+materia (endpoint `GET /api/sugerencias/:alumnoId?materiaId=X`, visible en PanelPredicciones). Esta feature agrega un botón "Sugerencias" en el Perfil del Alumno (`AlumnoPerfil.jsx`) que genera sugerencias **holísticas**: considera todas las materias, todo el historial académico, la información personal y las predicciones completas del alumno.

---

## Decisiones de diseño

- **Ubicación del botón:** header del perfil, junto al nombre del alumno (siempre visible sin importar qué tab está activo)
- **Presentación:** modal popup (igual al existente en PanelPredicciones)
- **Enfoque técnico:** reutilizar el endpoint existente sin `materiaId` (Opción A)

---

## Sección 1: Backend

**Archivo:** `backend/src/services/sugerencias.service.js`

### Cambio en `generarSugerencia(alumnoId, materiaId, rol)`

Cuando `materiaId` es `undefined` o `null`, ejecuta el camino "global":
1. Llama a `obtenerDatosAlumnoGlobal(alumnoId)`
2. Llama a `precalcularPrediccionesCompletas()` para cada materia activa + predicción de abandono global
3. Construye el prompt con `generarPromptGlobal(datos, predicciones, rol)`
4. Envía a Gemini y retorna la sugerencia

### Nueva función: `obtenerDatosAlumnoGlobal(alumnoId)`

Consulta:
- Info personal: `nombre_completo`, `anio_ingreso`, `promedio_colegio`, `ayuda_financiera`, `colegio_tecnico`
- Todas las cursadas con su estado (`aprobada`, `recursada`, `cursando`, `abandonada`) y notas
- Indicadores globales: promedio general, tasa de aprobación, tasa de recursado, asistencia promedio, total de materias cursadas

### Nueva función: `generarPromptGlobal(datos, predicciones, rol)`

El prompt incluye:
- Resumen del perfil: año de ingreso, promedio colegio, ayuda financiera
- Historial agrupado por estado: materias aprobadas / en curso / recursadas / abandonadas
- Predicción de abandono con nivel de riesgo (solo si rol es `admin` o `coordinador`)
- Predicciones de recursado para cada materia activa
- Instrucción de formato idéntica al prompt existente: máximo 80 palabras, estructura Resumen + 3 bullets

### Cache

Clave: `(alumnoId, 'global', rol)` — compatible con la lógica existente que ya usa `(alumnoId, materiaId, rol)`. El `null`/`undefined` de `materiaId` se normaliza a la cadena `'global'` antes de construir la clave.

### Rutas

Sin cambios. `GET /api/sugerencias/:alumnoId` sin query param `materiaId` ya es válido en el router existente.

---

## Sección 2: Componente compartido

**Archivo nuevo:** `frontend/src/components/ModalSugerencia.jsx`

Extrae de `PanelPredicciones.jsx` los dos componentes actualmente inline:

- **`SugerenciaContent`** — parsea el texto de sugerencia y renderiza resumen + lista de bullets. Sin cambios de lógica.
- **`ModalSugerencia`** — modal completo con estados: loading (spinner), error (mensaje + botón reintentar), contenido (`SugerenciaContent`). Acepta props: `open`, `onClose`, `sugerencia`, `loading`, `error`, `onRetry`, `alumnoNombre`. Sin cambios de lógica.

`PanelPredicciones.jsx` pasa a importar desde `../components/ModalSugerencia` en lugar de definirlos inline. Sin cambio de comportamiento ni de UI.

---

## Sección 3: Frontend — AlumnoPerfil

**Archivo:** `frontend/src/pages/AlumnoPerfil.jsx`

### Estado nuevo

```js
const [loadingSugerencia, setLoadingSugerencia] = useState(false);
const [sugerencia, setSugerencia] = useState(null);
const [errorSugerencia, setErrorSugerencia] = useState(null);
const [showSugerencias, setShowSugerencias] = useState(false);
```

### Función `handleVerSugerencias()`

```js
async function handleVerSugerencias() {
  setShowSugerencias(true);
  setLoadingSugerencia(true);
  setErrorSugerencia(null);
  try {
    const res = await fetch(`/api/sugerencias/${alumnoId}`, { credentials: 'include' });
    const data = await res.json();
    setSugerencia(data.sugerencia);
  } catch {
    setErrorSugerencia('No se pudieron cargar las sugerencias.');
  } finally {
    setLoadingSugerencia(false);
  }
}
```

### Header del perfil

Se agrega el botón a la derecha del nombre del alumno, visible solo para `role === 'admin' || role === 'coordinador'`:

```
👤 Juan Pérez                         [✨ Sugerencias]
Ingreso: 2022 · Prom: 7.2 · Riesgo: ALTO
```

### Modal

Al final del JSX, se monta `<ModalSugerencia>` importado del componente compartido:

```jsx
<ModalSugerencia
  open={showSugerencias}
  onClose={() => setShowSugerencias(false)}
  sugerencia={sugerencia}
  loading={loadingSugerencia}
  error={errorSugerencia}
  onRetry={handleVerSugerencias}
  alumnoNombre={alumno?.nombre_completo}
/>
```

### Alcance

- Sin cambios en tabs, historial académico ni ninguna otra sección del perfil
- Sin cambios en el comportamiento para rol `docente`

---

## Archivos afectados

| Archivo | Tipo de cambio |
|---|---|
| `backend/src/services/sugerencias.service.js` | Modificación: agregar modo global |
| `frontend/src/components/ModalSugerencia.jsx` | Nuevo: extracción de componente compartido |
| `frontend/src/pages/PanelPredicciones.jsx` | Modificación: importar desde componente compartido |
| `frontend/src/pages/AlumnoPerfil.jsx` | Modificación: botón + modal + estado |
