# Seed Masivo 500 Alumnos Activos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generar y poblar la base de datos con 500 alumnos activos (sin abandono), con historia académica completa, distribuidos por año de carrera y con desempeño 75/20/5.

**Architecture:** Un script Python (`seed-data-generator.py`) genera un JSON con todos los datos usando las mismas reglas estadísticas del generador de training. Ese JSON se commitea al repo. Una nueva función `seedMasivo500AlumnosCDU()` en `seed.js` lee el JSON e inserta en SQLite.

**Tech Stack:** Python 3.10+, NumPy, better-sqlite3, Node.js

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `ai-service/data/seed-data-generator.py` | CREAR | Genera `seed-masivo-data.json` con 500 alumnos |
| `backend/src/db/seed-masivo-data.json` | CREAR (generado) | Artefacto con datos listos para insertar |
| `backend/src/db/seed.js` | MODIFICAR | Agrega `seedMasivo500AlumnosCDU()` y la llama en `seedUsers()` |

---

## Task 1: Crear `ai-service/data/seed-data-generator.py`

**Files:**
- Create: `ai-service/data/seed-data-generator.py`

- [ ] **Step 1: Crear el archivo con imports y constantes**

```python
"""
Generador de datos para seed masivo — 500 alumnos activos.
Reutiliza funciones de generar_datasets.py con ajustes:
  - tipos: 75% excelente / 20% regular / 5% malo
  - anio_ingreso fijo por cohorte
  - abandono descartado (se regenera si ocurre)
  - snapshot al final de 2026 (cuatr 2)

Uso:
    cd ai-service
    python data/seed-data-generator.py
"""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from generar_datasets import (
    MATERIAS,
    MU_ASIST,
    calcular_hazard,
    calcular_indice_bloqueo_global,
    generar_nota,
    generar_asistencia,
    calcular_indice_bloqueo_materia,
    calcular_promedio_correlativas,
    generar_offtype,
    simular_cursada,
)

SEED         = 42
SNAPSHOT_ANIO = 2026

# (cantidad, anio_ingreso, anio_carrera)
COHORTES = [
    (150, 2026, 1),
    (130, 2025, 2),
    (125, 2024, 3),
    (120, 2023, 4),
    (120, 2022, 5),
]

TIPOS_PROB = [0.75, 0.20, 0.05]  # excelente, regular, malo
```

- [ ] **Step 2: Agregar `generar_perfil_seed()`**

```python
def generar_perfil_seed(alumno_id: str, tipo: str, anio_ingreso: int, rng) -> dict:
    p_ayuda    = 0.54 if tipo == 'excelente' else 0.02
    ayuda      = int(rng.random() < p_ayuda)
    p_tec      = {'excelente': 0.90, 'regular': 0.40, 'malo': 0.01}[tipo]
    colegio_tec = int(rng.random() < p_tec)

    mu_pc  = {'excelente': 8.0, 'regular': 6.5, 'malo': 5.5}[tipo]
    sig_pc = {'excelente': 0.8, 'regular': 1.0, 'malo': 1.2}[tipo]
    lo_pc  = {'excelente': 5.0, 'regular': 4.0, 'malo': 3.0}[tipo]
    hi_pc  = {'excelente': 10.0, 'regular': 9.0, 'malo': 8.0}[tipo]
    prom_col = float(np.clip(rng.normal(mu_pc, sig_pc), lo_pc, hi_pc))

    tipo_notas, tipo_asist, tipo_abandono = generar_offtype(tipo, rng)

    edad_ingreso = float(np.clip(rng.normal(19, 1.5), 17, 23))
    fecha_nac    = datetime(anio_ingreso, 3, 1) - timedelta(days=int(edad_ingreso * 365.25))
    genero       = 'Masculino' if rng.random() < 0.9 else 'Femenino'

    return {
        'IdAlumno':               alumno_id,
        'TipoAlumno':             tipo,
        'TipoEfectivoNotas':      tipo_notas,
        'TipoEfectivoAsistencia': tipo_asist,
        'TipoEfectivoAbandono':   tipo_abandono,
        'AyudaFinanciera':        ayuda,
        'ColegioTecnico':         colegio_tec,
        'PromedioColegio':        round(prom_col, 2),
        'AnioIngreso':            anio_ingreso,
        'FechaNac':               fecha_nac.strftime('%d-%m-%Y'),
        'Genero':                 genero,
    }
```

