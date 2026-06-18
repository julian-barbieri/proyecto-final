"""
Corrige las cursadas de anio=2026 para alumnos historicos alu000X.

El seed creo una cursada con estado='cursando' para el anio 2026 por cada
alumno historico, haciendolos aparecer como activos. Pero todos esos alumnos
son historicos (2015-2025 segun nivel_alumno.csv).

Se actualiza segun EstadoFinal:
  graduado            -> 'aprobada'
  abandono / timeout  -> 'abandonada'
"""

import sqlite3
import pandas as pd
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH  = os.path.join(BASE_DIR, "database.sqlite")
CSV_ALU  = os.path.join(BASE_DIR, "..", "ai-service", "data", "nivel_alumno.csv")

print("DB :", DB_PATH)
print("CSV:", CSV_ALU)

df_alu = pd.read_csv(CSV_ALU)
df_alu['username'] = df_alu['IdAlumno'].str.lower()

conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()

cur.execute("SELECT id, username FROM users WHERE username LIKE 'alu%' AND role='alumno'")
username_to_id = {row[1]: row[0] for row in cur.fetchall()}

# ── Estado antes ──────────────────────────────────────────────────────────

cur.execute("""
    SELECT c.estado, COUNT(*) FROM cursadas c
    JOIN users u ON c.alumno_id = u.id
    WHERE u.username LIKE 'alu%' AND c.anio = 2026
    GROUP BY c.estado
""")
print("\nEstado de cursadas 2026 (ANTES):")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

# ── Generar updates ───────────────────────────────────────────────────────

updates = []
for _, row in df_alu.iterrows():
    username  = row['username']
    alumno_id = username_to_id.get(username)
    if alumno_id is None:
        continue

    estado_final = str(row.get('EstadoFinal', '')).strip()
    nuevo = 'aprobada' if estado_final == 'graduado' else 'abandonada'
    updates.append((nuevo, alumno_id))

print(f"\nUpdates generados: {len(updates)}")
print("  graduado -> aprobada :", sum(1 for e, _ in updates if e == 'aprobada'))
print("  otro     -> abandonada:", sum(1 for e, _ in updates if e == 'abandonada'))

# ── Aplicar ───────────────────────────────────────────────────────────────

cur.executemany(
    "UPDATE cursadas SET estado = ? WHERE alumno_id = ? AND anio = 2026 AND estado = 'cursando'",
    updates,
)
conn.commit()

# ── Estado después ────────────────────────────────────────────────────────

cur.execute("""
    SELECT c.estado, COUNT(*) FROM cursadas c
    JOIN users u ON c.alumno_id = u.id
    WHERE u.username LIKE 'alu%' AND c.anio = 2026
    GROUP BY c.estado
""")
print("\nEstado de cursadas 2026 (DESPUES):")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

cur.execute("""
    SELECT COUNT(DISTINCT u.id)
    FROM users u
    JOIN cursadas c ON c.alumno_id = u.id AND c.estado = 'cursando'
    WHERE u.role = 'alumno' AND u.username LIKE 'alu%'
""")
print(f"\nalu000X con cursada 'cursando' restantes: {cur.fetchone()[0]}")

cur.execute("SELECT estado, COUNT(*) FROM cursadas GROUP BY estado")
print("\nEstado GLOBAL:")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

conn.close()
print("\nCorreccion completada.")
