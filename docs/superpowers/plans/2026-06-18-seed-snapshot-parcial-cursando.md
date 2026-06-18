# Seed snapshot parcial: alumnos cursando en Q1 2026 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir visibilidad de alumnos "cursando" en el panel, reducir cohortes a 195 alumnos totales, y filtrar `getAprobadosAlumnos` al año actual para que la tab muestre solo los ~4-5 alumnos que ya rindieron su Final en 2026.

**Architecture:** 3 cambios de código (COHORTES + snapshot filter + query SQL) + regeneración del JSON + re-seed. El seed Python sigue siendo el único lugar que genera datos; el backend solo ajusta su query de lectura.

**Tech Stack:** Python 3, NumPy, SQLite3, Node.js / better-sqlite3

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `ai-service/data/seed-data-generator.py` | COHORTES + parámetro `keep_final` en `snapshot_to_alumno` + llamada en `generar_seed_data` |
| `backend/src/db/seed-masivo-data.json` | Regenerado automáticamente |
| `backend/src/routes/panel-predicciones.routes.js` | `getAprobadosAlumnos`: filtro por año de última cursada |

---

## Task 1: Reducir COHORTES

**Files:**
- Modify: `ai-service/data/seed-data-generator.py:38-44`

- [ ] **Step 1: Editar COHORTES (líneas 38-44)**

Reemplazar:
```python
COHORTES = [
    (150, 2026, 1),
    (130, 2025, 2),
    (125, 2024, 3),
    (120, 2023, 4),
    (120, 2022, 5),
]
```
Por:
```python
COHORTES = [
    (45, 2026, 1),
    (40, 2025, 2),
    (40, 2024, 3),
    (35, 2023, 4),
    (35, 2022, 5),
]
```

- [ ] **Step 2: Commit**

```bash
git add ai-service/data/seed-data-generator.py
git commit -m "fix(seed): reducir cohortes a 195 alumnos totales"
```

---

## Task 2: Snapshot parcial — filtrar Finals de 2026 para ~90% de alumnos

**Files:**
- Modify: `ai-service/data/seed-data-generator.py:205, 222-235, 281`

**Contexto:** `snapshot_to_alumno` incluye actualmente TODOS los exámenes de la simulación, incluyendo los Finals de 2026. `getCursandoAlumnos` en el backend excluye alumnos con Finals aprobados, por eso la tab "Cursando" está vacía. La solución: agregar `keep_final: bool` a `snapshot_to_alumno`. En `generar_seed_data`, se decide con probabilidad 10% si un alumno conserva sus Finals de 2026 (simula que ya rindió el final en un turno anticipado). El 90% restante no tiene Finals → aparece en "Cursando".

- [ ] **Step 1: Modificar firma y loop de exámenes en `snapshot_to_alumno` (línea 205 y 222-235)**

Reemplazar:
```python
def snapshot_to_alumno(alumno_num: int, perfil: dict, snap: dict, anio_carrera: int) -> dict:
    cursadas = []
    for r in snap['regs_mat']:
        anio_c = r['AnioCursada']
        if anio_c == SNAPSHOT_ANIO:
            estado = 'cursando'
        elif r['Recursa'] == 0:
            estado = 'aprobada'
        else:
            estado = 'recursada'
        cursadas.append({
            'materia_codigo_plan': r['Materia'],
            'anio':                anio_c,
            'asistencia':          r['Asistencia'],
            'estado':              estado,
        })

    examenes = []
    for r in snap['regs_ex']:
        examenes.append({
            'materia_codigo_plan': r['Materia'],
            'anio':                r['Anio'],
            'tipo':                r['TipoExamen'],
            'instancia':           r['Instancia'],
            'rendido':             r['ExamenRendido'],
            'nota':                r['Nota'],
            'ausente':             r['AusenteExamen'],
            'veces_recursada':     r['VecesRecursada'],
            'asistencia':          r['Asistencia'],
            'fecha_examen':        r['FechaExamen'],
        })
```
Por:
```python
def snapshot_to_alumno(alumno_num: int, perfil: dict, snap: dict, anio_carrera: int,
                       keep_final: bool = False) -> dict:
    cursadas = []
    for r in snap['regs_mat']:
        anio_c = r['AnioCursada']
        if anio_c == SNAPSHOT_ANIO:
            estado = 'cursando'
        elif r['Recursa'] == 0:
            estado = 'aprobada'
        else:
            estado = 'recursada'
        cursadas.append({
            'materia_codigo_plan': r['Materia'],
            'anio':                anio_c,
            'asistencia':          r['Asistencia'],
            'estado':              estado,
        })

    examenes = []
    for r in snap['regs_ex']:
        if r['Anio'] == SNAPSHOT_ANIO and r['TipoExamen'] == 'Final' and not keep_final:
            continue  # alumno está mediados de Q1, todavía no rindió el Final
        examenes.append({
            'materia_codigo_plan': r['Materia'],
            'anio':                r['Anio'],
            'tipo':                r['TipoExamen'],
            'instancia':           r['Instancia'],
            'rendido':             r['ExamenRendido'],
            'nota':                r['Nota'],
            'ausente':             r['AusenteExamen'],
            'veces_recursada':     r['VecesRecursada'],
            'asistencia':          r['Asistencia'],
            'fecha_examen':        r['FechaExamen'],
        })
```

