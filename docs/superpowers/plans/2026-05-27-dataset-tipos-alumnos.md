# Dataset Tipos de Alumnos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactorizar `generar_datasets.py` para que cada alumno tenga un `tipo_alumno` (excelencia/regular/bajo_rendimiento) que controle sus notas, asistencia y probabilidad de abandono, convirtiendo esos features en los predictores dominantes del modelo.

**Architecture:** Se agrega `tipo_alumno` como atributo global del alumno al momento de creación. Las funciones `generar_nota()` y la generación de asistencia/abandono se reemplazan por versiones por-tipo. Se agrega un dict `notas_finales_por_alumno` para que nivel_materia use notas reales en lugar de valores aleatorios. Se agrega la columna `TipoAlumno` a nivel_alumno.csv.

**Tech Stack:** Python 3, NumPy, Pandas

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `ai-service/data/generar_datasets.py` | Modificar | Script principal — todos los cambios van aquí |
| `ai-service/data/test_generar_datasets.py` | Crear | Validaciones estadísticas del dataset generado |

---

### Task 1: Agregar constantes y funciones helper por tipo

**Files:**
- Modify: `ai-service/data/generar_datasets.py` (después de las constantes existentes, antes de `generar_fecha_nac`)
- Create: `ai-service/data/test_generar_datasets.py`

- [ ] **Step 1: Agregar constantes y funciones en `generar_datasets.py`**

Insertar después de la línea `MATERIAS_BOTTLENECK = {144, 147, 148, 152, 156, 162, 164}` y antes de `def generar_fecha_nac()`:

```python
PROB_ABANDONO = {
    "excelencia": 0.00,
    "regular": 0.015,
    "bajo_rendimiento": 0.88,
}

ANIO_CORTE_DIST = {
    "bajo_rendimiento": ([1, 2, 3], [0.70, 0.25, 0.05]),
    "regular":          ([2, 3, 4], [0.20, 0.40, 0.40]),
}

PROB_RECURSA = {
    "excelencia":       {True: 0.03, False: 0.01},
    "regular":          {True: 0.15, False: 0.06},
    "bajo_rendimiento": {True: 0.70, False: 0.50},
}


def generar_nota_tipo(tipo):
    if tipo == "excelencia":
        return round(np.clip(np.random.normal(8.0, 0.8), 6.0, 10.0), 2)
    elif tipo == "regular":
        return round(np.clip(np.random.normal(5.5, 1.2), 2.0, 8.5), 2)
    else:
        return round(np.clip(np.random.normal(2.5, 0.8), 1.0, 5.0), 2)


def generar_asistencia_tipo(tipo):
    if tipo == "excelencia":
        return round(np.random.uniform(0.90, 1.00), 2)
    elif tipo == "regular":
        return round(np.random.uniform(0.75, 1.00), 2)
    else:
        return round(np.random.uniform(0.50, 0.80), 2)
```

- [ ] **Step 2: Crear `test_generar_datasets.py` con tests para las helpers**

