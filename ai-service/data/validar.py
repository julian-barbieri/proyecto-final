"""
Validador de datasets sintéticos.
Uso:
    cd ai-service
    python data/validar.py
"""
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Para llamar a ft_engineering_procesado desde src/
_SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src')
sys.path.insert(0, _SRC)

_DATA_DIR = os.path.dirname(os.path.abspath(__file__))

ERRORES  = []
WARNINGS = []


def err(msg):  ERRORES.append(msg);  print(f'[ERROR] {msg}')
def warn(msg): WARNINGS.append(msg); print(f'[WARN]  {msg}')
def ok(msg):   print(f'[OK]    {msg}')


# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 1: REGLAS DE NEGOCIO
# ─────────────────────────────────────────────────────────────────────────────

def check_reglas_negocio(df_ex: pd.DataFrame, df_mat: pd.DataFrame):
    print('\n══ BLOQUE 1: Reglas de negocio ══')

    # R1: parcial < 4 → recuperatorio del mismo instancia existe
    parciales_bajos = df_ex[
        (df_ex['TipoExamen'] == 'Parcial') & (df_ex['Nota'] < 4)
    ][['IdAlumno', 'Materia', 'Anio', 'Cuatrimestre', 'Instancia']].copy()

    recups = df_ex[df_ex['TipoExamen'] == 'Recuperatorio'][
        ['IdAlumno', 'Materia', 'Anio', 'Cuatrimestre', 'Instancia']
    ].drop_duplicates()

    merged = parciales_bajos.merge(recups,
                                   on=['IdAlumno','Materia','Anio','Cuatrimestre','Instancia'])
    sin_recup = len(parciales_bajos) - len(merged)
    if sin_recup > 0:
        err(f'R1: {sin_recup} parciales < 4 sin recuperatorio correspondiente')
    else:
        ok(f'R1: todos los parciales < 4 tienen recuperatorio')

    # R2: finales tienen asistencia ≥ 0.75
    finales = df_ex[df_ex['TipoExamen'] == 'Final']
    r2_bad  = finales[finales['Asistencia'] < 0.75]
    if len(r2_bad):
        err(f'R2: {len(r2_bad)} finales con Asistencia < 0.75')
    else:
        ok('R2: todos los finales tienen Asistencia ≥ 0.75')

    # R3: máximo 3 finales por cursada
    n_finales = (df_ex[df_ex['TipoExamen'] == 'Final']
                 .groupby(['IdAlumno','Materia','Anio','Cuatrimestre']).size())
    r3_bad = (n_finales > 3).sum()
    if r3_bad:
        err(f'R3: {r3_bad} cursadas con > 3 finales')
    else:
        ok('R3: ninguna cursada supera 3 finales')

    # R4: correlativas respetadas — verificamos via nivel_materia ordenado por AnioCursada
    import sys as _sys
    _sys.path.insert(0, _DATA_DIR)
    from generar_datasets import MATERIAS
    aprobadas_por_alumno: dict = {}
    r4_bad = 0
    for row in df_mat.sort_values(['IdAlumno','AnioCursada']).itertuples(index=False):
        alu = row.IdAlumno
        mat = row.Materia
        corrs = MATERIAS[mat][3]
        apr = aprobadas_por_alumno.get(alu, set())
        for c in corrs:
            if c not in apr:
                r4_bad += 1
                break
        if row.Recursa == 0:
            aprobadas_por_alumno.setdefault(alu, set()).add(mat)
    if r4_bad:
        err(f'R4: {r4_bad} cursadas con correlativa no aprobada previa')
    else:
        ok('R4: correlativas respetadas')

    # R5: tipo A = 2 parciales, tipo C = 1 parcial (por cursada)
    pc = (df_ex[df_ex['TipoExamen'] == 'Parcial']
          .groupby(['IdAlumno','Materia','Anio','Cuatrimestre','Tipo']).size()
          .reset_index(name='n'))
    r5_A = pc[(pc['Tipo'] == 'A') & (pc['n'] != 2)]
    r5_C = pc[(pc['Tipo'] == 'C') & (pc['n'] != 1)]
    if len(r5_A) or len(r5_C):
        err(f'R5: {len(r5_A)} cursadas A con ≠2 parciales, {len(r5_C)} cursadas C con ≠1 parcial')
    else:
        ok('R5: número de parciales correcto por tipo')

    # R6: materia aprobada no se vuelve a cursar
    aprobaciones = (df_mat[df_mat['Recursa'] == 0]
                    [['IdAlumno','Materia','AnioCursada']]
                    .rename(columns={'AnioCursada': 'AnioAprobacion'}))
    cruzado = df_mat.merge(aprobaciones, on=['IdAlumno','Materia'])
    r6_bad  = cruzado[cruzado['AnioCursada'] > cruzado['AnioAprobacion']]
    if len(r6_bad):
        err(f'R6: {len(r6_bad)} cursadas de materias ya aprobadas')
    else:
        ok('R6: ninguna materia aprobada se vuelve a cursar')


# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 2: DISTRIBUCIONES POR GRUPO
# ─────────────────────────────────────────────────────────────────────────────

