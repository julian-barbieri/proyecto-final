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

    # R5: tipo A = 1 or 2 parciales (P2 only if P1_final >= 4), tipo C = exactly 1 parcial
    pc = (df_ex[df_ex['TipoExamen'] == 'Parcial']
          .groupby(['IdAlumno','Materia','Anio','Cuatrimestre','Tipo']).size()
          .reset_index(name='n'))
    r5_A = pc[(pc['Tipo'] == 'A') & (~pc['n'].isin([1, 2]))]
    r5_C = pc[(pc['Tipo'] == 'C') & (pc['n'] != 1)]
    if len(r5_A) or len(r5_C):
        err(f'R5: {len(r5_A)} cursadas A con parciales fuera de [1,2], {len(r5_C)} cursadas C con ≠1 parcial')
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
        ok(f'Abandona: todos los {len(df_alm)} alumnos tienen estado definido')

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
    n_alm   = len(df_alm)
    n_grad = (df_alm['Abandona'] == 0).sum()
    n_aban = (df_alm['Abandona'] == 1).sum()

    rng_ex  = '✓' if 230_000 <= n_ex  <= 320_000 else '[WARN fuera de 230k-320k]'
    rng_mat = '✓' if 40_000  <= n_mat <= 60_000  else '[WARN fuera de 40k-60k]'
    rng_alm = '✓' if 900     <= n_alm <= 1100    else '[WARN fuera de 900-1100]'

    print(f'  nivel_examen.csv  : {n_ex:>8,}  {rng_ex}')
    print(f'  nivel_materia.csv : {n_mat:>8,}  {rng_mat}')
    print(f'  nivel_alumno.csv  : {n_alm:>8,}  {rng_alm}')
    print(f'  Graduados         : {n_grad:>8,}')
    print(f'  Abandonados       : {n_aban:>8,}')

    if not (230_000 <= n_ex  <= 320_000): warn(f'Exámenes {n_ex:,} fuera del rango 230k-320k')
    if not (40_000  <= n_mat <= 60_000):  warn(f'Cursadas {n_mat:,} fuera del rango 40k-60k')
    if not (900     <= n_alm <= 1100):    warn(f'Alumnos {n_alm} fuera del rango 900-1100')


# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 4b: COHORTES EN-CURSO
# ─────────────────────────────────────────────────────────────────────────────

def check_cohortes_en_curso(df_alm: pd.DataFrame):
    print('\n══ BLOQUE 4b: Cohortes en-curso ══')

    # Terminales: AñosDesdeIngreso = 2026 - AnioIngreso ∈ {6..11}
    # En-curso:   AñosDesdeIngreso = snapshot_year ∈ {1..5}
    terminales = df_alm[df_alm['AñosDesdeIngreso'] > 5]
    en_curso   = df_alm[df_alm['AñosDesdeIngreso'].between(1, 5)]

    if not (450 <= len(terminales) <= 550):
        warn(f'Terminales: {len(terminales)} (esperado ~500)')
    else:
        ok(f'Terminales: {len(terminales)}')

    if not (450 <= len(en_curso) <= 550):
        warn(f'En-curso: {len(en_curso)} (esperado ~500)')
    else:
        ok(f'En-curso total: {len(en_curso)}')

    for year in range(1, 6):
        n = (en_curso['AñosDesdeIngreso'] == year).sum()
        if not (80 <= n <= 120):
            warn(f'Cohorte año-{year}: {n} alumnos (esperado ~100)')
        else:
            ok(f'Cohorte año-{year}: {n} alumnos')

    # Anti-leakage: alumnos en-curso no deben tener fecha de abandono
    en_curso_con_fecha = en_curso[en_curso['Fecha'].fillna('').str.strip() != '']
    if len(en_curso_con_fecha) > 0:
        err(f'[LEAKAGE] {len(en_curso_con_fecha)} alumnos en-curso con Fecha != ""')
    else:
        ok('Anti-leakage: ningún alumno en-curso tiene fecha de abandono')


# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 5: ACCURACY BASELINE + ANTI-LEAKAGE
# ─────────────────────────────────────────────────────────────────────────────

