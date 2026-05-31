# Diseño: Generación de Datasets Sintéticos

**Fecha:** 2026-05-31  
**Scope:** `ai-service/data/`  
**Estado:** Aprobado — pendiente de implementación

---

## 1. Objetivo

Generar tres datasets sintéticos realistas que alimentan los modelos de predicción académica (abandono, recursa, próxima nota). El generador produce tablas crudas; los datasets de modelado son el output de correr `ft_engineering.py` sobre esas tablas. La accuracy de los clasificadores baseline debe caer en 80–88% (no 99%) para que los modelos de producción tengan margen de mejora real.

---

## 2. Archivos que se crean o modifican

| Archivo | Acción |
|---|---|
| `ai-service/data/generar_datasets.py` | Rewrite completo |
| `ai-service/src/feature_engineering/ft_engineering.py` | Bug fix (2 leakages) |
| `ai-service/data/validar.py` | Crear nuevo |
| `ai-service/data/README.md` | Crear nuevo |

### Archivos de salida

```
ai-service/data/
├── nivel_examen.csv          ← tabla cruda
├── nivel_materia.csv         ← tabla cruda
├── nivel_alumno.csv          ← tabla cruda
├── audit_tipos.csv           ← solo para validación (IdAlumno → TipoAlumno)
├── dataset_alumno.csv        ← output de ft_engineering('alumno')
├── dataset_materia.csv       ← output de ft_engineering('materia')
└── dataset_examen.csv        ← output de ft_engineering('examen')
```

### Flujo de ejecución

```
python generar_datasets.py
    → nivel_examen.csv, nivel_materia.csv, nivel_alumno.csv, audit_tipos.csv

python validar.py
    → [internamente] llama ft_engineering_procesado() tres veces
    → dataset_alumno.csv, dataset_materia.csv, dataset_examen.csv
    → valida reglas de negocio + distribuciones + accuracy baseline
    → imprime reporte final
```

El pipeline de producción (`train_models.py`, `ft_engineering.py`, inferencia) no se toca, salvo los dos bug fixes de leakage detallados en §7.

---

## 3. Modelo generativo en capas

### 3.1 Capa 1 — Perfil latente del alumno

Cada alumno nace con atributos fijos. `TipoAlumno` es el único atributo que **no aparece en ningún CSV de entrenamiento**; va solo a `audit_tipos.csv`.

**Tipo latente:**
- Excelente: 25% / Regular: 50% / Malo: 25%

**Ayuda económica** — generada respetando la condicional:
- P(excelente | ayuda) = 0.90, P(ayuda) = 0.15
- Por Bayes: P(ayuda | excelente) = **0.54**, P(ayuda | regular o malo) = **0.02**
- Verificación: 0.25×0.54 + 0.75×0.02 = 0.15 ✓

**Colegio técnico** (por tipo):
- Excelente: 90% / Regular: 40% / Malo: 1%

**Promedio colegio** (Gaussiana suave, sin cortes duros):
- Excelente: N(8.0, 0.8) clamp [5, 10]
- Regular:   N(6.5, 1.0) clamp [4, 9]
- Malo:      N(5.5, 1.2) clamp [3, 8]

**Año de ingreso:** uniforme en {2015, 2016, 2017, 2018, 2019, 2020}

**Off-type** (`P_OFFTYPE = 0.12`, constante ajustable):  
Por cada dimensión `{notas, asistencia, abandono_base}`, cada alumno tiene P_OFFTYPE de comportarse como el tipo adyacente. El tipo adyacente:
- Excelente ↔ Regular
- Regular ↔ Excelente o Malo (50/50)
- Malo ↔ Regular

Esto rompe la separabilidad perfecta entre grupos y es el mecanismo principal para bajar la accuracy del baseline de 99% a 80–88%.

---

### 3.2 Capa 2 — Trayectoria cuatrimestral

