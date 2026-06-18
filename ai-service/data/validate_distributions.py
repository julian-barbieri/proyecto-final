import pandas as pd
import numpy as np
import sys
sys.path.insert(0, '.')

alumno = pd.read_csv("nivel_alumno.csv")
materia = pd.read_csv("nivel_materia.csv")
examen = pd.read_csv("nivel_examen.csv")

print("=== SHAPE ===")
print(f"alumno:  {alumno.shape}")
print(f"materia: {materia.shape}")
print(f"examen:  {examen.shape}")

print("\n=== ABANDONO POR TIPO ===")
print(alumno.groupby('TipoAlumno')['Abandona'].agg(['mean','sum','count']))

print("\n=== RECURSADO POR TIPO ===")
alumno_tipo = alumno[['IdAlumno','TipoAlumno']]
mat_tipo = materia.merge(alumno_tipo, on='IdAlumno')
print(mat_tipo.groupby('TipoAlumno')['Recursa'].agg(['mean','count']))

print("\n=== ASISTENCIA POR TIPO (materia) ===")
print(mat_tipo.groupby('TipoAlumno')['Asistencia'].describe()[['min','mean','max']])

print("\n=== NOTAS EN EXAMEN POR TIPO ===")
ex_pres = examen[examen['AusenteExamen']==0]
ex_tipo = ex_pres.merge(alumno_tipo, on='IdAlumno')
print(ex_tipo.groupby('TipoAlumno')['Nota'].describe()[['min','mean','max']])

print("\n=== NOTA PROMEDIO PREVIAS (materia) ===")
print(mat_tipo.groupby('TipoAlumno')['NotaPromedioPrevias'].agg(['mean','min','max']))

print("\n=== MATERIAS APROBADAS (alumno) ===")
print(alumno.groupby(['TipoAlumno','Abandona'])['MateriasAprobadas'].agg(['mean','min','max']))
