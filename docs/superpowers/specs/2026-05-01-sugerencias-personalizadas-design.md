# Diseño: Sugerencias Personalizadas para Docentes

**Fecha:** 2026-05-01  
**Estado:** Aprobado

## Resumen

Sistema de sugerencias pedagógicas generadas por Claude (Anthropic) bajo demanda, dirigidas a docentes y coordinadores que usan el PanelPredicciones. Dado un alumno, el sistema recopila sus predicciones ML, variables clave e historial completo, y devuelve un párrafo narrativo con análisis de la situación y acciones recomendadas.

---

## Arquitectura

### Flujo completo

```
Frontend (PanelPredicciones)
  → click "Ver sugerencias" para alumno X (materiaId en contexto)
  → GET /predict/sugerencias/:alumnoId?materiaId=Y
       ↓
  Backend Express
  1. Verifica JWT (middleware existente)
  2. Chequea caché en memoria (clave: alumnoId_materiaId, TTL: 1h)
  3. Si no hay caché:
     a. Busca predicciones del alumno desde `predictions_log` (ya calculadas por el panel; si no existen retorna 404)
     b. Busca variables de predicción (asistencia, promedio, veces_recursada, etc.)
     c. Busca historial completo (cursadas + exámenes anteriores)
     d. Arma el prompt y llama a Claude API
     e. Guarda respuesta en caché
  4. Retorna { sugerencia: "..." }
       ↓
  Frontend muestra el párrafo en modal
```

### Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `backend/src/services/sugerencias.service.js` | Recopila datos del alumno, arma el prompt, llama a Claude API |
| `backend/src/routes/sugerencias.routes.js` | Endpoint con caché TTL, manejo de errores HTTP |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `backend/src/app.js` | Registrar nueva ruta `/predict/sugerencias` |
| `frontend/src/pages/PanelPredicciones.jsx` | Agregar botón "Ver sugerencias" y modal por alumno |

---

## Endpoint

```
GET /predict/sugerencias/:alumnoId?materiaId=Y
Authorization: Bearer <JWT>

200 OK
{ "sugerencia": "El alumno Juan García muestra..." }

404 Not Found
{ "error": "No hay suficiente información para generar sugerencias" }

503 Service Unavailable
{ "error": "No se pudo generar la sugerencia, intente nuevamente" }
```

---

## Servicio de sugerencias

### Datos recopilados

1. **Predicciones:** probabilidad de abandono, probabilidad de recursado, nota esperada — leídas de `predictions_log` (no se recalculan para evitar llamar a los modelos ML)
2. **Variables clave:** asistencia actual, promedio general, veces_recursada, parciales rendidos
3. **Historial:** cursadas anteriores con estado (aprobada/recursada/abandonó), últimos exámenes con nota

### Prompt enviado a Claude

```
Sos un asistente académico que ayuda a docentes universitarios.
Analizá la siguiente información de un alumno y redactá UN párrafo 
narrativo (150-200 palabras) dirigido al docente/coordinador, 
explicando la situación del alumno y qué acciones concretas 
se recomiendan. Sé específico, usa los datos provistos.

--- DATOS DEL ALUMNO ---
Nombre: {nombre_completo}
Materia: {nombre_materia}
Año de ingreso: {anio_ingreso}

PREDICCIONES:
- Probabilidad de abandono: {abandono}% (riesgo {nivel_abandono})
- Probabilidad de recursado: {recursado}% (riesgo {nivel_recursado})
- Nota esperada próximo examen: {nota_esperada}

VARIABLES CLAVE:
- Asistencia actual: {asistencia}%
- Promedio general: {promedio}
- Veces que recursó esta materia: {veces_recursada}
- Parciales rendidos: {parciales_rendidos} de {total_parciales}

HISTORIAL:
{historial_formateado}
```

### Modelo Claude

`claude-haiku-4-5-20251001` — velocidad y costo adecuados para texto corto narrativo. Se puede cambiar a Sonnet si se requiere mayor profundidad en el análisis.

---

## Caché

- Implementación: `Map` en memoria en Express (mismo patrón que `panel-predicciones.routes.js`)
- Clave: `${alumnoId}_${materiaId}`
- TTL: 1 hora
- Invalidación: automática por TTL (no se invalida manualmente)

---

## Frontend

### Cambios en PanelPredicciones.jsx

- Botón "Ver sugerencias" por cada fila de alumno
- Estado local por alumno: `Map<alumnoId, { status, texto }>` para no repetir el fetch si el modal se cierra y reabre en la misma sesión
- Modal con tres estados:
  - **Loading:** spinner + "Analizando perfil del alumno..."
  - **Success:** párrafo narrativo con ícono de sugerencia
  - **Error:** mensaje de error con opción de reintentar

Se reutiliza el patrón de modales existente en el panel (`useState` + overlay).

---

## Seguridad

- `ANTHROPIC_API_KEY` leída desde `process.env` (mismo patrón que otras credenciales del backend)
- Endpoint protegido por middleware JWT existente
- La API key nunca sale del backend

---

## Manejo de errores

| Caso | Comportamiento backend | Comportamiento frontend |
|---|---|---|
| Claude API falla | Retorna 503 | Modal muestra error + botón reintentar |
| Alumno sin datos suficientes | Retorna 404 | Modal muestra "No hay suficiente información" |
| JWT inválido | Retorna 401 (middleware) | Redirige a login (comportamiento existente) |
| Timeout Claude (>10s) | Retorna 503 | Modal muestra error + botón reintentar |
