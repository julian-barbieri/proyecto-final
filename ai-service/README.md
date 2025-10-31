# AI Service

Microservicio de IA para predicción de calificaciones y abandono estudiantil.

## Estructura

```
ai-service/
  app/
    __init__.py
    main.py          # FastAPI application
    config.py        # Configuración
    schemas.py       # Modelos Pydantic
    utils.py         # Utilidades
    model_registry.py # Gestión de modelos
    train_grades.py  # Script de entrenamiento
    test_model.py    # Script de validación
  models/            # Modelos entrenados (persistidos)
  data/              # Datos para entrenamiento
  metrics/           # Métricas de modelos
  requirements.txt
  Dockerfile
  README.md
  FEATURES.md        # Documentación detallada de features
```

## Instalación

### Local

```bash
pip install -r requirements.txt
```

### Docker

```bash
docker build -t ai-service .
docker run -p 8001:8001 ai-service
```

### Docker Compose

```bash
docker compose up -d
```

## Ejecución

### Local

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Con Python

```bash
python -m app.main
```

## Endpoints

### GET /health

Health check del servicio.

**Respuesta:**
```json
{
  "status": "ok",
  "version": "v1.0.0"
}
```

### GET /info

Información sobre modelos disponibles.

**Respuesta:**
```json
{
  "service": "ai-service",
  "version": "v1.0.0",
  "models": {
    "grades": ["v1.0.0"]
  },
  "timestamp": "2024-01-01T00:00:00"
}
```

## Variables de Entorno

- `MODEL_DIR`: Directorio para modelos (default: `./models`)
- `METRICS_DIR`: Directorio para métricas (default: `./metrics`)
- `DATA_DIR`: Directorio para datos (default: `./data`)
- `MODEL_VERSION`: Versión del modelo (default: `v1.0.0`)
- `LOG_LEVEL`: Nivel de logging (default: `INFO`)
- `API_HOST`: Host del API (default: `0.0.0.0`)
- `API_PORT`: Puerto del API (default: `8000`)
- `MODEL_LOAD_TIMEOUT`: Timeout para cargar modelos (default: `30.0`)
- `PREDICTION_TIMEOUT`: Timeout para predicciones (default: `10.0`)
- `DROPOUT_THRESHOLD`: Umbral para predicción de abandono (default: `0.5`)
- `MIN_GRADE`: Calificación mínima (default: `1.0`)
- `MAX_GRADE`: Calificación máxima (default: `10.0`)

## Logging

El servicio usa logging estructurado con nivel configurable. Los logs se muestran en consola con formato:

```
YYYY-MM-DD HH:MM:SS - logger_name - LEVEL - message
```

---

## 📊 Modelo de Producción - Predicción de Notas

### Información General

- **Versión**: v1.0.0
- **Tipo**: Random Forest Regressor
- **Parámetros**:
  - `n_estimators`: 100
  - `max_depth`: 3 (regularización para evitar overfitting)
  - `random_state`: 42

### Cómo Funciona

1. **Entrenamiento**: El modelo utiliza un ensamble de 100 árboles de decisión con profundidad máxima de 3.
2. **Predicción**: Cada árbol genera una predicción y el resultado final es el promedio de todas las predicciones.
3. **Regularización**: `max_depth=3` limita la complejidad de los árboles para evitar sobreajuste.

### Métricas de Rendimiento

- **R² Score**: -0.0349
  - Indica que el modelo es ligeramente peor que predecir el promedio, pero es el mejor resultado obtenido de todos los modelos probados.
- **MAE (Mean Absolute Error)**: 1.5250
  - Error promedio de ~1.5 puntos en una escala de 1-10 (aceptable).
- **Dataset**: 374 muestras válidas (de 400 totales)
- **Train/Test Split**: 70/30 (261 train, 113 test)

### Atributos Utilizados (21 Features)

#### Features Numéricas Base (9)
1. `edad` - Edad del estudiante (calculada desde FechaNacimiento)
2. `AsistenciaAM1` - Porcentaje de asistencia (0-100%)
3. `VecesRecursadaAM1` - Número de veces que recursó
4. `Parcial1AM1` - Nota del primer parcial (1-10)
5. `Parcial2AM1` - Nota del segundo parcial (1-10)
6. `Recuperatorio1AM1` - Nota del primer recuperatorio (1-10)
7. `Recuperatorio2AM1` - Nota del segundo recuperatorio (1-10)
8. `PromedioNotasColegio` - Promedio de notas del colegio secundario (1-10)
9. `AniosUniversidad` - Años cursados en la universidad

