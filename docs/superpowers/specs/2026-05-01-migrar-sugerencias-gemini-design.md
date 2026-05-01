# Spec: Migrar servicio de sugerencias a Gemini 2.5 Flash-Lite

**Fecha:** 2026-05-01

## Contexto

El servicio de sugerencias académicas (`backend/src/services/sugerencias.service.js`) genera un párrafo narrativo para docentes analizando el riesgo de cada alumno. Actualmente usa `@anthropic-ai/sdk` con el modelo `claude-haiku-4-5-20251001`. Se requiere migrar a Google Gemini usando el modelo `gemini-2.5-flash-lite`.

La `GEMINI_API_KEY` ya está disponible en `backend/.env`.

## Cambios requeridos

### 1. Nueva dependencia

Instalar el SDK oficial de Google:

```
@google/genai
```

### 2. `backend/src/services/sugerencias.service.js`

- Eliminar el `require` de `@anthropic-ai/sdk` y la instanciación del cliente Anthropic.
- Agregar `const { GoogleGenAI } = require('@google/genai')`.
- Inicializar el cliente: `const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`.
- En `generarSugerencia`, reemplazar la llamada a `client.messages.create(...)` por:

```js
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash-lite',
  contents: prompt,
});
return response.text ?? null;
```

### 3. `backend/src/services/sugerencias.service.test.js`

Si el test mockea `@anthropic-ai/sdk`, actualizar el mock para apuntar a `@google/genai` y ajustar la estructura de respuesta esperada.

## Sin cambios

- Función `generarPrompt` — el prompt enviado al LLM no cambia.
- Función `obtenerDatosAlumno` — toda la lógica de base de datos se mantiene.
- `backend/src/routes/sugerencias.routes.js` — ruta y caché de 1 hora sin cambios.
- Variables de entorno del resto del sistema.

## Criterios de éxito

- El servidor inicia sin errores.
- Al solicitar sugerencias desde el frontend, la respuesta es texto generado por Gemini.
- Los tests del servicio pasan con los mocks actualizados.
