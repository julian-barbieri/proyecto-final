# Features del Modelo de Predicción de Notas

Este documento detalla todos los atributos (features) que se utilizan para entrenar y predecir con el modelo de regresión de notas.

## 📊 Resumen

El modelo utiliza **21 features** en total:
- **9 features numéricas base** (escaladas con StandardScaler)
- **8 features numéricas derivadas** (feature engineering, escaladas con StandardScaler)
- **4 features categóricas** (codificadas con LabelEncoder)

---

## 🔢 Features Numéricas Base (9)

Estas features son valores numéricos continuos originales del dataset que se normalizan con `StandardScaler` antes del entrenamiento.

| Feature | Descripción | Fuente | Tipo | Rango/Valores |
|---------|-------------|--------|------|---------------|
| `edad` | Edad del estudiante en años | Calculada desde `FechaNacimiento` | float | ~17-25 años |
| `AsistenciaAM1` | Porcentaje de asistencia a clases | `AsistenciaAM1` | float | 0-100% |
| `VecesRecursadaAM1` | Número de veces que recursó la materia | `VecesRecursadaAM1` | int | 0, 1, 2, ... |
| `Parcial1AM1` | Nota del primer parcial | `Parcial1AM1` | float | 1-10 |
| `Parcial2AM1` | Nota del segundo parcial | `Parcial2AM1` | float | 1-10 |
| `Recuperatorio1AM1` | Nota del primer recuperatorio | `Recuperatorio1AM1` | float | 1-10 |
| `Recuperatorio2AM1` | Nota del segundo recuperatorio | `Recuperatorio2AM1` | float | 1-10 |
| `PromedioNotasColegio` | Promedio de notas del colegio secundario | `PromedioNotasColegio` | float | 1-10 |
| `AniosUniversidad` | Años cursados en la universidad | `AniosUniversidad` | int | 1, 2, 3, 4, ... |

---

## 🧮 Features Numéricas Derivadas (8) - Feature Engineering

Estas features se crean a partir de las features base mediante transformaciones y agregaciones:

| Feature | Descripción | Fuente | Tipo | Rango/Valores |
|---------|-------------|--------|------|---------------|
| `promedio_parciales` | Promedio de Parcial1AM1 y Parcial2AM1 | Calculado | float | 1-10 |
| `max_parcial` | Máximo entre Parcial1AM1 y Parcial2AM1 | Calculado | float | 1-10 |
| `min_parcial` | Mínimo entre Parcial1AM1 y Parcial2AM1 | Calculado | float | 1-10 |
| `tendencia_parciales` | Diferencia Parcial2AM1 - Parcial1AM1 (mejora/deterioro) | Calculado | float | Positivo = mejora, Negativo = deterioro |
| `tiene_recuperatorio` | 1 si tiene al menos un recuperatorio > 0, 0 en caso contrario | Calculado | int | 0 o 1 |
| `promedio_historico` | Promedio de todas las notas (parciales + recuperatorios) | Calculado | float | 1-10 |
| `rango_parciales` | Diferencia entre max_parcial y min_parcial (variabilidad) | Calculado | float | >= 0 |
| `std_parciales` | Desviación estándar entre Parcial1AM1 y Parcial2AM1 | Calculado | float | >= 0 |

### Propósito de las Features Derivadas:
- **promedio_parciales**: Captura el rendimiento general en parciales
- **max_parcial**: Identifica el mejor desempeño parcial
- **min_parcial**: Identifica el peor desempeño parcial
- **tendencia_parciales**: Detecta si el estudiante mejora o empeora
- **tiene_recuperatorio**: Indicador binario de si necesitó recuperatorios
- **promedio_historico**: Rendimiento consolidado considerando todos los exámenes
- **rango_parciales**: Mide la consistencia del rendimiento
- **std_parciales**: Mide la variabilidad en el desempeño

### Preprocesamiento de Numéricas (Base + Derivadas):
- Conversión a tipo numérico (maneja errores con `coerce`)
- Valores faltantes (NaN) se rellenan con la mediana de cada columna
- Escalado con `StandardScaler` (media=0, std=1) antes del entrenamiento

---

## 📝 Features Categóricas (4)

Estas features son valores discretos que se codifican con `LabelEncoder` (cada categoría se convierte en un número entero).

| Feature | Descripción | Fuente | Valores Posibles | Codificación |
|---------|-------------|--------|------------------|--------------|
| `Genero` | Género del estudiante | `Genero` | "M", "F", "X" | 0, 1, 2 |
| `ProfesorAM1` | Nombre del profesor | `ProfesorAM1` | "Agustina", "Pedro", "Juan", etc. | 0, 1, 2, ... |
| `ColegioTecnico` | Si proviene de colegio técnico | `ColegioTecnico` | "Si", "No" | 0, 1 |
| `AyudaFinanciera` | Si recibe ayuda financiera | `AyudaFinanciera` | "Si", "No" | 0, 1 |

