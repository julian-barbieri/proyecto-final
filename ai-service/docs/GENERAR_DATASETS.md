# 📊 Generador de Datasets Sintéticos

Este script genera 3 datasets sintéticos para la carrera de Ingeniería en Informática USAL con todas las reglas académicas, correlativas y flujos de examen especificados.

## 📋 Archivos Generados

- **nivel_examen.csv** (~50k-80k registros): Detalle de cada examen rendido (parciales, recuperatorios, finales)
- **nivel_materia.csv** (~20k-30k registros): Resumen por cursada de materia
- **nivel_alumno.csv** (500 registros): Datos consolidados por alumno

## 🚀 Cómo Ejecutar

### Opción 1: Desde PowerShell (Recomendado)

```powershell
# 1. Abrir PowerShell en VS Code o terminal
# 2. Navegar a la carpeta ai-service
cd "C:\Users\julia\OneDrive\Documentos\Facultad\Proyecto final\proyecto-final\ai-service"

# 3. Activar el ambiente virtual (si tienes .venv)
.\.venv\Scripts\Activate.ps1

# 4. Ejecutar el script
python src/generar_datasets.py
```

### Opción 2: Desde CMD

```cmd
# 1. Abrir CMD en VS Code o terminal
# 2. Navegar a la carpeta ai-service
cd "C:\Users\julia\OneDrive\Documentos\Facultad\Proyecto final\proyecto-final\ai-service"

# 3. Ejecutar el script
python src/generar_datasets.py
```

### Opción 3: Directamente desde VS Code

1. Abre el archivo `src/generar_datasets.py`
2. Haz clic en el botón ▶️ (Run) en la esquina superior derecha
3. O presiona `Ctrl+F5`

## 📂 Dónde se Guardan

Los datasets se guardarán en:

```
ai-service/data/
├── nivel_examen.csv
├── nivel_materia.csv
└── nivel_alumno.csv
```

## ⏱️ Tiempo Estimado

- **Primera ejecución**: ~2-5 minutos (genera 500 alumnos completos)
- **Ejecuciones posteriores**: Se sobresciben los archivos anteriores

## ✅ Validaciones Automáticas

El script verifica y muestra al finalizar:

- ✓ Porcentaje de alumnos que abandonan (debe ser ~20%)
- ✓ Porcentaje de alumnos que completaron 1er año
- ✓ Total de registros generados

## 📋 Requisitos

Asegúrate que tengas `pandas` y `numpy` instalados:

```powershell
pip install pandas numpy
```

Si usas el ambiente virtual del proyecto:

```powershell
.\.venv\Scripts\activate
pip install pandas numpy
```

## 🔧 Personalización

Para modificar parámetros del generador, abre `src/generar_datasets.py` y busca:

- `generar_datasets(num_alumnos=500, ...)` para cambiar cantidad de alumnos
- `MATERIAS_BOTTLENECK` para las materias críticas
- Distribuciones de probabilidad en las funciones de generación

## 📝 Notas

- Los datasets son **sintéticos pero realistas** respetando:
  - Correlativas académicas
  - Tipos de materias (anuales/cuatrimestrales)
  - Flujos de examen completos
  - Distribuciones estadísticas de desempeño
  - Tasa de abandono del 20%

- **Reproducibilidad**: El script usa `np.random.seed(42)`, así que siempre generará los mismos datos
  - Si quieres datos diferentes: cambia el seed o borra esta línea