La simulación corre en pasos `(año, cuatrimestre)` con `cuatrimestre ∈ {1, 2}` y `año ∈ {anio_ingreso, ..., 2025}`. En cada paso:

#### Hazard de abandono

```
logit_t = b_tipo_eff
         + w1 × progreso_t          (w1 = -3.0)
         + w2 × asistencia_acum_t   (w2 = -2.0)
         + w3 × indice_bloqueo_t    (w3 = +1.5)
         + ε,  ε ~ N(0, 0.3)

p_abandon_t = sigmoid(logit_t)
```

**Baselines por tipo** (sin off-type):

| Tipo | b_tipo |
|---|---|
| Excelente | -4.5 |
| Regular   | -2.0 |
| Malo      |  -0.5 |

Definiciones de los términos:
- `progreso_t` = materias aprobadas acumuladas / 48
- `asistencia_acum_t` = media de asistencia de todas las cursadas hasta `t`
- `indice_bloqueo_t` = fracción de materias no disponibles por correlativas incumplidas sobre todas las materias no aprobadas

Los coeficientes (`b_tipo`, `w1`, `w2`, `w3`) son constantes ajustables en el módulo. Si el validador reporta accuracy fuera de rango, el primer lever es `P_OFFTYPE`; el segundo, `w3`.

#### Selección de materias

- Pool: materias no aprobadas con correlativas satisfechas
- Anuales (`A`): solo inician en C1 (duran el año completo)
- Cuatrimestrales (`C`): pueden iniciar en C1 o C2
- Carga por cuatrimestre: Excelente ~5, Regular ~4, Malo ~2–3 (con varianza ±1)
- Materias pendientes de recursa se priorizan antes de tomar nuevas

#### Estados terminales

| Estado | Condición |
|---|---|
| Graduado | 48 materias aprobadas |
| Abandonó | Hazard disparado en cuatrimestre `t` |
| Timeout-abandonó | Llega a (2025, C2) sin graduarse |

No hay alumnos "en curso". Todos los 500 terminan en uno de estos dos estados.

---

### 3.3 Capa 3 — Simulación de exámenes por materia

#### Distribuciones de notas y asistencia

Gaussianas con σ amplio para garantizar solapamiento entre grupos vecinos:

| Tipo efectivo | μ notas | σ notas | μ asistencia | σ asistencia |
|---|---|---|---|---|
| Excelente | 8.0 | 1.5 | 0.93 | 0.05 |
| Regular   | 5.5 | 1.8 | 0.85 | 0.08 |
| Malo      | 3.5 | 1.5 | 0.65 | 0.10 |

Notas: clamp [1, 10]. Asistencia: clamp [0.3, 1.0].  
No se usan cortes duros por tipo (un regular puede sacar 7, un excelente puede sacar 6).

**Ajuste por ayuda económica:**
- nota_final += clip(N(+0.3, 0.2), 0.0, 0.8)
- asistencia += 0.03 (clamp a 1.0)

#### Flujo anual (tipo `A`, 2 parciales)

```
Parcial1 → [si nota < 4: Recuperatorio1]
    si P1_final ≥ 4:
        Parcial2 → [si nota < 4: Recuperatorio2]
            si P2_final ≥ 4 AND asistencia ≥ 0.75:
                Final1 → [si nota < 4: Final2 → [si nota < 4: Final3]]
```

#### Flujo cuatrimestral (tipo `C`, 1 parcial)

```
Parcial1 → [si nota < 4: Recuperatorio1]
    si P1_final ≥ 4 AND asistencia ≥ 0.75:
        Final1 → [si nota < 4: Final2 → [si nota < 4: Final3]]
```

#### Recursa — derivada deterministicamente

`Recursa = 1` si y solo si la cursada terminó sin aprobar ningún final (nota_final < 4 en todos los intentos, o no se llegó a rendir final). No hay tirada aleatoria post-hoc. Esta es la diferencia fundamental con el generador anterior.

---

## 4. Reglas de negocio (invariantes duras)