#### Features Derivadas (8) - Feature Engineering
10. `promedio_parciales` - Promedio de Parcial1AM1 y Parcial2AM1
11. `max_parcial` - Máximo entre parciales
12. `min_parcial` - Mínimo entre parciales
13. `tendencia_parciales` - Diferencia Parcial2AM1 - Parcial1AM1 (mejora/deterioro)
14. `tiene_recuperatorio` - Indicador binario (1 si tiene recuperatorio, 0 si no)
15. `promedio_historico` - Promedio de todas las notas (parciales + recuperatorios)
16. `rango_parciales` - Diferencia entre max_parcial y min_parcial (variabilidad)
17. `std_parciales` - Desviación estándar entre parciales (variabilidad)

#### Features Categóricas (4)
18. `Genero` - Género del estudiante ("M", "F", "X")
19. `ProfesorAM1` - Nombre del profesor
20. `ColegioTecnico` - Si proviene de colegio técnico ("Si", "No")
21. `AyudaFinanciera` - Si recibe ayuda financiera ("Si", "No")

### Feature Importance (Top 5)

1. **PromedioNotasColegio** (0.198) - Historial académico previo
2. **tendencia_parciales** (0.163) - Mejora/deterioro entre parciales
3. **Recuperatorio2AM1** (0.108) - Nota del segundo recuperatorio
4. **AsistenciaAM1** (0.080) - Asistencia a clases
5. **promedio_historico** (0.079) - Promedio consolidado

### Preprocesamiento

1. **Parseo**: `FechaNacimiento` → `edad`
2. **Feature Engineering**: Creación de 8 features derivadas
3. **Conversión numérica**: Strings a números para features numéricas
4. **Codificación**: `LabelEncoder` para features categóricas
5. **Relleno**: NaN → mediana (numéricas) o -1 (categóricas)
6. **Escalado**: `StandardScaler` para todas las features numéricas (base + derivadas)
7. **Concatenación**: [numéricas escaladas] + [categóricas codificadas]
8. **Entrenamiento**: Random Forest Regressor

### Variable Objetivo (Target)

- **Target**: Nota final de la materia AM1
- **Prioridad**: `NotaFinalAM1` > promedio de `Final1AM1/Final2AM1/Final3AM1`
- ⚠️ **Importante**: Solo se usan notas finales como target (NO parciales) para evitar data leakage

### Limitaciones y Consideraciones

1. **R² Negativo**: El modelo tiene R² negativo (-0.035), lo que indica que es ligeramente peor que predecir el promedio. Esto es debido a:
   - Baja correlación entre features y target en el dataset
   - Las Parciales no son buenos predictores de Finales en estos datos

2. **MAE Aceptable**: Con un MAE de 1.53 puntos, el error promedio es aceptable para predicciones de notas (rango 1-10).

3. **Uso Recomendado**: 
   - Útil como herramienta de apoyo a la decisión
   - No debe ser el único factor para decisiones críticas
   - Mejor para identificar tendencias generales que predicciones precisas

---

## Estructura de Modelos

Los modelos se almacenan en `models/{model_name}/{version}/`:
- `{model_name}_model.joblib`: Modelo entrenado
- `{model_name}_scaler.joblib`: StandardScaler
- `{model_name}_encoders.joblib`: LabelEncoders para categóricas
- `feature_order.json`: Orden exacto de features
- `meta.json`: Metadatos del modelo (métricas, parámetros, etc.)

## Entrenar Modelo

```bash
# Modelo de producción (Random Forest) - Por defecto usa Random Forest
python -m app.train_grades \
  --csv data/dataset_alumnos.csv \
  --sep ";" \
  --out models \
  --version v1.0.1

# O desde Docker:
docker compose exec ai-service python -m app.train_grades \
  --csv data/dataset_alumnos.csv \
  --sep ";" \
  --out models \
  --version v1.0.1

# Alternativas:
# Especificar parámetros explícitamente (si necesitas cambiar defaults)
python -m app.train_grades --csv data/dataset_alumnos.csv --sep ";" --out models --version v1.0.1 --model random_forest --n_estimators 100 --max_depth 3

# Linear Regression
python -m app.train_grades --csv data/dataset_alumnos.csv --sep ";" --out models --version v1.0.1 --model linear

# Gradient Boosting
python -m app.train_grades --csv data/dataset_alumnos.csv --sep ";" --out models --version v1.0.1 --model gradient_boosting --n_estimators 100 --max_depth 3
```

## Validar Modelo

```bash
# Validar modelo entrenado
python -m app.test_model --model grades --version v1.0.0
```

## Desarrollo

Para desarrollo local con hot-reload:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Documentación Adicional

- **FEATURES.md**: Documentación detallada de todas las features utilizadas

