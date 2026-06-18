"""
Generador de datos para seed masivo — 500 alumnos activos.
Reutiliza funciones de generar_datasets.py con ajustes:
  - tipos: 95% excelente / 4% regular / 1% malo
  - anio_ingreso fijo por cohorte
  - abandono descartado (se regenera si ocurre)
  - snapshot al final de 2026 (cuatr 2)

Uso:
    cd ai-service
    python data/seed-data-generator.py
"""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from generar_datasets import (
    MATERIAS,
    MU_ASIST,
    calcular_hazard,
    calcular_indice_bloqueo_global,
    generar_nota,
    generar_asistencia,
    calcular_indice_bloqueo_materia,
    calcular_promedio_correlativas,
    generar_offtype,
    simular_cursada,
)

SEED          = 42
SNAPSHOT_ANIO = 2026

# (cantidad, anio_ingreso, anio_carrera)
COHORTES = [
    (45, 2026, 1),
    (40, 2025, 2),
    (40, 2024, 3),
    (35, 2023, 4),
    (35, 2022, 5),
]

TIPOS_PROB = [0.95, 0.04, 0.01]  # excelente, regular, malo


def generar_perfil_seed(alumno_id: str, tipo: str, anio_ingreso: int, rng) -> dict:
    p_ayuda     = 0.54 if tipo == 'excelente' else 0.02
    ayuda       = int(rng.random() < p_ayuda)
    p_tec       = {'excelente': 0.90, 'regular': 0.40, 'malo': 0.01}[tipo]
    colegio_tec = int(rng.random() < p_tec)

    mu_pc  = {'excelente': 8.0, 'regular': 6.5, 'malo': 5.5}[tipo]
    sig_pc = {'excelente': 0.8, 'regular': 1.0, 'malo': 1.2}[tipo]
    lo_pc  = {'excelente': 5.0, 'regular': 4.0, 'malo': 3.0}[tipo]
    hi_pc  = {'excelente': 10.0, 'regular': 9.0, 'malo': 8.0}[tipo]
    prom_col = float(np.clip(rng.normal(mu_pc, sig_pc), lo_pc, hi_pc))

    tipo_notas, tipo_asist, tipo_abandono = generar_offtype(tipo, rng)

    edad_ingreso = float(np.clip(rng.normal(19, 1.5), 17, 23))
    fecha_nac    = datetime(anio_ingreso, 3, 1) - timedelta(days=int(edad_ingreso * 365.25))
    genero       = 'Masculino' if rng.random() < 0.9 else 'Femenino'

    return {
        'IdAlumno':               alumno_id,
        'TipoAlumno':             tipo,
        'TipoEfectivoNotas':      tipo_notas,
        'TipoEfectivoAsistencia': tipo_asist,
        'TipoEfectivoAbandono':   tipo_abandono,
        'AyudaFinanciera':        ayuda,
        'ColegioTecnico':         colegio_tec,
        'PromedioColegio':        round(prom_col, 2),
        'AnioIngreso':            anio_ingreso,
        'FechaNac':               fecha_nac.strftime('%d-%m-%Y'),
        'Genero':                 genero,
    }