def check_accuracy_baseline():
    from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
    from sklearn.metrics import accuracy_score, r2_score, mean_absolute_error
    from feature_engineering import ft_engineering_procesado

    print('\n══ BLOQUE 5: Accuracy baseline ══')

    # Generar los 3 datasets de modelado usando ft_engineering.py real
    print('  Generando dataset_alumno  via ft_engineering_procesado("alumno")...')
    Xtr_a, Xte_a, ytr_a, yte_a = ft_engineering_procesado('alumno')
    print('  Generando dataset_materia via ft_engineering_procesado("materia")...')
    Xtr_m, Xte_m, ytr_m, yte_m = ft_engineering_procesado('materia')
    print('  Generando dataset_examen  via ft_engineering_procesado("examen")...')
    Xtr_e, Xte_e, ytr_e, yte_e = ft_engineering_procesado('examen')

    # Guardar CSVs de modelado
    import pandas as pd
    pd.concat([Xtr_a.assign(split='train'), Xte_a.assign(split='test')]).to_csv(
        os.path.join(_DATA_DIR, 'dataset_alumno.csv'), index=False)
    pd.concat([Xtr_m.assign(split='train'), Xte_m.assign(split='test')]).to_csv(
        os.path.join(_DATA_DIR, 'dataset_materia.csv'), index=False)
    pd.concat([Xtr_e.assign(split='train'), Xte_e.assign(split='test')]).to_csv(
        os.path.join(_DATA_DIR, 'dataset_examen.csv'), index=False)

    # Assert: TipoAlumno no está en ningún dataset de modelado
    for nombre, X in [('alumno', Xtr_a), ('materia', Xtr_m), ('examen', Xtr_e)]:
        assert 'TipoAlumno' not in X.columns, \
            f'[BUG] TipoAlumno encontrado en dataset_{nombre} — LEAKAGE!'
        ok(f'Anti-leakage: TipoAlumno ausente en dataset_{nombre}')

    # Modelos baseline
    def _check_range(val, lo, hi, label):
        sym = '✓' if lo <= val <= hi else '✗'
        print(f'  {sym} {label}: {val:.3f}  (esperado [{lo},{hi}])')
        if val > hi:
            warn(f'{label} = {val:.3f} > {hi} — subir P_OFFTYPE o SIGMA_NOTA en generar_datasets.py')
        elif val < lo:
            warn(f'{label} = {val:.3f} < {lo} — bajar P_OFFTYPE o SIGMA_NOTA en generar_datasets.py')

    clf_a = DecisionTreeClassifier(max_depth=4, random_state=42)
    clf_a.fit(Xtr_a, ytr_a)
    acc_a = accuracy_score(yte_a, clf_a.predict(Xte_a))
    _check_range(acc_a, 0.80, 0.88, 'Abandono accuracy')

    clf_m = DecisionTreeClassifier(max_depth=4, random_state=42)
    clf_m.fit(Xtr_m, ytr_m)
    acc_m = accuracy_score(yte_m, clf_m.predict(Xte_m))
    _check_range(acc_m, 0.80, 0.88, 'Recursa  accuracy')

    reg_e = DecisionTreeRegressor(max_depth=4, random_state=42)
    reg_e.fit(Xtr_e, ytr_e)
    yhat_e = reg_e.predict(Xte_e)
    _check_range(r2_score(yte_e, yhat_e),           0.30, 0.65, 'Prox nota R²')
    _check_range(mean_absolute_error(yte_e, yhat_e), 1.0,  2.0, 'Prox nota MAE')


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    df_ex  = pd.read_csv(os.path.join(_DATA_DIR, 'nivel_examen.csv'))
    df_mat = pd.read_csv(os.path.join(_DATA_DIR, 'nivel_materia.csv'))
    df_alm = pd.read_csv(os.path.join(_DATA_DIR, 'nivel_alumno.csv'))
    df_aud = pd.read_csv(os.path.join(_DATA_DIR, 'audit_tipos.csv'))

    check_reglas_negocio(df_ex, df_mat)
    check_distribuciones(df_ex, df_mat, df_alm, df_aud)
    check_temporal(df_ex, df_alm)
    check_volumen(df_ex, df_mat, df_alm)
    check_cohortes_en_curso(df_alm)
    check_accuracy_baseline()

    print(f'\n══ REPORTE FINAL ══')
    print(f'  Errores  : {len(ERRORES)}')
    print(f'  Warnings : {len(WARNINGS)}')
    for e in ERRORES:
        print(f'  [ERROR] {e}')
    if not ERRORES:
        print('  ✓ Todos los checks críticos pasaron.')


if __name__ == '__main__':
    main()