### Preprocesamiento de Categóricas:
- Conversión a string y codificación con `LabelEncoder`
- Valores faltantes (NaN) se rellenan con `-1` (valor especial)
- El encoder se ajusta solo con valores no-nulos durante el entrenamiento

---

## 🎯 Variable Objetivo (Target)

El modelo predice la **nota final** de la materia AM1:

| Target | Descripción | Fuente | Prioridad |
|--------|-------------|--------|-----------|
| `NotaFinalAM1` o promedio de `Final1AM1/Final2AM1/Final3AM1` | Nota final del estudiante | Columnas Final | 1. `NotaFinalAM1` (si existe)<br>2. Promedio de `Final1AM1`, `Final2AM1`, `Final3AM1` |

### ⚠️ Importante:
- **NO se usa** promedio de parciales como target (eso causaría data leakage)
- Solo se usan filas que tienen al menos una nota final disponible
- Las filas sin notas finales se eliminan del entrenamiento

---

## ❌ Columnas Excluidas (NO se usan como features)

Las siguientes columnas se **excluyen** del entrenamiento:

### Identificadores y Metadata:
- `id`, `ID`, `email`, `nombre`, `Email`, `Nombre`
- `Carrera` (todos los valores son iguales)

### Datos de AM2 (materia diferente):
- Todas las columnas que terminan en `AM2`: `AnioAM2`, `TutorAM2`, `ProfesorAM2`, `VecesRecursadaAM2`, `AsistenciaAM2`, `PeriodoAM2`, `ModalidadAM2`, `TipoMateriaAM2`, `Parcial1AM2`, `Parcial2AM2`, `Recuperatorio1AM2`, `Recuperatorio2AM2`, `Final1AM2`, `Final2AM2`, `Final3AM2`, `ApruebaAM2`

### Columnas de target (no son features):
- `Final1AM1`, `Final2AM1`, `Final3AM1` (usadas para calcular target, no como features)
- `NotaFinalAM1` (target directo, no feature)
- `ApruebaAM1` (resultado binario, no feature)
- `Abandona` (target diferente, para modelo de dropout)

### Otras:
- `FechaNacimiento` (se convierte a `edad`, la fecha original no se usa)
- `TutorAM1` (no se incluye como feature)
- `PeriodoAM1`, `ModalidadAM1`, `TipoMateriaAM1` (no se incluyen)

---

## 🔄 Orden de Features

El orden de las features es **crítico** y se guarda en `feature_order.json`:

1. Primero todas las **numéricas** (en el orden especificado)
2. Luego todas las **categóricas** (en el orden especificado)

Este orden debe mantenerse exactamente igual durante la predicción.

---

## 📦 Estructura de Datos de Entrada

Para hacer una predicción, necesitas proporcionar un diccionario/JSON con estos campos:

```json
{
  "features": {
    "edad": 20.0,
    "AsistenciaAM1": 75.0,
    "VecesRecursadaAM1": 0,
    "Parcial1AM1": 7.0,
    "Parcial2AM1": 8.0,
    "Recuperatorio1AM1": 0.0,
    "Recuperatorio2AM1": 0.0,
    "PromedioNotasColegio": 7.5,
    "AniosUniversidad": 1,
    "Genero": "F",
    "ProfesorAM1": "Pedro",
    "ColegioTecnico": "No",
    "AyudaFinanciera": "No"
  }
}
```

---

## 🧮 Pipeline de Preprocesamiento

1. **Parseo**: `FechaNacimiento` → `edad`
2. **Limpieza**: Eliminar columnas no deseadas
3. **Conversión numérica**: Convertir strings a números (numéricas)
4. **Codificación**: `LabelEncoder` para categóricas
5. **Relleno**: NaN → mediana (numéricas) o -1 (categóricas)
6. **Escalado**: `StandardScaler` para numéricas
7. **Concatenación**: [numéricas escaladas] + [categóricas codificadas]
8. **Predicción**: Modelo LinearRegression

---

## 📈 Importancia de Features

El modelo actual ( "model_type": "random_forest") asigna coeficientes a cada feature. Para ver la importancia:

```python
from app.model_registry import load_model

model = load_model("grades", "v0.1.0")
print("Coefficients:", model.coef_)
print("Intercept:", model.intercept_)
```

Coeficientes más grandes (en valor absoluto) indican mayor influencia en la predicción.

---

## ✅ Validación

Para verificar qué features se están usando en un modelo entrenado:

```bash
# Ver feature_order.json
cat models/grades/v0.1.0/feature_order.json | python -m json.tool

# Ver metadatos
cat models/grades/v0.1.0/meta.json | python -m json.tool
```