- [ ] **Step 3: Agregar `simular_trayectoria_seed()`**

```python
def simular_trayectoria_seed(perfil: dict, rng, snapshot_anio: int) -> tuple:
    """
    Simula trayectoria hasta snapshot_anio (inclusive, cuatr 2).
    Retorna (abandono: bool, snapshot_state: dict | None).
    abandono=True → el caller debe descartar este alumno.
    snapshot_state=None → alumno no tenía cursadas activas al snapshot (ej: graduó antes).
    """
    alumno_id     = perfil['IdAlumno']
    tipo_notas    = perfil['TipoEfectivoNotas']
    tipo_asist    = perfil['TipoEfectivoAsistencia']
    tipo_abandono = perfil['TipoEfectivoAbandono']
    ayuda         = bool(perfil['AyudaFinanciera'])

    aprobadas:        set  = set()
    notas_aprobadas:  dict = {}
    asistencia_hist:  list = []
    pendiente_recursa: dict = {}

    registros_examen  = []
    registros_materia = []
    snapshot_state    = None

    carga_base = {'excelente': 5, 'regular': 4, 'malo': 3}[tipo_notas]

    for anio in range(perfil['AnioIngreso'], snapshot_anio + 1):
        for cuatr in [1, 2]:
            progreso      = len(aprobadas) / 48
            asist_acum    = float(np.mean(asistencia_hist)) if asistencia_hist else MU_ASIST[tipo_asist]
            ind_bloqueo_g = calcular_indice_bloqueo_global(aprobadas)

            p_abandon = calcular_hazard(tipo_abandono, progreso, asist_acum, ind_bloqueo_g, rng)
            if rng.random() < p_abandon:
                return True, None  # abandona → caller descarta

            disponibles = [
                m for m in MATERIAS
                if m not in aprobadas
                and m not in pendiente_recursa
                and all(c in aprobadas for c in MATERIAS[m][3])
                and (MATERIAS[m][1] == 'C' or cuatr == 1)
            ]
            recursa_disp = [
                m for m in pendiente_recursa
                if all(c in aprobadas for c in MATERIAS[m][3])
                and (MATERIAS[m][1] == 'C' or cuatr == 1)
            ]

            carga = max(1, carga_base + int(rng.integers(-1, 2)))
            materias_cuatr = recursa_disp[:carga]
            slots = carga - len(materias_cuatr)
            if slots > 0:
                rng.shuffle(disponibles)
                materias_cuatr += disponibles[:slots]

            if not materias_cuatr:
                if anio == snapshot_anio and cuatr == 2:
                    snapshot_state = {
                        'regs_ex':  list(registros_examen),
                        'regs_mat': list(registros_materia),
                    }
                continue

            n_sim = len(materias_cuatr)

            for mat_code in materias_cuatr:
                tipo_mat = MATERIAS[mat_code][1]
                n_veces  = pendiente_recursa.get(mat_code, 0)

                regs_ex, aprobada, nota_final = simular_cursada(
                    mat_code, tipo_mat, cuatr, anio,
                    tipo_notas, tipo_asist, ayuda,
                    aprobadas, notas_aprobadas, n_veces, n_sim, rng,
                )

                for reg in regs_ex:
                    reg.update({
                        'IdAlumno':        alumno_id,
                        'Genero':          perfil['Genero'],
                        'FechaNac':        perfil['FechaNac'],
                        'AyudaFinanciera': perfil['AyudaFinanciera'],
                        'ColegioTecnico':  perfil['ColegioTecnico'],
                        'PromedioColegio': perfil['PromedioColegio'],
                    })
                registros_examen.extend(regs_ex)

                asist_cursada = regs_ex[0]['Asistencia'] if regs_ex else 0.5
                asistencia_hist.append(asist_cursada)

                registros_materia.append({
                    'IdAlumno':    alumno_id,
                    'Materia':     mat_code,
                    'Tipo':        tipo_mat,
                    'AnioCursada': anio,
                    'Asistencia':  round(asist_cursada, 2),
                    'Recursa':     0 if aprobada else 1,
                })

                if aprobada:
                    aprobadas.add(mat_code)
                    notas_aprobadas[mat_code] = nota_final
                    pendiente_recursa.pop(mat_code, None)
                else:
                    pendiente_recursa[mat_code] = n_veces + 1

            if len(aprobadas) == 48:
                # Se graduó antes del snapshot — retornar snapshot hasta aquí
                snapshot_state = {
                    'regs_ex':  list(registros_examen),
                    'regs_mat': list(registros_materia),
                }
                return False, snapshot_state

            if anio == snapshot_anio and cuatr == 2:
                snapshot_state = {
                    'regs_ex':  list(registros_examen),
                    'regs_mat': list(registros_materia),
                }

    return False, snapshot_state
```