Todas chequeadas por `validar.py` con asserts explícitos:

| # | Regla |
|---|---|
| R1 | Todo parcial o recuperatorio con nota < 4 tiene su recuperatorio correspondiente en la misma cursada |
| R2 | Para rendir final: asistencia ≥ 0.75 y al menos un parcial aprobado (≥ 4) en esa cursada |
| R3 | Máximo 3 intentos de final por cursada |
| R4 | Una materia solo se cursa si todas sus correlativas están aprobadas |
| R5 | Materias tipo "A" tienen exactamente 2 parciales; tipo "C", exactamente 1 |
| R6 | Una materia aprobada no vuelve a cursarse |

---

## 5. Esquemas de columnas

### `nivel_examen.csv`

| Columna | Tipo | Descripción |
|---|---|---|
| IdAlumno | str | ALU0001…ALU0500 |
| Materia | int | 140–187 |
| Tipo | str | "A" / "C" |
| Cuatrimestre | int | 0 (anuales) / 1 / 2 |
| Anio | int | año calendario del examen |
| TipoExamen | str | "Parcial" / "Recuperatorio" / "Final" |
| Instancia | int | 1, 2 o 3 |
| Genero | str | "Masculino" / "Femenino" |
| FechaNac | str | dd-mm-yyyy |
| AyudaFinanciera | int | 0/1 |
| ColegioTecnico | int | 0/1 |
| PromedioColegio | float | |
| Asistencia | float | asistencia de esa cursada |
| VecesRecursada | int | cursadas previas fallidas de esta materia |
| ExamenRendido | int | 1 siempre (ausentes no se escriben) |
| AusenteExamen | int | 0 siempre |
| Nota | float | 1.0–10.0 |
| FechaExamen | str | dd-mm-yyyy |
| AñoCarrera | int | año del plan (1–5) |
| NotaPromedioCorrelativas | float | promedio de notas aprobadas en correlativas |
| MateriasAprobadasHastaMomento | int | acumulado as-of |
| CargaSimultanea | int | materias cursadas este cuatrimestre |
| IndiceBloqueo | float | fracción de correlativas no aprobadas |

> `TipoAlumno` no aparece en esta tabla.

### `nivel_materia.csv`

| Columna | Tipo | Descripción |
|---|---|---|
| IdAlumno | str | |
| Materia | int | |
| Tipo | str | "A" / "C" |
| Cuatrimestre | int | 0 / 1 / 2 |
| AnioCursada | int | |
| FechaNac | str | |
| AyudaFinanciera | int | 0/1 |
| ColegioTecnico | int | 0/1 |
| PromedioColegio | float | |
| Asistencia | float | asistencia de esa cursada |
| Recursa | int | 0/1 — determinístico de los exámenes |
| AñoCarrera | int | año del plan (1–5) |
| DelayRespectoPlan | int | AnioCursada − (anio_ingreso + AñoCarrera − 1) |
| NotaPromedioPrevias | float | promedio de notas finales de correlativas |
| EsMateriaBottleneck | int | 0/1 |
| IndiceBloqueo | float | |

> `MateriasRecursadasTotal` eliminado (era `np.random.randint` — valor falso). El conteo real se deriva de los datos en ft_engineering.

### `nivel_alumno.csv`

| Columna | Tipo | Descripción |
|---|---|---|
| IdAlumno | str | |
| FechaNac | str | |
| Genero | str | |
| AyudaFinanciera | int | |
| ColegioTecnico | int | |
| PromedioColegio | float | |
| Fecha | str | fecha de abandono o "" si graduó — ft_engineering la dropea |
| Abandona | int | 0/1 — target del modelo alumno |
| AnioIngreso | int | |
| EstadoFinal | str | "graduado" / "abandonó" |
| MateriasAprobadas | int | acumulado final |
| AñoCarreraActual | int | |
| TasaProgresion | float | MateriasAprobadas / 48 |
| PrimerAñoCompleto | int | 1 si MateriasAprobadas ≥ 8 |
| MateriasRecursadasTotal | int | conteo real derivado de la simulación |
| AñosDesdeIngreso | int | |
| IndiceBloqueo | float | al momento del corte |

