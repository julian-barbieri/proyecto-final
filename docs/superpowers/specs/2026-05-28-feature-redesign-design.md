# Feature Redesign: Dataset Correlations, AyudaFinanciera Effects & Variable Simplification

**Date:** 2026-05-28  
**Status:** Approved

---

## Objetivo

Tres mejoras al pipeline de ML para que los modelos reflejen mejor la realidad:

1. Correlacionar asistencia con el outcome de recursado en los datos de entrenamiento.
2. Hacer que `AyudaFinanciera` tenga efecto real en abandono, recursado y notas.
3. Simplificar el conjunto de features a las variables más significativas, manteniendo coherencia semántica entre los tres modelos.

---

## Alcance

| Archivo | Cambio |
|---|---|
| `ai-service/data/generar_datasets.py` | Asistencia ±15% según Recursa; efectos AyudaFinanciera |
| `ai-service/src/feature_engineering/ft_engineering.py` | Renombres, join PromedioAsistencia, selección de variables |
| `backend/src/services/prediction-variables.service.js` | Actualizar las tres funciones calcular* |
| Modelos `.pkl` | Reentrenar los tres modelos tras los cambios anteriores |

---

## Sección 1 — Generación de datos (`generar_datasets.py`)

### 1.1 Asistencia correlacionada con Recursa

En `nivel_materia.csv`, después de determinar `recursa` con las probabilidades por `tipo_alumno`, aplicar ajuste aditivo a `asistencia`:

```python
# Ajuste post-determinación de recursa
if recursa:
    asistencia = max(round(asistencia - 0.15, 2), 0.0)  # techo inferior: 0
else:
    asistencia = min(round(asistencia + 0.15, 2), 1.0)  # techo superior: 1.0
```

**Objetivo:** Crear una señal de correlación en datos de entrenamiento para que el modelo aprenda baja asistencia → mayor riesgo de recursado.

### 1.2 Efectos de AyudaFinanciera

`AyudaFinanciera` actualmente aparece en los datasets pero sin efecto en los outcomes. Se agregan tres efectos:

**Abandono** — al calcular `abandona` por alumno:
```python
prob = PROB_ABANDONO[tipo]
if datos_alumno["ayuda_financiera"]:
    prob = prob * 0.8  # 20% menos probabilidad de abandono
abandona = 1 if np.random.random() < prob else 0
```

**Recursado** — al calcular `recursa` por cursada:
```python
prob_recursa = PROB_RECURSA[tipo][year_group]
if datos_alumno["ayuda_financiera"]:
    prob_recursa = prob_recursa * 0.8  # 20% menos probabilidad de recursado
recursa = int(np.random.random() < prob_recursa)
```

**Notas** — bonus post-generación en nivel_examen (dentro del loop de materias, después de `generar_nota_tipo`):
```python
if datos_alumno["ayuda_financiera"]:
    nota = min(nota + np.random.uniform(0.5, 1.0), 10)
```

---

## Sección 2 — Feature Engineering (`ft_engineering.py`)

### Principio de diseño

Tres variables "comunes" con el mismo significado semántico en los tres modelos:
- `PromedioNotaGeneral`: promedio global de notas del alumno en todos los exámenes rendidos.
- `PromedioAsistencia`: promedio global de asistencia del alumno en todas sus cursadas.
- `AyudaFinanciera`: flag binario (0/1).

Más variables específicas por modelo. El resto del código se **comenta** (no se borra).

### 2.1 Dataset alumno (abandono) — 5 features

Renombrar `PromedioNota` → `PromedioNotaGeneral` en la agregación de nivel_examen.

**Variables seleccionadas:**
```python
alumno_vars = [
    'PromedioNotaGeneral', 'PromedioAsistencia', 'AyudaFinanciera',
    'CantExamenesRendidos', 'CantFinalesRendidos',
    target
]
```

### 2.2 Dataset materia (recursado) — 5 features

Agregar join para `PromedioAsistencia` global del alumno antes de la selección:

```python
asistencia_global = materia.groupby('IdAlumno').agg(
    PromedioAsistencia=('Asistencia', 'mean')
).reset_index()
df = df.merge(asistencia_global, on='IdAlumno', how='left')
df['PromedioAsistencia'] = df['PromedioAsistencia'].fillna(0)
```