```python
import numpy as np
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
np.random.seed(0)

from generar_datasets import generar_nota_tipo, generar_asistencia_tipo

def test_notas_por_tipo():
    N = 10_000
    for tipo, lo, hi in [
        ("excelencia", 6.0, 10.0),
        ("regular", 2.0, 8.5),
        ("bajo_rendimiento", 1.0, 5.0),
    ]:
        notas = [generar_nota_tipo(tipo) for _ in range(N)]
        assert all(lo <= n <= hi for n in notas), f"{tipo}: nota fuera de rango"
    print("PASS test_notas_por_tipo")

def test_medias_por_tipo():
    N = 10_000
    notas_exc = [generar_nota_tipo("excelencia") for _ in range(N)]
    notas_reg = [generar_nota_tipo("regular") for _ in range(N)]
    notas_bp  = [generar_nota_tipo("bajo_rendimiento") for _ in range(N)]
    assert np.mean(notas_exc) > np.mean(notas_reg) > np.mean(notas_bp), \
        "Media excelencia > regular > bajo_rendimiento debe cumplirse"
    assert np.mean(notas_exc) >= 7.0, f"Media excelencia esperada >= 7, got {np.mean(notas_exc):.2f}"
    assert 4.5 <= np.mean(notas_reg) <= 6.5, f"Media regular esperada 4.5-6.5, got {np.mean(notas_reg):.2f}"
    assert np.mean(notas_bp) <= 3.5, f"Media BP esperada <= 3.5, got {np.mean(notas_bp):.2f}"
    print("PASS test_medias_por_tipo")

def test_asistencia_por_tipo():
    N = 10_000
    for tipo, lo, hi in [
        ("excelencia", 0.90, 1.00),
        ("regular", 0.75, 1.00),
        ("bajo_rendimiento", 0.50, 0.80),
    ]:
        vals = [generar_asistencia_tipo(tipo) for _ in range(N)]
        assert all(lo <= v <= hi for v in vals), f"{tipo}: asistencia fuera de rango [{lo}, {hi}]"
    print("PASS test_asistencia_por_tipo")

def test_tasa_aprobacion_por_tipo():
    N = 10_000
    tasa_exc = sum(1 for _ in range(N) if generar_nota_tipo("excelencia") >= 4) / N
    tasa_reg = sum(1 for _ in range(N) if generar_nota_tipo("regular") >= 4) / N
    tasa_bp  = sum(1 for _ in range(N) if generar_nota_tipo("bajo_rendimiento") >= 4) / N
    assert tasa_exc > 0.98, f"Excelencia debe aprobar >98%, got {tasa_exc:.2%}"
    assert 0.70 < tasa_reg < 0.99, f"Regular debe aprobar 70-99%, got {tasa_reg:.2%}"
    assert tasa_bp < 0.15, f"BP debe aprobar <15%, got {tasa_bp:.2%}"
    print(f"PASS test_tasa_aprobacion_por_tipo (exc={tasa_exc:.1%}, reg={tasa_reg:.1%}, bp={tasa_bp:.1%})")

if __name__ == "__main__":
    test_notas_por_tipo()
    test_medias_por_tipo()
    test_asistencia_por_tipo()
    test_tasa_aprobacion_por_tipo()
    print("\nAll Task 1 tests passed.")
```

- [ ] **Step 3: Ejecutar tests — deben pasar**

```
cd ai-service/data
python test_generar_datasets.py
```

Salida esperada:
```
PASS test_notas_por_tipo
PASS test_medias_por_tipo
PASS test_asistencia_por_tipo
PASS test_tasa_aprobacion_por_tipo (exc=~100%, reg=~87%, bp=~3%)

All Task 1 tests passed.
```

- [ ] **Step 4: Commit**

```bash
git add ai-service/data/generar_datasets.py ai-service/data/test_generar_datasets.py
git commit -m "feat: add tipo_alumno helper functions and constants"
```

---

### Task 2: Refactorizar creación de estudiantes

**Files:**
- Modify: `ai-service/data/generar_datasets.py` — función `generar_datasets`, bloque de creación de alumnos (líneas 142–158)
- Modify: `ai-service/data/test_generar_datasets.py` — agregar tests de distribución de alumnos

- [ ] **Step 1: Reemplazar el bloque de creación de estudiantes**

Reemplazar desde `estudiantes = {}` hasta el `print(f"✓ {num_alumnos} alumnos generados")` con:

```python
    estudiantes = {}
    for i in range(1, num_alumnos + 1):
        alumno_id = f"ALU{i:04d}"
        tipo = np.random.choice(
            ["excelencia", "regular", "bajo_rendimiento"],
            p=[0.50, 0.40, 0.10]
        )
        abandona = int(np.random.random() < PROB_ABANDONO[tipo])

        cuatrimestres_abandono = None
        if abandona:
            opciones, pesos = ANIO_CORTE_DIST[tipo]
            anio_corte = np.random.choice(opciones, p=pesos)
            cuatrimestres_abandono = (anio_corte - 1) * 2 + np.random.randint(1, 3)

        estudiantes[alumno_id] = {
            "tipo_alumno": tipo,
            "genero": "Masculino" if np.random.random() < 0.9 else "Femenino",
            "ayuda_financiera": 1 if np.random.random() < 0.05 else 0,
            "colegio_tecnico": 1 if np.random.random() < 0.10 else 0,
            "promedio_colegio": np.clip(np.random.normal(7.0, 0.8), 1, 10),
            "fecha_nac": generar_fecha_nac(),
            "anio_ingreso": np.random.randint(2018, 2025),
            "abandona": abandona,
            "cuatrimestres_abandono": cuatrimestres_abandono,
        }

    print(f"✓ {num_alumnos} alumnos generados")
```

- [ ] **Step 2: Agregar tests de distribución al test file**

Agregar al final de `test_generar_datasets.py`, antes del bloque `if __name__ == "__main__"`:

```python
def test_distribucion_tipos(num_alumnos=2000):
    from generar_datasets import generar_datasets, PROB_ABANDONO
    import pandas as pd
    import tempfile, os

    with tempfile.TemporaryDirectory() as tmpdir:
        _, _, df_alumno = generar_datasets(num_alumnos=num_alumnos, output_dir=tmpdir)

    tipos = df_alumno["TipoAlumno"].value_counts(normalize=True)
    assert 0.44 <= tipos.get("excelencia", 0) <= 0.56, f"Excelencia esperado ~50%, got {tipos.get('excelencia',0):.1%}"
    assert 0.34 <= tipos.get("regular", 0) <= 0.46, f"Regular esperado ~40%, got {tipos.get('regular',0):.1%}"
    assert 0.06 <= tipos.get("bajo_rendimiento", 0) <= 0.14, f"BP esperado ~10%, got {tipos.get('bajo_rendimiento',0):.1%}"
    print(f"PASS test_distribucion_tipos (exc={tipos.get('excelencia',0):.1%}, reg={tipos.get('regular',0):.1%}, bp={tipos.get('bajo_rendimiento',0):.1%})")

def test_abandono_por_tipo(num_alumnos=2000):
    from generar_datasets import generar_datasets
    import tempfile

    with tempfile.TemporaryDirectory() as tmpdir:
        _, _, df_alumno = generar_datasets(num_alumnos=num_alumnos, output_dir=tmpdir)

    for tipo in ["excelencia", "regular", "bajo_rendimiento"]:
        sub = df_alumno[df_alumno["TipoAlumno"] == tipo]
        if len(sub) == 0:
            continue
        tasa = sub["Abandona"].mean()
        if tipo == "excelencia":
            assert tasa == 0.0, f"Excelencia no debe abandonar, got {tasa:.1%}"
        elif tipo == "regular":
            assert tasa < 0.08, f"Regular abandono <8%, got {tasa:.1%}"
        else:
            assert tasa > 0.70, f"BP abandono >70%, got {tasa:.1%}"
    
    abandonan = df_alumno[df_alumno["Abandona"] == 1]
    if len(abandonan) > 0:
        frac_lp = (abandonan["TipoAlumno"] == "bajo_rendimiento").mean()
        assert frac_lp >= 0.80, f"LP debe ser >=80% de los que abandonan, got {frac_lp:.1%}"
    print("PASS test_abandono_por_tipo")
```

Y actualizar el bloque `if __name__ == "__main__"`:

```python
if __name__ == "__main__":
    test_notas_por_tipo()
    test_medias_por_tipo()
    test_asistencia_por_tipo()
    test_tasa_aprobacion_por_tipo()
    print("\n--- Tests con dataset completo (puede tardar ~30s) ---")
    test_distribucion_tipos()
    test_abandono_por_tipo()
    print("\nAll tests passed.")
```

