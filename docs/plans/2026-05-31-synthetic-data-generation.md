# Synthetic Data Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the synthetic data generator, fix two leakage bugs in ft_engineering.py, and build a full validation script that confirms 80–88% baseline accuracy on the production feature pipeline.

**Architecture:** Three-layer generative model (latent type → cuatrimestre trajectory with dynamic hazard → per-materia exam simulation). Raw tables are produced by the generator; the three modeling CSVs are produced by the validator calling ft_engineering_procesado() on those raw tables. The production pipeline (train_models.py, ft_engineering.py) is untouched except for the two leakage fixes.

**Tech Stack:** Python 3.10+, pandas, numpy (default_rng), scikit-learn, pathlib. No new dependencies.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `ai-service/data/generar_datasets.py` | Rewrite | Generates raw tables + audit_tipos.csv |
| `ai-service/data/test_generador.py` | Create | Unit tests for generator functions |
| `ai-service/src/feature_engineering/ft_engineering.py` | 2 fixes | LOO corrections for PromedioNotaGeneral |
| `ai-service/data/validar.py` | Create | 5-block validation + baseline accuracy check |
| `ai-service/data/README.md` | Create | Usage instructions |

**Working directory for all commands:** `ai-service/`

---

## Task 1: Fix PromedioNotaGeneral leakage in ft_engineering.py

**Files:**
- Modify: `ai-service/src/feature_engineering/ft_engineering.py`

- [ ] **Step 1: Write unit tests that detect both leakage bugs**

Create `ai-service/data/test_generador.py`:

```python
"""Unit tests for generar_datasets.py and ft_engineering.py fixes."""
import numpy as np
import pandas as pd


def test_fix1_loo_examen_single_exam():
    """Student with 1 exam: LOO PromedioNotaGeneral must be 0, not nota itself."""
    # Simulate state after merging ex_nota_general (includes current exam)
    df = pd.DataFrame({
        'Nota':                [7.0,  8.0,  5.0],
        'PromedioNotaGeneral': [7.5,  7.5,  5.0],   # global avg including self
        '_n_exams':            [2,    2,    1],       # count including self
    })

    df['PromedioNotaGeneral'] = np.where(
        df['_n_exams'] > 1,
        (df['PromedioNotaGeneral'] * df['_n_exams'] - df['Nota']) / (df['_n_exams'] - 1),
        0.0,
    )

    assert df.loc[0, 'PromedioNotaGeneral'] == 8.0   # (7.5*2 - 7) / 1
    assert df.loc[1, 'PromedioNotaGeneral'] == 7.0   # (7.5*2 - 8) / 1
    assert df.loc[2, 'PromedioNotaGeneral'] == 0.0   # only 1 exam → fallback


def test_fix2_loo_materia_all_exams_from_same_subject():
    """Student whose only exams are for the materia being predicted → 0."""
    df = pd.DataFrame({
        'IdAlumno':     ['A', 'A'],
        'Materia':      [140, 141],
        '_global_sum':  [15.0, 15.0],
        '_global_cnt':  [2,    2],
        '_self_sum':    [15.0, 8.0],   # mat 140 owns all; mat 141 owns one
        '_self_cnt':    [2,    1],
    })
    remaining = (df['_global_cnt'] - df['_self_cnt']).clip(lower=1)
    df['PromedioNotaGeneral'] = np.where(
        df['_global_cnt'] > df['_self_cnt'],
        (df['_global_sum'] - df['_self_sum']) / remaining,
        0.0,
    )
    assert df.loc[0, 'PromedioNotaGeneral'] == 0.0   # no other materia exams
    assert df.loc[1, 'PromedioNotaGeneral'] == 7.0   # (15 - 8) / 1


if __name__ == '__main__':
    test_fix1_loo_examen_single_exam()
    test_fix2_loo_materia_all_exams_from_same_subject()
    print('All leakage tests PASSED')
```

- [ ] **Step 2: Run tests to confirm they test the right math (they should pass since they test the fix directly)**

```
cd ai-service
python data/test_generador.py
```
Expected: `All leakage tests PASSED`

- [ ] **Step 3: Apply Fix 1 — LOO correction in examen model**

In `ai-service/src/feature_engineering/ft_engineering.py`, locate the `# -- 0d2)` block (around line 351). Replace:

```python
        ex_nota_general = examen[examen['AusenteExamen'] == 0].groupby('IdAlumno').agg(
            PromedioNotaGeneral   = ('Nota', 'mean'),
            TasaAprobacionGeneral = ('Nota', lambda x: (x >= 4).mean()),
        ).reset_index()
        df = df.merge(ex_nota_general, on='IdAlumno', how='left')
        df[['PromedioNotaGeneral', 'TasaAprobacionGeneral']] = (
            df[['PromedioNotaGeneral', 'TasaAprobacionGeneral']].fillna(0)
        )
```

With:

```python
        ex_nota_general = examen[examen['AusenteExamen'] == 0].groupby('IdAlumno').agg(
            PromedioNotaGeneral   = ('Nota', 'mean'),
            TasaAprobacionGeneral = ('Nota', lambda x: (x >= 4).mean()),
            _n_exams              = ('Nota', 'count'),
        ).reset_index()
        df = df.merge(ex_nota_general, on='IdAlumno', how='left')
        df[['PromedioNotaGeneral', 'TasaAprobacionGeneral', '_n_exams']] = (
            df[['PromedioNotaGeneral', 'TasaAprobacionGeneral', '_n_exams']].fillna(0)
        )
        # LOO: remove current exam's contribution to avoid leakage into target Nota
        df['PromedioNotaGeneral'] = np.where(
            df['_n_exams'] > 1,
            (df['PromedioNotaGeneral'] * df['_n_exams'] - df['Nota']) / (df['_n_exams'] - 1),
            0.0,
        )
        df['TasaAprobacionGeneral'] = np.where(
            df['_n_exams'] > 1,
            (df['TasaAprobacionGeneral'] * df['_n_exams']
             - (df['Nota'] >= 4).astype(int)) / (df['_n_exams'] - 1),
            0.0,
        )
        df = df.drop(columns=['_n_exams'])
```

- [ ] **Step 4: Apply Fix 2 — leave-one-materia-out in materia model**

In `ft_engineering.py`, locate the `# -- 0c) Features desde nivel_examen por IdAlumno` block inside the `elif dataset == 'materia'` branch (around line 225). Replace the entire ex_general computation AND its merge line with:

```python
        # -- 0c) PromedioNotaGeneral por IdAlumno (leave-one-materia-out) -
        # Exclude current materia's exams so failing finals don't encode Recursa target
        _ex_global = ex_presentes_mat.groupby('IdAlumno').agg(
            _global_sum=('Nota', 'sum'),
            _global_cnt=('Nota', 'count'),
        ).reset_index()
        _ex_self = ex_presentes_mat.groupby(['IdAlumno', 'Materia']).agg(
            _self_sum=('Nota', 'sum'),
            _self_cnt=('Nota', 'count'),
        ).reset_index()
```

And replace the merge line `df = df.merge(ex_general[['IdAlumno', 'PromedioNotaGeneral', 'TasaAprobacionGeneral']], on='IdAlumno', how='left')` with:

```python
        df = df.merge(_ex_global, on='IdAlumno', how='left')
        df = df.merge(_ex_self, on=['IdAlumno', 'Materia'], how='left')
        for _c in ['_global_sum', '_global_cnt', '_self_sum', '_self_cnt']:
            df[_c] = df[_c].fillna(0)
        _remaining = (df['_global_cnt'] - df['_self_cnt']).clip(lower=1)
        df['PromedioNotaGeneral'] = np.where(
            df['_global_cnt'] > df['_self_cnt'],
            (df['_global_sum'] - df['_self_sum']) / _remaining,
            0.0,
        )
        df = df.drop(columns=['_global_sum', '_global_cnt', '_self_sum', '_self_cnt'])
```

Also remove the `fill_zero` entry for `PromedioNotaGeneral` and `TasaAprobacionGeneral` from the materia branch (they are now set directly above).

- [ ] **Step 5: Verify ft_engineering still runs without errors**

```
cd ai-service
python -c "
import sys; sys.path.insert(0, 'src')
from feature_engineering import ft_engineering_procesado
X_tr, X_te, y_tr, y_te = ft_engineering_procesado('examen')
print('examen OK, shape:', X_tr.shape)
X_tr, X_te, y_tr, y_te = ft_engineering_procesado('materia')
print('materia OK, shape:', X_tr.shape)
"
```
Expected: prints shapes without errors. If `nivel_examen.csv` doesn't exist yet (first run), skip this step and run after Task 5.

- [ ] **Step 6: Commit**

```bash
git add ai-service/src/feature_engineering/ft_engineering.py ai-service/data/test_generador.py
git commit -m "fix(ft_engineering): remove PromedioNotaGeneral leakage in examen and materia models"
```

---

## Task 2: generar_datasets.py — skeleton, constants, and utility functions

**Files:**
- Create: `ai-service/data/generar_datasets.py`

- [ ] **Step 1: Write tests for utility functions**

Add to `ai-service/data/test_generador.py`:

```python
# ── Imports needed for generator tests ──────────────────────
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))


def test_sigmoid_range():
    from generar_datasets import sigmoid
    assert sigmoid(0.0) == 0.5
    assert 0 < sigmoid(-10) < 0.1
    assert 0.9 < sigmoid(10) < 1.0


def test_calcular_hazard_monotone():
    from generar_datasets import calcular_hazard
    rng = np.random.default_rng(0)
    # More progress → lower hazard (deterministic: use same noise seed)
    rng1 = np.random.default_rng(0)
    rng2 = np.random.default_rng(0)
    # Hack: zero out noise by checking sign of coefficient * difference
    # Instead test expected ordering via many samples
    hazards_high = [calcular_hazard('malo', 0.9, 0.8, 0.0, np.random.default_rng(i)) for i in range(200)]
    hazards_low  = [calcular_hazard('malo', 0.1, 0.8, 0.0, np.random.default_rng(i)) for i in range(200)]
    assert np.mean(hazards_high) < np.mean(hazards_low)


def test_generar_nota_range():
    from generar_datasets import generar_nota
    rng = np.random.default_rng(42)
    notas = [generar_nota('excelente', rng) for _ in range(500)]
    assert all(1.0 <= n <= 10.0 for n in notas)
    assert np.mean(notas) > 6.5   # excelente skews high


def test_generar_nota_overlap():
    from generar_datasets import generar_nota
    rng = np.random.default_rng(42)
    notas_excelente = [generar_nota('excelente', rng) for _ in range(1000)]
    notas_regular   = [generar_nota('regular',   rng) for _ in range(1000)]
    # Some excelente notes should be below 7 (overlap with regular)
    assert any(n < 7.0 for n in notas_excelente)
    # Some regular notes should be above 6.5 (overlap with excelente)
    assert any(n > 6.5 for n in notas_regular)
```