**Variables seleccionadas:**
```python
materia_vars = [
    'PromedioNotaGeneral', 'PromedioAsistencia', 'AyudaFinanciera',
    'Materia', 'PromedioColegio',
    target
]
```

### 2.3 Dataset examen (notas) — 6 features

Renombrar `PromedioAsistenciaGeneral` → `PromedioAsistencia` en la aggregation de `mat_general`.

Agregar bloque de selección explícita de variables (el modelo examen actualmente no filtra):

```python
examen_vars = [
    'PromedioNotaGeneral', 'PromedioAsistencia', 'AyudaFinanciera',
    'NotaPromedioParcialCursada', 'TasaRecursaGeneral', 'Materia',
    target
]
examen_vars = [col for col in examen_vars if col in df.columns]
df = df[examen_vars]
```

**Nota:** `TipoExamen` y `Tipo` (que actualmente pasan por OHE) quedan fuera de la selección final → se comentan en la lista `cat_vars`.

---

## Sección 3 — Backend (`prediction-variables.service.js`)

### 3.1 `calcularVariablesAbandono(legajo)` → 5 variables

| Variable | Fuente |
|---|---|
| `PromedioNotaGeneral` | Renombrado de `PromedioNota` (mismo cálculo) |
| `PromedioAsistencia` | Ya existe |
| `AyudaFinanciera` | Ya existe |
| `CantExamenesRendidos` | Ya existe |
| `CantFinalesRendidos` | Ya existe |

El código de: CantMaterias, CantAniosCursados, CantAusencias, TasaAusencia, CantAprobados, TasaAprobacion, Edad, Genero, ColegioTecnico, PromedioColegio → **comentado**.

### 3.2 `calcularVariablesRecursado(legajo, materiaId, anio)` → 5 variables

| Variable | Fuente |
|---|---|
| `PromedioNotaGeneral` | Ya existe en la función |
| `PromedioAsistencia` | Nuevo: `AVG(c.asistencia) FROM cursadas WHERE alumno_id = ?` |
| `AyudaFinanciera` | `alumno.ayuda_financiera` |
| `Materia` | `materia.codigo_plan` |
| `PromedioColegio` | `alumno.promedio_colegio` |

El código de: Edad, AniosDesdeIngreso, IndiceBloqueo, Genero, ColegioTecnico, Asistencia (específica), TasaAprobacionGeneral → **comentado**.

### 3.3 `calcularVariablesExamen(legajo, materiaId, tipoExamen, instancia, anio)` → 6 variables

| Variable | Fuente |
|---|---|
| `PromedioNotaGeneral` | Ya existe |
| `PromedioAsistencia` | Nuevo: `AVG(c.asistencia) FROM cursadas WHERE alumno_id = ?` |
| `AyudaFinanciera` | `alumno.ayuda_financiera` |
| `NotaPromedioParcialCursada` | Ya existe |
| `TasaRecursaGeneral` | Nuevo: `COUNT(*) FILTER (estado='recursada') / COUNT(*) FROM cursadas WHERE alumno_id = ?` |
| `Materia` | `materia.codigo_plan` |

El resto del código de variables → **comentado**.

---

## Orden de implementación (Bottom-up secuencial)

1. `generar_datasets.py` — aplicar cambios y regenerar los 3 CSVs
2. `ft_engineering.py` — aplicar renombres, join y selección de variables
3. `train_models.py` — reentrenar los tres modelos con `python train_models.py`
4. `prediction-variables.service.js` — actualizar las tres funciones calcular*
5. Verificar end-to-end: llamar al endpoint `/predict/alumno` con datos reales y confirmar que las predicciones son no-triviales

---

## Criterios de éxito

- Los tres modelos se entrenan sin errores y el feature set coincide entre FE y backend.
- `AyudaFinanciera=1` en el dataset muestra ~20% menos abandono y recursado que la misma tipología sin ayuda.
- Alumnos con baja asistencia muestran mayor probabilidad de recursado que los de alta asistencia.
- Pedro Quintero (bajo rendimiento) sigue prediciendo >80% de abandono tras el retrain.
- El endpoint del AI service responde correctamente con las nuevas features.
