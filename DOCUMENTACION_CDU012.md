# Documentación Técnica - CDU012: Dashboard Ejecutivo

## 📋 Descripción del Caso de Uso

**CDU012 - Dashboard Ejecutivo:** Proporciona una vista consolidada del estado del sistema académico con métricas clave, análisis de riesgo de alumnos y salud del sistema.

---

## 🏗️ Arquitectura Implementada

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│ Dashboard.jsx (Page)                                          │
│ ├─ Fetches: GET /api/dashboard                              │
│ ├─ Displays: 4 KPI Cards                                    │
│ ├─ Shows: Health Status                                     │
│ └─ Layout: Responsive Grid                                  │
│                                                              │
│ KpiCard.jsx (Component)                                      │
│ ├─ Props: titulo, valor, subtitulo, color, icono           │
│ ├─ Colors: blue, red, orange, green                         │
│ └─ Responsive: Mobile/Tablet/Desktop                        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP GET + JWT Token
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Express.js)                        │
├─────────────────────────────────────────────────────────────┤
│ app.js:                                                      │
│ ├─ Route: GET /api/dashboard                                │
│ ├─ Middleware: authenticate, authorize("admin","coordinador")│
│ └─ Handler: dashboardRoutes.getExecutiveDashboard()         │
│                                                              │
│ dashboard.routes.js:                                         │
│ ├─ Query all materias with alumno counts by category        │
│ ├─ Calculate risk aggregations                              │
│ ├─ Check AI service health                                  │
│ └─ Return: { materias[], resumen{}, salud_sistema{} }      │
└────────────────────┬────────────────────────────────────────┘
                     │ SQL Queries
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  SQLite Database                              │
├─────────────────────────────────────────────────────────────┤
│ Tables:                                                       │
│ ├─ materias (id, codigo, nombre, ...)                       │
│ ├─ alumno_materia (alumno_id, materia_id, prediccion_id)    │
│ ├─ prediccion (id, alumno_id, prediccion, probabilidad)    │
│ └─ usuarios (id, username, role, ...)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Detalle de Implementación

### 1. Backend Endpoint

**Archivo:** `backend/src/routes/dashboard.routes.js`

**Endpoint:**

```
GET /api/dashboard
Authorization: Bearer {valid_jwt_token}
Roles permitidos: admin, coordinador
```

**Lógica Implementada:**