def simular_trayectoria_seed(perfil: dict, rng, snapshot_anio: int) -> tuple:
    """
    Simula trayectoria hasta snapshot_anio (inclusive, cuatr 1).
    Retorna (abandono: bool, snapshot_state: dict | None).
    abandono=True → el caller debe descartar este alumno.
    snapshot_state=None → alumno graduó antes de tener cursadas en 2026.
    """
    alumno_id     = perfil['IdAlumno']
    tipo_notas    = perfil['TipoEfectivoNotas']
    tipo_asist    = perfil['TipoEfectivoAsistencia']
    tipo_abandono = perfil['TipoEfectivoAbandono']
    ayuda         = bool(perfil['AyudaFinanciera'])

    aprobadas:         set  = set()
    notas_aprobadas:   dict = {}
    asistencia_hist:   list = []
    pendiente_recursa: dict = {}

    registros_examen  = []
    registros_materia = []
    snapshot_state    = None

    carga_base = {'excelente': 5, 'regular': 4, 'malo': 3}[tipo_notas]

    for anio in range(perfil['AnioIngreso'], snapshot_anio + 1):
        cuatrs = [1] if anio == snapshot_anio else [1, 2]
        anio_relativo = anio - perfil['AnioIngreso'] + 1
        for cuatr in cuatrs:
            progreso      = len(aprobadas) / 48
            asist_acum    = float(np.mean(asistencia_hist)) if asistencia_hist else MU_ASIST[tipo_asist]
            ind_bloqueo_g = calcular_indice_bloqueo_global(aprobadas)

            p_abandon = calcular_hazard(tipo_abandono, progreso, asist_acum, ind_bloqueo_g, rng)
            if rng.random() < p_abandon:
                return True, None  # abandona → caller descarta

            disponibles = [
                m for m in MATERIAS
                if m not in aprobadas
                and m not in pendiente_recursa
                and all(c in aprobadas for c in MATERIAS[m][3])
                and (MATERIAS[m][1] == 'C' or cuatr == 1)
                and MATERIAS[m][2] <= anio_relativo
            ]
            recursa_disp = [
                m for m in pendiente_recursa
                if all(c in aprobadas for c in MATERIAS[m][3])
                and (MATERIAS[m][1] == 'C' or cuatr == 1)
            ]

            carga = max(1, carga_base + int(rng.integers(-1, 2)))
            materias_cuatr = recursa_disp[:carga]
            slots = carga - len(materias_cuatr)
            if slots > 0:
                rng.shuffle(disponibles)
                materias_cuatr += disponibles[:slots]

            if not materias_cuatr:
                if anio == snapshot_anio and cuatr == cuatrs[-1]:
                    snapshot_state = {
                        'regs_ex':  list(registros_examen),
                        'regs_mat': list(registros_materia),
                    }
                continue

            n_sim = len(materias_cuatr)

            for mat_code in materias_cuatr:
                tipo_mat = MATERIAS[mat_code][1]
                n_veces  = pendiente_recursa.get(mat_code, 0)

                regs_ex, aprobada, nota_final = simular_cursada(
                    mat_code, tipo_mat, cuatr, anio,
                    tipo_notas, tipo_asist, ayuda,
                    aprobadas, notas_aprobadas, n_veces, n_sim, rng,
                )

                for reg in regs_ex:
                    reg.update({
                        'IdAlumno':        alumno_id,
                        'Genero':          perfil['Genero'],
                        'FechaNac':        perfil['FechaNac'],
                        'AyudaFinanciera': perfil['AyudaFinanciera'],
                        'ColegioTecnico':  perfil['ColegioTecnico'],
                        'PromedioColegio': perfil['PromedioColegio'],
                    })
                registros_examen.extend(regs_ex)

                asist_cursada = regs_ex[0]['Asistencia'] if regs_ex else 0.5
                asistencia_hist.append(asist_cursada)

                registros_materia.append({
                    'IdAlumno':    alumno_id,
                    'Materia':     mat_code,
                    'Tipo':        tipo_mat,
                    'AnioCursada': anio,
                    'Asistencia':  round(asist_cursada, 2),
                    'Recursa':     0 if aprobada else 1,
                })

                if aprobada:
                    aprobadas.add(mat_code)
                    notas_aprobadas[mat_code] = nota_final
                    pendiente_recursa.pop(mat_code, None)
                else:
                    pendiente_recursa[mat_code] = n_veces + 1

            if len(aprobadas) == 48:
                snapshot_state = {
                    'regs_ex':  list(registros_examen),
                    'regs_mat': list(registros_materia),
                }
                return False, snapshot_state

            if anio == snapshot_anio and cuatr == cuatrs[-1]:
                snapshot_state = {
                    'regs_ex':  list(registros_examen),
                    'regs_mat': list(registros_materia),
                }

    return False, snapshot_state