- [ ] **Step 4: Agregar `snapshot_to_alumno()` y `generar_seed_data()`**

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

    username = f'seed_{alumno_num:04d}'
    return {
        'username':        username,
        'nombre_completo': f'Alumno Seed {alumno_num:04d}',
        'email':           f'{username}@usal.edu.ar',
        'google_id':       f'seed_google_{alumno_num:04d}',
        'genero':          perfil['Genero'],
        'fecha_nac':       perfil['FechaNac'],
        'ayuda_financiera': perfil['AyudaFinanciera'],
        'colegio_tecnico':  perfil['ColegioTecnico'],
        'promedio_colegio': perfil['PromedioColegio'],
        'anio_ingreso':     perfil['AnioIngreso'],
        'anio_carrera':     anio_carrera,
        'tipo':             perfil['TipoAlumno'],
        'cursadas':         cursadas,
        'examenes':         examenes,
    }


def generar_seed_data():
    rng       = np.random.default_rng(SEED)
    alumnos   = []
    alumno_num = 1

    for cantidad, anio_ingreso, anio_carrera in COHORTES:
        generados = 0
        intentos  = 0
        print(f'Generando cohorte año {anio_carrera} ({cantidad} alumnos, ingreso {anio_ingreso})...')

        while generados < cantidad:
            intentos  += 1
            tipo       = rng.choice(['excelente', 'regular', 'malo'], p=TIPOS_PROB)
            alumno_id  = f'SEED{alumno_num:04d}'
            perfil     = generar_perfil_seed(alumno_id, tipo, anio_ingreso, rng)

            abandono, snap = simular_trayectoria_seed(perfil, rng, SNAPSHOT_ANIO)

            if abandono or snap is None:
                continue

            # Requiere al menos una cursada activa en 2026
            has_2026 = any(r['AnioCursada'] == SNAPSHOT_ANIO for r in snap['regs_mat'])
            if not has_2026:
                continue

            alumno = snapshot_to_alumno(alumno_num, perfil, snap, anio_carrera)
            alumnos.append(alumno)
            alumno_num += 1
            generados  += 1

        print(f'  Cohorte año {anio_carrera}: {generados} alumnos ({intentos} intentos)')

    output_path = Path(__file__).parent.parent.parent / 'backend' / 'src' / 'db' / 'seed-masivo-data.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({'alumnos': alumnos}, f, ensure_ascii=False, indent=2)

    total_cursadas = sum(len(a['cursadas']) for a in alumnos)
    total_examenes = sum(len(a['examenes']) for a in alumnos)
    print(f'\n✅ JSON generado: {output_path}')
    print(f'   Total alumnos:  {len(alumnos)}')
    print(f'   Total cursadas: {total_cursadas}')
    print(f'   Total examenes: {total_examenes}')


if __name__ == '__main__':
    generar_seed_data()
```

- [ ] **Step 5: Verificar que el archivo está completo**

El archivo final debe tener en orden:
1. Docstring + imports
2. Constantes (SEED, SNAPSHOT_ANIO, COHORTES, TIPOS_PROB)
3. `generar_perfil_seed()`
4. `simular_trayectoria_seed()`
5. `snapshot_to_alumno()`
6. `generar_seed_data()`
7. `if __name__ == '__main__': generar_seed_data()`

- [ ] **Step 6: Commit del script**

```bash
git add ai-service/data/seed-data-generator.py
git commit -m "feat(ai): agregar seed-data-generator.py para seed masivo 500 alumnos"
```

---

## Task 2: Ejecutar el generador y commitear el JSON

**Files:**
- Create: `backend/src/db/seed-masivo-data.json` (generado)

- [ ] **Step 1: Correr el generador desde el directorio ai-service**

```bash
cd ai-service
python data/seed-data-generator.py
```

Salida esperada (los intentos varían según SEED):
```
Generando cohorte año 1 (150 alumnos, ingreso 2026)...
  Cohorte año 1: 150 alumnos (NNN intentos)
