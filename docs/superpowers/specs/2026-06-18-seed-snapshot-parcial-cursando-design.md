# Seed snapshot parcial: alumnos cursando en Q1 2026 — Design

**Fecha:** 2026-06-18

**Objetivo:** Corregir tres problemas relacionados:
1. El frontend no muestra alumnos en la tab "Cursando" porque el seed genera Finals en 2026, haciendo que casi todos aparezcan como "Aprobados".
2. La tab "Aprobados en 2026" muestra el historial completo de alumnos que aprobaron en años anteriores, no solo los del año actual.
3. Las cohortes son demasiado grandes (645 alumnos), dando 110–172 alumnos por materia en año 1, cuando el objetivo es 30–40.

---

## Contexto

### Por qué la tab "Cursando" está vacía

`getCursandoAlumnos` en `panel-predicciones.routes.js` excluye alumnos que tengan cualquier Final aprobado (`NOT EXISTS (Final con nota >= 4)`). El seed actualmente:
- Genera cursadas con `estado='cursando'` para 2026 ✓
- Pero **también** genera registros de examen tipo `Final` para 2026 (3080 finales, 2974 aprobados)

Resultado: casi todos los alumnos de 2026 caen en la tab "Aprobados" en lugar de "Cursando".

### Por qué "Aprobados" muestra 609 alumnos para Álgebra I

`getAprobadosAlumnos` no filtra por año. Retorna todos los alumnos de todas las cohortes (2022–2026) que tengan algún Final aprobado para esa materia. Los 609 son históricos, no solo 2026.

### Distribución actual vs. objetivo

| Cohorte | Actual | Objetivo |
|---------|--------|----------|
| Año 1 (2026) | 150 | 45 |
| Año 2 (2025) | 130 | 40 |
| Año 3 (2024) | 125 | 40 |
| Año 4 (2023) | 120 | 35 |
| Año 5 (2022) | 120 | 35 |
| **Total** | **645** | **195** |

---

## Diseño

### Cambio 1: Reducir COHORTES

**Archivo:** `ai-service/data/seed-data-generator.py`, línea 38.

```python
COHORTES = [
    (45, 2026, 1),
    (40, 2025, 2),
    (40, 2024, 3),
    (35, 2023, 4),
    (35, 2022, 5),
]
```

Con 45 alumnos en año 1 y ~83% de participación por materia, se esperan ~37 alumnos por materia de año 1. Para materias de años superiores los conteos son menores (30–50 dependiendo de las correlativas).

### Cambio 2: Snapshot parcial — filtrar Finals de 2026

**Archivos:** `ai-service/data/seed-data-generator.py`, funciones `snapshot_to_alumno` y `generar_seed_data`.

En `generar_seed_data`, determinar por alumno si conserva sus Finals de 2026 (probabilidad 10%):

```python
keep_final = bool(rng.random() < 0.10)
alumno = snapshot_to_alumno(alumno_num, perfil, snap, anio_carrera, keep_final=keep_final)
```

En `snapshot_to_alumno`, agregar el parámetro y el filtro:

```python
def snapshot_to_alumno(alumno_num, perfil, snap, anio_carrera, keep_final=False):
    ...
    for r in snap['regs_ex']:
        if r['Anio'] == SNAPSHOT_ANIO and r['TipoExamen'] == 'Final' and not keep_final:
            continue
        examenes.append({...})
```

**Resultado esperado por materia de año 1 (~37 alumnos):**
- ~33 alumnos: sin Finals en 2026 → aparecen en tab "Cursando"
- ~4 alumnos: con Finals en 2026 → aparecen en "Aprobados" (si aprobaron) o "Recursados" (si fallaron)
- Alumnos con Recuperatorio fallido en 2026 (sin Final): aparecen en "Recursados"

### Cambio 3: `getAprobadosAlumnos` filtrado por año actual

**Archivo:** `backend/src/routes/panel-predicciones.routes.js`, función `getAprobadosAlumnos`.

Cambiar el `EXISTS` y la subquery de `nota_final` para restringir el Final al año de la cursada más reciente del alumno en esa materia:

```sql
-- nota_final subquery
SELECT e2.nota FROM examenes e2
WHERE e2.alumno_id = u.id AND e2.materia_id = @materiaId
  AND e2.tipo = 'Final' AND e2.rendido = 1 AND e2.nota >= 4
  AND e2.anio = (
    SELECT MAX(c3.anio) FROM cursadas c3
    WHERE c3.alumno_id = u.id AND c3.materia_id = @materiaId
  )
ORDER BY e2.anio DESC, e2.instancia DESC
LIMIT 1

-- EXISTS condition
AND EXISTS (
  SELECT 1 FROM examenes e
  WHERE e.alumno_id = u.id AND e.materia_id = @materiaId
    AND e.tipo = 'Final' AND e.rendido = 1 AND e.nota >= 4
    AND e.anio = (
      SELECT MAX(c2.anio) FROM cursadas c2
      WHERE c2.alumno_id = u.id AND c2.materia_id = @materiaId
    )
)
```

**Resultado:** Muestra solo alumnos que aprobaron el Final en el año de su cursada más reciente. Para el panel de una materia en 2026, muestra únicamente los ~4 alumnos que tienen Final aprobado en 2026.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `ai-service/data/seed-data-generator.py` | COHORTES + `keep_final` en `generar_seed_data` + filtro en `snapshot_to_alumno` |
| `backend/src/db/seed-masivo-data.json` | Regenerado |
| `backend/src/routes/panel-predicciones.routes.js` | `getAprobadosAlumnos` filtrado por año actual |

---

## Estado esperado post-fix

Para una materia de año 1 (ej. Álgebra I):

| Tab | Count | Descripción |
|-----|-------|-------------|
| Cursando | ~33–37 | Alumnos año 1 (2026) sin Finals, mediados de Q1 |
| Aprobados | ~3–5 | Alumnos año 1 (2026) que ya rindieron y aprobaron el Final |
| Recursados | ~2–4 | Alumnos con Recuperatorio fallido o 3+ Finals reprobados en 2026 |

La tab "Aprobados" ya no mostrará el historial de años anteriores.