- [ ] **Step 2: Modificar la llamada en `generar_seed_data` (línea 281)**

Reemplazar:
```python
            alumno = snapshot_to_alumno(alumno_num, perfil, snap, anio_carrera)
```
Por:
```python
            keep_final = bool(rng.random() < 0.10)
            alumno = snapshot_to_alumno(alumno_num, perfil, snap, anio_carrera,
                                        keep_final=keep_final)
```

- [ ] **Step 3: Commit**

```bash
git add ai-service/data/seed-data-generator.py
git commit -m "fix(seed): snapshot parcial Q1 2026 — filtrar Finals para 90% de alumnos"
```

---

## Task 3: `getAprobadosAlumnos` filtrado por año de última cursada

**Files:**
- Modify: `backend/src/routes/panel-predicciones.routes.js:242-267`

**Contexto:** La función actualmente devuelve todos los alumnos que alguna vez aprobaron un Final de la materia (sin filtro de año). Con la nueva lógica del seed, solo los ~10% de alumnos que conservan su Final de 2026 deben aparecer en la tab. La query pasa a buscar Finals exclusivamente en el año de la cursada más reciente del alumno para esa materia.

- [ ] **Step 1: Reemplazar la función `getAprobadosAlumnos` (líneas 242-267)**

Reemplazar:
```javascript
function getAprobadosAlumnos(materiaId) {
  return db
    .prepare(
      `SELECT DISTINCT
         u.id,
         COALESCE(u.nombre_completo, u.username) AS nombre_completo,
         (
           SELECT e2.nota FROM examenes e2
           WHERE e2.alumno_id = u.id AND e2.materia_id = @materiaId
             AND e2.tipo = 'Final' AND e2.rendido = 1 AND e2.nota >= 4
           ORDER BY e2.anio DESC, e2.instancia DESC
           LIMIT 1
         ) AS nota_final
       FROM users u
       JOIN cursadas c ON c.alumno_id = u.id AND c.materia_id = @materiaId
       WHERE u.role = 'alumno'
         AND EXISTS (
           SELECT 1 FROM examenes e
           WHERE e.alumno_id = u.id AND e.materia_id = @materiaId
             AND e.tipo = 'Final' AND e.rendido = 1 AND e.nota >= 4
         )
       GROUP BY u.id
       ORDER BY nombre_completo ASC`,
    )
    .all({ materiaId });
}
```
Por:
```javascript
function getAprobadosAlumnos(materiaId) {
  return db
    .prepare(
      `SELECT DISTINCT
         u.id,
         COALESCE(u.nombre_completo, u.username) AS nombre_completo,
         (
           SELECT e2.nota FROM examenes e2
           WHERE e2.alumno_id = u.id AND e2.materia_id = @materiaId
             AND e2.tipo = 'Final' AND e2.rendido = 1 AND e2.nota >= 4
             AND e2.anio = (
               SELECT MAX(c3.anio) FROM cursadas c3
               WHERE c3.alumno_id = u.id AND c3.materia_id = @materiaId
             )
           ORDER BY e2.anio DESC, e2.instancia DESC
           LIMIT 1
         ) AS nota_final
       FROM users u
       JOIN cursadas c ON c.alumno_id = u.id AND c.materia_id = @materiaId
       WHERE u.role = 'alumno'
         AND EXISTS (
           SELECT 1 FROM examenes e
           WHERE e.alumno_id = u.id AND e.materia_id = @materiaId
             AND e.tipo = 'Final' AND e.rendido = 1 AND e.nota >= 4
             AND e.anio = (
               SELECT MAX(c2.anio) FROM cursadas c2
               WHERE c2.alumno_id = u.id AND c2.materia_id = @materiaId
             )
         )
       GROUP BY u.id
       ORDER BY nombre_completo ASC`,
    )
    .all({ materiaId });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/panel-predicciones.routes.js
git commit -m "fix(panel): getAprobadosAlumnos filtra por año de última cursada"
```

---

## Task 4: Regenerar seed-masivo-data.json

**Files:**
- Regenerated: `backend/src/db/seed-masivo-data.json`

- [ ] **Step 1: Correr el generador Python**

Desde la raíz del proyecto:
```bash
cd ai-service
python data/seed-data-generator.py
```

