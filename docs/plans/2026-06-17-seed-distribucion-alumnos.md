# Corrección de distribución de alumnos en seed masivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir tres problemas en `seed-data-generator.py` para que el seed masivo genere 10-15 alumnos en riesgo, no muestre alumnos como "Aprobados en 2026", y tenga distribución equitativa de cursadas por materia.

**Architecture:** 4 cambios quirúrgicos en un único archivo Python (`seed-data-generator.py`), luego regenerar el JSON y re-sembrar la base de datos. No se toca `seed.js` ni el frontend.

**Tech Stack:** Python 3, NumPy, SQLite, Node.js (npm run seed)

---

## Archivos modificados

| Archivo | Qué cambia |
|---|---|
| `ai-service/data/seed-data-generator.py` | 4 cambios: TIPOS_PROB, loop cuatr, snapshot capture ×2, filtro disponibles |
| `backend/src/db/seed-masivo-data.json` | Regenerado automáticamente al correr el script Python |

---

## Task 1: Reducir proporción de alumnos en riesgo (TIPOS_PROB)

**Files:**
- Modify: `ai-service/data/seed-data-generator.py:46`

- [ ] **Step 1: Editar línea 46**

Reemplazar:
```python
TIPOS_PROB = [0.75, 0.20, 0.05]  # excelente, regular, malo
```
Por:
```python
TIPOS_PROB = [0.95, 0.04, 0.01]  # excelente, regular, malo
```

- [ ] **Step 2: Commit**

```bash
git add ai-service/data/seed-data-generator.py
git commit -m "fix(seed): reducir proporcion de alumnos en riesgo (TIPOS_PROB)"
```

---

## Task 2: Snapshot solo en cuatrimestre 1 de 2026 + corregir captura de estado

**Files:**
- Modify: `ai-service/data/seed-data-generator.py:106-107, 137, 193`

**Contexto:** La función `simular_trayectoria_seed` actualmente corre `[1, 2]` cuatrimestres para todos los años, incluyendo 2026. Esto genera exámenes Finales en 2026, que el panel detecta como "Aprobados". Además, hay dos condiciones `cuatr == 2` que capturan el snapshot final — si dejamos de simular cuatr 2 para 2026 sin actualizarlas, los alumnos de ingreso 2026 nunca capturan su snapshot y son descartados.

- [ ] **Step 1: Cambiar el loop de cuatrimestres (líneas 106-107)**

Reemplazar:
```python
    for anio in range(perfil['AnioIngreso'], snapshot_anio + 1):
        for cuatr in [1, 2]:
```
Por:
```python
    for anio in range(perfil['AnioIngreso'], snapshot_anio + 1):
        cuatrs = [1] if anio == snapshot_anio else [1, 2]
        anio_relativo = anio - perfil['AnioIngreso'] + 1
        for cuatr in cuatrs:
```

- [ ] **Step 2: Actualizar primera captura de snapshot (línea 137)**

Reemplazar:
```python
                if anio == snapshot_anio and cuatr == 2:
                    snapshot_state = {
                        'regs_ex':  list(registros_examen),
                        'regs_mat': list(registros_materia),
                    }
                continue
```
Por:
```python
                if anio == snapshot_anio and cuatr == cuatrs[-1]:
                    snapshot_state = {
                        'regs_ex':  list(registros_examen),
                        'regs_mat': list(registros_materia),
                    }
                continue
```

- [ ] **Step 3: Actualizar segunda captura de snapshot (línea 193)**

Reemplazar:
```python
            if anio == snapshot_anio and cuatr == 2:
                snapshot_state = {
                    'regs_ex':  list(registros_examen),
                    'regs_mat': list(registros_materia),
                }
```
Por:
```python
            if anio == snapshot_anio and cuatr == cuatrs[-1]:
                snapshot_state = {
                    'regs_ex':  list(registros_examen),
                    'regs_mat': list(registros_materia),
                }
```

- [ ] **Step 4: Actualizar docstring (línea 84, opcional pero recomendado)**

Reemplazar:
```python
    Simula trayectoria hasta snapshot_anio (inclusive, cuatr 2).
```
Por:
```python
    Simula trayectoria hasta snapshot_anio (inclusive, cuatr 1).
```

- [ ] **Step 5: Commit**

```bash
git add ai-service/data/seed-data-generator.py
git commit -m "fix(seed): snapshot al cuatr 1 de 2026 para evitar Finales simulados"
```

---

## Task 3: Restringir materias disponibles por año de carrera

**Files:**
- Modify: `ai-service/data/seed-data-generator.py:116-122`

**Contexto:** `disponibles` se filtra solo por correlativas cumplidas. Teología (año 4, sin correlativas) queda disponible para cualquier alumno de cualquier año. `anio_relativo` ya fue definido en Task 2 en el loop exterior. `MATERIAS[m][2]` es el `año_plan` (1-5).

- [ ] **Step 1: Agregar condición de año al filtro disponibles (líneas 116-122)**

Reemplazar:
```python
            disponibles = [
                m for m in MATERIAS
                if m not in aprobadas
                and m not in pendiente_recursa
                and all(c in aprobadas for c in MATERIAS[m][3])
                and (MATERIAS[m][1] == 'C' or cuatr == 1)
            ]
```
Por:
```python
            disponibles = [
                m for m in MATERIAS
                if m not in aprobadas
                and m not in pendiente_recursa
                and all(c in aprobadas for c in MATERIAS[m][3])
                and (MATERIAS[m][1] == 'C' or cuatr == 1)
                and MATERIAS[m][2] <= anio_relativo
            ]
```

