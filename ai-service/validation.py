import pandas as pd

df_examen = pd.read_csv('data/nivel_examen.csv')
df_materia = pd.read_csv('data/nivel_materia.csv')
df_alumno = pd.read_csv('data/nivel_alumno.csv')

print("=" * 60)
print("📊 VALIDACIÓN FINAL DE DATASETS")
print("=" * 60)

# Análisis por nivel
print("\n1️⃣  NIVEL EXAMEN")
print(f"   Total registros: {len(df_examen):,}")
print(f"   Rango de años: {df_examen['Anio'].min()} - {df_examen['Anio'].max()}")
print(f"   Estudiantes únicos: {df_examen['IdAlumno'].nunique()}")

# Análisis de alumnos activos vs abandonados
print("\n2️⃣  ANÁLISIS DE ALUMNOS")
activos = df_alumno[df_alumno['Abandona'] == 0]
abandonados = df_alumno[df_alumno['Abandona'] == 1]

print(f"   Total alumnos: {len(df_alumno)}")
print(f"   - Activos (no abandonan): {len(activos)} ({len(activos)/len(df_alumno)*100:.1f}%)")
print(f"   - Abandonados: {len(abandonados)} ({len(abandonados)/len(df_alumno)*100:.1f}%)")

# Verificar graduación de activos
print("\n3️⃣  TASA DE GRADUACIÓN (ACTIVOS)")
graduados = len(activos[activos['MateriasAprobadas'] >= 48])
print(f"   Activos graduados: {graduados}/{len(activos)} ({graduados/len(activos)*100:.1f}%)")
print(f"   Promedio materias (activos): {activos['MateriasAprobadas'].mean():.1f}")

# Verificar nivel_materia
print("\n4️⃣  NIVEL MATERIA")
print(f"   Total cursadas: {len(df_materia):,}")
aprobadas = len(df_materia[df_materia['Recursa'] == 0])
recursadas = len(df_materia[df_materia['Recursa'] == 1])
print(f"   - Aprobadas: {aprobadas:,} ({aprobadas/len(df_materia)*100:.1f}%)")
print(f"   - Recursadas: {recursadas:,} ({recursadas/len(df_materia)*100:.1f}%)")

# IndiceBloqueo
print("\n5️⃣  ÍNDICE DE BLOQUEO")
print(f"   Valores únicos en examen: {df_examen['IndiceBloqueo'].unique()}")
print(f"   Valores únicos en materia: {df_materia['IndiceBloqueo'].unique()}")

print("\n" + "=" * 60)
print("✅ VALIDACIÓN COMPLETADA")
print("=" * 60)
