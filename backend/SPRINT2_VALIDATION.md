# Checklist de Validación - Sprint 2

Esta guía te ayudará a validar que todas las funcionalidades del Sprint 2 estén funcionando correctamente.

## 1. Setup Inicial

### 1.1 Verificar Dependencias
```bash
cd backend
npm install
```
✅ Verificar que no hay errores de instalación

### 1.2 Verificar Variables de Entorno
Crear/verificar `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@db:5432/edupredict"
PORT=3001
JWT_SECRET=your-secret-key-change-in-production
ALLOWED_EMAIL_DOMAIN="usal.edu.ar"
DATASET_CSV="./data/dataset_alumnos.csv"
CSV_DELIMITER=","
```

## 2. Validación de Base de Datos

### 2.1 Crear Migración
```bash
cd backend
npx prisma migrate dev --name sprint2_schema
```
✅ Verificar:
- La migración se crea sin errores
- Aparece en `backend/prisma/migrations/`
- La base de datos se actualiza correctamente

### 2.2 Verificar Schema
```bash
npx prisma studio
```
✅ Abrir http://localhost:5555 y verificar:
- [ ] Modelo `User` tiene campos: gender, birthDate, isTechnicalHS
- [ ] Modelo `Subject` existe con campos: name, year, kind, modality, hasTutor
- [ ] Modelo `Enrollment` existe con relación a User y Subject
- [ ] Modelo `Assessment` existe con enum AssessmentType
- [ ] Modelos `TutorAssignment` y `ProfessorAssignment` existen

### 2.3 Ejecutar Seed
```bash
npm run prisma:seed
```
✅ Verificar:
- [ ] Se crean usuarios con roles DIRECTOR, TUTOR, PROFESOR, ALUMNO
- [ ] Se crean subjects AM1 y SN
- [ ] Se asignan tutores a AM1
- [ ] Se asignan profesores a AM1 y SN
- [ ] No hay errores en la consola

## 3. Validación del ETL/Importador CSV

### 3.1 Preparar CSV de Prueba (Opcional)
Si quieres probar con un CSV pequeño:
```csv
alumno_email,alumno_nombre,genero,fecha_nacimiento,colegio_tecnico,materia,anio_lectivo,profesor,tutor,asistencia_pct,recursadas,parcial1,parcial2,abandono
test1@usal.edu.ar,Juan Pérez,M,15/05/2005,Si,AM1,2024,Pedro,Si,85.5,0,8,7,No
test2@usal.edu.ar,María García,F,20/03/2005,No,AM1,2024,Agustina,Si,92.0,0,9,8,No
```

### 3.2 Ejecutar Importación
```bash
npm run import:csv
```
✅ Verificar:
- [ ] El proceso no se detiene con errores fatales
- [ ] Se genera `import_report.json` en la raíz del backend
- [ ] El reporte muestra métricas: rows_read, rows_ok, rows_error
- [ ] Se crean usuarios en la base de datos
- [ ] Se crean subjects en la base de datos
- [ ] Se crean enrollments
- [ ] Se crean assessments (notas)

### 3.3 Revisar Reporte de Importación
```bash
cat import_report.json
```
✅ Verificar estructura del reporte:
- [ ] `rows_read`: número de filas procesadas
- [ ] `rows_ok`: filas sin errores
- [ ] `rows_error`: filas con errores (si hay)
- [ ] `users_upserted`: usuarios creados/actualizados
- [ ] `subjects_upserted`: materias creadas/actualizadas
- [ ] `enrollments_upserted`: inscripciones creadas
- [ ] `assessments_created`: evaluaciones creadas
- [ ] `error_samples`: muestra de errores (máximo 20)
- [ ] `warnings`: advertencias durante el proceso

### 3.4 Validar Idempotencia
Ejecutar el importador **2 veces seguidas**:
```bash
npm run import:csv
npm run import:csv
```
✅ Verificar:
- [ ] No se duplican registros
- [ ] El reporte muestra valores actualizados (upsert)
- [ ] No hay errores de "unique constraint violation"

### 3.5 Probar con Ruta Personalizada
```bash
npm run import:csv -- --file ./data/dataset_alumnos.csv
```
✅ Verificar que acepta el parámetro `--file`

## 4. Validación de Endpoints API

### 4.1 Iniciar Servidor
```bash
npm run dev
```
✅ Verificar que el servidor inicia sin errores en puerto 3001

