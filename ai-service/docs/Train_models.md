# Módulo de Entrenamiento de Modelos

Este directorio contiene los scripts para entrenar los tres modelos de predicción académica.

## Estructura

- **alumno_training.py**: Modelo de clasificación para predicción de abandono de estudiantes
- **materia_training.py**: Modelo de clasificación para predicción de recursión de materias
- **examen_training.py**: Modelo de regresión para predicción de notas de exámenes
- **train_all_models.py**: Script orquestador que entrena todos los modelos en secuencia

## Uso

### Ejemplos de uso:

```bash
#Entrena todos los modelos
python main.py                    
# Entrena modelo alumno
python main.py --modelo alumno    

# Entrena solo predicción de materia
python main.py --modelo materia   

# Entrena solo predicción de nota
python main.py --modelo examen    


```

### Entrenar todos los modelos

```bash
python train_all_models.py
```

## Salida

Los modelos entrenados se guardan en el directorio `models/` con los nombres:

- `modelo_alumno.pkl`
- `modelo_materia.pkl`
- `modelo_examen.pkl`

Los conjuntos de prueba se exportan como CSV:

- `X_test_alumno.csv`, `y_test_alumno.csv`
- `X_test_materia.csv`, `y_test_materia.csv`
- `X_test_examen.csv`, `y_test_examen.csv`

## Dependencias

Los scripts dependen de:

- `../ft_engineering.py`: Feature engineering y preprocesamiento de datos
- `../cargar_datos.py`: Carga de datasets
- Librerías: scikit-learn, xgboost, pandas, numpy, joblib

## Notas

- La ejecución de los modelos puede tomar varios minutos
- Se utiliza RandomizedSearchCV para ajuste de hiperparámetros
- Los mejores parámetros se muestran durante el entrenamiento