Salida esperada:
```
Generando cohorte año 1 (45 alumnos, ingreso 2026)...
  Cohorte año 1: 45 alumnos (NNN intentos)
Generando cohorte año 2 (40 alumnos, ingreso 2025)...
  Cohorte año 2: 40 alumnos (NNN intentos)
Generando cohorte año 3 (40 alumnos, ingreso 2024)...
  Cohorte año 3: 40 alumnos (NNN intentos)
Generando cohorte año 4 (35 alumnos, ingreso 2023)...
  Cohorte año 4: 35 alumnos (NNN intentos)
Generando cohorte año 5 (35 alumnos, ingreso 2022)...
  Cohorte año 5: 35 alumnos (NNN intentos)
✅ JSON generado: .../backend/src/db/seed-masivo-data.json
   Total alumnos:  195
   Total cursadas: XXXX
   Total examenes: XXXX
```

- [ ] **Step 2: Verificar contenido del JSON**

```bash
cd ..   # volver a la raíz
python -c "
import json
with open('backend/src/db/seed-masivo-data.json') as f:
    d = json.load(f)
alumnos = d['alumnos']
print(f'Total alumnos: {len(alumnos)}')

# Verificar: no debe haber Finals de 2026 para la mayoría
finales_2026 = sum(
    1 for a in alumnos
    for e in a['examenes']
    if e['anio'] == 2026 and e['tipo'] == 'Final'
)
print(f'Finals en 2026: {finales_2026} (esperado: ~18 = 10% de 195*1 materia aprox)')

cursando_2026 = sum(1 for a in alumnos for c in a['cursadas'] if c['anio'] == 2026)
cursando_no_cursando = sum(
    1 for a in alumnos for c in a['cursadas']
    if c['anio'] == 2026 and c['estado'] != 'cursando'
)
print(f'Cursadas 2026: {cursando_2026} (no-cursando: {cursando_no_cursando}, esperado: 0)')
"
```

Salida esperada:
```
Total alumnos: 195
Finals en 2026: <número bajo, aprox 10% de cursadas 2026 × materias>
Cursadas 2026: XXXX (no-cursando: 0, esperado: 0)
```

- [ ] **Step 3: Commit del JSON**

```bash
git add backend/src/db/seed-masivo-data.json
git commit -m "chore(seed): regenerar seed-masivo-data.json con snapshot parcial 195 alumnos"
```

---

## Task 5: Re-seed la base de datos y verificar

**Files:**
- Wipe + recreate: `backend/database.sqlite`

- [ ] **Step 1: Eliminar la base de datos existente**

En PowerShell desde la raíz del proyecto:
```powershell
Remove-Item backend/database.sqlite -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 2: Correr el seed**

```bash
cd backend
npm run seed
```

Salida esperada al final:
```
Seed masivo: 195 alumnos insertados.
```

Si dice "ya existen alumnos seed_*, saltando", el archivo no se eliminó correctamente. Repetir Step 1.

- [ ] **Step 3: Verificar estados 2026**

```bash
sqlite3 database.sqlite "SELECT estado, COUNT(*) FROM cursadas WHERE anio = 2026 GROUP BY estado;"
```

Esperado: solo `cursando | XXXX`. Sin `aprobada` ni `abandonada`.

- [ ] **Step 4: Verificar distribución de cursando por materia**

```bash
sqlite3 database.sqlite "
SELECT m.nombre, COUNT(*) as n
FROM cursadas c
JOIN materias m ON c.materia_id = m.id
WHERE c.anio = 2026 AND c.estado = 'cursando'
GROUP BY m.nombre
ORDER BY n DESC LIMIT 15;"
```

Esperado: materias de año 1 con 30–45 alumnos. Teología (año 4, sin correlativas) debería aparecer con valor bajo (~35 máximo).

- [ ] **Step 5: Verificar tab Aprobados — solo año actual**

```bash
sqlite3 database.sqlite "
SELECT m.nombre,
       COUNT(DISTINCT e.alumno_id) as aprobados_anio_actual
FROM examenes e
JOIN materias m ON e.materia_id = m.id
WHERE e.tipo = 'Final' AND e.rendido = 1 AND e.nota >= 4
  AND e.anio = (
    SELECT MAX(c2.anio) FROM cursadas c2
    WHERE c2.alumno_id = e.alumno_id AND c2.materia_id = e.materia_id
  )
GROUP BY m.nombre
ORDER BY aprobados_anio_actual DESC LIMIT 15;"
```

Esperado: mayoría de materias con 3–6 aprobados (el ~10% de alumnos que conservaron Finals de 2026).

- [ ] **Step 6: Levantar el backend y verificar en el frontend**

```bash
npm run dev
```

Abrir el panel de predicciones y verificar materia Álgebra I:
- Tab "Cursando": 30–40 alumnos visibles con predicciones
- Tab "Aprobados": 3–6 alumnos (no 609)
- Tab "Recursados": 2–5 alumnos con Recuperatorio fallido