### 4.2 Obtener Token de Autenticación
Hacer login con Google OAuth y obtener token JWT.

### SUBJECTS (Materias)

#### GET /api/subjects
```bash
curl -X GET "http://localhost:3001/api/subjects?page=1&pageSize=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
✅ Verificar:
- [ ] Respuesta 200 OK
- [ ] Estructura paginada: `{data, page, pageSize, total}`
- [ ] Incluye subjects AM1 y SN del seed

#### GET /api/subjects con filtro
```bash
curl -X GET "http://localhost:3001/api/subjects?name=AM1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
✅ Verificar que solo devuelve subjects con "AM1" en el nombre

#### GET /api/subjects/:id
```bash
# Obtener ID de un subject primero
curl -X GET "http://localhost:3001/api/subjects/YOUR_SUBJECT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
✅ Verificar estructura completa del subject

#### POST /api/subjects (requiere DIRECTOR/TUTOR)
```bash
curl -X POST "http://localhost:3001/api/subjects" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Subject",
    "year": 2,
    "kind": "avanzada",
    "modality": "presencial",
    "hasTutor": false
  }'
```
✅ Verificar:
- [ ] Respuesta 201 Created
- [ ] Se crea el subject en la base de datos
- [ ] Validación rechaza datos inválidos (name vacío, etc.)

#### PUT /api/subjects/:id
```bash
curl -X PUT "http://localhost:3001/api/subjects/YOUR_SUBJECT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hasTutor": true
  }'
```
✅ Verificar que actualiza correctamente

#### DELETE /api/subjects/:id (solo DIRECTOR)
✅ Verificar:
- [ ] DIRECTOR puede eliminar
- [ ] TUTOR no puede eliminar (403)
- [ ] ALUMNO no puede eliminar (403)

### ENROLLMENTS (Inscripciones)

#### GET /api/enrollments
```bash
curl -X GET "http://localhost:3001/api/enrollments?page=1&pageSize=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
✅ Verificar estructura paginada

#### GET /api/enrollments con filtros
```bash
# Por año académico
curl -X GET "http://localhost:3001/api/enrollments?academicYear=2024" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Por asistencia mínima
curl -X GET "http://localhost:3001/api/enrollments?minAttendance=70" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Por riesgo de abandono
curl -X GET "http://localhost:3001/api/enrollments?risk=dropout" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
✅ Verificar que cada filtro funciona correctamente

#### GET /api/enrollments/:id
✅ Verificar que incluye:
- [ ] Datos del estudiante
- [ ] Datos del subject
- [ ] Lista de grades (assessments)

#### POST /api/enrollments
```bash
curl -X POST "http://localhost:3001/api/enrollments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "STUDENT_ID",
    "subjectId": "SUBJECT_ID",
    "academicYear": 2024,
    "attendancePct": 85.5,
    "recursadas": 0
  }'
```
✅ Verificar creación exitosa

#### PUT /api/enrollments/:id
✅ Verificar actualización de attendancePct, recursadas, dropoutFlag

### ASSESSMENTS (Evaluaciones)

#### GET /api/assessments
```bash
curl -X GET "http://localhost:3001/api/assessments?enrollmentId=ENROLLMENT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
✅ Verificar listado paginado

#### POST /api/assessments
```bash
curl -X POST "http://localhost:3001/api/assessments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enrollmentId": "ENROLLMENT_ID",
    "kind": "PARCIAL1",
    "grade": 8
  }'
```
✅ Verificar:
- [ ] Crea assessment correctamente
- [ ] Rechaza grade fuera de rango (0, 11, -1) con 400
- [ ] Acepta grade null
- [ ] Rechaza kind inválido

#### PUT /api/assessments/:id
✅ Verificar actualización de grade

## 5. Validación de Reglas de Negocio

### 5.1 Validación de Notas
✅ Probar POST /api/assessments con:
- [ ] grade = 0 → debe rechazar (400)
- [ ] grade = 11 → debe rechazar (400)
- [ ] grade = 1 → debe aceptar (201)
- [ ] grade = 10 → debe aceptar (201)
- [ ] grade = null → debe aceptar (201)

### 5.2 Validación de Asistencia
✅ Verificar que attendancePct:
- [ ] Se limita a rango 0-100
- [ ] Acepta valores decimales
- [ ] Acepta null

