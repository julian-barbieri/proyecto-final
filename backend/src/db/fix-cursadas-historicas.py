"""
Corrige los estados de cursadas para alumnos históricos (alu000X).

El problema: todas las cursadas importadas desde nivel_materia.csv quedaron
con estado='cursando' en la DB, aunque representan datos históricos
(2015-2025). Esto hace que el modelo de abandono prediga muy alto riesgo
para todos los alumnos, ya que les calcula un DelayPromedioRespectoPlan
erróneo y los incluye en el panel como si estuvieran actualmente cursando.

La corrección:
  - Recursa=0 en CSV → 'aprobada' en DB (el alumno pasó la materia)
  - Recursa=1 en CSV → 'recursada' en DB (el alumno tuvo que recursar)

Para (IdAlumno, Materia, AnioCursada) con filas duplicadas en el CSV:
  - Si alguna tiene Recursa=0 → 'aprobada' (el resultado final fue aprobar)
  - Si todas tienen Recursa=1  → 'recursada'

Solo se actualizan cursadas de usuarios alu000X que tengan match en el CSV.
Las cursadas de alumnos demo (rodrigo.molina, etc.) no se tocan.
"""

import sqlite3
import pandas as pd
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH  = os.path.join(BASE_DIR, "database.sqlite")
CSV_PATH = os.path.join(BASE_DIR, "..", "ai-service", "data", "nivel_materia.csv")

print(f"DB  : {DB_PATH}")
print(f"CSV : {CSV_PATH}")

if not os.path.exists(DB_PATH):
    print("ERROR: No se encontró la base de datos.")
    sys.exit(1)
if not os.path.exists(CSV_PATH):
    print("ERROR: No se encontró nivel_materia.csv.")
    sys.exit(1)

# ── Carga de datos ──────────────────────────────────────────────────────────

df_mat = pd.read_csv(CSV_PATH)
# Codificación defensiva
df_mat.columns = [c.encode('ascii', 'ignore').decode() for c in df_mat.columns]

# Normalizar IdAlumno: 'ALU0001' → 'alu0001'
df_mat['username'] = df_mat['IdAlumno'].str.lower()

# Determinar estado final por (username, Materia, AnioCursada):
#   si alguna fila tiene Recursa=0 → aprobada, si todas Recursa=1 → recursada
grouped = (
    df_mat
    .groupby(['username', 'Materia', 'AnioCursada'])['Recursa']
    .min()           # min(0,1)=0 → hubo al menos una aprobación
    .reset_index()
    .rename(columns={'Recursa': 'recursa_min', 'AnioCursada': 'anio'})
)
grouped['estado_nuevo'] = grouped['recursa_min'].apply(
    lambda r: 'aprobada' if r == 0 else 'recursada'
)

print(f"\nFila únicas en CSV (username, Materia, año): {len(grouped)}")
print(grouped['estado_nuevo'].value_counts().to_string())

# ── Conexión a la DB ────────────────────────────────────────────────────────

conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()

# Usuarios alu000X y sus IDs
cur.execute(
    "SELECT id, username FROM users WHERE username LIKE 'alu%' AND role='alumno'"
)
username_to_id = {row[1]: row[0] for row in cur.fetchall()}
print(f"\nAlumnos alu000X en DB: {len(username_to_id)}")

# Mapeo codigo_plan → materia_id
cur.execute("SELECT id, codigo_plan FROM materias WHERE codigo_plan IS NOT NULL")
plan_to_materia = {row[1]: row[0] for row in cur.fetchall()}

# ── Estado antes ────────────────────────────────────────────────────────────

cur.execute(
    """SELECT c.estado, COUNT(*) FROM cursadas c
       JOIN users u ON c.alumno_id = u.id
       WHERE u.username LIKE 'alu%'
       GROUP BY c.estado"""
)
print("\nEstado ANTES de la corrección (solo alu000X):")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

# ── Generar updates ─────────────────────────────────────────────────────────

updates   = []
sin_match = 0

for _, row in grouped.iterrows():
    username    = row['username']
    codigo_plan = int(row['Materia'])
    anio        = int(row['anio'])
    estado      = row['estado_nuevo']

    alumno_id  = username_to_id.get(username)
    materia_id = plan_to_materia.get(codigo_plan)

    if alumno_id is None or materia_id is None:
        sin_match += 1
        continue

    updates.append((estado, alumno_id, materia_id, anio))

print(f"\nUpdates a aplicar: {len(updates)}")
print(f"Sin match (alumno o materia no encontrada): {sin_match}")

if not updates:
    print("Nada que actualizar.")
    conn.close()
    sys.exit(0)

# ── Aplicar updates ─────────────────────────────────────────────────────────

cur.executemany(
    """UPDATE cursadas
       SET estado = ?
       WHERE alumno_id = ? AND materia_id = ? AND anio = ?
         AND estado = 'cursando'""",   # solo tocar las que siguen como 'cursando'
    updates,
)
filas_afectadas = cur.rowcount
conn.commit()

print(f"Filas actualizadas: {filas_afectadas}")

# ── Estado después ──────────────────────────────────────────────────────────

cur.execute(
    """SELECT c.estado, COUNT(*) FROM cursadas c
       JOIN users u ON c.alumno_id = u.id
       WHERE u.username LIKE 'alu%'
       GROUP BY c.estado"""
)
print("\nEstado DESPUÉS de la corrección (solo alu000X):")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

cur.execute("SELECT estado, COUNT(*) FROM cursadas GROUP BY estado")
print("\nEstado GLOBAL (todos los alumnos):")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

# ── Verificar impacto en filtro soloActivos ──────────────────────────────────

cur.execute(
    """SELECT COUNT(DISTINCT u.id)
       FROM users u
       JOIN cursadas c ON c.alumno_id = u.id AND c.estado = 'cursando'
       WHERE u.role = 'alumno' AND u.username LIKE 'alu%'"""
)
print(f"\nalu000X con cursada 'cursando' tras la corrección: {cur.fetchone()[0]}")

conn.close()
print("\nCorreción completada.")