> `TipoAlumno` no aparece en esta tabla.

### `audit_tipos.csv`

| Columna | Tipo | Descripción |
|---|---|---|
| IdAlumno | str | |
| TipoAlumno | str | excelente / regular / malo |
| TipoEfectivoNotas | str | tipo usado para distribución de notas (puede diferir por off-type) |
| TipoEfectivoAsistencia | str | tipo usado para distribución de asistencia |
| TipoEfectivoAbandono | str | tipo usado para hazard baseline |

---

## 6. Volumen objetivo

| Métrica | Rango orientativo |
|---|---|
| Exámenes (nivel_examen) | 190k–260k |
| Cursadas (nivel_materia) | 32k–45k |
| Alumnos | 500 (fijo) |

El script reporta los totales reales y avisa si quedan fuera del rango, pero no falla por eso. Los rangos no se fuerzan si hacerlo violaría las reglas de negocio.

---

## 7. Fixes de `ft_engineering.py`

### Fix 1 — `PromedioNotaGeneral` en modelo `examen` (leakage directo)

**Problema:** el aggregate sobre `nivel_examen` incluye la nota del examen actual, que es el target. Infla R² artificialmente.

**Fix — leave-one-out correction**, aplicada después del merge de `ex_nota_general`:

```python
_n = ex_nota_general.set_index('IdAlumno')['CantExamenesRendidos']
df['_n'] = df['IdAlumno'].map(_n)
df['PromedioNotaGeneral'] = np.where(
    df['_n'] > 1,
    (df['PromedioNotaGeneral'] * df['_n'] - df['Nota']) / (df['_n'] - 1),
    0.0
)
df['TasaAprobacionGeneral'] = np.where(
    df['_n'] > 1,
    (df['TasaAprobacionGeneral'] * df['_n'] - (df['Nota'] >= 4).astype(int)) / (df['_n'] - 1),
    0.0
)
df = df.drop(columns=['_n'])
```

### Fix 2 — `PromedioNotaGeneral` en modelo `materia` (leakage indirecto)

**Problema:** `PromedioNotaGeneral` incluye los exámenes de la cursada predicha. Para `Recursa=1`, las notas bajas de los finales fallidos bajan el promedio global, codificando el outcome indirectamente.

**Fix — leave-one-materia-out**, reemplazando el join de `ex_general` en el bloque `materia`:

```python
ex_self = ex_presentes_mat.groupby(['IdAlumno', 'Materia']).agg(
    _self_sum=('Nota', 'sum'),
    _self_cnt=('Nota', 'count'),
).reset_index()

ex_general_loo = ex_general.merge(ex_self, on=['IdAlumno', 'Materia'], how='left')
ex_general_loo['_self_sum'] = ex_general_loo['_self_sum'].fillna(0)
ex_general_loo['_self_cnt'] = ex_general_loo['_self_cnt'].fillna(0)

remaining = (ex_general_loo['CantRendidosGeneral'] - ex_general_loo['_self_cnt']).clip(lower=1)
ex_general_loo['PromedioNotaGeneral'] = np.where(
    ex_general_loo['CantRendidosGeneral'] > ex_general_loo['_self_cnt'],
    (ex_general_loo['PromedioNotaGeneral'] * ex_general_loo['CantRendidosGeneral']
     - ex_general_loo['_self_sum']) / remaining,
    0.0
)
```

Ambos fixes son transparentes para `train_models.py`: mismo nombre de columna, misma posición. El único efecto observable es una leve baja en métricas (señal de que el leakage estaba inflando los números).

---

## 8. `validar.py` — estructura y checks

### Bloque 1 — Reglas de negocio