- [ ] **Step 2: Commit**

```bash
git add ai-service/data/seed-data-generator.py
git commit -m "fix(seed): restringir materias disponibles por año de carrera del alumno"
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

Salida esperada (los números pueden variar levemente):
```
Generando cohorte año 1 (150 alumnos, ingreso 2026)...
  Cohorte año 1: 150 alumnos (NNN intentos)
Generando cohorte año 2 (130 alumnos, ingreso 2025)...
  Cohorte año 2: 130 alumnos (NNN intentos)
Generando cohorte año 3 (125 alumnos, ingreso 2024)...
  ...
✅ JSON generado: .../backend/src/db/seed-masivo-data.json
   Total alumnos:  645
   Total cursadas: XXXX
   Total examenes: XXXX
```

Si el script falla con `ModuleNotFoundError: numpy`, instalar con: `pip install numpy pandas`

- [ ] **Step 2: Verificar que el JSON fue actualizado**

```bash
# Verificar que el archivo fue modificado (fecha reciente)
ls -la backend/src/db/seed-masivo-data.json

# Verificar que sigue siendo un JSON válido con la estructura esperada
python -c "
import json
with open('backend/src/db/seed-masivo-data.json') as f:
    d = json.load(f)
alumnos = d['alumnos']
print(f'Total alumnos: {len(alumnos)}')
tipos = {}
for a in alumnos:
    t = a.get('tipo', 'desconocido')
    tipos[t] = tipos.get(t, 0) + 1
print('Distribución de tipos:', tipos)
cursadas_2026 = sum(1 for a in alumnos for c in a['cursadas'] if c['anio'] == 2026)
cursadas_no_cursando = sum(1 for a in alumnos for c in a['cursadas'] if c['anio'] == 2026 and c['estado'] != 'cursando')
print(f'Cursadas 2026: {cursadas_2026} (no-cursando: {cursadas_no_cursando}, esperado: 0)')
"
```

Salida esperada:
```
Total alumnos: 645
Distribución de tipos: {'excelente': ~612, 'regular': ~26, 'malo': ~7}
Cursadas 2026: XXXX (no-cursando: 0, esperado: 0)
```

- [ ] **Step 3: Commit del JSON regenerado**

```bash
cd ..   # volver a la raíz del proyecto
git add backend/src/db/seed-masivo-data.json
git commit -m "chore(seed): regenerar seed-masivo-data.json con distribución corregida"
```

---

## Task 5: Re-seed la base de datos y verificar

**Files:**
- Wipe + recreate: `backend/database.sqlite`

- [ ] **Step 1: Detener el servidor backend si está corriendo**

En la terminal donde corre el backend, presionar `Ctrl+C`.

- [ ] **Step 2: Eliminar la base de datos existente**

```bash
# Desde la raíz del proyecto
rm backend/database.sqlite
```

En Windows (PowerShell): `Remove-Item backend/database.sqlite`

- [ ] **Step 3: Correr el seed**

```bash
cd backend
npm run seed
```

Salida esperada al final:
```
✅ Seed CSV: alumnos de entrenamiento ya cargados, saltando.   (o mensaje de inserción)
Seed masivo: 645 alumnos insertados.
```

- [ ] **Step 4: Verificar distribución de cursadas 2026 por materia**

```bash
sqlite3 database.sqlite "
SELECT m.nombre, COUNT(*) as n
FROM cursadas c
JOIN materias m ON c.materia_id = m.id
WHERE c.anio = 2026 AND c.estado = 'cursando'
GROUP BY m.nombre
ORDER BY n DESC
LIMIT 10;
"
```

Salida esperada: Teología debería aparecer con ~120-180, no con 507. Todas las materias del año 1 deberían tener ~150.

- [ ] **Step 5: Verificar que no hay cursadas 2026 finalizadas**

```bash
sqlite3 database.sqlite "
SELECT estado, COUNT(*) FROM cursadas WHERE anio = 2026 GROUP BY estado;
"
```

Salida esperada: solo `cursando | XXXX`. No debe haber `aprobada` ni `abandonada` en 2026.

- [ ] **Step 6: Verificar perfil de alumnos en riesgo (proxy)**

```bash
sqlite3 database.sqlite "
SELECT
  COUNT(*) as total_alumnos,
  ROUND(AVG(promedio_colegio), 2) as promedio_colegio_promedio,
  SUM(ayuda_financiera) as con_ayuda_financiera
FROM users
WHERE role = 'alumno' AND username LIKE 'seed_%';
"
```

Con la nueva distribución de tipos el promedio de `promedio_colegio` debería subir (más alumnos excelentes). El count `con_ayuda_financiera` también debería bajar.

- [ ] **Step 7: Levantar el backend y verificar en el panel**

```bash
npm run dev
```

Abrir el panel predicciones en el frontend y verificar visualmente:
- Tab "En riesgo": debería mostrar 10-18 alumnos (antes ~90)
- Tab "Aprobados 2026" para cualquier materia: debería estar vacío o casi vacío
- Distribución de alumnos por materia en 2026: más equitativa

---

## Notas

- Si el conteo de at-risk queda por encima de 18 después del paso 7, ajustar `TIPOS_PROB` a `[0.96, 0.03, 0.01]` y repetir Tasks 4-5.
- Los alumnos demo (lucas.martinez, etc.) son eliminados y recreados por `seedMasivo500AlumnosCDU()` — este comportamiento no cambia.
- `recursa_disp` (materias que el alumno está recursando) no tiene restricción de año, lo cual es correcto: un alumno puede recursar una materia de años anteriores sin importar su año actual.