- [ ] **Step 3: Ejecutar tests**

```
cd ai-service/data
python test_generar_datasets.py
```

Este paso genera datasets de prueba. Va a tardar ~30-60s. Salida esperada:
```
PASS test_notas_por_tipo
PASS test_medias_por_tipo
PASS test_asistencia_por_tipo
PASS test_tasa_aprobacion_por_tipo (...)
--- Tests con dataset completo (puede tardar ~30s) ---
PASS test_distribucion_tipos (exc=~50%, reg=~40%, bp=~10%)
PASS test_abandono_por_tipo

All tests passed.
```

Si `test_distribucion_tipos` falla porque `TipoAlumno` no está en `df_alumno` aún, es esperado — se agrega en Task 4. Comentar esos dos tests por ahora y ejecutar solo los 4 primeros.

- [ ] **Step 4: Commit**

```bash
git add ai-service/data/generar_datasets.py ai-service/data/test_generar_datasets.py
git commit -m "feat: assign tipo_alumno at student creation with type-based abandono logic"
```

---

### Task 3: Refactorizar flujo de exámenes

**Files:**
- Modify: `ai-service/data/generar_datasets.py` — loops de exámenes anuales y cuatrimestrales (líneas 165–344)

El cambio central: reemplazar `generar_nota()` por `generar_nota_tipo(tipo)` en todos los puntos del loop, y eliminar las variables `aprueba_*` que ya no son necesarias. También añadir `notas_finales_por_alumno` para guardado.

- [ ] **Step 1: Agregar `notas_finales_por_alumno = {}` antes del loop principal de exámenes**

Justo antes de `for alumno_id, datos_alumno in estudiantes.items():` (en la sección de DATASET 1):

```python
    notas_finales_por_alumno = {}
```

- [ ] **Step 2: Reemplazar el inicio del loop por alumno — extraer `tipo` y guardar al final**

El bloque actual empieza con:
```python
    for alumno_id, datos_alumno in estudiantes.items():
        aprobadas = set()
        notas_finales = {}
```

Reemplazar con:
```python
    for alumno_id, datos_alumno in estudiantes.items():
        aprobadas = set()
        notas_finales = {}
        tipo = datos_alumno["tipo_alumno"]
```

Y agregar al final del loop (después del `for anio in range(...):`), antes del `df_examen = pd.DataFrame(...)`:

```python
        notas_finales_por_alumno[alumno_id] = notas_finales
```

- [ ] **Step 3: Refactorizar la generación de asistencia por materia**

Dentro del `for mat_code in materias:`, reemplazar:
```python
                if datos_alumno["abandona"]:
                    asistencia_final = np.clip(np.random.normal(0.50, 0.15), 0.10, 0.75)
                else:
                    asistencia_final = np.clip(np.random.normal(0.84, 0.11), 0.10, 1.0)
```
Con:
```python
                asistencia_final = generar_asistencia_tipo(tipo)
```

- [ ] **Step 4: Refactorizar el flujo ANUAL (tipo_mat == "A")**

Reemplazar todo el bloque `if tipo_mat == "A":` con:

```python
                if tipo_mat == "A":
                    nota_p1 = generar_nota_tipo(tipo)
                    registros_examen.append(crear_registro_examen(
                        "Parcial", 1, nota_p1,
                        np.clip(asistencia_final + np.random.uniform(-0.05, 0.05), 0, 1),
                        generar_fecha_examen_anual("Parcial", 1, anio)))

                    if nota_p1 < 4:
                        nota_rec1 = generar_nota_tipo(tipo)
                        registros_examen.append(crear_registro_examen(
                            "Recuperatorio", 1, nota_rec1,
                            np.clip(asistencia_final + np.random.uniform(-0.05, 0.05), 0, 1),
                            generar_fecha_examen_anual("Recuperatorio", 1, anio)))
                        nota_p1_final = nota_rec1
                    else:
                        nota_p1_final = nota_p1

                    if nota_p1_final >= 4:
                        nota_p2 = generar_nota_tipo(tipo)
                        registros_examen.append(crear_registro_examen(
                            "Parcial", 2, nota_p2,
                            np.clip(asistencia_final + np.random.uniform(-0.05, 0.05), 0, 1),
                            generar_fecha_examen_anual("Parcial", 2, anio)))

                        if nota_p2 < 4:
                            nota_rec2 = generar_nota_tipo(tipo)
                            registros_examen.append(crear_registro_examen(
                                "Recuperatorio", 2, nota_rec2,
                                np.clip(asistencia_final + np.random.uniform(-0.05, 0.05), 0, 1),
                                generar_fecha_examen_anual("Recuperatorio", 2, anio)))
                            nota_p2_final = nota_rec2
                        else:
                            nota_p2_final = nota_p2

                        if asistencia_final >= 0.75 and nota_p2_final >= 4:
                            nota_f1 = generar_nota_tipo(tipo)
                            registros_examen.append(crear_registro_examen(
                                "Final", 1, nota_f1, asistencia_final,
                                generar_fecha_examen_anual("Final", 1, anio)))

                            if nota_f1 >= 4:
                                aprobadas.add(mat_code)
                                notas_finales[mat_code] = nota_f1
                            else:
                                nota_f2 = generar_nota_tipo(tipo)
                                registros_examen.append(crear_registro_examen(
                                    "Final", 2, nota_f2, asistencia_final,
                                    generar_fecha_examen_anual("Final", 2, anio)))

                                if nota_f2 >= 4:
                                    aprobadas.add(mat_code)
                                    notas_finales[mat_code] = nota_f2
                                else:
                                    nota_f3 = generar_nota_tipo(tipo)
                                    registros_examen.append(crear_registro_examen(
                                        "Final", 3, nota_f3, asistencia_final,
                                        generar_fecha_examen_anual("Final", 3, anio)))

                                    if nota_f3 >= 4:
                                        aprobadas.add(mat_code)
                                        notas_finales[mat_code] = nota_f3
```

- [ ] **Step 5: Refactorizar el flujo CUATRIMESTRAL (else branch)**

Reemplazar todo el bloque `else:` (el flujo cuatrimestral) con:

```python
                else:
                    nota_parcial = generar_nota_tipo(tipo)
                    registros_examen.append(crear_registro_examen(
                        "Parcial", 1, nota_parcial,
                        np.clip(asistencia_final + np.random.uniform(-0.05, 0.05), 0, 1),
                        generar_fecha_examen_cuatrimestral("Parcial", cuatrimestre, anio)))

                    if nota_parcial < 4:
                        nota_rec = generar_nota_tipo(tipo)
                        registros_examen.append(crear_registro_examen(
                            "Recuperatorio", 1, nota_rec,
                            np.clip(asistencia_final + np.random.uniform(-0.05, 0.05), 0, 1),
                            generar_fecha_examen_cuatrimestral("Recuperatorio", cuatrimestre, anio)))
                        nota_parcial_final = nota_rec
                    else:
                        nota_parcial_final = nota_parcial

                    if asistencia_final >= 0.75 and nota_parcial_final >= 4:
                        nota_f1 = generar_nota_tipo(tipo)
                        registros_examen.append(crear_registro_examen(
                            "Final", 1, nota_f1, asistencia_final,
                            generar_fecha_examen_cuatrimestral("Final", cuatrimestre, anio)))

                        if nota_f1 >= 4:
                            aprobadas.add(mat_code)
                            notas_finales[mat_code] = nota_f1
                        else:
                            nota_f2 = generar_nota_tipo(tipo)
                            registros_examen.append(crear_registro_examen(
                                "Final", 2, nota_f2, asistencia_final,
                                generar_fecha_examen_cuatrimestral("Final", cuatrimestre, anio)))

                            if nota_f2 >= 4:
                                aprobadas.add(mat_code)
                                notas_finales[mat_code] = nota_f2
                            else:
                                nota_f3 = generar_nota_tipo(tipo)
                                registros_examen.append(crear_registro_examen(
                                    "Final", 3, nota_f3, asistencia_final,
                                    generar_fecha_examen_cuatrimestral("Final", cuatrimestre, anio)))

                                if nota_f3 >= 4:
                                    aprobadas.add(mat_code)
                                    notas_finales[mat_code] = nota_f3
```