def snapshot_to_alumno(alumno_num: int, perfil: dict, snap: dict, anio_carrera: int) -> dict:
    cursadas = []
    for r in snap['regs_mat']:
        anio_c = r['AnioCursada']
        if anio_c == SNAPSHOT_ANIO:
            estado = 'cursando'
        elif r['Recursa'] == 0:
            estado = 'aprobada'
        else:
            estado = 'recursada'
        cursadas.append({
            'materia_codigo_plan': r['Materia'],
            'anio':                anio_c,
            'asistencia':          r['Asistencia'],
            'estado':              estado,
        })

    examenes = []
    for r in snap['regs_ex']:
        examenes.append({
            'materia_codigo_plan': r['Materia'],
            'anio':                r['Anio'],
            'tipo':                r['TipoExamen'],
            'instancia':           r['Instancia'],
            'rendido':             r['ExamenRendido'],
            'nota':                r['Nota'],
            'ausente':             r['AusenteExamen'],
            'veces_recursada':     r['VecesRecursada'],
            'asistencia':          r['Asistencia'],
            'fecha_examen':        r['FechaExamen'],
        })

    username = f'seed_{alumno_num:04d}'
    return {
        'username':         username,
        'nombre_completo':  f'Alumno Seed {alumno_num:04d}',
        'email':            f'{username}@usal.edu.ar',
        'google_id':        f'seed_google_{alumno_num:04d}',
        'genero':           perfil['Genero'],
        'fecha_nac':        perfil['FechaNac'],
        'ayuda_financiera': perfil['AyudaFinanciera'],
        'colegio_tecnico':  perfil['ColegioTecnico'],
        'promedio_colegio': perfil['PromedioColegio'],
        'anio_ingreso':     perfil['AnioIngreso'],
        'anio_carrera':     anio_carrera,
        'tipo':             perfil['TipoAlumno'],
        'cursadas':         cursadas,
        'examenes':         examenes,
    }


def generar_seed_data():
    rng        = np.random.default_rng(SEED)
    alumnos    = []
    alumno_num = 1

    for cantidad, anio_ingreso, anio_carrera in COHORTES:
        generados = 0
        intentos  = 0
        print(f'Generando cohorte año {anio_carrera} ({cantidad} alumnos, ingreso {anio_ingreso})...')

        while generados < cantidad:
            intentos  += 1
            tipo       = rng.choice(['excelente', 'regular', 'malo'], p=TIPOS_PROB)
            alumno_id  = f'SEED{alumno_num:04d}'
            perfil     = generar_perfil_seed(alumno_id, tipo, anio_ingreso, rng)

            abandono, snap = simular_trayectoria_seed(perfil, rng, SNAPSHOT_ANIO)

            if abandono or snap is None:
                continue

            has_2026 = any(r['AnioCursada'] == SNAPSHOT_ANIO for r in snap['regs_mat'])
            if not has_2026:
                continue

            alumno = snapshot_to_alumno(alumno_num, perfil, snap, anio_carrera)
            alumnos.append(alumno)
            alumno_num += 1
            generados  += 1

        print(f'  Cohorte año {anio_carrera}: {generados} alumnos ({intentos} intentos)')

    output_path = Path(__file__).parent.parent.parent / 'backend' / 'src' / 'db' / 'seed-masivo-data.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({'alumnos': alumnos}, f, ensure_ascii=False, indent=2)

    total_cursadas = sum(len(a['cursadas']) for a in alumnos)
    total_examenes = sum(len(a['examenes']) for a in alumnos)
    print(f'\n✅ JSON generado: {output_path}')
    print(f'   Total alumnos:  {len(alumnos)}')
    print(f'   Total cursadas: {total_cursadas}')
    print(f'   Total examenes: {total_examenes}')


if __name__ == '__main__':
    generar_seed_data()
