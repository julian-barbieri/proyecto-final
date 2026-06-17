# Seed Masivo — 500 Alumnos Activos

**Fecha:** 2026-06-17  
**Estado:** Aprobado

## Objetivo

Generar un seed reproducible de 500 alumnos activos (sin abandono) con cursadas y exámenes históricos coherentes con las reglas del generador de datasets de entrenamiento. Los alumnos deben estar distribuidos por año de carrera y con una distribución de desempeño 75% excelente / 20% regular / 5% malo.

---

## Arquitectura

```
ai-service/data/
  seed-data-generator.py     ← script nuevo, se corre 1 sola vez

backend/src/db/
  seed-masivo-data.json      ← artefacto generado, se commitea al repo
  seed.js                    ← agrega seedMasivo500AlumnosCDU()
```

**Flujo de uso:**
1. Correr `python ai-service/data/seed-data-generator.py` → produce `backend/src/db/seed-masivo-data.json`
2. Commitear el JSON al repo
3. El seed normal (`node backend/src/db/seed.js`) llama a `seedMasivo500AlumnosCDU()` que lee el JSON e inserta en SQLite
4. En ejecuciones futuras el JSON ya está presente — no se necesita Python

---

## Reglas de generación

### Distribución por año de carrera (año actual = 2026)

| Año carrera | Cantidad | `anio_ingreso` |
|-------------|----------|----------------|
| 1º año      | 150      | 2026           |
| 2º año      | 130      | 2025           |
| 3º año      | 125      | 2024           |
| 4º año      | 120      | 2023           |
| 5º año      | 120      | 2022           |

### Distribución de desempeño

- 75% tipo `excelente` → notas μ=8.0 σ=1.5, asistencia μ=0.93 σ=0.05, pocas recursadas
- 20% tipo `regular` → notas μ=5.5 σ=1.8, asistencia μ=0.85 σ=0.08, algunas recursadas
- 5% tipo `malo` → notas μ=3.5 σ=1.5, asistencia μ=0.65 σ=0.10, muchas recursadas

Los parámetros estadísticos son idénticos a los de `generar_datasets.py` (MU_NOTA, SIGMA_NOTA, MU_ASIST, SIGMA_ASIST).

### Abandono

Desactivado: se usa el mismo modelo de hazard del generador original pero si el alumno "abandonaría", se descarta y se genera otro hasta completar la cuota de ese año de carrera.

### Historia académica

Se corre `simular_trayectoria()` con `snapshot_anio = anio_ingreso + anio_carrera - 1` para capturar la trayectoria completa hasta el final del año actual. Esto es idéntico a la Fase 2 del generador original. Solo se persisten los datos hasta el snapshot.

### Carga de materias

Carga parcial determinada por `carga_base = {'excelente': 5, 'regular': 4, 'malo': 3}` con variación ±1, igual al generador. Las materias cursadas respetan correlativas.

### Identificadores

- Username: `seed_XXXX` (ej: `seed_0001`)
- Email: `seed_XXXX@usal.edu.ar`
- Nombre: `Alumno Seed XXXX`
- google_id: `seed_google_XXXX` (para satisfacer constraint UNIQUE de la tabla)

---

## Estructura del JSON generado

```json
{
  "alumnos": [
    {
      "username": "seed_0001",
      "nombre_completo": "Alumno Seed 0001",
      "email": "seed_0001@usal.edu.ar",
      "google_id": "seed_google_0001",
      "genero": "Masculino",
      "fecha_nac": "15-03-2007",
      "ayuda_financiera": 0,
      "colegio_tecnico": 1,
      "promedio_colegio": 8.2,
      "anio_ingreso": 2026,
      "anio_carrera": 1,
      "tipo": "excelente",
      "cursadas": [
        {
          "materia_codigo_plan": 142,
          "anio": 2026,
          "asistencia": 0.94,
          "estado": "cursando"
        }
      ],
      "examenes": [
        {
          "materia_codigo_plan": 142,
          "anio": 2026,
          "tipo": "Parcial",
          "instancia": 1,
          "rendido": 1,
          "nota": 8.1,
          "ausente": 0,
          "veces_recursada": 0,
          "asistencia": 0.94,
          "fecha_examen": "15-06-2026"
        }
      ]
    }
  ]
}
```

El campo `materia_codigo_plan` corresponde al código numérico de la malla (ej: 142 = Análisis Matemático I), que se usa para hacer el JOIN con la tabla `materias` por `codigo_plan`.

---

## Función `seedMasivo500AlumnosCDU()` en `seed.js`

### Comportamiento

1. Leer `seed-masivo-data.json` (path relativo al `seed.js`)
2. Verificar si ya existen alumnos `seed_*` en `users` → si existen, return temprano (idempotente, no toca nada)
3. Eliminar alumnos demo existentes: lista hardcodeada de usernames actuales (lucas.martinez, valentina.gomez, etc.) — **no** toca usuarios base como `alumno1`, `docente`, `admin`, `coordinador`
4. Por cada alumno del JSON dentro de una transacción:
   - `INSERT INTO users` con todos los campos demográficos
   - `INSERT INTO cursadas` (materia buscada por `codigo_plan`)
   - `INSERT INTO examenes`
   - `INSERT OR IGNORE INTO inscripciones` para las materias del año actual (estado `'activa'`)
5. Log: `✅ Seed masivo: 500 alumnos insertados.`

### Atomicidad

Todo el bloque de inserción corre dentro de `db.transaction()`. Si falla cualquier INSERT, se hace rollback completo.

### Idempotencia

Al inicio de la función se verifica si ya existen filas con username que empiece por `seed_` en `users`. Si existen, la función retorna sin hacer nada. Para re-generar desde cero hay que eliminar manualmente los `seed_*` o usar un flag de fuerza.

---

## Tablas modificadas

| Tabla | Operación |
|-------|-----------|
| `users` | DELETE demo existentes + INSERT 500 nuevos |
| `cursadas` | INSERT histórico por alumno |
| `examenes` | INSERT histórico por alumno |
| `inscripciones` | INSERT OR IGNORE año actual |

---

## Restricciones y consideraciones

- El `seed-data-generator.py` usa `SEED = 42` para reproducibilidad
- Los alumnos `seed_*` no tienen `password` (igual que los demo actuales que usan OAuth)
- Las materias se buscan en la tabla `materias` por `codigo_plan` — requiere que `seedRestoCurriculumPlan()` se haya ejecutado antes
- `seedMasivo500AlumnosCDU()` debe llamarse al final del `seed.js`, después de que la malla curricular esté insertada
- El estado de las cursadas del año actual es `"cursando"`; las de años anteriores son `"aprobada"` o `"recursada"` según el resultado de la simulación