Generando cohorte año 2 (130 alumnos, ingreso 2025)...
  Cohorte año 2: 130 alumnos (NNN intentos)
Generando cohorte año 3 (125 alumnos, ingreso 2024)...
  Cohorte año 3: 125 alumnos (NNN intentos)
Generando cohorte año 4 (120 alumnos, ingreso 2023)...
  Cohorte año 4: 120 alumnos (NNN intentos)
Generando cohorte año 5 (120 alumnos, ingreso 2022)...
  Cohorte año 5: 120 alumnos (NNN intentos)

✅ JSON generado: .../backend/src/db/seed-masivo-data.json
   Total alumnos:  500
   Total cursadas: XXXX
   Total examenes: XXXX
```

Si el script falla con `ImportError`, verificar que se corre desde `ai-service/` y que `generar_datasets.py` está en `ai-service/data/`.

- [ ] **Step 2: Verificar la estructura del JSON**

```bash
python -c "
import json
with open('../backend/src/db/seed-masivo-data.json') as f:
    d = json.load(f)
a = d['alumnos']
print('Total alumnos:', len(a))
años = {}
for x in a:
    años[x['anio_carrera']] = años.get(x['anio_carrera'], 0) + 1
print('Por año:', años)
tipos = {}
for x in a:
    tipos[x['tipo']] = tipos.get(x['tipo'], 0) + 1
