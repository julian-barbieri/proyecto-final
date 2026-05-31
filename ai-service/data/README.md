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
- `data/nivel_examen.csv` — exámenes generados
- `data/nivel_materia.csv` — cursadas generadas
- `data/nivel_alumno.csv` — 500 alumnos con estado final (graduado/abandonó)
- `data/audit_tipos.csv` — mapeo IdAlumno → TipoAlumno (solo para validación, no para entrenamiento)

## Validar y generar datasets de modelado

```bash
cd ai-service
python data/validar.py
```

Corre 5 bloques:
1. Reglas de negocio (asserts R1–R6)
2. Distribuciones por grupo
3. Coherencia temporal
4. Volumen (reporte, no falla)
5. Accuracy baseline con `DecisionTree(max_depth=4)` sobre los features de producción

Produce además:
- `data/dataset_alumno.csv` — features + target Abandona (output de ft_engineering)
- `data/dataset_materia.csv` — features + target Recursa
- `data/dataset_examen.csv` — features + target Nota

La accuracy esperada de los clasificadores baseline es **80–88%**. Si está fuera de rango,
el validador sugiere qué parámetros ajustar.

## Parámetros ajustables

En `generar_datasets.py`, bloque `PARÁMETROS AJUSTABLES`:

| Parámetro | Default | Efecto |
|-----------|---------|--------|
| `P_OFFTYPE` | 0.18 | Sube → menos separabilidad → baja accuracy |
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