- [ ] **Step 2: Run tests (they will fail — generar_datasets.py doesn't exist yet)**

```
cd ai-service
python -m pytest data/test_generador.py::test_sigmoid_range -v
```
Expected: `ModuleNotFoundError: No module named 'generar_datasets'`

- [ ] **Step 3: Create generar_datasets.py with constants, MATERIAS, and utility functions**

Create `ai-service/data/generar_datasets.py`:

```python
"""
Generador de datasets sintéticos realistas.
Modelo en 3 capas: perfil latente → trayectoria cuatrimestral → exámenes por materia.

Uso:
    cd ai-service
    python data/generar_datasets.py          # genera en data/
    python data/generar_datasets.py --out /ruta/alternativa
"""
import os
import sys
import argparse
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

# ─────────────────────────────────────────────────────────────────────────────
# PARÁMETROS AJUSTABLES
# ─────────────────────────────────────────────────────────────────────────────
N_ALUMNOS    = 500
SEED         = 42
P_OFFTYPE    = 0.12          # prob de comportarse como tipo adyacente por dimensión

B_TIPO       = {'excelente': -4.5, 'regular': -2.0, 'malo': -0.5}
W_PROGRESO   = -3.0
W_ASISTENCIA = -2.0
W_BLOQUEO    = +1.5
SIGMA_HAZARD = 0.3

MU_NOTA      = {'excelente': 8.0, 'regular': 5.5, 'malo': 3.5}
SIGMA_NOTA   = {'excelente': 1.5, 'regular': 1.8, 'malo': 1.5}
MU_ASIST     = {'excelente': 0.93, 'regular': 0.85, 'malo': 0.65}
SIGMA_ASIST  = {'excelente': 0.05, 'regular': 0.08, 'malo': 0.10}

# ─────────────────────────────────────────────────────────────────────────────
# MALLA CURRICULAR  (código: (nombre, tipo, año_plan, [correlativas]))
# ─────────────────────────────────────────────────────────────────────────────
MATERIAS = {
    140: ("Introducción a la Administración de Empresas", "C", 1, []),
    141: ("Sistemas Numéricos",                           "C", 1, []),
    142: ("Análisis Matemático I",                        "A", 1, []),
    143: ("Metodología de la Investigación",              "C", 1, []),
    144: ("Introducción a la Programación",               "C", 1, []),
    145: ("Arquitectura de Computadoras",                 "C", 1, [141]),
    146: ("Álgebra I",                                    "C", 1, []),
    147: ("Paradigmas de Programación",                   "C", 1, [144]),
    148: ("Programación I",                               "C", 1, [144]),
    149: ("Sistemas de Representación",                   "C", 2, []),
    150: ("Física I",                                     "C", 2, []),
    151: ("Cálculo Numérico",                             "C", 2, [142]),
    152: ("Estructura de Datos y Algoritmos",             "A", 2, [144]),
    153: ("Sistemas de Información I",                    "A", 2, []),
    154: ("Álgebra II",                                   "C", 2, [146]),
    155: ("Filosofía",                                    "C", 2, []),
    156: ("Programación II",                              "C", 2, [147, 148]),
    157: ("Teoría de Lenguajes",                          "C", 2, [147, 148]),
    158: ("Análisis Matemático II",                       "C", 2, [142]),
    159: ("Química General",                              "C", 3, []),
    160: ("Física II",                                    "C", 3, [150]),
    161: ("Sistemas Operativos",                          "A", 3, [152]),
    162: ("Sistemas de Información II",                   "A", 3, [153]),
    163: ("Sistemas de Bases de Datos",                   "A", 3, [152]),
    164: ("Probabilidad y Estadística",                   "A", 3, [154]),
    165: ("Programación Avanzada",                        "A", 3, [156]),
    166: ("Teleinformática",                              "C", 3, [145]),
    167: ("Física III",                                   "C", 3, [160]),
    168: ("Inglés I",                                     "C", 3, []),
    169: ("Inglés II",                                    "C", 3, []),
    170: ("Tecnología Informática",                       "C", 4, [161]),
    171: ("Ingeniería del Software",                      "C", 4, [162]),
    172: ("Seminario de Integración Profesional",         "A", 4, [156, 162]),
    173: ("Investigación Operativa",                      "C", 4, [164]),
    174: ("Arquitectura de Redes",                        "C", 4, [166]),
    175: ("Dirección de Proyectos Informáticos",          "C", 4, [162]),
    176: ("Auditoría de Sistemas",                        "C", 4, [162]),
    177: ("Teología",                                     "C", 4, []),
    178: ("Modelos y Simulación",                         "C", 4, [164]),
    179: ("Derecho Informático",                          "C", 5, []),
    180: ("Ética Profesional",                            "C", 5, []),
    181: ("Tecnologías Emergentes",                       "A", 5, [170]),
    182: ("Sistemas Inteligentes",                        "A", 5, [165]),
    183: ("Proyecto Final de Ingeniería en Informática",  "A", 5, [172, 175]),
    184: ("Gestión Ambiental",                            "C", 5, []),
    185: ("Aseguramiento de la Calidad del Software",     "C", 5, [171]),
    186: ("Seguridad Informática",                        "C", 5, [176]),
    187: ("Elementos de Economía",                        "C", 5, []),
}

MATERIAS_BOTTLENECK = {144, 147, 148, 152, 156, 162, 164}

_ADJACENT = {
    'excelente': ['regular'],
    'regular':   ['excelente', 'malo'],
    'malo':      ['regular'],
}

# ─────────────────────────────────────────────────────────────────────────────
# UTILIDADES
# ─────────────────────────────────────────────────────────────────────────────

def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -30, 30)))


def calcular_hazard(tipo_abandono: str, progreso: float, asistencia_acum: float,
                    indice_bloqueo: float, rng) -> float:
    logit = (B_TIPO[tipo_abandono]
             + W_PROGRESO   * progreso
             + W_ASISTENCIA * asistencia_acum
             + W_BLOQUEO    * indice_bloqueo
             + rng.normal(0, SIGMA_HAZARD))
    return float(sigmoid(logit))


def generar_nota(tipo_notas: str, rng, ayuda: bool = False) -> float:
    nota = rng.normal(MU_NOTA[tipo_notas], SIGMA_NOTA[tipo_notas])
    if ayuda:
        nota += float(np.clip(rng.normal(0.3, 0.2), 0.0, 0.8))
    return float(np.clip(nota, 1.0, 10.0))


def generar_asistencia(tipo_asist: str, rng, ayuda: bool = False) -> float:
    asist = rng.normal(MU_ASIST[tipo_asist], SIGMA_ASIST[tipo_asist])
    if ayuda:
        asist += 0.03
    return float(np.clip(asist, 0.3, 1.0))


def calcular_indice_bloqueo_materia(aprobadas: set, materia_code: int) -> float:
    corrs = MATERIAS[materia_code][3]
    if not corrs:
        return 0.0
    return round(sum(1 for c in corrs if c not in aprobadas) / len(corrs), 2)


def calcular_indice_bloqueo_global(aprobadas: set) -> float:
    no_aprobadas = [m for m in MATERIAS if m not in aprobadas]
    if not no_aprobadas:
        return 0.0
    bloqueadas = sum(
        1 for m in no_aprobadas
        if not all(c in aprobadas for c in MATERIAS[m][3])
    )
    return bloqueadas / len(no_aprobadas)


def calcular_promedio_correlativas(notas_aprobadas: dict, materia_code: int) -> float:
    corrs = MATERIAS[materia_code][3]
    vals = [notas_aprobadas[c] for c in corrs if c in notas_aprobadas]
    return round(float(np.mean(vals)), 2) if vals else 0.0


def generar_offtype(tipo: str, rng) -> tuple:
    """Returns (tipo_notas, tipo_asist, tipo_abandono). Each dimension independently off-type."""
    def _maybe_flip(t):
        if rng.random() < P_OFFTYPE:
            adj = _ADJACENT[t]
            return adj[int(rng.integers(0, len(adj)))]
        return t
    return _maybe_flip(tipo), _maybe_flip(tipo), _maybe_flip(tipo)


# ── Fechas ────────────────────────────────────────────────────────────────────

def _fecha(anio, mes, lo, hi, rng):
    return datetime(anio, mes, int(rng.integers(lo, hi + 1)))


def fecha_parcial(tipo_mat, cuatr, anio, instancia, rng):
    if tipo_mat == 'A':
        return _fecha(anio, 6 if instancia == 1 else 11, 10, 20, rng)
    return _fecha(anio, 4 if cuatr == 1 else 9, 10, 25, rng)


def fecha_recuperatorio(tipo_mat, cuatr, anio, instancia, rng):
    if tipo_mat == 'A':
        return _fecha(anio, 6 if instancia == 1 else 11, 21, 28, rng)
    return _fecha(anio, 5 if cuatr == 1 else 10, 5, 20, rng)


def fecha_final(tipo_mat, cuatr, anio, instancia, rng):
    slots = {
        ('A', 0): [(anio, 12, 1, 29), (anio+1, 2, 1, 27), (anio+1, 7, 1, 30)],
        ('C', 1): [(anio, 6, 10, 28), (anio+1, 2, 1, 27), (anio+1, 7, 1, 30)],
        ('C', 2): [(anio, 11, 10, 28), (anio+1, 2, 1, 27), (anio+1, 7, 1, 30)],
    }
    y, m, lo, hi = slots[(tipo_mat, 0 if tipo_mat == 'A' else cuatr)][instancia - 1]
    return _fecha(y, m, lo, hi, rng)
```

- [ ] **Step 4: Run the utility tests**

```
cd ai-service
python -m pytest data/test_generador.py::test_sigmoid_range data/test_generador.py::test_calcular_hazard_monotone data/test_generador.py::test_generar_nota_range data/test_generador.py::test_generar_nota_overlap -v
```
Expected: 4 PASSED

- [ ] **Step 5: Commit**

```bash
git add ai-service/data/generar_datasets.py ai-service/data/test_generador.py
git commit -m "feat(generar): add generator skeleton — constants, MATERIAS, utility functions"
```

---

## Task 3: generar_datasets.py — Capa 1: generar_perfil + off-type

**Files:**
- Modify: `ai-service/data/generar_datasets.py`
- Modify: `ai-service/data/test_generador.py`

- [ ] **Step 1: Add tests for generar_perfil**

Append to `ai-service/data/test_generador.py`:

```python
def test_generar_perfil_structure():
    from generar_datasets import generar_perfil
    rng = np.random.default_rng(0)
    p = generar_perfil('ALU0001', rng)
    required = ['IdAlumno','TipoAlumno','TipoEfectivoNotas','TipoEfectivoAsistencia',
                'TipoEfectivoAbandono','AyudaFinanciera','ColegioTecnico','PromedioColegio',
                'AnioIngreso','FechaNac','Genero']
    for k in required:
        assert k in p, f'Missing key: {k}'
    assert p['AnioIngreso'] in range(2015, 2021)
    assert 'TipoAlumno' not in p or p['TipoAlumno'] in {'excelente','regular','malo'}


def test_ayuda_economica_conditional():
    """P(excelente | ayuda) must be ~0.90 over large sample."""
    from generar_datasets import generar_perfil
    rng = np.random.default_rng(42)
    perfiles = [generar_perfil(f'ALU{i:04d}', rng) for i in range(2000)]
    con_ayuda = [p for p in perfiles if p['AyudaFinanciera'] == 1]
    assert len(con_ayuda) > 0
    pct_excel = sum(1 for p in con_ayuda if p['TipoAlumno'] == 'excelente') / len(con_ayuda)
    assert 0.80 <= pct_excel <= 0.99, f'P(excelente|ayuda) = {pct_excel:.2f}'
    pct_ayuda = len(con_ayuda) / len(perfiles)
    assert 0.10 <= pct_ayuda <= 0.20, f'P(ayuda) = {pct_ayuda:.2f}'


def test_colegio_tecnico_by_tipo():
    """Excelente ~90%, regular ~40%, malo ~1%."""
    from generar_datasets import generar_perfil
    rng = np.random.default_rng(0)
    perfiles = [generar_perfil(f'ALU{i:04d}', rng) for i in range(3000)]
    for tipo, lo, hi in [('excelente', 0.80, 0.99), ('regular', 0.28, 0.55), ('malo', 0.0, 0.06)]:
        grp = [p for p in perfiles if p['TipoAlumno'] == tipo]
        pct = sum(1 for p in grp if p['ColegioTecnico'] == 1) / len(grp)
        assert lo <= pct <= hi, f'{tipo} colegio_tecnico = {pct:.2f}, expected [{lo},{hi}]'
```

- [ ] **Step 2: Run tests — they should fail (function not yet written)**

```
cd ai-service
python -m pytest data/test_generador.py::test_generar_perfil_structure -v
```
Expected: `AttributeError` or `ImportError`

- [ ] **Step 3: Implement generar_perfil**

Append to `ai-service/data/generar_datasets.py` (after the utility functions):

```python
# ─────────────────────────────────────────────────────────────────────────────
# CAPA 1: PERFIL LATENTE
# ─────────────────────────────────────────────────────────────────────────────

def generar_perfil(alumno_id: str, rng) -> dict:
    tipo = rng.choice(['excelente', 'regular', 'malo'], p=[0.25, 0.50, 0.25])

    # Ayuda económica: P(ayuda|excelente)=0.54, P(ayuda|no-excelente)=0.02
    p_ayuda = 0.54 if tipo == 'excelente' else 0.02
    ayuda = int(rng.random() < p_ayuda)

    # Colegio técnico por tipo
    p_tec = {'excelente': 0.90, 'regular': 0.40, 'malo': 0.01}[tipo]
    colegio_tec = int(rng.random() < p_tec)

    # Promedio colegio (Gaussiana suave, sin cortes duros entre tipos)
    mu_pc   = {'excelente': 8.0, 'regular': 6.5, 'malo': 5.5}[tipo]
    sig_pc  = {'excelente': 0.8, 'regular': 1.0, 'malo': 1.2}[tipo]
    lo_pc   = {'excelente': 5.0, 'regular': 4.0, 'malo': 3.0}[tipo]
    hi_pc   = {'excelente': 10.0,'regular': 9.0, 'malo': 8.0}[tipo]
    prom_col = float(np.clip(rng.normal(mu_pc, sig_pc), lo_pc, hi_pc))

    tipo_notas, tipo_asist, tipo_abandono = generar_offtype(tipo, rng)

    anio_ingreso = int(rng.choice([2015, 2016, 2017, 2018, 2019, 2020]))
    edad_ingreso = float(np.clip(rng.normal(19, 1.5), 17, 23))
    fecha_nac    = datetime(anio_ingreso, 3, 1) - timedelta(days=int(edad_ingreso * 365.25))
    genero       = 'Masculino' if rng.random() < 0.9 else 'Femenino'

    return {
        'IdAlumno':              alumno_id,
        'TipoAlumno':            tipo,
        'TipoEfectivoNotas':     tipo_notas,
        'TipoEfectivoAsistencia':tipo_asist,
        'TipoEfectivoAbandono':  tipo_abandono,
        'AyudaFinanciera':       ayuda,
        'ColegioTecnico':        colegio_tec,
        'PromedioColegio':       round(prom_col, 2),
        'AnioIngreso':           anio_ingreso,
        'FechaNac':              fecha_nac.strftime('%d-%m-%Y'),
        'Genero':                genero,
    }
```

- [ ] **Step 4: Run perfil tests**

```
cd ai-service
python -m pytest data/test_generador.py::test_generar_perfil_structure data/test_generador.py::test_ayuda_economica_conditional data/test_generador.py::test_colegio_tecnico_by_tipo -v
```
Expected: 3 PASSED

- [ ] **Step 5: Commit**

```bash
git add ai-service/data/generar_datasets.py ai-service/data/test_generador.py
git commit -m "feat(generar): add Capa 1 — generar_perfil with off-type and ayuda economica"
```

---

## Task 4: generar_datasets.py — Capa 3: simular_cursada

**Files:**
- Modify: `ai-service/data/generar_datasets.py`
- Modify: `ai-service/data/test_generador.py`

- [ ] **Step 1: Add tests that verify business rules R1–R3, R5, and deterministic Recursa**

Append to `ai-service/data/test_generador.py`:

```python
def _run_cursada(tipo_mat, tipo='malo', n=300, seed=0):
    from generar_datasets import simular_cursada
    rng = np.random.default_rng(seed)
    results = []
    for _ in range(n):
        cuatr = 1
        regs, aprobada, nota_f = simular_cursada(
            materia_code=144 if tipo_mat == 'C' else 142,
            tipo_mat=tipo_mat, cuatr=cuatr, anio=2020,
            tipo_notas=tipo, tipo_asist=tipo, ayuda=False,
            aprobadas=set(), notas_aprobadas={},
            n_veces_recursada=0, n_materias_simultaneas=3, rng=rng,
        )
        results.append((regs, aprobada, nota_f))
    return results


def test_r1_parcial_bajo_tiene_recuperatorio():
    """R1: every Parcial < 4 must have a Recuperatorio in same cursada."""
    for tipo_mat in ['C', 'A']:
        for regs, _, _ in _run_cursada(tipo_mat):
            parciales = [r for r in regs if r['TipoExamen'] == 'Parcial']
            for p in parciales:
                if p['Nota'] < 4:
                    recups = [r for r in regs
                              if r['TipoExamen'] == 'Recuperatorio'
                              and r['Instancia'] == p['Instancia']]
                    assert recups, f'Parcial {p["Instancia"]} nota={p["Nota"]:.1f} sin recuperatorio'


def test_r2_final_requiere_asistencia():
    """R2: no Final record when asistencia < 0.75."""
    for tipo_mat in ['C', 'A']:
        for regs, _, _ in _run_cursada(tipo_mat):
            finales = [r for r in regs if r['TipoExamen'] == 'Final']
            for f in finales:
                assert f['Asistencia'] >= 0.75, \
                    f'Final con asistencia={f["Asistencia"]:.2f}'


def test_r3_max_3_finales():
    """R3: at most 3 Final records per cursada."""
    for tipo_mat in ['C', 'A']:
        for regs, _, _ in _run_cursada(tipo_mat):
            n_finales = sum(1 for r in regs if r['TipoExamen'] == 'Final')
            assert n_finales <= 3, f'{n_finales} finales en una cursada'


def test_r5_parciales_por_tipo():
    """R5: tipo C = 1 parcial, tipo A = 2 parciales (when not blocked early)."""
    # Test tipo C: exactly 1 Parcial record
    for regs, _, _ in _run_cursada('C', tipo='excelente'):
        n_p = sum(1 for r in regs if r['TipoExamen'] == 'Parcial')
        assert n_p == 1, f'Tipo C tiene {n_p} parciales'
    # Test tipo A: exactly 2 Parcials (when P1 passes so P2 is generated)
    for regs, aprobada, _ in _run_cursada('A', tipo='excelente'):
        n_p = sum(1 for r in regs if r['TipoExamen'] == 'Parcial')
        if n_p > 0:
            assert n_p <= 2


def test_recursa_deterministic():
    """Recursa=True iff no Final with nota>=4; nota_final is None when not approved."""
    for tipo_mat in ['C', 'A']:
        for regs, aprobada, nota_f in _run_cursada(tipo_mat):
            finales = [r for r in regs if r['TipoExamen'] == 'Final']
            has_passing_final = any(f['Nota'] >= 4 for f in finales)
            assert aprobada == has_passing_final, \
                'aprobada flag inconsistent with Final notas'
            if aprobada:
                assert nota_f is not None and nota_f >= 4
            else:
                assert nota_f is None
```

- [ ] **Step 2: Run tests — they fail (simular_cursada not written)**

```
cd ai-service
python -m pytest data/test_generador.py::test_r1_parcial_bajo_tiene_recuperatorio -v
```
Expected: `ImportError` (simular_cursada not defined yet)

- [ ] **Step 3: Implement simular_cursada**

Append to `ai-service/data/generar_datasets.py`:

```python
# ─────────────────────────────────────────────────────────────────────────────
# CAPA 3: SIMULACIÓN DE EXÁMENES POR MATERIA
# ─────────────────────────────────────────────────────────────────────────────

def simular_cursada(materia_code: int, tipo_mat: str, cuatr: int, anio: int,
                    tipo_notas: str, tipo_asist: str, ayuda: bool,
                    aprobadas: set, notas_aprobadas: dict,
                    n_veces_recursada: int, n_materias_simultaneas: int,
                    rng) -> tuple:
    """
    Simula una cursada completa.
    Returns: (registros_examen: list[dict], aprobada: bool, nota_final: float | None)
    """
    _, _, ano_plan, _ = MATERIAS[materia_code]
    asistencia     = generar_asistencia(tipo_asist, rng, ayuda)
    ind_bloqueo    = calcular_indice_bloqueo_materia(aprobadas, materia_code)
    nota_prom_corr = calcular_promedio_correlativas(notas_aprobadas, materia_code)

    registros = []

    def _reg(tipo_examen, instancia, nota, fecha):
        return {
            'Materia':                    materia_code,
            'Tipo':                       tipo_mat,
            'Cuatrimestre':               0 if tipo_mat == 'A' else cuatr,
            'Anio':                       anio,
            'TipoExamen':                 tipo_examen,
            'Instancia':                  instancia,
            'Asistencia':                 round(asistencia, 2),
            'VecesRecursada':             n_veces_recursada,
            'AñoCarrera':                 ano_plan,
            'NotaPromedioCorrelativas':   nota_prom_corr,
            'MateriasAprobadasHastaMomento': len(aprobadas),
            'CargaSimultanea':            n_materias_simultaneas,
            'IndiceBloqueo':              ind_bloqueo,
            'ExamenRendido':              1,
            'AusenteExamen':              0,
            'Nota':                       round(nota, 2),
            'FechaExamen':                fecha.strftime('%d-%m-%Y'),
        }

    # ── Flujo cuatrimestral (tipo C) ─────────────────────────────────────────
    if tipo_mat == 'C':
        nota_p1 = generar_nota(tipo_notas, rng, ayuda)
        registros.append(_reg('Parcial', 1, nota_p1,
                              fecha_parcial('C', cuatr, anio, 1, rng)))
        if nota_p1 < 4:
            nota_r1 = generar_nota(tipo_notas, rng, ayuda)
            registros.append(_reg('Recuperatorio', 1, nota_r1,
                                  fecha_recuperatorio('C', cuatr, anio, 1, rng)))
            nota_p1_final = nota_r1
        else:
            nota_p1_final = nota_p1

        if nota_p1_final < 4 or asistencia < 0.75:
            return registros, False, None

        for inst in range(1, 4):
            nota_f = generar_nota(tipo_notas, rng, ayuda)
            registros.append(_reg('Final', inst, nota_f,
                                  fecha_final('C', cuatr, anio, inst, rng)))
            if nota_f >= 4:
                return registros, True, round(nota_f, 2)

        return registros, False, None

    # ── Flujo anual (tipo A) ──────────────────────────────────────────────────
    nota_p1 = generar_nota(tipo_notas, rng, ayuda)
    registros.append(_reg('Parcial', 1, nota_p1,
                          fecha_parcial('A', 0, anio, 1, rng)))
    if nota_p1 < 4:
        nota_r1 = generar_nota(tipo_notas, rng, ayuda)
        registros.append(_reg('Recuperatorio', 1, nota_r1,
                              fecha_recuperatorio('A', 0, anio, 1, rng)))
        nota_p1_final = nota_r1
    else:
        nota_p1_final = nota_p1

    if nota_p1_final < 4:
        return registros, False, None

    nota_p2 = generar_nota(tipo_notas, rng, ayuda)
    registros.append(_reg('Parcial', 2, nota_p2,
                          fecha_parcial('A', 0, anio, 2, rng)))
    if nota_p2 < 4:
        nota_r2 = generar_nota(tipo_notas, rng, ayuda)
        registros.append(_reg('Recuperatorio', 2, nota_r2,
                              fecha_recuperatorio('A', 0, anio, 2, rng)))
        nota_p2_final = nota_r2
    else:
        nota_p2_final = nota_p2

    if nota_p2_final < 4 or asistencia < 0.75:
        return registros, False, None

    for inst in range(1, 4):
        nota_f = generar_nota(tipo_notas, rng, ayuda)
        registros.append(_reg('Final', inst, nota_f,
                              fecha_final('A', 0, anio, inst, rng)))
        if nota_f >= 4:
            return registros, True, round(nota_f, 2)

    return registros, False, None
```

- [ ] **Step 4: Run all cursada tests**

```
cd ai-service
python -m pytest data/test_generador.py::test_r1_parcial_bajo_tiene_recuperatorio data/test_generador.py::test_r2_final_requiere_asistencia data/test_generador.py::test_r3_max_3_finales data/test_generador.py::test_r5_parciales_por_tipo data/test_generador.py::test_recursa_deterministic -v
```
Expected: 5 PASSED

- [ ] **Step 5: Commit**

```bash
git add ai-service/data/generar_datasets.py ai-service/data/test_generador.py
git commit -m "feat(generar): add Capa 3 — simular_cursada with enforced business rules"
```

---

## Task 5: generar_datasets.py — Capa 2: simular_trayectoria + main()

**Files:**
- Modify: `ai-service/data/generar_datasets.py`
- Modify: `ai-service/data/test_generador.py`

- [ ] **Step 1: Add integration test for a single student trajectory**

Append to `ai-service/data/test_generador.py`:

```python
def test_simular_trayectoria_closed_state():
    """Every simulated student must end as 'graduado' or 'abandonó', never in-course."""
    from generar_datasets import generar_perfil, simular_trayectoria
    rng = np.random.default_rng(7)
    for i in range(30):
        perfil = generar_perfil(f'ALU{i:04d}', rng)
        regs_ex, regs_mat, estado, _ = simular_trayectoria(perfil, rng)
        assert estado in ('graduado', 'abandonó', 'timeout-abandonó'), \
            f'Estado inválido: {estado}'
        # All exam years must be in range
        if regs_ex:
            anios = [r['Anio'] for r in regs_ex]
            assert max(anios) <= 2025
            assert min(anios) >= perfil['AnioIngreso']


def test_r4_correlativas_respetadas():
    """R4: a materia can only be enrolled when all correlativas are approved."""
    from generar_datasets import generar_perfil, simular_trayectoria, MATERIAS
    rng = np.random.default_rng(3)
    for i in range(20):
        perfil = generar_perfil(f'ALU{i:04d}', rng)
        _, regs_mat, _, _ = simular_trayectoria(perfil, rng)
        # Build: for each (alumno, materia) first cursada year,
        # check all correlativas had a cursada that started earlier with Recursa=0
        aprobadas_por_anio = {}
        for r in sorted(regs_mat, key=lambda x: x['AnioCursada']):
            mat = r['Materia']
            anio = r['AnioCursada']
            corrs = MATERIAS[mat][3]
            for c in corrs:
                assert c in aprobadas_por_anio, \
                    f'Materia {mat} cursada en {anio} pero correlativa {c} no aprobada antes'
            if r['Recursa'] == 0:
                aprobadas_por_anio[mat] = anio


def test_r6_materia_aprobada_no_se_vuelve_a_cursar():
    """R6: once a materia is approved (Recursa=0), it never appears again."""
    from generar_datasets import generar_perfil, simular_trayectoria
    rng = np.random.default_rng(5)
    for i in range(30):
        perfil = generar_perfil(f'ALU{i:04d}', rng)
        _, regs_mat, _, _ = simular_trayectoria(perfil, rng)
        aprobadas = set()
        for r in sorted(regs_mat, key=lambda x: x['AnioCursada']):
            assert r['Materia'] not in aprobadas, \
                f'Materia {r["Materia"]} cursada después de ser aprobada'
            if r['Recursa'] == 0:
                aprobadas.add(r['Materia'])
```

- [ ] **Step 2: Run tests — they fail (simular_trayectoria not written)**

```
cd ai-service
python -m pytest data/test_generador.py::test_simular_trayectoria_closed_state -v
```
Expected: `ImportError`

- [ ] **Step 3: Implement simular_trayectoria**

Append to `ai-service/data/generar_datasets.py`:

```python
# ─────────────────────────────────────────────────────────────────────────────
# CAPA 2: TRAYECTORIA CUATRIMESTRAL
# ─────────────────────────────────────────────────────────────────────────────

def simular_trayectoria(perfil: dict, rng) -> tuple:
    """
    Returns: (registros_examen, registros_materia, estado_final, fecha_abandono)
    estado_final ∈ {'graduado', 'abandonó', 'timeout-abandonó'}
    """
    alumno_id      = perfil['IdAlumno']
    tipo_notas     = perfil['TipoEfectivoNotas']
    tipo_asist     = perfil['TipoEfectivoAsistencia']
    tipo_abandono  = perfil['TipoEfectivoAbandono']
    ayuda          = bool(perfil['AyudaFinanciera'])

    aprobadas:      set  = set()
    notas_aprobadas: dict = {}
    asistencia_hist: list = []
    pendiente_recursa: dict = {}   # materia_code → n_veces_fallida

    registros_examen  = []
    registros_materia = []

    carga_base = {'excelente': 5, 'regular': 4, 'malo': 3}[tipo_notas]

    for anio in range(perfil['AnioIngreso'], 2026):
        for cuatr in [1, 2]:

            # ── Hazard de abandono ──────────────────────────────────────────
            progreso        = len(aprobadas) / 48
            asist_acum      = float(np.mean(asistencia_hist)) if asistencia_hist else 0.5
            ind_bloqueo_g   = calcular_indice_bloqueo_global(aprobadas)

            p_abandon = calcular_hazard(tipo_abandono, progreso, asist_acum, ind_bloqueo_g, rng)

            if rng.random() < p_abandon:
                mes = 6 if cuatr == 1 else 11
                dia = int(rng.integers(1, 28))
                fecha_ab = datetime(anio, mes, dia).strftime('%d-%m-%Y')
                return registros_examen, registros_materia, 'abandonó', fecha_ab

            # ── Seleccionar materias ────────────────────────────────────────
            disponibles = [
                m for m in MATERIAS
                if m not in aprobadas
                and m not in pendiente_recursa
                and all(c in aprobadas for c in MATERIAS[m][3])
                and (MATERIAS[m][1] == 'C' or cuatr == 1)   # anuales solo C1
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
                continue

            n_sim = len(materias_cuatr)

            for mat_code in materias_cuatr:
                tipo_mat  = MATERIAS[mat_code][1]
                n_veces   = pendiente_recursa.get(mat_code, 0)

                regs_ex, aprobada, nota_final = simular_cursada(
                    mat_code, tipo_mat, cuatr, anio,
                    tipo_notas, tipo_asist, ayuda,
                    aprobadas, notas_aprobadas, n_veces, n_sim, rng,
                )

                # Enriquecer con datos demográficos del alumno
                for reg in regs_ex:
                    reg.update({
                        'IdAlumno':       alumno_id,
                        'Genero':         perfil['Genero'],
                        'FechaNac':       perfil['FechaNac'],
                        'AyudaFinanciera':perfil['AyudaFinanciera'],
                        'ColegioTecnico': perfil['ColegioTecnico'],
                        'PromedioColegio':perfil['PromedioColegio'],
                    })
                registros_examen.extend(regs_ex)

                asist_cursada = regs_ex[0]['Asistencia'] if regs_ex else 0.5
                asistencia_hist.append(asist_cursada)

                delay = anio - (perfil['AnioIngreso'] + MATERIAS[mat_code][2] - 1)

                registros_materia.append({
                    'IdAlumno':           alumno_id,
                    'Materia':            mat_code,
                    'Tipo':               tipo_mat,
                    'Cuatrimestre':       0 if tipo_mat == 'A' else cuatr,
                    'AnioCursada':        anio,
                    'FechaNac':           perfil['FechaNac'],
                    'AyudaFinanciera':    perfil['AyudaFinanciera'],
                    'ColegioTecnico':     perfil['ColegioTecnico'],
                    'PromedioColegio':    perfil['PromedioColegio'],
                    'Asistencia':         round(asist_cursada, 2),
                    'Recursa':            0 if aprobada else 1,
                    'AñoCarrera':         MATERIAS[mat_code][2],
                    'DelayRespectoPlan':  delay,
                    'NotaPromedioPrevias':calcular_promedio_correlativas(notas_aprobadas, mat_code),
                    'EsMateriaBottleneck':int(mat_code in MATERIAS_BOTTLENECK),
                    'IndiceBloqueo':      calcular_indice_bloqueo_materia(aprobadas, mat_code),
                })

                if aprobada:
                    aprobadas.add(mat_code)
                    notas_aprobadas[mat_code] = nota_final
                    pendiente_recursa.pop(mat_code, None)
                else:
                    pendiente_recursa[mat_code] = n_veces + 1

            if len(aprobadas) == 48:
                return registros_examen, registros_materia, 'graduado', ''

    return registros_examen, registros_materia, 'timeout-abandonó', ''
```

- [ ] **Step 4: Implement main() / generar_datasets()**

Append to `ai-service/data/generar_datasets.py`:

```python
# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

_EXAMEN_COLS = [
    'IdAlumno','Materia','Tipo','Cuatrimestre','Anio','TipoExamen','Instancia',
    'Genero','FechaNac','AyudaFinanciera','ColegioTecnico','PromedioColegio',
    'Asistencia','VecesRecursada','ExamenRendido','AusenteExamen','Nota',
    'FechaExamen','AñoCarrera','NotaPromedioCorrelativas',
    'MateriasAprobadasHastaMomento','CargaSimultanea','IndiceBloqueo',
]
_MATERIA_COLS = [
    'IdAlumno','Materia','Tipo','Cuatrimestre','AnioCursada','FechaNac',
    'AyudaFinanciera','ColegioTecnico','PromedioColegio','Asistencia','Recursa',
    'AñoCarrera','DelayRespectoPlan','NotaPromedioPrevias',
    'EsMateriaBottleneck','IndiceBloqueo',
]
_ALUMNO_COLS = [
    'IdAlumno','FechaNac','Genero','AyudaFinanciera','ColegioTecnico',
    'PromedioColegio','Fecha','Abandona','AnioIngreso','EstadoFinal',
    'MateriasAprobadas','AñoCarreraActual','TasaProgresion','PrimerAñoCompleto',
    'MateriasRecursadasTotal','AñosDesdeIngreso','IndiceBloqueo',
]


def generar_datasets(output_dir: str = None, n_alumnos: int = N_ALUMNOS) -> tuple:
    if output_dir is None:
        output_dir = os.path.dirname(os.path.abspath(__file__))
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(SEED)

    todos_examenes  = []
    todos_materias  = []
    todos_alumnos   = []
    audit           = []

    print(f'Generando {n_alumnos} alumnos...')
    for i in range(1, n_alumnos + 1):
        alumno_id = f'ALU{i:04d}'
        perfil    = generar_perfil(alumno_id, rng)

        regs_ex, regs_mat, estado, fecha_ab = simular_trayectoria(perfil, rng)

        todos_examenes.extend(regs_ex)
        todos_materias.extend(regs_mat)

        aprobadas_set = {r['Materia'] for r in regs_mat if r['Recursa'] == 0}
        mat_aprobadas = len(aprobadas_set)
        mat_recursadas = sum(1 for r in regs_mat if r['Recursa'] == 1)

        todos_alumnos.append({
            'IdAlumno':             alumno_id,
            'FechaNac':             perfil['FechaNac'],
            'Genero':               perfil['Genero'],
            'AyudaFinanciera':      perfil['AyudaFinanciera'],
            'ColegioTecnico':       perfil['ColegioTecnico'],
            'PromedioColegio':      perfil['PromedioColegio'],
            'Fecha':                fecha_ab,
            'Abandona':             0 if estado == 'graduado' else 1,
            'AnioIngreso':          perfil['AnioIngreso'],
            'EstadoFinal':          estado,
            'MateriasAprobadas':    mat_aprobadas,
            'AñoCarreraActual':     min(int(mat_aprobadas / 10) + 1, 5),
            'TasaProgresion':       round(mat_aprobadas / 48, 3),
            'PrimerAñoCompleto':    int(mat_aprobadas >= 8),
            'MateriasRecursadasTotal': mat_recursadas,
            'AñosDesdeIngreso':     2026 - perfil['AnioIngreso'],
            'IndiceBloqueo':        0.0,
        })

        audit.append({
            'IdAlumno':               alumno_id,
            'TipoAlumno':             perfil['TipoAlumno'],
            'TipoEfectivoNotas':      perfil['TipoEfectivoNotas'],
            'TipoEfectivoAsistencia': perfil['TipoEfectivoAsistencia'],
            'TipoEfectivoAbandono':   perfil['TipoEfectivoAbandono'],
        })

        if i % 50 == 0:
            print(f'  {i}/{n_alumnos} alumnos procesados...')

    df_ex  = pd.DataFrame(todos_examenes)[_EXAMEN_COLS]
    df_mat = pd.DataFrame(todos_materias)[_MATERIA_COLS]
    df_alm = pd.DataFrame(todos_alumnos)[_ALUMNO_COLS]
    df_aud = pd.DataFrame(audit)

    df_ex.to_csv( os.path.join(output_dir, 'nivel_examen.csv'),  index=False)
    df_mat.to_csv(os.path.join(output_dir, 'nivel_materia.csv'), index=False)
    df_alm.to_csv(os.path.join(output_dir, 'nivel_alumno.csv'),  index=False)
    df_aud.to_csv(os.path.join(output_dir, 'audit_tipos.csv'),   index=False)

    n_ex  = len(df_ex)
    n_mat = len(df_mat)
    print(f'\nnivel_examen.csv  : {n_ex:>8,}', end='')
    print('' if 190_000 <= n_ex  <= 260_000 else '  [WARN] fuera del rango orientativo 190k-260k')
    print(f'nivel_materia.csv : {n_mat:>8,}', end='')
    print('' if 32_000  <= n_mat <= 45_000  else '  [WARN] fuera del rango orientativo 32k-45k')
    print(f'nivel_alumno.csv  :      500')
    print(f'audit_tipos.csv   :      500')

    return df_ex, df_mat, df_alm, df_aud


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default=None, help='Output directory (default: same as script)')
    args = parser.parse_args()
    generar_datasets(output_dir=args.out)
```

- [ ] **Step 5: Run trajectory tests**

```
cd ai-service
python -m pytest data/test_generador.py::test_simular_trayectoria_closed_state data/test_generador.py::test_r4_correlativas_respetadas data/test_generador.py::test_r6_materia_aprobada_no_se_vuelve_a_cursar -v
```
Expected: 3 PASSED (may take ~30s on 30 students)

- [ ] **Step 6: Run the full generator end-to-end**

```
cd ai-service
python data/generar_datasets.py
```
Expected: prints progress and volume report. Check for `[WARN]` messages. If exámenes < 190k, increase student activity (raise carga_base or reduce abandonment); if > 260k, lower them. Tweak `carga_base` values in `simular_trayectoria` or `B_TIPO` in constants first.

- [ ] **Step 7: Commit**

```bash
git add ai-service/data/generar_datasets.py ai-service/data/test_generador.py
git commit -m "feat(generar): add Capa 2 + main — full simulation loop and CSV output"
```

---

## Task 6: validar.py — Bloques 1–4 (reglas, distribuciones, coherencia, volumen)

**Files:**
- Create: `ai-service/data/validar.py`

- [ ] **Step 1: Create validar.py with Blocks 1–4**

Create `ai-service/data/validar.py`:

```python
"""
Validador de datasets sintéticos.
Uso:
    cd ai-service
    python data/validar.py
"""
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Para llamar a ft_engineering_procesado desde src/
_SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src')
sys.path.insert(0, _SRC)

_DATA_DIR = os.path.dirname(os.path.abspath(__file__))

ERRORES  = []
WARNINGS = []


def err(msg):  ERRORES.append(msg);  print(f'[ERROR] {msg}')
def warn(msg): WARNINGS.append(msg); print(f'[WARN]  {msg}')
def ok(msg):   print(f'[OK]    {msg}')


# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 1: REGLAS DE NEGOCIO
# ─────────────────────────────────────────────────────────────────────────────

def check_reglas_negocio(df_ex: pd.DataFrame, df_mat: pd.DataFrame):
    print('\n══ BLOQUE 1: Reglas de negocio ══')

    # R1: parcial < 4 → recuperatorio del mismo instancia existe
    parciales_bajos = df_ex[
        (df_ex['TipoExamen'] == 'Parcial') & (df_ex['Nota'] < 4)
    ][['IdAlumno', 'Materia', 'Anio', 'Cuatrimestre', 'Instancia']].copy()

    recups = df_ex[df_ex['TipoExamen'] == 'Recuperatorio'][
        ['IdAlumno', 'Materia', 'Anio', 'Cuatrimestre', 'Instancia']
    ].drop_duplicates()

    merged = parciales_bajos.merge(recups,
                                   on=['IdAlumno','Materia','Anio','Cuatrimestre','Instancia'])
    sin_recup = len(parciales_bajos) - len(merged)
    if sin_recup > 0:
        err(f'R1: {sin_recup} parciales < 4 sin recuperatorio correspondiente')
    else:
        ok(f'R1: todos los parciales < 4 tienen recuperatorio')

    # R2: finales tienen asistencia ≥ 0.75
    finales = df_ex[df_ex['TipoExamen'] == 'Final']
    r2_bad  = finales[finales['Asistencia'] < 0.75]
    if len(r2_bad):
        err(f'R2: {len(r2_bad)} finales con Asistencia < 0.75')
    else:
        ok('R2: todos los finales tienen Asistencia ≥ 0.75')

    # R3: máximo 3 finales por cursada
    n_finales = (df_ex[df_ex['TipoExamen'] == 'Final']
                 .groupby(['IdAlumno','Materia','Anio','Cuatrimestre']).size())
    r3_bad = (n_finales > 3).sum()
    if r3_bad:
        err(f'R3: {r3_bad} cursadas con > 3 finales')
    else:
        ok('R3: ninguna cursada supera 3 finales')

    # R4: correlativas respetadas — verificamos via nivel_materia ordenado por AnioCursada
    from generar_datasets import MATERIAS
    aprobadas_por_alumno: dict = {}
    r4_bad = 0
    for row in df_mat.sort_values(['IdAlumno','AnioCursada']).itertuples(index=False):
        alu = row.IdAlumno
        mat = row.Materia
        corrs = MATERIAS[mat][3]
        apr = aprobadas_por_alumno.get(alu, set())
        for c in corrs:
            if c not in apr:
                r4_bad += 1
                break
        if row.Recursa == 0:
            aprobadas_por_alumno.setdefault(alu, set()).add(mat)
    if r4_bad:
        err(f'R4: {r4_bad} cursadas con correlativa no aprobada previa')
    else:
        ok('R4: correlativas respetadas')

    # R5: tipo A = 2 parciales, tipo C = 1 parcial (por cursada)
    pc = (df_ex[df_ex['TipoExamen'] == 'Parcial']
          .groupby(['IdAlumno','Materia','Anio','Cuatrimestre','Tipo']).size()
          .reset_index(name='n'))
    r5_A = pc[(pc['Tipo'] == 'A') & (pc['n'] != 2)]
    r5_C = pc[(pc['Tipo'] == 'C') & (pc['n'] != 1)]
    if len(r5_A) or len(r5_C):
        err(f'R5: {len(r5_A)} cursadas A con ≠2 parciales, {len(r5_C)} cursadas C con ≠1 parcial')
    else:
        ok('R5: número de parciales correcto por tipo')

    # R6: materia aprobada no se vuelve a cursar
    aprobaciones = (df_mat[df_mat['Recursa'] == 0]
                    [['IdAlumno','Materia','AnioCursada']]
                    .rename(columns={'AnioCursada': 'AnioAprobacion'}))
    cruzado = df_mat.merge(aprobaciones, on=['IdAlumno','Materia'])
    r6_bad  = cruzado[cruzado['AnioCursada'] > cruzado['AnioAprobacion']]
    if len(r6_bad):
        err(f'R6: {len(r6_bad)} cursadas de materias ya aprobadas')
    else:
        ok('R6: ninguna materia aprobada se vuelve a cursar')


# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 2: DISTRIBUCIONES POR GRUPO
# ─────────────────────────────────────────────────────────────────────────────

def check_distribuciones(df_ex, df_mat, df_alm, df_audit):
    print('\n══ BLOQUE 2: Distribuciones por grupo ══')

    merged_alm = df_alm.merge(df_audit[['IdAlumno','TipoAlumno']], on='IdAlumno')
    ex_tipo    = df_ex.merge(df_audit[['IdAlumno','TipoAlumno']], on='IdAlumno')

    specs = {
        'excelente': dict(pct_no_aban=0.93, rec_max=2,  asist=(0.88,1.00), notas=(7.0,9.5), tec=(0.80,0.99)),
        'regular':   dict(pct_no_aban=0.88, rec_max=3,  asist=(0.77,0.93), notas=(4.5,7.0), tec=(0.30,0.55)),
        'malo':      dict(pct_no_aban=0.72, rec_max=999,asist=(0.55,0.75), notas=(2.5,5.0), tec=(0.00,0.05)),
    }

    for tipo, sp in specs.items():
        grp = merged_alm[merged_alm['TipoAlumno'] == tipo]
        n   = len(grp)

        # % no abandona
        pct = (grp['Abandona'] == 0).mean()
        (ok if pct >= sp['pct_no_aban'] else warn)(
            f'{tipo}: % no abandona = {pct:.1%} (umbral ≥{sp["pct_no_aban"]:.0%})')

        # recursadas acumuladas
        if sp['rec_max'] < 999:
            violadores = grp[grp['MateriasRecursadasTotal'] > sp['rec_max']]
            tol = 0.15   # off-type tolerance
            if len(violadores) / n > tol:
                warn(f'{tipo}: {len(violadores)}/{n} alumnos con recursadas > {sp["rec_max"]}')
            else:
                ok(f'{tipo}: recursadas acumuladas OK')

        # media notas
        mn = ex_tipo[ex_tipo['TipoAlumno'] == tipo]['Nota'].mean()
        lo, hi = sp['notas']
        (ok if lo <= mn <= hi else warn)(f'{tipo}: media nota = {mn:.2f} (esperado [{lo},{hi}])')

        # media asistencia (desde nivel_materia)
        mat_tipo = df_mat.merge(df_audit[['IdAlumno','TipoAlumno']], on='IdAlumno')
        ma = mat_tipo[mat_tipo['TipoAlumno'] == tipo]['Asistencia'].mean()
        lo, hi = sp['asist']
        (ok if lo <= ma <= hi else warn)(f'{tipo}: media asistencia = {ma:.3f} (esperado [{lo},{hi}])')

        # % colegio técnico
        pct_tec = grp['ColegioTecnico'].mean()
        lo, hi = sp['tec']
        (ok if lo <= pct_tec <= hi else warn)(
            f'{tipo}: % colegio técnico = {pct_tec:.1%} (esperado [{lo:.0%},{hi:.0%}])')

    # P(excelente | ayuda)
    con_ayuda = merged_alm[merged_alm['AyudaFinanciera'] == 1]
    if len(con_ayuda):
        p = con_ayuda['TipoAlumno'].eq('excelente').mean()
        (ok if 0.80 <= p <= 0.99 else warn)(f'P(excelente|ayuda) = {p:.2f} (esperado [0.80,0.99])')


# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 3: COHERENCIA TEMPORAL
# ─────────────────────────────────────────────────────────────────────────────

def check_temporal(df_ex, df_alm):
    print('\n══ BLOQUE 3: Coherencia temporal ══')

    bad_ingreso = df_alm[~df_alm['AnioIngreso'].isin(range(2015, 2021))]
    if len(bad_ingreso):
        err(f'{len(bad_ingreso)} alumnos con AnioIngreso fuera de 2015-2020')
    else:
        ok('AnioIngreso: todos en [2015, 2020]')

    if df_alm['Abandona'].isnull().any():
        err('Existen alumnos sin estado Abandona definido')
    else:
        ok('Abandona: todos los 500 alumnos tienen estado definido')

    max_anio = df_ex['Anio'].max()
    if max_anio > 2025:
        err(f'Examen con Anio = {max_anio} > 2025')
    else:
        ok(f'Anio máximo en nivel_examen: {max_anio}')


# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 4: VOLUMEN
# ─────────────────────────────────────────────────────────────────────────────

def check_volumen(df_ex, df_mat, df_alm):
    print('\n══ BLOQUE 4: Volumen ══')
    n_ex  = len(df_ex)
    n_mat = len(df_mat)
    n_grad = (df_alm['Abandona'] == 0).sum()
    n_aban = (df_alm['Abandona'] == 1).sum()

    rng_ex  = '✓' if 190_000 <= n_ex  <= 260_000 else '[WARN fuera de 190k-260k]'
    rng_mat = '✓' if 32_000  <= n_mat <= 45_000  else '[WARN fuera de 32k-45k]'

    print(f'  nivel_examen.csv  : {n_ex:>8,}  {rng_ex}')
    print(f'  nivel_materia.csv : {n_mat:>8,}  {rng_mat}')
    print(f'  Graduados         : {n_grad:>8,}')
    print(f'  Abandonados       : {n_aban:>8,}')

    if not (190_000 <= n_ex  <= 260_000): warn(f'Exámenes {n_ex:,} fuera del rango 190k-260k')
    if not (32_000  <= n_mat <= 45_000):  warn(f'Cursadas {n_mat:,} fuera del rango 32k-45k')
```

- [ ] **Step 2: Run Blocks 1–4**

```
cd ai-service
python -c "
import pandas as pd, sys, os
sys.path.insert(0, 'data')
from validar import check_reglas_negocio, check_distribuciones, check_temporal, check_volumen
df_ex  = pd.read_csv('data/nivel_examen.csv')
df_mat = pd.read_csv('data/nivel_materia.csv')
df_alm = pd.read_csv('data/nivel_alumno.csv')
df_aud = pd.read_csv('data/audit_tipos.csv')
check_reglas_negocio(df_ex, df_mat)
check_distribuciones(df_ex, df_mat, df_alm, df_aud)
check_temporal(df_ex, df_alm)
check_volumen(df_ex, df_mat, df_alm)
"
```
Expected: all R1–R6 print `[OK]`. Distribution checks may show `[WARN]` — note them, tune in Task 7.

- [ ] **Step 3: Commit**

```bash
git add ai-service/data/validar.py
git commit -m "feat(validar): add Blocks 1-4 — business rules, distributions, temporal, volume"
```

---

## Task 7: validar.py — Bloque 5 (accuracy baseline) + tuning

**Files:**
- Modify: `ai-service/data/validar.py`

- [ ] **Step 1: Add Block 5 to validar.py**

Append to `ai-service/data/validar.py`:

```python
# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 5: ACCURACY BASELINE + ANTI-LEAKAGE
# ─────────────────────────────────────────────────────────────────────────────

def check_accuracy_baseline():
    from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
    from sklearn.metrics import accuracy_score, r2_score, mean_absolute_error
    from feature_engineering import ft_engineering_procesado

    print('\n══ BLOQUE 5: Accuracy baseline ══')

    # Generar los 3 datasets de modelado usando ft_engineering.py real
    print('  Generando dataset_alumno  via ft_engineering_procesado("alumno")...')
    Xtr_a, Xte_a, ytr_a, yte_a = ft_engineering_procesado('alumno')
    print('  Generando dataset_materia via ft_engineering_procesado("materia")...')
    Xtr_m, Xte_m, ytr_m, yte_m = ft_engineering_procesado('materia')
    print('  Generando dataset_examen  via ft_engineering_procesado("examen")...')
    Xtr_e, Xte_e, ytr_e, yte_e = ft_engineering_procesado('examen')

    # Guardar CSVs de modelado
    import pandas as pd
    pd.concat([Xtr_a.assign(split='train'), Xte_a.assign(split='test')]).to_csv(
        os.path.join(_DATA_DIR, 'dataset_alumno.csv'), index=False)
    pd.concat([Xtr_m.assign(split='train'), Xte_m.assign(split='test')]).to_csv(
        os.path.join(_DATA_DIR, 'dataset_materia.csv'), index=False)
    pd.concat([Xtr_e.assign(split='train'), Xte_e.assign(split='test')]).to_csv(
        os.path.join(_DATA_DIR, 'dataset_examen.csv'), index=False)

    # Assert: TipoAlumno no está en ningún dataset de modelado
    for nombre, X in [('alumno', Xtr_a), ('materia', Xtr_m), ('examen', Xtr_e)]:
        assert 'TipoAlumno' not in X.columns, \
            f'[BUG] TipoAlumno encontrado en dataset_{nombre} — LEAKAGE!'
        ok(f'Anti-leakage: TipoAlumno ausente en dataset_{nombre}')

    # Modelos baseline
    def _check_range(val, lo, hi, label, tipo='acc'):
        sym = '✓' if lo <= val <= hi else '✗'
        print(f'  {sym} {label}: {val:.3f}  (esperado [{lo},{hi}])')
        if val > hi:
            warn(f'{label} = {val:.3f} > {hi} — subir P_OFFTYPE o SIGMA_NOTA en generar_datasets.py')
        elif val < lo:
            warn(f'{label} = {val:.3f} < {lo} — bajar P_OFFTYPE o SIGMA_NOTA en generar_datasets.py')

    clf_a = DecisionTreeClassifier(max_depth=4, random_state=42)
    clf_a.fit(Xtr_a, ytr_a)
    acc_a = accuracy_score(yte_a, clf_a.predict(Xte_a))
    _check_range(acc_a, 0.80, 0.88, 'Abandono accuracy')

    clf_m = DecisionTreeClassifier(max_depth=4, random_state=42)
    clf_m.fit(Xtr_m, ytr_m)
    acc_m = accuracy_score(yte_m, clf_m.predict(Xte_m))
    _check_range(acc_m, 0.80, 0.88, 'Recursa  accuracy')

    reg_e = DecisionTreeRegressor(max_depth=4, random_state=42)
    reg_e.fit(Xtr_e, ytr_e)
    yhat_e = reg_e.predict(Xte_e)
    _check_range(r2_score(yte_e, yhat_e),          0.30, 0.65, 'Prox nota R²',  'r2')
    _check_range(mean_absolute_error(yte_e, yhat_e),1.0,  2.0, 'Prox nota MAE', 'mae')


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    df_ex  = pd.read_csv(os.path.join(_DATA_DIR, 'nivel_examen.csv'))
    df_mat = pd.read_csv(os.path.join(_DATA_DIR, 'nivel_materia.csv'))
    df_alm = pd.read_csv(os.path.join(_DATA_DIR, 'nivel_alumno.csv'))
    df_aud = pd.read_csv(os.path.join(_DATA_DIR, 'audit_tipos.csv'))

    check_reglas_negocio(df_ex, df_mat)
    check_distribuciones(df_ex, df_mat, df_alm, df_aud)
    check_temporal(df_ex, df_alm)
    check_volumen(df_ex, df_mat, df_alm)
    check_accuracy_baseline()

    print(f'\n══ REPORTE FINAL ══')
    print(f'  Errores  : {len(ERRORES)}')
    print(f'  Warnings : {len(WARNINGS)}')
    for e in ERRORES:
        print(f'  [ERROR] {e}')
    if not ERRORES:
        print('  ✓ Todos los checks críticos pasaron.')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run the full validation**

```
cd ai-service
python data/validar.py
```
Expected: all R1–R6 `[OK]`, accuracy in 80–88%, R² in 0.30–0.65.

- [ ] **Step 3: Tune if accuracy is out of range (only if needed)**

If **accuracy > 88%** (too separable): open `generar_datasets.py`, increase `P_OFFTYPE` (e.g., `0.12` → `0.18`) or increase `SIGMA_NOTA` (e.g., `1.5` → `2.0` for excelente), then re-run generator and validator:
```
cd ai-service
python data/generar_datasets.py && python data/validar.py
```

If **accuracy < 80%** (signal too weak): decrease `P_OFFTYPE` (e.g., `0.12` → `0.07`) or decrease `SIGMA_NOTA`, then re-run.

Repeat until both classifiers fall in [0.80, 0.88] and R² in [0.30, 0.65].

- [ ] **Step 4: Commit**

```bash
git add ai-service/data/validar.py ai-service/data/dataset_alumno.csv \
        ai-service/data/dataset_materia.csv ai-service/data/dataset_examen.csv \
        ai-service/data/nivel_examen.csv ai-service/data/nivel_materia.csv \
        ai-service/data/nivel_alumno.csv ai-service/data/audit_tipos.csv
git commit -m "feat(validar): add Block 5 — accuracy baseline, anti-leakage assert, save modeling CSVs"
```

---

## Task 8: README.md

**Files:**
- Create: `ai-service/data/README.md`

- [ ] **Step 1: Create README**

Create `ai-service/data/README.md`:

```markdown
# Datasets sintéticos — Ingeniería en Informática

Genera y valida los datasets sintéticos para los modelos de predicción académica.

## Requisitos

```
pip install pandas numpy scikit-learn
```
(No hay dependencias adicionales más allá de lo que ya usa el proyecto.)

## Generar los datos

```bash
cd ai-service
python data/generar_datasets.py
```

Produce:
- `data/nivel_examen.csv` — ~190k–260k registros de exámenes
- `data/nivel_materia.csv` — ~32k–45k registros de cursadas
- `data/nivel_alumno.csv` — 500 alumnos con estado final (graduado/abandonó)
- `data/audit_tipos.csv` — mapeo IdAlumno → TipoAlumno (solo para validación, no para entrenamiento)

## Validar y generar datasets de modelado

```bash
cd ai-service
python data/validar.py
```

Corre 5 bloques:
1. Reglas de negocio (asserts duros)
2. Distribuciones por grupo
3. Coherencia temporal
4. Volumen (reporte, no falla)
5. Accuracy baseline con `DecisionTree(max_depth=4)` sobre los features reales de producción

Produce además:
- `data/dataset_alumno.csv` — features + target Abandona (output de ft_engineering)
- `data/dataset_materia.csv` — features + target Recursa
- `data/dataset_examen.csv` — features + target Nota

La accuracy esperada de los clasificadores baseline es **80–88%**. Si está fuera de rango,
el validador sugiere qué parámetros ajustar en `generar_datasets.py`.

## Parámetros ajustables

En `generar_datasets.py`, bloque `PARÁMETROS AJUSTABLES`:

| Parámetro | Default | Efecto |
|-----------|---------|--------|
| `P_OFFTYPE` | 0.12 | Sube → menos separabilidad → baja accuracy |
| `SIGMA_NOTA` | 1.5–1.8 | Sube → más solapamiento → baja accuracy |
| `B_TIPO` | ver código | Ajusta tasa base de abandono por grupo |

## Cómo usar los datasets en el pipeline de producción

Los modelos de producción se entrenan con:
```bash
cd ai-service
python src/train_models.py
```
Ese script usa `nivel_examen.csv`, `nivel_materia.csv`, `nivel_alumno.csv` vía `ft_engineering.py`.
Los `dataset_*.csv` son para validación y experimentación; no reemplazan el pipeline.
```

- [ ] **Step 2: Commit**

```bash
git add ai-service/data/README.md
git commit -m "docs(ai-service/data): add README with usage, parameters, and pipeline description"
```

---

## Checklist de cobertura (self-review)

| Requisito del spec | Tarea que lo implementa |
|---|---|
| Modelo 3 capas (latente → cuatrimestre → exámenes) | Task 2, 3, 4, 5 |
| Off-type P_OFFTYPE | Task 3 (generar_offtype) |
| Hazard dinámico por cuatrimestre | Task 5 (simular_trayectoria) |
| Distribuciones solapadas (no cortes duros) | Task 2 (generar_nota, SIGMA_NOTA) |
| Ayuda económica via condicional Bayes | Task 3 (generar_perfil) |
| Colegio técnico 90/40/1% | Task 3 |
| Recursa determinístico desde exámenes | Task 4 (simular_cursada) |
| R1–R6 business rules | Task 4 (enforced) + Task 6 (validated) |
| Estados cerrados (graduado / abandonó) | Task 5 |
| AnioIngreso 2015–2020 | Task 3 |
| TipoAlumno NO en nivel_alumno.csv | Task 5 (main — columnas explícitas) |
| audit_tipos.csv | Task 5 |
| Fix 1 ft_engineering (examen LOO) | Task 1 |
| Fix 2 ft_engineering (materia LOMO) | Task 1 |
| 3 datasets de modelado via ft_engineering | Task 7 |
| Accuracy 80–88% | Task 7 (+ tuning loop) |
| Assert TipoAlumno no en modeling CSVs | Task 7 |
| Volumen 190k-260k / 32k-45k | Task 5 (warning), Task 6 (report) |
| Parámetros ajustables con constantes | Task 2 (top of file) |
| README | Task 8 |
| seed=42, solo pandas/numpy/sklearn | All tasks |