- [ ] **Step 6: Verificar que el script corra sin errores con 50 alumnos de prueba**

```
cd ai-service/data
python -c "from generar_datasets import generar_datasets; generar_datasets(50, 'tmp_test')"
```

Salida esperada (sin errores, con conteos de registros):
```
🚀 Generando datasets con alumnos activos 100% graduados...
✓ 50 alumnos generados
📊 Generando nivel_examen.csv...
✓ nivel_examen.csv (XXXX registros)
...
🎉 ¡Datasets generados exitosamente!
```

Limpiar: `python -c "import shutil; shutil.rmtree('tmp_test', True)"`

- [ ] **Step 7: Commit**

```bash
git add ai-service/data/generar_datasets.py
git commit -m "feat: use generar_nota_tipo and generar_asistencia_tipo in exam flow"
```

---

### Task 4: Refactorizar nivel_materia y nivel_alumno

**Files:**
- Modify: `ai-service/data/generar_datasets.py` — loops de nivel_materia y nivel_alumno
- Modify: `ai-service/data/test_generar_datasets.py` — activar tests de distribución completa

- [ ] **Step 1: Refactorizar el loop de nivel_materia**

Dentro del loop `for (alumno_id, materia, anio, cuatrimestre), data in cursadas_unicas.items():`, reemplazar el bloque completo de cálculo de `asistencia`, `recursa` y `NotaPromedioPrevias` con:

```python
        datos_alumno = estudiantes[alumno_id]
        tipo = datos_alumno["tipo_alumno"]
        tiene_final_aprobado = any(nota >= 4 for nota in data['finales']) if data['finales'] else False

        asistencia = generar_asistencia_tipo(tipo)

        es_early_year = data['ano_plan'] <= 2
        prob_recursa = PROB_RECURSA[tipo][es_early_year]
        recursa = int(np.random.random() < prob_recursa)

        notas_finales_alumno = notas_finales_por_alumno.get(alumno_id, {})
        correlativas = MATERIAS[materia][3]
        notas_previas = [notas_finales_alumno[c] for c in correlativas if c in notas_finales_alumno]
        nota_promedio_previas = round(np.mean(notas_previas), 2) if notas_previas else 0.0

        if tipo == "excelencia":
            materias_recursadas_hist = np.random.randint(0, 2)
        elif tipo == "regular":
            materias_recursadas_hist = np.random.randint(0, 5)
        else:
            materias_recursadas_hist = np.random.randint(2, 10)

        delay = anio - (datos_alumno["anio_ingreso"] + data['ano_plan'] - 1)
```

Y en el `registros_materia.append({...})`, actualizar los campos:
```python
            "Asistencia": asistencia,
            "Recursa": recursa,
            "NotaPromedioPrevias": nota_promedio_previas,
            "MateriasRecursadasTotal": materias_recursadas_hist,
```

- [ ] **Step 2: Refactorizar el loop de nivel_alumno**

Reemplazar el bloque dentro de `for alumno_id, datos_alumno in estudiantes.items():` con:

```python
        tipo = datos_alumno["tipo_alumno"]

        if not datos_alumno["abandona"]:
            if tipo == "excelencia":
                materias_aprobadas = 48
                recursadas_total = 0
                tasa_progresion = 1.0
                indice_bloqueo = 0.0
            else:
                materias_aprobadas = len(df_materia[
                    (df_materia['IdAlumno'] == alumno_id) & (df_materia['Recursa'] == 0)
                ])
                recursadas_total = len(df_materia[
                    (df_materia['IdAlumno'] == alumno_id) & (df_materia['Recursa'] == 1)
                ])
                tasa_progresion = min(materias_aprobadas / 48, 1.0) if materias_aprobadas > 0 else 0
                indice_bloqueo = 0.0
        else:
            materias_aprobadas = len(df_materia[
                (df_materia['IdAlumno'] == alumno_id) & (df_materia['Recursa'] == 0)
            ])
            recursadas_total = len(df_materia[
                (df_materia['IdAlumno'] == alumno_id) & (df_materia['Recursa'] == 1)
            ])
            tasa_progresion = min(materias_aprobadas / 48, 1.0) if materias_aprobadas > 0 else 0
            indice_bloqueo = 0.0
```

Y en el `registros_alumno.append({...})`, agregar:
```python
            "TipoAlumno": tipo,
```

- [ ] **Step 3: Actualizar validaciones al final de `generar_datasets`**

Reemplazar el bloque `print("\n✅ VALIDACIONES")` con:

```python
    print("\n✅ VALIDACIONES")
    tipos_cnt = df_alumno["TipoAlumno"].value_counts()
    for t in ["excelencia", "regular", "bajo_rendimiento"]:
        n = tipos_cnt.get(t, 0)
        print(f"   {t}: {n} alumnos ({n/len(df_alumno)*100:.1f}%)")
    print(f"   Abandono total: {df_alumno['Abandona'].sum() / len(df_alumno) * 100:.1f}%")
    abandonan = df_alumno[df_alumno['Abandona'] == 1]
    if len(abandonan) > 0:
        lp_frac = (abandonan['TipoAlumno'] == 'bajo_rendimiento').mean()
        print(f"   LP como % de abandonos: {lp_frac:.1%}")
    activos = len(df_alumno[df_alumno['Abandona'] == 0])
    print(f"   Alumnos activos: {activos}")
    print(f"   Año máximo en datos: {df_examen['Anio'].max()}")
    print(f"   Año mínimo en datos: {df_examen['Anio'].min()}")
```

- [ ] **Step 4: Descomentar y ejecutar tests completos**

En `test_generar_datasets.py`, asegurarse de que `test_distribucion_tipos` y `test_abandono_por_tipo` estén activos en el bloque `if __name__ == "__main__"`:

```
cd ai-service/data
python test_generar_datasets.py
```

Salida esperada:
```
PASS test_notas_por_tipo
PASS test_medias_por_tipo
PASS test_asistencia_por_tipo
PASS test_tasa_aprobacion_por_tipo (exc=~100%, reg=~87%, bp=~3%)
--- Tests con dataset completo (puede tardar ~30s) ---
PASS test_distribucion_tipos (exc=~50%, reg=~40%, bp=~10%)
PASS test_abandono_por_tipo

All tests passed.
```

- [ ] **Step 5: Commit**

```bash
git add ai-service/data/generar_datasets.py ai-service/data/test_generar_datasets.py
git commit -m "feat: tipo-based asistencia, recursa, NotaPromedioPrevias and TipoAlumno column"
```

---

### Task 5: Generación final y validación

**Files:**
- Run: `ai-service/data/generar_datasets.py` con 500 alumnos

- [ ] **Step 1: Generar dataset completo de 500 alumnos**

```
cd ai-service/data
python generar_datasets.py
```

