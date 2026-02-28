import os
import sys

# Permite importar cargar_datos desde la misma carpeta src/
sys.path.append(os.path.dirname(__file__))

from cargar_datos import cargar_datos

# ── Carga de datos ────────────────────────────────────────────────────────────
# data/ está un nivel arriba de src/
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

alumno, materia, examen = cargar_datos(data_dir=DATA_DIR)

# ── Verificación ──────────────────────────────────────────────────────────────
print('\n-- nivel_alumno --')
print(alumno.head())
print(alumno.dtypes)

print('\n-- nivel_materia --')
print(materia.head())
print(materia.dtypes)

print('\n-- nivel_examen --')
print(examen.head())
print(examen.dtypes)
