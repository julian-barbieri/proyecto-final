# Diseño: Dataset con Alumnos en Curso

**Fecha:** 2026-06-15
**Scope:** `ai-service/data/`
**Estado:** Aprobado — pendiente de implementación

---

## 1. Problema que resuelve

El modelo de abandono (`dataset='alumno'`) se entrenó exclusivamente con alumnos que completaron su trayectoria (graduados o abandonados). Sus features clave — `CantFinalesRendidos` y `CantExamenesRendidos` — son conteos absolutos que son naturalmente bajos para alumnos de primer año. El modelo interpreta esos valores bajos como señal de abandono, clasificando a todos los alumnos del seed con P(abandono) ≈ 0.99.

**Causa raíz:** el generador actual termina a todos los alumnos en uno de tres estados (`graduado`, `abandonó`, `timeout-abandonó`). No hay alumnos observados a mitad de carrera.

**Solución:** agregar 500 alumnos "en curso" al dataset de entrenamiento — 100 por cada año de carrera (1 a 5). Cada alumno en-curso se simula completo (para obtener el label eventual), pero solo se registran sus features hasta el punto de observación (snapshot).

---

## 2. Archivos que cambian

| Archivo | Cambio |
|---|---|
| `ai-service/data/generar_datasets.py` | Fase 2 de generación + parámetro `snapshot_anio` en `simular_trayectoria` |
| `ai-service/data/validar.py` | Actualizar rangos de volumen; agregar chequeo de cohortes en-curso |
| `ai-service/data/DESIGN.md` | Actualizar §3.2, §6; agregar §3.4 |

**No cambia nada de:** `ft_engineering.py`, `train_models.py`, `model_deploy.py`.

---

## 3. Estrategia de label para alumnos en curso

**Opción elegida: simular completo + snapshot de features.**

Para cada alumno en-curso:
1. Correr la trayectoria **completa** hasta `graduado` / `abandonó` / `timeout-abandonó`.
2. Al llegar al milestone (fin de C2 del año `anio_ingreso + N − 1`), capturar un snapshot de los registros acumulados hasta ese momento.
3. Escribir en `nivel_alumno.csv` las features **del snapshot** con el **label eventual** (`Abandona = 0` si graduó, `1` si abandonó o timeout).
4. Escribir en `nivel_materia.csv` y `nivel_examen.csv` solo los registros **hasta el snapshot** (no los futuros).

**Milestone:** temporal — fin del cuatrimestre 2 del año N de carrera (`snapshot_anio = anio_ingreso + N − 1`).

---

## 4. Cambio a `simular_trayectoria`

**Firma nueva (retrocompatible):**

```python
def simular_trayectoria(perfil, rng, snapshot_anio=None) -> tuple:
    # returns (regs_examen, regs_materia, estado_final, fecha_abandono, snapshot_state)
```

`snapshot_state` es `None` si el alumno no estaba activo al llegar al milestone; es un `dict` si sí lo estaba:

```python
snapshot_state = {
    'regs_ex':  list(registros_examen),   # copia al momento del corte
    'regs_mat': list(registros_materia),
}
```

**Las 4 líneas que se agregan** al final del bloque `for cuatr in [1, 2]`, después de procesar todas las materias del cuatrimestre:

```python
if snapshot_anio is not None and anio == snapshot_anio and cuatr == 2:
    snapshot_state = {
        'regs_ex':  list(registros_examen),
        'regs_mat': list(registros_materia),
    }
```

Los tres `return` existentes agregan `snapshot_state` como quinto elemento. El llamador del path terminal se actualiza a:

```python
regs_ex, regs_mat, estado, fecha_ab, _ = simular_trayectoria(perfil, rng)
```

**Semántica de `snapshot_state is None`:** el alumno abandonó o se graduó antes de llegar al cierre de C2 del año objetivo → se descarta y se genera el siguiente candidato. Esto incluye alumnos que se gradúan exactamente en mid-C2 del año N (la graduación se detecta dentro del loop de materias, antes del bloque de captura).

---

## 5. Función auxiliar `_nivel_alumno_desde_snapshot`

Computa la fila de `nivel_alumno.csv` para un alumno en-curso, espejando la lógica existente del path terminal pero sobre los registros filtrados:

```python
def _nivel_alumno_desde_snapshot(perfil, snapshot_state, estado_final, snapshot_year):
    regs_mat = snapshot_state['regs_mat']
    aprobadas_snap = {r['Materia'] for r in regs_mat if r['Recursa'] == 0}
    mat_aprobadas  = len(aprobadas_snap)
    mat_recursadas = sum(1 for r in regs_mat if r['Recursa'] == 1)

    return {
        'IdAlumno':                perfil['IdAlumno'],
        'FechaNac':                perfil['FechaNac'],
        'Genero':                  perfil['Genero'],
        'AyudaFinanciera':         perfil['AyudaFinanciera'],
        'ColegioTecnico':          perfil['ColegioTecnico'],
        'PromedioColegio':         perfil['PromedioColegio'],
        'Fecha':                   '',   # no abandonó al momento del snapshot
        'Abandona':                0 if estado_final == 'graduado' else 1,
        'AnioIngreso':             perfil['AnioIngreso'],
        'EstadoFinal':             estado_final,
        'MateriasAprobadas':       mat_aprobadas,
        'AñoCarreraActual':        snapshot_year,
        'TasaProgresion':          round(mat_aprobadas / 48, 3),
        'PrimerAñoCompleto':       int(mat_aprobadas >= 8),
        'MateriasRecursadasTotal': mat_recursadas,
        'AñosDesdeIngreso':        snapshot_year,
        'IndiceBloqueo':           calcular_indice_bloqueo_global(aprobadas_snap),
    }
```

