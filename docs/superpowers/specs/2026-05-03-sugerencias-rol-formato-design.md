# Sugerencias: restricción por rol y formato simplificado

**Fecha:** 2026-05-03  
**Rama:** develop-materias

---

## Contexto

Las sugerencias generadas por IA se muestran en `PanelPredicciones` para docentes, coordinadores y admins. Actualmente el prompt incluye datos de abandono y genera un bloque de texto de 150-200 palabras sin estructura, igual para todos los roles.

Se requiere:
1. Que los docentes no reciban información de abandono en el texto generado.
2. Que el texto sea más corto y fácil de leer: 1 oración de resumen + 2-3 bullets de acción.

---

## Cambios

### 1. Backend — `sugerencias.service.js`

**`generarPrompt(datos, rol)`** recibe el rol como segundo parámetro.

- Si `rol === 'docente'`: el prompt incluye recursado, nota esperada, asistencia, promedio, parciales e historial de cursadas. **Omite** probabilidad y nivel de abandono.
- Si `rol === 'admin'` o `'coordinador'`: el prompt incluye todos los datos, incluido abandono.

En ambos casos la instrucción de formato al LLM es:

```
Respondé SOLO con este formato exacto, sin explicaciones adicionales:
**Resumen:** [una oración que describa la situación del alumno]
• [acción concreta 1]
• [acción concreta 2]
• [acción concreta 3 — opcional]
Máximo 80 palabras en total.
```

**`generarSugerencia(alumnoId, materiaId, rol)`** recibe el rol y lo pasa a `generarPrompt`.

---

### 2. Backend — `sugerencias.routes.js`

- Extraer `req.user.role` (disponible desde el middleware de auth existente) y pasarlo a `generarSugerencia`.
- Cambiar la clave de cache de `sugerencia:{alumnoId}:{materiaId}` a `sugerencia:{alumnoId}:{materiaId}:{cacheRol}`, donde `cacheRol` es `'docente'` si el rol es docente, o `'full'` para admin y coordinador. Esto genera como máximo 2 entradas cacheadas por alumno/materia.

---

### 3. Frontend — `PanelPredicciones.jsx`

**`ModalSugerencia`** actualmente renderiza el texto de la sugerencia como bloque plano. Se actualiza para parsear el formato estructurado:

- La línea que empieza con `**Resumen:**` se renderiza como párrafo destacado (negrita).
- Las líneas que empiezan con `•` se renderizan como ítems de lista (`<ul><li>`).

No se modifican: el botón "Sugerencias ✨", la llamada al endpoint, la lógica de roles en tabla/KPIs, ni la autenticación.

---

## Tabla de datos por rol

| Dato                         | docente | admin / coordinador |
|------------------------------|---------|---------------------|
| Probabilidad recursado       | ✅      | ✅                  |
| Nota esperada                | ✅      | ✅                  |
| Asistencia, promedio, parciales | ✅   | ✅                  |
| Historial de cursadas        | ✅      | ✅                  |
| Probabilidad abandono        | ❌      | ✅                  |

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `backend/src/services/sugerencias.service.js` | Agregar parámetro `rol` a `generarPrompt` y `generarSugerencia`; ajustar prompt según rol y formato |
| `backend/src/routes/sugerencias.routes.js` | Pasar `req.user.role` a `generarSugerencia`; actualizar clave de cache |
| `frontend/src/pages/PanelPredicciones.jsx` | Actualizar `ModalSugerencia` para renderizar resumen + bullets |

---

## Lo que no cambia

- Acceso al endpoint: sigue siendo `admin`, `coordinador`, `docente`.
- TTL del cache: 1 hora.
- Columna de riesgo y KPIs en la tabla (ya diferenciados por rol).
- Lógica de autenticación y rutas protegidas.