print('Por tipo:', tipos)
print('Ejemplo alumno 1:', {k: v for k, v in a[0].items() if k != 'cursadas' and k != 'examenes'})
print('Cursadas alumno 1:', a[0]['cursadas'][:2])
"
```

Salida esperada:
```
Total alumnos: 500
Por año: {1: 150, 2: 130, 3: 125, 4: 120, 5: 120}
Por tipo: {'excelente': ~375, 'regular': ~100, 'malo': ~25}
Ejemplo alumno 1: {'username': 'seed_0001', 'anio_ingreso': 2026, 'anio_carrera': 1, ...}
Cursadas alumno 1: [{'materia_codigo_plan': ..., 'anio': 2026, 'estado': 'cursando', ...}, ...]
```

- [ ] **Step 3: Commitear el JSON**

```bash
cd ..
git add backend/src/db/seed-masivo-data.json
git commit -m "data: agregar seed-masivo-data.json con 500 alumnos activos generados"
```

---

## Task 3: Agregar `seedMasivo500AlumnosCDU()` en `backend/src/db/seed.js`

**Files:**
- Modify: `backend/src/db/seed.js`

- [ ] **Step 1: Agregar la función antes de `seedUsers()`**

Insertar el siguiente bloque en `seed.js` justo antes de la función `async function seedUsers()` (que está al final del archivo). La función usa `db`, `fs` y `path` que ya están importados en las primeras líneas del archivo.

```javascript
function seedMasivo500AlumnosCDU() {
  try {
    const existing = db
      .prepare("SELECT COUNT(*) as count FROM users WHERE username LIKE 'seed_%'")
      .get();
    if (existing.count > 0) {
      console.log("Seed masivo: ya existen alumnos seed_*, saltando.");
      return;
    }

    const jsonPath = path.join(__dirname, "seed-masivo-data.json");
    if (!fs.existsSync(jsonPath)) {
      console.warn(
        "⚠️  seed-masivo-data.json no encontrado. Correr ai-service/data/seed-data-generator.py primero.",
      );
      return;
    }
    const { alumnos } = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    const DEMO_USERNAMES = [
      "lucas.martinez", "valentina.gomez", "mateo.fernandez", "sofia.rodriguez",
      "nicolas.lopez", "joaquin.perez", "camila.torres", "sebastian.diaz",
      "agustina.romero", "ignacio.sanchez", "martina.villareal", "tomas.acosta",
      "pedro.quintero", "ana.benitez", "rodrigo.molina", "luciana.herrera",
      "diego.castro", "florencia.ramos", "ezequiel.vargas", "camila.mendez",
      "martin.ibarra", "natalia.quispe", "pablo.luna", "valeria.mora",
      "gabriel.silva", "antonella.reyes",
    ];

    const ph = DEMO_USERNAMES.map(() => "?").join(",");
    const demoIds = db
      .prepare(`SELECT id FROM users WHERE username IN (${ph})`)
      .all(...DEMO_USERNAMES)
      .map((r) => r.id);

    if (demoIds.length > 0) {
      const idPh = demoIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM examenes WHERE alumno_id IN (${idPh})`).run(...demoIds);
      db.prepare(`DELETE FROM cursadas WHERE alumno_id IN (${idPh})`).run(...demoIds);
      db.prepare(`DELETE FROM inscripciones WHERE alumno_id IN (${idPh})`).run(...demoIds);
      db.prepare(`DELETE FROM users WHERE id IN (${idPh})`).run(...demoIds);
    }

    const stmtInsertUser = db.prepare(`
      INSERT OR IGNORE INTO users
        (username, password, role, nombre_completo, email,
         oauth_provider, google_id, genero, fecha_nac,
         ayuda_financiera, colegio_tecnico, promedio_colegio, anio_ingreso)
      VALUES (?, NULL, 'alumno', ?, ?, 'google', ?, ?, ?, ?, ?, ?, ?)
    `);
    const stmtGetUser    = db.prepare("SELECT id FROM users WHERE username = ?");
    const stmtGetMateria = db.prepare("SELECT id FROM materias WHERE codigo_plan = ?");
    const stmtInsertCursada = db.prepare(`
      INSERT OR IGNORE INTO cursadas (alumno_id, materia_id, anio, asistencia, estado)
      VALUES (?, ?, ?, ?, ?)
    `);
    const stmtInsertExamen = db.prepare(`
      INSERT OR IGNORE INTO examenes
        (alumno_id, materia_id, anio, tipo, instancia,
         rendido, nota, ausente, veces_recursada, asistencia, fecha_examen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const stmtInsertInscr = db.prepare(`
      INSERT OR IGNORE INTO inscripciones (alumno_id, materia_id, anio, estado)
      VALUES (?, ?, ?, 'activa')
    `);

    const seedAll = db.transaction(() => {
      for (const alumno of alumnos) {
        stmtInsertUser.run(
          alumno.username,
          alumno.nombre_completo,
          alumno.email,
          alumno.google_id,
          alumno.genero,
          alumno.fecha_nac,
          alumno.ayuda_financiera,
          alumno.colegio_tecnico,
          alumno.promedio_colegio,
          alumno.anio_ingreso,
        );

        const row = stmtGetUser.get(alumno.username);
        if (!row) continue;
        const aId = row.id;

        for (const c of alumno.cursadas) {
          const m = stmtGetMateria.get(c.materia_codigo_plan);
          if (!m) continue;
          stmtInsertCursada.run(aId, m.id, c.anio, c.asistencia, c.estado);
        }

        for (const e of alumno.examenes) {
          const m = stmtGetMateria.get(e.materia_codigo_plan);
          if (!m) continue;
          stmtInsertExamen.run(
            aId, m.id, e.anio, e.tipo, e.instancia,
            e.rendido, e.nota ?? null, e.ausente,
            e.veces_recursada, e.asistencia, e.fecha_examen,
          );
        }

        for (const c of alumno.cursadas.filter(
          (c) => c.anio === 2026 && c.estado === "cursando",
        )) {
          const m = stmtGetMateria.get(c.materia_codigo_plan);
          if (!m) continue;
          stmtInsertInscr.run(aId, m.id, 2026);
        }
      }
    });

    seedAll();
    console.log(`✅ Seed masivo: ${alumnos.length} alumnos insertados.`);
  } catch (error) {
    console.error("❌ Error en seed masivo:", error.message);
  }
}
```

- [ ] **Step 2: Commit del cambio**

```bash
git add backend/src/db/seed.js
git commit -m "feat(backend): agregar seedMasivo500AlumnosCDU() en seed.js"
```

---

## Task 4: Conectar la función en `seedUsers()` y verificar

**Files:**
- Modify: `backend/src/db/seed.js` (línea ~3640, dentro de `seedUsers()`)

- [ ] **Step 1: Agregar la llamada al final de `seedUsers()`**

En `seed.js`, dentro de la función `async function seedUsers()`, agregar `seedMasivo500AlumnosCDU()` después de `seedDemoAlumnosAM2CDU014()`:

```javascript
  seedDemoAlumnosCDU010();
  seedDemoAlumnosAM2CDU014();
  seedMasivo500AlumnosCDU();   // ← agregar esta línea
}
```

- [ ] **Step 2: Correr el seed**

Desde la raíz del proyecto:

```bash
cd backend
node src/db/seed.js
```

Buscar en la salida:
```
✅ Seed masivo: 500 alumnos insertados.
```

Si aparece `⚠️  seed-masivo-data.json no encontrado`, primero correr el generador Python (Task 2, Step 1).

Si aparece `Seed masivo: ya existen alumnos seed_*, saltando.`, el seed ya se ejecutó antes — es el comportamiento idempotente esperado.

- [ ] **Step 3: Verificar los datos en la DB**

```bash
cd backend
node -e "
const db = require('./src/db/database');
const total = db.prepare(\"SELECT COUNT(*) as c FROM users WHERE username LIKE 'seed_%'\").get();
console.log('Alumnos seed_:', total.c);

const porAnio = db.prepare(\`
  SELECT anio_ingreso, COUNT(*) as c
  FROM users WHERE username LIKE 'seed_%'
  GROUP BY anio_ingreso ORDER BY anio_ingreso
\`).all();
console.log('Por anio_ingreso:', porAnio);

const cursadas = db.prepare(\`
  SELECT COUNT(*) as c FROM cursadas c
  JOIN users u ON u.id = c.alumno_id
  WHERE u.username LIKE 'seed_%'
\`).get();
console.log('Total cursadas seed_:', cursadas.c);

const examenes = db.prepare(\`
  SELECT COUNT(*) as c FROM examenes e
  JOIN users u ON u.id = e.alumno_id
  WHERE u.username LIKE 'seed_%'
\`).get();
console.log('Total examenes seed_:', examenes.c);

const demos = db.prepare(\"SELECT COUNT(*) as c FROM users WHERE username IN ('lucas.martinez','valentina.gomez','mateo.fernandez')\").get();
console.log('Alumnos demo (deben ser 0):', demos.c);
"
```

Salida esperada:
```
Alumnos seed_: 500
Por anio_ingreso: [
  { anio_ingreso: 2022, c: 120 },
  { anio_ingreso: 2023, c: 120 },
  { anio_ingreso: 2024, c: 125 },
  { anio_ingreso: 2025, c: 130 },
  { anio_ingreso: 2026, c: 150 },
]
Total cursadas seed_: XXXX  (esperado > 2000)
Total examenes seed_: XXXX  (esperado > 5000)
Alumnos demo (deben ser 0): 0
```

- [ ] **Step 4: Commit final**

```bash
git add backend/src/db/seed.js
git commit -m "feat(backend): conectar seedMasivo500AlumnosCDU en seedUsers"
```

---

## Spec Coverage Check

| Requisito del spec | Tarea |
|--------------------|-------|
| 500 alumnos (150/130/125/120/120) | Task 2 genera, Task 4 verifica |
| Tipos 75/20/5 | Task 1 Step 1 (TIPOS_PROB) |
| Sin abandono | Task 1 Step 3 (caller descarta) |
| Historia completa vía snapshot | Task 1 Step 3 (simular_trayectoria_seed) |
| Idempotencia (seed_* check) | Task 3 Step 1 (líneas iniciales) |
| Elimina demos existentes | Task 3 Step 1 (DEMO_USERNAMES) |
| No toca usuarios base | Task 3 Step 1 (solo DEMO_USERNAMES, no admin/docente) |
| cursadas 2026 como "cursando" | Task 1 Step 4 (snapshot_to_alumno) |
| inscripciones año actual | Task 3 Step 1 (stmtInsertInscr) |
| Transacción atómica | Task 3 Step 1 (db.transaction) |
| JSON en backend/src/db/ | Task 1 Step 4 (output_path) |
| seedMasivo al final de seedUsers | Task 4 Step 1 |