---

## 6. Fase 2 en `generar_datasets`

Loop que genera 500 alumnos en-curso (100 por año de carrera 1–5), a continuación de los 500 terminales existentes:

```python
next_id = n_alumnos + 1   # empieza en 501

for snapshot_year in range(1, 6):
    cohorte_count = 0
    intentos = 0
    while cohorte_count < 100:
        intentos += 1
        alumno_id     = f'ALU{next_id:04d}'
        next_id      += 1
        perfil        = generar_perfil(alumno_id, rng)
        snapshot_anio = perfil['AnioIngreso'] + snapshot_year - 1

        regs_ex, regs_mat, estado, fecha_ab, snap = simular_trayectoria(
            perfil, rng, snapshot_anio=snapshot_anio
        )

        if snap is None:
            continue   # no estaba activo al snapshot → siguiente candidato

        todos_alumnos.append(
            _nivel_alumno_desde_snapshot(perfil, snap, estado, snapshot_year)
        )
        todos_materias.extend(snap['regs_mat'])
        todos_examenes.extend(snap['regs_ex'])

        cohorte_count += 1

    print(f'  Cohorte año-{snapshot_year}: 100 alumnos '
          f'(~{intentos} intentos)')
```

**IDs:** `next_id` incrementa en cada intento, incluyendo los descartados. Los IDs de alumnos en-curso pueden tener gaps (ALU0501, ALU0503, …) pero son siempre únicos dentro de los CSVs.

**Enriquecimiento demográfico:** el `update` con `IdAlumno`, `Genero`, `FechaNac`, etc. ya ocurre dentro de `simular_trayectoria` durante el loop. `snap['regs_ex']` y `snap['regs_mat']` llegan completos — no se requiere post-procesamiento adicional.

---

## 7. `audit_tipos.csv`

Los 500 alumnos en-curso se añaden a `audit_tipos.csv` con la misma estructura (`IdAlumno`, `TipoAlumno`, `TipoEfectivo*`). Permite que `validar.py` verifique distribuciones por tipo sobre la población completa de 1000 alumnos.

---

## 8. Cambios a `validar.py`

### Bloque 4 — Volumen

```python
# nivel_alumno ahora es 1000 filas (500 terminales + 500 en-curso)
if not (900 <= len(df_alm) <= 1100):
    print(f'[WARN] nivel_alumno: {len(df_alm)} filas (esperado ~1000)')
```

### Bloque nuevo — Coherencia de cohortes en-curso

Se distinguen terminales de en-curso por `AñosDesdeIngreso`:
- Terminales: `AñosDesdeIngreso = 2026 − AnioIngreso` (6–11 años)
- En-curso: `AñosDesdeIngreso = snapshot_year` (1–5 años)

```python
en_curso   = df_alm[df_alm['AñosDesdeIngreso'].between(1, 5)]
terminales = df_alm[df_alm['AñosDesdeIngreso'] > 5]

if not (450 <= len(terminales) <= 550):
    print(f'[WARN] Terminales: {len(terminales)} (esperado ~500)')
if not (450 <= len(en_curso) <= 550):
    print(f'[WARN] En-curso: {len(en_curso)} (esperado ~500)')

for year in range(1, 6):
    n = (en_curso['AñosDesdeIngreso'] == year).sum()
    if not (80 <= n <= 120):
        print(f'[WARN] Cohorte año-{year}: {n} alumnos (esperado ~100)')
```

### Anti-leakage check

```python
en_curso_con_fecha = en_curso[en_curso['Fecha'] != '']
assert len(en_curso_con_fecha) == 0, \
    '[ERROR] Alumnos en-curso con fecha de abandono — imposible por diseño'
```

### Bloque 5 — Accuracy baseline

Sin cambios en rangos (80–88%). El dataset `alumno` tendrá ahora ~1000 filas en lugar de 500, lo que mejora el split train/test. Si la accuracy cae por debajo de 80% tras el reentrenamiento, el primer lever es `P_OFFTYPE`.

---

## 9. Volumen objetivo actualizado

| CSV | Filas | Notas |
|---|---|---|
| `nivel_alumno.csv` | ~1000 | 500 terminales + 500 en-curso |
| `nivel_materia.csv` | 40k–60k | terminales completos + parciales en-curso |
| `nivel_examen.csv` | 230k–320k | terminales completos + parciales en-curso |
| `audit_tipos.csv` | ~1000 | todos los alumnos |

Los rangos de materia/examen son orientativos; no se fuerzan si hacerlo viola reglas de negocio.

---

## 10. Edge cases

| Caso | Comportamiento |
|---|---|
| Alumno se gradúa mid-C2 del año N | `snapshot_state = None` → descartado (graduación detectada antes del bloque de captura) |
| Alumno abandona antes del snapshot | `snapshot_state = None` → descartado |
| Cohorte año-5 mayoritariamente regular/malo | Correcto — alumnos en escuela a año 5 sin graduarse son progresores lentos; refleja la realidad |
| `anio_ingreso + N − 1 > 2025` | Imposible: `anio_ingreso ≤ 2020`, `N ≤ 5` → `snapshot_anio ≤ 2024 ≤ 2025` |

---

## 11. Paths que no cambian

- `ft_engineering.py` — los joins sobre `nivel_materia`/`nivel_examen` ya funcionan con registros parciales; los aggregates reflejan el estado al snapshot automáticamente.
- `train_models.py` — consume el output de `ft_engineering` sin cambios.
- `model_deploy.py` — inferencia en producción sin cambios.
