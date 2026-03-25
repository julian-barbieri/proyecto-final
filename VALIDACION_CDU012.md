# Plan de Validación - CDU012: Dashboard Ejecutivo

## 📋 Resumen de Implementación

El CDU012 ha sido implementado con:

- **Backend:** Endpoint `GET /api/dashboard` en `backend/src/routes/dashboard.routes.js`
- **Frontend:** Componentes `KpiCard.jsx` y actualización de `Dashboard.jsx`
- **Autorización:** Solo admin y coordinador pueden acceder
- **Estado Build:** ✅ EXITOSO (127 módulos compilados)

---

## 🔍 PLAN DE VALIDACIÓN (5 Fases)

### FASE 1: Validación del Endpoint Backend

**Objetivo:** Verificar que el endpoint retorna la estructura de datos correcta

#### Paso 1.1: Iniciar el servidor backend

```powershell
cd "c:\Users\julia\OneDrive\Documentos\Facultad\Proyecto final\proyecto-final\backend"
npm start
```

**Resultado esperado:**

- Servidor corriendo en `http://localhost:3000`
- Mensaje: "Servidor escuchando en puerto 3000"

#### Paso 1.2: Obtener token de autenticación

Realiza una solicitud POST a:

```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Resultado esperado:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "email": "admin@example.com",
    "nombre_completo": "Administrador"
  }
}
```

**Guardar el `token` para los siguientes pasos.**

#### Paso 1.3: Llamar al endpoint dashboard

Realiza una solicitud GET a:

```
GET http://localhost:3000/api/dashboard
Authorization: Bearer {token_del_paso_anterior}
```

**Resultado esperado - Estructura JSON:**

```json
{
  "materias": [
    {
      "id": 1,
      "codigo": "ALG101",
      "nombre": "Álgebra",
      "alumnos_total": 45,
      "en_riesgo_alto": 8,
      "en_riesgo_medio": 12,
      "bajo_riesgo": 25
    },
    {
      "id": 2,
      "codigo": "CAL101",
      "nombre": "Cálculo",
      "alumnos_total": 38,
      "en_riesgo_alto": 5,
      "en_riesgo_medio": 10,
      "bajo_riesgo": 23
    }
  ],
  "resumen": {
    "total_alumnos": 150,
    "en_riesgo_alto": 20,
    "en_riesgo_medio": 35,
    "bajo_riesgo": 95
  },
  "salud_sistema": {
    "disponible": true,
    "mensaje": "Servicio de IA activo"
  }
}
```

**✅ Validación de Fase 1:**

- [ ] Endpoint retorna status 200
- [ ] Respuesta include el array `materias` con al menos 3 objetos
- [ ] Cada materia tiene: id, codigo, nombre, alumnos_total, en_riesgo_alto, en_riesgo_medio, bajo_riesgo
- [ ] Resumen tiene: total_alumnos, en_riesgo_alto, en_riesgo_medio, bajo_riesgo
- [ ] Salud_sistema incluye: disponible (boolean), mensaje (string)

---

### FASE 2: Validación de Autorización

**Objetivo:** Verificar que solo admin y coordinador pueden acceder

#### Paso 2.1: Intentar acceso sin token

```
GET http://localhost:3000/api/dashboard
```

**Resultado esperado:**

```
Status: 401 Unauthorized
```

#### Paso 2.2: Intentar acceso con rol no autorizado

Primero obten un token para un usuario con rol `alumno`:

```
POST http://localhost:3000/api/auth/login
{
  "username": "alumno1",
  "password": "pass123"
}
```

Luego llama:

```
GET http://localhost:3000/api/dashboard
Authorization: Bearer {token_alumno}
```

**Resultado esperado:**

```
Status: 403 Forbidden
```

#### Paso 2.3: Acceso exitoso con admin

Ya debe funcionar del Paso 1.3

**✅ Validación de Fase 2:**

- [ ] Sin token retorna 401
- [ ] Con rol alumno retorna 403
- [ ] Con rol admin retorna 200
- [ ] Con rol coordinador retorna 200

---

### FASE 3: Validación de Cálculos de Datos

**Objetivo:** Verificar que los cálculos de riesgo son correctos

#### Paso 3.1: Verificar suma de alumnos por materia

Para CADA materia en la respuesta:

```
alumnos_total = en_riesgo_alto + en_riesgo_medio + bajo_riesgo
```

**Ejemplo:**

```
Materia: Álgebra
45 = 8 + 12 + 25 ✅
```

#### Paso 3.2: Verificar sumatoria general

Suma el campo `alumnos_total` de todas las materias:

```
total_alumnos_esperado = SUM(materia.alumnos_total para todas las materias)
total_alumnos_esperado = resumen.total_alumnos
```

#### Paso 3.3: Verificar sumatoria de categorías

```
en_riesgo_alto_esperado = SUM(materia.en_riesgo_alto) = resumen.en_riesgo_alto
en_riesgo_medio_esperado = SUM(materia.en_riesgo_medio) = resumen.en_riesgo_medio
bajo_riesgo_esperado = SUM(materia.bajo_riesgo) = resumen.bajo_riesgo
```

#### Paso 3.4: Verificar suma total de categorías

```
total_alumnos = en_riesgo_alto + en_riesgo_medio + bajo_riesgo
```

**Ejemplo:**

```
150 = 20 + 35 + 95 ✅
```

**✅ Validación de Fase 3:**

- [ ] Cada materia suma correctamente: total = riesgo_alto + riesgo_medio + riesgo_bajo
- [ ] Sumatoria de materias = total_alumnos
- [ ] Sumatoria de categorías coincide
- [ ] Total de resumen = suma de todas las categorías

---

### FASE 4: Validación del Frontend

**Objetivo:** Verificar que la UI muestra los datos correctamente

#### Paso 4.1: Iniciar el servidor frontend

En otra terminal:

```powershell
cd "c:\Users\julia\OneDrive\Documentos\Facultad\Proyecto final\proyecto-final\frontend"
npm run dev
```

**Resultado esperado:**

```
VITE v6.4.1  ready in 123 ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

#### Paso 4.2: Navegar a Dashboard con usuario admin

1. Abre `http://localhost:5173/` en el navegador
2. Login con: `username: admin` / `password: admin123`
3. Deberías estar en el Dashboard automáticamente

#### Paso 4.3: Verificar estructura visual

**Debes ver (en este orden):**

1. **Encabezado:** "Dashboard Ejecutivo"
2. **Estado del Sistema (Health Check):**
   - Indicador verde (disponible) o rojo (no disponible)
   - Mensaje descriptivo
3. **4 Tarjetas KPI en grid responsivo:**
   - KPI 1: Total Predicciones (número azul)
   - KPI 2: Alumnos en Riesgo Alto (número rojo)
   - KPI 3: Tasa de Recursado (número naranja/orange)
   - KPI 4: Nota Promedio (número verde)
4. **Tabla/Cards de Distribución por Materia:**
   - Nombre de materia y código
   - Total de alumnos
   - Desglose por categoría (rojo/amarillo/verde)

#### Paso 4.4: Verificar responsividad

1. En navegador desktop (1920px width): Grid de 4 KPIs en una fila
2. En tablet (768px width): Grid de 2 KPIs por fila
3. En móvil (375px width): Grid de 1 KPI por fila

**Utiliza DevTools (F12) y modo responsive:**

- F12 → Ctrl+Shift+M (Windows)
- O click en "Toggle device toolbar"

#### Paso 4.5: Verificar datos coinciden con backend

**Comparar valores:**

| Elemento                    | Backend                    | Frontend           | ✅  |
| --------------------------- | -------------------------- | ------------------ | --- |
| Total predicciones          | resumen.total_alumnos      | KPI 1 valor        |     |
| Alumnos en riesgo alto      | resumen.en_riesgo_alto     | KPI 2 valor        |     |
| Nota promedio               | /api/history promedio      | KPI 4 valor        |     |
| Primera materia nombre      | materias[0].nombre         | Tabla más reciente |     |
| Primera materia riesgo alto | materias[0].en_riesgo_alto | Tabla distribución |     |

**✅ Validación de Fase 4:**

- [ ] Dashboard carga sin errores
- [ ] Muestra encabezado "Dashboard Ejecutivo"
- [ ] Health check visible (verde o rojo)
- [ ] 4 KPI cards presentes
- [ ] Layout responsive en desktop/tablet/móvil
- [ ] Valores coinciden con backend / /api/history
- [ ] Tabla materias visible
- [ ] Sin console errors (F12)

---

### FASE 5: Validación de Casos Edge

**Objetivo:** Verificar comportamiento en situaciones especiales

#### Paso 5.1: AI Service no disponible

1. Detén el servicio de AI:

   ```powershell
   # En la terminal del AI service
   Ctrl+C
   ```

2. Recarga el Dashboard: F5

3. **Resultado esperado:**
   - Health check debe mostrar en ROJO
   - Mensaje: "Servicio de IA no disponible"
   - Dashboard sigue mostrando datos (de base de datos)
   - No hay crashes o errores