### 5.3 Validación de Rol ALUMNO
✅ Probar como ALUMNO:
- [ ] Solo ve sus propios enrollments
- [ ] Solo ve sus propios assessments
- [ ] No puede crear/modificar enrollments
- [ ] No puede crear/modificar assessments

### 5.4 Filtros de Enrollments
✅ Verificar:
- [ ] `academicYear`: filtra por año exacto
- [ ] `minAttendance`: filtra >= valor
- [ ] `maxAttendance`: filtra <= valor
- [ ] `risk=dropout`: solo enrollments con dropoutFlag=true
- [ ] `subjectId`: filtra por materia

## 6. Validación de Tests Automatizados

### 6.1 Ejecutar Tests
```bash
cd backend
npm test
```
✅ Verificar:
- [ ] Todos los tests pasan (verde)
- [ ] Tests de ETL funcionan
- [ ] Tests de API funcionan
- [ ] Cobertura razonable

### 6.2 Tests Específicos
```bash
# Solo tests de ETL
npm test -- csvMapping
npm test -- rowSchema

# Solo tests de API
npm test -- subjects
npm test -- enrollments
npm test -- assessments
```

## 7. Validación de Integridad de Datos

### 7.1 Relaciones
✅ Verificar en Prisma Studio:
- [ ] Enrollment tiene relación con User (student)
- [ ] Enrollment tiene relación con Subject
- [ ] Assessment tiene relación con Enrollment
- [ ] TutorAssignment tiene relación con User y Subject
- [ ] ProfessorAssignment tiene relación con User y Subject

### 7.2 Constraints Únicos
✅ Verificar:
- [ ] No se pueden crear enrollments duplicados (mismo studentId + subjectId + academicYear)
- [ ] No se pueden crear assessments duplicados (mismo enrollmentId + kind)
- [ ] No se pueden crear subjects con nombre duplicado

### 7.3 Índices
✅ Verificar en Prisma Studio o base de datos:
- [ ] Índice en Enrollment(studentId, subjectId, academicYear)
- [ ] Índice en Assessment(enrollmentId, kind)

## 8. Validación de Casos Edge

### 8.1 CSV con Datos Faltantes
✅ Probar CSV con:
- [ ] Filas sin email → debe generar email sintético
- [ ] Filas sin nombre → debe generar nombre sintético
- [ ] Notas fuera de rango → debe ignorar o redondear
- [ ] Asistencia > 100 → debe limitar a 100
- [ ] Fechas en formato incorrecto → debe manejar gracefully

### 8.2 Paginación
✅ Probar:
- [ ] page=0 → debe usar page=1
- [ ] pageSize=0 → debe usar pageSize=20
- [ ] pageSize=1000 → debe limitar a 100
- [ ] Última página con datos parciales

### 8.3 Autenticación
✅ Probar:
- [ ] Request sin token → 401
- [ ] Token inválido → 401
- [ ] Token expirado → 401
- [ ] Request con rol incorrecto → 403

## 9. Validación de Performance

### 9.1 Importación de CSV Grande
✅ Si tienes CSV grande:
- [ ] No se detiene por timeout
- [ ] Procesa todas las filas
- [ ] Reporte muestra progreso cada 50 filas (logs)

### 9.2 Consultas Paginadas
✅ Verificar:
- [ ] GET /api/subjects con muchos registros se ejecuta rápido
- [ ] GET /api/enrollments con filtros complejos es eficiente

## 10. Checklist Final

- [ ] Migración aplicada correctamente
- [ ] Seed ejecutado sin errores
- [ ] ETL importa CSV correctamente
- [ ] Reporte JSON generado con métricas
- [ ] Todos los endpoints CRUD funcionan
- [ ] Paginación funciona en todos los endpoints
- [ ] Filtros funcionan correctamente
- [ ] Validaciones rechazan datos inválidos
- [ ] RBAC funciona (roles correctos)
- [ ] Tests pasan
- [ ] Sin errores de linter
- [ ] Documentación actualizada

## Herramientas Útiles

### Prisma Studio
```bash
npx prisma studio
```
Abre interfaz visual para explorar datos.

### Ver Logs del Servidor
Los logs estructurados aparecen en consola con winston.

### Insomnia/Postman
Importa estos endpoints para pruebas más cómodas.

### Ver Reporte de Importación
```bash
cat backend/import_report.json | jq
```
(Requiere `jq` instalado para formato bonito)