Seis asserts sobre `nivel_examen.csv` + `nivel_materia.csv` (ver §4). Si un assert falla, se reporta con contexto y continúa — no muere en el primer error.

### Bloque 2 — Topes y distribuciones por grupo

Usando `audit_tipos.csv`:

| Métrica | Excelente | Regular | Malo |
|---|---|---|---|
| Recursadas acumuladas | ≤ 2 | ≤ 3 | cualquier valor |
| Recuperatorios acumulados | ≤ 3 | ≤ 15 | ≥ 5 en promedio |
| % no abandona | ≥ 93% | ≥ 88% | ≥ 72% |
| % colegio técnico | 80–99% | 30–55% | 0–5% |
| P(excelente \| ayuda) | 0.80–0.99 | — | — |
| Media asistencia | 0.88–1.00 | 0.77–0.93 | 0.55–0.75 |
| Media nota | 7.0–9.5 | 4.5–7.0 | 2.5–5.0 |

Violaciones leves → warning. Violaciones extremas (>3× margen) → error.

### Bloque 3 — Coherencia temporal

- Fechas ordenadas dentro de cada cursada (parcial < recuperatorio < final)
- `Abandona ∈ {0, 1}` sin nulls
- `AnioIngreso ∈ {2015…2020}`
- Ningún examen posterior a 2025-12-31

### Bloque 4 — Volumen

Reporta totales reales y compara con rangos orientativos (190k–260k exámenes, 32k–45k cursadas). No falla por estar fuera del rango.

### Bloque 5 — Separabilidad / accuracy baseline

**Genera los datasets de modelado** llamando a `ft_engineering_procesado()` e imprime sus columnas + shape.

**Split temporal:** alumnos con `AnioIngreso ≤ 2018` → train; `AnioIngreso ≥ 2019` → test.

**Modelos baseline:**
- `DecisionTreeClassifier(max_depth=4)` para abandono y recursa
- `DecisionTreeRegressor(max_depth=4)` para próxima nota

**Targets:**

| Modelo | Métrica | Rango aceptado |
|---|---|---|
| Abandono | Accuracy | 80–88% |
| Recursa | Accuracy | 80–88% |
| Próxima nota | R² | 0.30–0.65 |
| Próxima nota | MAE | 1.0–2.0 |

Si accuracy > 88% → `[WARN] Separabilidad alta — subir P_OFFTYPE o σ_notas`  
Si accuracy < 80% → `[WARN] Señal débil — bajar P_OFFTYPE o σ_notas`

**Assert anti-leakage:**
```python
for nombre, df in [('alumno', df_a), ('materia', df_m), ('examen', df_e)]:
    assert 'TipoAlumno' not in df.columns, f"[ERROR] TipoAlumno en dataset_{nombre}.csv"
```

---

## 9. Parámetros ajustables (constantes al tope del generador)

```python
N_ALUMNOS    = 500
SEED         = 42
P_OFFTYPE    = 0.12   # fracción de alumnos con comportamiento off-type

# Hazard de abandono
B_TIPO       = {'excelente': -4.5, 'regular': -2.0, 'malo': -0.5}
W_PROGRESO   = -3.0
W_ASISTENCIA = -2.0
W_BLOQUEO    = +1.5
SIGMA_HAZARD = 0.3

# Distribuciones de notas
MU_NOTA      = {'excelente': 8.0, 'regular': 5.5, 'malo': 3.5}
SIGMA_NOTA   = {'excelente': 1.5, 'regular': 1.8, 'malo': 1.5}

# Distribuciones de asistencia
MU_ASIST     = {'excelente': 0.93, 'regular': 0.85, 'malo': 0.65}
SIGMA_ASIST  = {'excelente': 0.05, 'regular': 0.08, 'malo': 0.10}
```

---

## 10. Reproducibilidad

`np.random.seed(SEED)` al inicio del script. Dependencias: `pandas`, `numpy`, `scikit-learn`. Sin dependencias adicionales.
