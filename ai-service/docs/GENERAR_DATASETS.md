# 📁 Estructura de Scripts de Generación de Datos

## Ubicación de Scripts

### Opción 1: Ejecutar desde la carpeta `data` (RECOMENDADO)

```bash
cd data/
python generar_datasets.py      # Genera los 3 CSVs
python analizar_datasets.py     # Valida los datasets generados
```

### Opción 2: Ejecutar desde la carpeta `src`

```bash
cd src/
python generar_datasets.py      # Genera los 3 CSVs en ../data
```

---

## Scripts Disponibles

### 🔧 `data/generar_datasets.py`

- **Propósito**: Genera los 3 datasets sintéticos desde cero
- **Entrada**: Nada (genera datos aleatorios)
- **Salida**:
  - `nivel_examen.csv` (~47k registros)
  - `nivel_materia.csv` (~24k registros)
  - `nivel_alumno.csv` (500 registros)
- **Parámetros**:
  - `num_alumnos`: cantidad de estudiantes (default: 500)
  - `output_dir`: carpeta de destino (default: ".")
- **Duración**: ~30-60 segundos

### 📊 `data/analizar_datasets.py`

- **Propósito**: Valida y analiza los datasets generados
- **Entrada**: Los 3 CSVs generados por `generar_datasets.py`
- **Salida**: Estadísticas y validaciones en consola
- **Métricas**:
  - Distribución de alumnos (activos vs abandonados)
  - Tasa de graduación (activos: 100%)
  - Rango de años (2018-2025)
  - Índice de bloqueo
  - Materias aprobadas vs cursadas
- **Duración**: ~1-2 segundos

---

## Características Implementadas

✅ **Alumnos Activos 100% Graduados**

- 418/418 alumnos activos aprueban todas las 48 materias

✅ **Datos Históricos 2018-2025**

- Solo datos "históricos" hasta 2025

✅ **IndiceBloqueo Correcto**

- Calcula correlativas no aprobadas
- Rango: 0.0 (sin bloqueo) a 1.0 (bloqueado)

✅ **Trayectos Completos**

- Permite estudiar progreso de inicio a fin por alumno

---

## Cómo Usar

1. **Generar datasets**:

   ```bash
   cd data
   python generar_datasets.py
   ```

2. **Analizar datasets**:

   ```bash
   python analizar_datasets.py
   ```

3. **Modificar parámetros** (editar `generar_datasets.py`, última línea):
   ```python
   generar_datasets(num_alumnos=1000, output_dir=".")
   ```

---

## Archivos Originales en `src/`

- `src/generar_datasets.py`: Versión original (también funciona, generar desde src)

**Nota**: Se recomienda usar los scripts desde la carpeta `data/` para evitar problemas de rutas relativas.