def check_distribuciones(df_ex, df_mat, df_alm, df_audit):
    print('\n══ BLOQUE 2: Distribuciones por grupo ══')

    merged_alm = df_alm.merge(df_audit[['IdAlumno','TipoAlumno']], on='IdAlumno')
    ex_tipo    = df_ex.merge(df_audit[['IdAlumno','TipoAlumno']], on='IdAlumno')

    specs = {
        'excelente': dict(pct_no_aban=0.93, rec_max=2,  asist=(0.88,1.00), notas=(7.0,9.5), tec=(0.80,0.99)),
        'regular':   dict(pct_no_aban=0.88, rec_max=3,  asist=(0.77,0.93), notas=(4.5,7.0), tec=(0.30,0.55)),
        'malo':      dict(pct_no_aban=0.72, rec_max=999,asist=(0.55,0.75), notas=(2.5,5.0), tec=(0.00,0.05)),
    }

    for tipo, sp in specs.items():
        grp = merged_alm[merged_alm['TipoAlumno'] == tipo]
        n   = len(grp)

        pct = (grp['Abandona'] == 0).mean()
        (ok if pct >= sp['pct_no_aban'] else warn)(
            f'{tipo}: % no abandona = {pct:.1%} (umbral ≥{sp["pct_no_aban"]:.0%})')

        if sp['rec_max'] < 999:
            violadores = grp[grp['MateriasRecursadasTotal'] > sp['rec_max']]
            tol = 0.15
            if len(violadores) / n > tol:
                warn(f'{tipo}: {len(violadores)}/{n} alumnos con recursadas > {sp["rec_max"]}')
            else:
                ok(f'{tipo}: recursadas acumuladas OK')

        mn = ex_tipo[ex_tipo['TipoAlumno'] == tipo]['Nota'].mean()
        lo, hi = sp['notas']
        (ok if lo <= mn <= hi else warn)(f'{tipo}: media nota = {mn:.2f} (esperado [{lo},{hi}])')

        mat_tipo = df_mat.merge(df_audit[['IdAlumno','TipoAlumno']], on='IdAlumno')
        ma = mat_tipo[mat_tipo['TipoAlumno'] == tipo]['Asistencia'].mean()
        lo, hi = sp['asist']
        (ok if lo <= ma <= hi else warn)(f'{tipo}: media asistencia = {ma:.3f} (esperado [{lo},{hi}])')

        pct_tec = grp['ColegioTecnico'].mean()
        lo, hi = sp['tec']
        (ok if lo <= pct_tec <= hi else warn)(
            f'{tipo}: % colegio técnico = {pct_tec:.1%} (esperado [{lo:.0%},{hi:.0%}])')

    con_ayuda = merged_alm[merged_alm['AyudaFinanciera'] == 1]
    if len(con_ayuda):
        p = con_ayuda['TipoAlumno'].eq('excelente').mean()
        (ok if 0.80 <= p <= 0.99 else warn)(f'P(excelente|ayuda) = {p:.2f} (esperado [0.80,0.99])')


# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 3: COHERENCIA TEMPORAL
# ─────────────────────────────────────────────────────────────────────────────

def check_temporal(df_ex, df_alm):
    print('\n══ BLOQUE 3: Coherencia temporal ══')

    bad_ingreso = df_alm[~df_alm['AnioIngreso'].isin(range(2015, 2021))]
    if len(bad_ingreso):
        err(f'{len(bad_ingreso)} alumnos con AnioIngreso fuera de 2015-2020')
    else:
        ok('AnioIngreso: todos en [2015, 2020]')

    if df_alm['Abandona'].isnull().any():
        err('Existen alumnos sin estado Abandona definido')
    else:
        ok('Abandona: todos los 500 alumnos tienen estado definido')

    max_anio = df_ex['Anio'].max()
    if max_anio > 2025:
        err(f'Examen con Anio = {max_anio} > 2025')
    else:
        ok(f'Anio máximo en nivel_examen: {max_anio}')


# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 4: VOLUMEN
# ─────────────────────────────────────────────────────────────────────────────

def check_volumen(df_ex, df_mat, df_alm):
    print('\n══ BLOQUE 4: Volumen ══')
    n_ex  = len(df_ex)
    n_mat = len(df_mat)
    n_grad = (df_alm['Abandona'] == 0).sum()
    n_aban = (df_alm['Abandona'] == 1).sum()

    rng_ex  = '✓' if 190_000 <= n_ex  <= 260_000 else '[WARN fuera de 190k-260k]'
    rng_mat = '✓' if 32_000  <= n_mat <= 45_000  else '[WARN fuera de 32k-45k]'

    print(f'  nivel_examen.csv  : {n_ex:>8,}  {rng_ex}')
    print(f'  nivel_materia.csv : {n_mat:>8,}  {rng_mat}')
    print(f'  Graduados         : {n_grad:>8,}')
    print(f'  Abandonados       : {n_aban:>8,}')

    if not (190_000 <= n_ex  <= 260_000): warn(f'Exámenes {n_ex:,} fuera del rango 190k-260k')
    if not (32_000  <= n_mat <= 45_000):  warn(f'Cursadas {n_mat:,} fuera del rango 32k-45k')