**✅ Reactivar AI service:**

```powershell
cd "c:\Users\julia\OneDrive\Documentos\Facultad\Proyecto final\proyecto-final\ai-service"
python -m uvicorn app.streamlit_app:app --host 127.0.0.1 --port 8000
```

#### Paso 5.2: Acceso sin permisos

1. En otra ventana incógnita, login con `alumno1`
2. Intenta acceder manualmente a `http://localhost:5173/`
3. **Resultado esperado:**
   - Dashboard no carga
   - Mensaje: "No autorizado. Este dashboard es solo para admin y coordinadores."

#### Paso 5.3: Carga lenta de datos

1. Abre DevTools (F12)
2. Ir a Network tab
3. Establecer throttling en "Slow 3G"
4. Reload el dashboard
5. **Resultado esperado:**
   - Debe mostrar skeleton loaders durante 2-3 segundos
   - Datos cargan completamente sin timeout
   - Skeleton loaders desaparecen

#### Paso 5.4: Error de conexión backend

En DevTools console:

```javascript
// Desactiva la API simuladamente
localStorage.setItem("api_error_test", "true");
```

Reload la página:

```
F5
```

**Resultado esperado:**

- Mensaje de error visible
- Dashboard no muestra datos parciales
- Opción para reintentar (si está implementada)

**✅ Validación de Fase 5:**

- [ ] Health check refleja estado real del AI service
- [ ] Usuarios sin permisos no pueden ver dashboard
- [ ] Skeleton loaders muestran durante carga
- [ ] Error handling graceful
- [ ] Sin crashes en edge cases

---

## 📊 Checklist Final

### Backend ✅

- [ ] Endpoint `GET /api/dashboard` implementado
- [ ] Autorización solo admin/coordinador
- [ ] Datos correctos en respuesta
- [ ] Cálculos de riesgo correctos
- [ ] Conexión a AI service funciona
- [ ] Manejo de errores

### Frontend ✅

- [ ] Componente `KpiCard.jsx` creado
- [ ] Dashboard.jsx actualizado
- [ ] Layout responsivo
- [ ] Datos coinciden con backend
- [ ] Loading estados corretos
- [ ] Error handling

### Integración ✅

- [ ] Build sin errores (127 módulos)
- [ ] Rutas registradas en app.js
- [ ] API calls correctos
- [ ] Autorización funciona
- [ ] Sin console errors

### UX/Validación ✅

- [ ] Todos los valores correctos
- [ ] Edge cases manejados
- [ ] Performance aceptable
- [ ] Comportamiento esperado

---

## 🧪 Comandos útiles para testing

### Test del endpoint con curl

```powershell
$token = "tu_token_aqui"
curl -H "Authorization: Bearer $token" http://localhost:3000/api/dashboard
```

### Verificar logs del backend

```powershell
cd "c:\Users\julia\OneDrive\Documentos\Facultad\Proyecto final\proyecto-final\backend"
npm start
# Buscar línea con "GET /api/dashboard" en los logs
```

### Verificar logs del frontend

```
F12 → Console → Buscar "Error cargando dashboard"
```

---

## ✅ Resumen de Entregas

| Componente         | Archivo                                       | Estado                 |
| ------------------ | --------------------------------------------- | ---------------------- |
| Backend Endpoint   | backend/src/routes/dashboard.routes.js        | ✅ Implementado        |
| Frontend Component | frontend/src/components/dashboard/KpiCard.jsx | ✅ Creado              |
| Frontend Page      | frontend/src/pages/Dashboard.jsx              | ✅ Actualizado         |
| Routes Config      | backend/src/app.js                            | ✅ Registrado          |
| Build              | frontend/src                                  | ✅ compilación exitosa |
| Autorización       | Middleware                                    | ✅ Implementado        |

---

## 📝 Notas Importantes

1. **Base de datos:** El endpoint usa las tablas existentes en SQLite
2. **Predicciones:** Los datos de riesgo vienen de predicciones previas almacenadas
3. **Actualización:** Los datos se actualizan en tiempo real desde BD
4. **Caché:** Si agregues caché futuro, recuerda invalidarlo cuando haya nuevas predicciones
5. **Logs:** Revisa los logs del backend para debug en caso de errores 500

---

## 🚀 Si todo valida correctamente

¡CDU012 está 100% implementado y listo para producción!

Puedes proceder a:

1. Desplegar en servidor de producción
2. Documentar en Confluence/WikiTeam
3. Comunicar a stakeholders que Dashboard Ejecutivo está disponible
4. Capacitar usuarios admin y coordinadores