```javascript
router.get("/", async (req, res) => {
  try {
    // 1. Obtener todas las materias
    const materias = db
      .prepare(
        `
      SELECT 
        m.id,
        m.codigo,
        m.nombre,
        COUNT(DISTINCT am.alumno_id) as alumnos_total,
        SUM(CASE WHEN p.prediccion = 'rojo' THEN 1 ELSE 0 END) as en_riesgo_alto,
        SUM(CASE WHEN p.prediccion = 'amarillo' THEN 1 ELSE 0 END) as en_riesgo_medio,
        SUM(CASE WHEN p.prediccion = 'verde' THEN 1 ELSE 0 END) as bajo_riesgo
      FROM materias m
      LEFT JOIN alumno_materia am ON m.id = am.materia_id
      LEFT JOIN prediccion p ON am.prediccion_id = p.id
      GROUP BY m.id
      ORDER BY m.nombre
    `,
      )
      .all();

    // 2. Calcular resumen agregado
    const resumen = {
      total_alumnos: materias.reduce((sum, m) => sum + m.alumnos_total, 0),
      en_riesgo_alto: materias.reduce((sum, m) => sum + m.en_riesgo_alto, 0),
      en_riesgo_medio: materias.reduce((sum, m) => sum + m.en_riesgo_medio, 0),
      bajo_riesgo: materias.reduce((sum, m) => sum + m.bajo_riesgo, 0),
    };

    // 3. Verificar salud del AI service
    const salud_sistema = await checkAIServiceHealth();

    res.json({
      materias,
      resumen,
      salud_sistema,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Respuesta Exitosa (Status 200):**

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

**Errores Posibles:**

| Status | Condición        | Response                                  |
| ------ | ---------------- | ----------------------------------------- |
| 401    | Sin token válido | `{ error: "No autorizado" }`              |
| 403    | Rol insuficiente | `{ error: "Acceso denegado" }`            |
| 500    | Error en BD      | `{ error: "Error al obtener dashboard" }` |

---

### 2. Frontend Components

#### 2.1 KpiCard.jsx

**Ubicación:** `frontend/src/components/dashboard/KpiCard.jsx`

**Props:**

```javascript
interface KpiCardProps {
  titulo: string;           // "Total Predicciones"
  valor: string | number;   // "150"
  subtitulo?: string;       // "alumnos totales"
  color: 'blue' | 'red' | 'orange' | 'green';
  icono?: React.ReactNode;  // <IconComponent />
}
```

**Colores Disponibles:**

```javascript
const colorMap = {
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "text-blue-600",
    value: "text-blue-700",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "text-red-600",
    value: "text-red-700",
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: "text-orange-600",
    value: "text-orange-700",
  },
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    icon: "text-green-600",
    value: "text-green-700",
  },
};
```

**Layout Responsivo:**

- **Desktop (≥1024px):** 4 KPIs en 1 fila
- **Tablet (768px-1023px):** 2 KPIs por fila
- **Móvil (<768px):** 1 KPI por fila

#### 2.2 Dashboard.jsx

**Ubicación:** `frontend/src/pages/Dashboard.jsx`

**Estructura:**

```jsx
export default function Dashboard() {
  const { user } = useAuth(); // Obtiene usuario del contexto
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Autorización
  if (!user || !["admin", "coordinador"].includes(user.role)) {
    return <AccessDeniedMessage />;
  }

  // 2. Carga de datos
  useEffect(() => {
    const cargarDashboard = async () => {
      try {
        const response = await api.get("/api/dashboard");
        setData(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    cargarDashboard();
  }, []);

  // 3. Estados UI
  if (loading) return <SkeletonLoader />;
  if (error) return <ErrorMessage error={error} />;

  // 4. Render datos
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        titulo="Total Predicciones"
        valor={data.resumen.total_alumnos}
        color="blue"
      />
      <KpiCard
        titulo="Alumnos en Riesgo Alto"
        valor={data.resumen.en_riesgo_alto}
        color="red"
      />
      <KpiCard titulo="Tasa de Recursado" valor={`${tasa}%`} color="orange" />
      <KpiCard
        titulo="Nota Promedio"
        valor={notaPromedio.toFixed(2)}
        color="green"
      />
    </div>
  );
}
```

**Flujo de Datos:**

```
1. Componente monta
   ↓
2. useAuth() obtiene usuario
   ↓
3. ¿Tiene permisos?
   ├─ No → Mostrar "No autorizado"
   └─ Sí → Continuar
   ↓
4. useEffect ejecuta → Fetch /api/dashboard
   ├─ Loading → Mostrar SkeletonLoader
   ├─ Error → Mostrar ErrorMessage
   └─ Éxito → Mostrar datos
   ↓
5. Renderizar 4 KPI cards con datos
```

---

### 3. Integración de Rutas

**Archivo:** `backend/src/app.js`

**Registro de ruta:**

```javascript
// Línea 21
const dashboardRoutes = require("./routes/dashboard.routes");

// Línea 85
app.use(
  "/api/dashboard",
  authenticate,
  authorize("admin", "coordinador"),
  dashboardRoutes,
);
```

**Middlewares aplicados:**

1. **authenticate:** Verifica que existe token JWT válido
   - Sin token → 401 Unauthorized
   - Token inválido → 401 Unauthorized
   - Token expirado → 401 Unauthorized

2. **authorize("admin", "coordinador"):** Verifica rol
   - Rol no permitido → 403 Forbidden
   - Rol permitido → Continúa

---

## 🔍 Flujo de Datos Detallado

### Request Flow

```
Cliente (Browser)
    │
    ├─ 1. Usuario hace login
    │   └─ POST /api/auth/login → Recibe JWT token
    │
    ├─ 2. Dashboard.jsx monta
    │   └─ useAuth() → Obtiene user del token
    │
    ├─ 3. Verifica autorización
    │   └─ user.role = "admin" ✅
    │
    ├─ 4. Llama API dashboard
    │   └─ GET /api/dashboard
    │       Header: Authorization: Bearer {token}
    │
    └─ 5. Backend procesa
        └─ authenticate middleware
            ├─ Decodifica JWT
            ├─ Valida expiración
            └─ Obtiene user del token
                │
                └─ authorize middleware
                    ├─ Verifica role in ["admin", "coordinador"]
                    └─ Continúa a endpoint
                        │
                        └─ dashboard.routes.js
                            ├─ Query materias + counts
                            ├─ Calculate resumen
                            ├─ Check AI health
                            └─ Return JSON (Status 200)
                                │
                                └─ setTimeout 300ms
                                    │
                                    └─ Browser recibe datos
                                        └─ React actualiza state
                                            └─ KpiCard re-renderiza
                                                └─ Usuario ve dashboard
```

---

## 💾 Consultas de Base de Datos

### Query Principal - Materias con Conteos

```sql
SELECT
  m.id,
  m.codigo,
  m.nombre,
  COUNT(DISTINCT am.alumno_id) as alumnos_total,
  SUM(CASE WHEN p.prediccion = 'rojo' THEN 1 ELSE 0 END) as en_riesgo_alto,
  SUM(CASE WHEN p.prediccion = 'amarillo' THEN 1 ELSE 0 END) as en_riesgo_medio,
  SUM(CASE WHEN p.prediccion = 'verde' THEN 1 ELSE 0 END) as bajo_riesgo
FROM materias m
LEFT JOIN alumno_materia am ON m.id = am.materia_id
LEFT JOIN prediccion p ON am.prediccion_id = p.id
GROUP BY m.id
ORDER BY m.nombre;
```

**Explicación:**

- **LEFT JOIN alumno_materia:** Obtiene todos los alumnos de cada materia
- **LEFT JOIN prediccion:** Obtiene la predicción de riesgo de cada alumno
- **GROUP BY m.id:** Agrupa por materia
- **COUNT DISTINCT:** Evita duplicados si hay múltiples predicciones
- **SUM CASE:** Cuenta predicciones por categoría (rojo/amarillo/verde)

### Ejemplo de Transformación de Datos

```
Raw Data (BD):
┌────────┬─────┬─────────────┬───────────┐
│ materia│alumno│prediccion   │ contador  │
├────────┼─────┼─────────────┼───────────┤
│ ALG101 │ 1   │ rojo        │ 1         │
│ ALG101 │ 2   │ rojo        │ 1         │
│ ALG101 │ 3   │ amarillo    │ 1         │
│ ALG101 │ 4   │ verde       │ 1         │
│ ...    │ ... │ ...         │ ...       │
└────────┴─────┴─────────────┴───────────┘

Transformado:
{
  "id": 1,
  "codigo": "ALG101",
  "nombre": "Álgebra",
  "alumnos_total": 45,
  "en_riesgo_alto": 8,      (COUNT WHERE prediccion='rojo')
  "en_riesgo_medio": 12,    (COUNT WHERE prediccion='amarillo')
  "bajo_riesgo": 25         (COUNT WHERE prediccion='verde')
}
```

---

## 🔒 Seguridad y Autorización

### Niveles de Protección

```
1. NIVEL 1: Middleware de Autenticación
   ├─ Verifica presencia de token JWT
   ├─ Valida firma del token
   ├─ Verifica expiración
   └─ Extrae datos del usuario

2. NIVEL 2: Middleware de Autorización
   ├─ Verifica rol del usuario
   ├─ Permite: admin, coordinador
   └─ Deniega: alumno, profesor, otros

3. NIVEL 3: Frontend Guard
   ├─ Dashboard.jsx valida user.role
   ├─ No rendered si es alumno
   └─ Muestra mensaje de error

4. NIVEL 4: Base de Datos
   ├─ Solo consultas permitidas en endpoint
   ├─ No exposición de datos sensibles
   └─ No inyección SQL (parametrized queries)
```

### Matriz de Acceso

```
┌──────────────┬─────────────────────────┐
│ Rol          │ Acceso a Dashboard      │
├──────────────┼─────────────────────────┤
│ admin        │ ✅ SÍ                    │
│ coordinador  │ ✅ SÍ                    │
│ profesor     │ ❌ NO                    │
│ alumno       │ ❌ NO                    │
│ Sin auth     │ ❌ NO (401)              │
└──────────────┴─────────────────────────┘
```

---

## 🧪 Testing - Casos de Prueba

### TC001: Acceso Autorizado (Happy Path)

```
Given: Usuario admin autenticado
When: Navega a /dashboard
Then: Ve 4 KPI cards con datos reales
And: Status 200 en /api/dashboard
```

### TC002: Acceso no Autorizado

```
Given: Usuario alumno autenticado
When: Navega a /dashboard
Then: Ve mensaje "No autorizado"
And: Status 403 en /api/dashboard
```

### TC003: Sin Autenticación

```
Given: Usuario no autenticado
When: Hace GET /api/dashboard sin token
Then: Status 401
And: Response: { error: "No autorizado" }
```

### TC004: Datos Consistentes

```
Given: Dashboard cargado
When: Verifico suma de riesgo_alto+riesgo_medio+bajo_riesgo
Then: Suma = total_alumnos
```

### TC005: AI Service Down

```
Given: Servicio de IA no disponible
When: Dashboard se carga
Then: Health check muestra rojo
And: Dashboard sigue mostrando datos de BD
```

---

## 📊 Métricas y Performance

### Tamaño de Respuesta

```
{
  "materias": [...],      // ~2-5KB dependiendo de cantidad
  "resumen": {...},       // ~200 bytes
  "salud_sistema": {...}  // ~100 bytes
}
Total: ~3-5KB (sin compresión)
```

### Tiempo de Respuesta Esperado

| Operación          | Tiempo        | Notas                     |
| ------------------ | ------------- | ------------------------- |
| Query de materias  | 50-100ms      | Depende de índices en BD  |
| Query de resumen   | 0ms           | Cálculos en JavaScript    |
| Health check       | 100-200ms     | Request HTTP a AI service |
| **Total Backend**  | **150-300ms** | Incluye overhead Express  |
| Fetch + Render     | 100-200ms     | Overhead navegador        |
| **Total Frontend** | **250-500ms** | Con skeleton loader       |

### Optimizaciones Implementadas

1. **Base de Datos:**
   - Query único con JOINs (no N+1)
   - GROUP BY en BD (no en JavaScript)
   - LEFT JOIN para manejar alumnos sin predicción

2. **Frontend:**
   - Skeleton loader mientras carga (mejor UX)
   - Cálculos en JavaScript (no queries adicionales)
   - Responsive grid con CSS Grid (sin JS)

3. **Red:**
   - JWT en header (no cookie)
   - CORS configurado
   - Compresión gzip en respuestas

---

## 🐛 Manejo de Errores

### Escenarios de Error Implementados

```
1. Token Expirado
   └─ Response 401 + Redirect a login

2. Permiso Insuficiente
   └─ Response 403 + UI message

3. Base de Datos Unavailable
   └─ Response 500 + Error message

4. AI Service Down
   └─ Health check marca como unavailable
   └─ Dashboard sigue funcionando

5. Conexión Lenta
   └─ Skeleton loader durante carga
   └─ Timeout después de 30 segundos
```

---

## 🚀 Despliegue a Producción

### Checklist Previo

- [ ] Tests unitarios pasan (backend)
- [ ] Tests de integración pasan
- [ ] Coverage >80% en código crítico
- [ ] Validación de todas las 5 fases completada
- [ ] Performance benchmarks OK
- [ ] Security audit completado
- [ ] Documentation actualizada
- [ ] Backup de BD realizado

### Variables de Entorno Necesarias

```env
# Backend
NODE_ENV=production
DATABASE_URL=sqlite:./data/database.db
JWT_SECRET=your_secret_key_here
AI_SERVICE_URL=http://ai-service:8000
PORT=3000

# Frontend (build-time)
VITE_API_BASE_URL=http://backend.domain.com:3000
VITE_APP_NAME="Sistema de Predicciones"
```

### Comandos de Deploy

```bash
# Backend
cd backend
npm install
npm run build
npm start

# Frontend
cd frontend
npm install
npm run build
# Servir dist/ con server web estático
```

---

## 📚 Referencias

- **Backend Routes:** `backend/src/routes/dashboard.routes.js`
- **Frontend Component:** `frontend/src/components/dashboard/KpiCard.jsx`
- **Frontend Page:** `frontend/src/pages/Dashboard.jsx`
- **Main Server:** `backend/src/app.js`
- **Auth Middleware:** `backend/src/middleware/auth.middleware.js`
- **Database Schema:** `backend/src/db/database.js`
