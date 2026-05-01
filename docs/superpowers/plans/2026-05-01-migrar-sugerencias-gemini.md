# Migrar sugerencias a Gemini 2.5 Flash-Lite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el cliente de Anthropic en el servicio de sugerencias por Google Gemini 2.5 Flash-Lite.

**Architecture:** Un único cambio localizado en `sugerencias.service.js`: se elimina `@anthropic-ai/sdk` y se reemplaza por `@google/genai`. El prompt, la lógica de datos, la ruta y el caché no cambian. Los tests existentes no necesitan modificación porque solo testean funciones puras que no dependen del SDK.

**Tech Stack:** Node.js, `@google/genai` (SDK oficial de Google), `GEMINI_API_KEY` en `.env`.

---

## File Map

| Acción   | Archivo                                              |
|----------|------------------------------------------------------|
| Modificar | `backend/src/services/sugerencias.service.js`       |
| Sin cambio | `backend/src/services/sugerencias.service.test.js` |
| Sin cambio | `backend/src/routes/sugerencias.routes.js`         |

---

### Task 1: Instalar `@google/genai`

**Files:**
- Modify: `backend/package.json` (automático vía npm)

- [ ] **Step 1: Instalar el paquete**

Desde la carpeta `backend/`:

```bash
cd backend
npm install @google/genai
```

Salida esperada: línea que dice `added X packages` sin errores.

- [ ] **Step 2: Verificar que aparece en package.json**

```bash
grep "@google/genai" package.json
```

Salida esperada: `"@google/genai": "^X.X.X"`

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: install @google/genai SDK"
```

---

### Task 2: Migrar `sugerencias.service.js` a Gemini

**Files:**
- Modify: `backend/src/services/sugerencias.service.js`

- [ ] **Step 1: Ejecutar los tests actuales para tener baseline**

```bash
cd backend
npx jest src/services/sugerencias.service.test.js --no-coverage
```

Salida esperada: todos los tests en PASS.

- [ ] **Step 2: Reemplazar el cliente en el archivo**

Abrir `backend/src/services/sugerencias.service.js` y aplicar estos cambios:

**Línea 1 — reemplazar:**
```js
// ANTES
const Anthropic = require('@anthropic-ai/sdk');
```
```js
// DESPUÉS
const { GoogleGenAI } = require('@google/genai');
```

**Línea 6 — reemplazar:**
```js
// ANTES
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```
```js
// DESPUÉS
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

**Función `generarSugerencia` (líneas 174-180) — reemplazar el bloque de llamada al LLM:**
```js
// ANTES
const message = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 512,
  messages: [{ role: 'user', content: prompt }],
});

return message.content[0]?.text ?? null;
```
```js
// DESPUÉS
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash-lite',
  contents: prompt,
});

return response.text ?? null;
```

- [ ] **Step 3: Ejecutar los tests para verificar que siguen pasando**

```bash
npx jest src/services/sugerencias.service.test.js --no-coverage
```

Salida esperada: todos los tests en PASS (los tests no dependen del SDK).

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/sugerencias.service.js
git commit -m "feat: migrate sugerencias service from Anthropic to Gemini 2.5 Flash-Lite"
```

---

### Task 3: Verificación manual en el servidor

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Levantar el servidor backend**

```bash
cd backend
npm run dev
```

Salida esperada: `Server running on port 3001` sin errores de importación.

- [ ] **Step 2: Hacer una petición de prueba**

Con el frontend corriendo, navegar al panel de predicciones de cualquier alumno y hacer clic en "Ver sugerencias". Verificar que se muestra un párrafo generado por Gemini (texto coherente, en español).

Si no hay frontend disponible, usar curl:

```bash
curl -X GET "http://localhost:3001/api/sugerencias/<alumnoId>/<materiaId>" \
  -H "Authorization: Bearer <token>"
```

Salida esperada: JSON con un campo `sugerencia` conteniendo texto narrativo.