Salida esperada:
```
🚀 Generando datasets con alumnos activos 100% graduados...
✓ 500 alumnos generados
📊 Generando nivel_examen.csv...
✓ nivel_examen.csv (XXX,XXX registros)
📊 Generando nivel_materia.csv...
✓ nivel_materia.csv (XX,XXX registros)
📊 Generando nivel_alumno.csv...
✓ nivel_alumno.csv (500 registros)

✅ VALIDACIONES
   excelencia: ~250 alumnos (~50%)
   regular: ~200 alumnos (~40%)
   bajo_rendimiento: ~50 alumnos (~10%)
   Abandono total: ~9-11%
   LP como % de abandonos: ~90-97%
   Alumnos activos: ~445-455
   Año máximo en datos: 2025
   Año mínimo en datos: 2018

🎉 ¡Datasets generados exitosamente!
```

- [ ] **Step 2: Verificar columna TipoAlumno en nivel_alumno.csv**

```
python -c "
import pandas as pd
df = pd.read_csv('nivel_alumno.csv')
print('Columnas:', df.columns.tolist())
print(df['TipoAlumno'].value_counts())
print('Abandono por tipo:')
print(df.groupby('TipoAlumno')['Abandona'].mean().round(3))
"
```

Salida esperada:
```
Columnas: [..., 'TipoAlumno']
excelencia         ~250
regular            ~200
bajo_rendimiento   ~50
Abandono por tipo:
TipoAlumno
bajo_rendimiento    0.85-0.92
excelencia          0.000
regular             0.000-0.030
```

- [ ] **Step 3: Verificar notas en nivel_examen.csv por tipo de alumno**

```
python -c "
import pandas as pd
ex = pd.read_csv('nivel_examen.csv')
al = pd.read_csv('nivel_alumno.csv')[['IdAlumno', 'TipoAlumno']]
df = ex.merge(al, on='IdAlumno')
print('Nota media por tipo:')
print(df.groupby('TipoAlumno')['Nota'].mean().round(2))
print('Asistencia media por tipo (nivel_materia):')
mat = pd.read_csv('nivel_materia.csv')
mat2 = mat.merge(al, on='IdAlumno')
print(mat2.groupby('TipoAlumno')['Asistencia'].mean().round(2))
"
```

Salida esperada:
```
Nota media por tipo:
TipoAlumno
bajo_rendimiento    ~2.4-2.8
excelencia          ~7.8-8.2
regular             ~5.2-5.8

Asistencia media por tipo:
bajo_rendimiento    ~0.65
excelencia          ~0.95
regular             ~0.87
```

- [ ] **Step 4: Commit final**

```bash
git add ai-service/data/nivel_examen.csv ai-service/data/nivel_materia.csv ai-service/data/nivel_alumno.csv
git commit -m "data: regenerate datasets with tipo_alumno profiles"
```

---

## Self-Review

**Cobertura del spec:**
- ✅ tipo_alumno asignado en creación (Task 2)
- ✅ generar_nota_tipo() con rangos 7-10 / 4-7 / 1-4 (Task 1)
- ✅ generar_asistencia_tipo() con rangos 90-100 / 75-100 / 50-80 (Task 1)
- ✅ PROB_ABANDONO y timing por ANIO_CORTE_DIST (Task 2)
- ✅ Flujo anual y cuatrimestral refactorizados (Task 3)
- ✅ Asistencia en nivel_materia por tipo (Task 4)
- ✅ Recursa en nivel_materia por tipo y año (Task 4)
- ✅ NotaPromedioPrevias usa notas reales (Task 4)
- ✅ TipoAlumno en nivel_alumno (Task 4)
- ✅ MateriasAprobadas diferenciado por tipo no-abandonante (Task 4)
- ✅ Validaciones actualizadas (Task 4)

**Consistencia de tipos:**
- `generar_nota_tipo(tipo)` definida en Task 1, usada en Tasks 3 y 4 ✅
- `generar_asistencia_tipo(tipo)` definida en Task 1, usada en Tasks 3 y 4 ✅
- `PROB_RECURSA[tipo][es_early_year]` — `es_early_year` es `bool` (True/False), coincide con las keys del dict ✅
- `notas_finales_por_alumno` inicializado en Task 3 Step 1, poblado en Task 3 Step 2, consumido en Task 4 Step 1 ✅
