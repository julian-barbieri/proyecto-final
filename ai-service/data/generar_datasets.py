"""
Generador de datasets sintéticos realistas.
Modelo en 3 capas: perfil latente → trayectoria cuatrimestral → exámenes por materia.

Uso:
    cd ai-service
    python data/generar_datasets.py          # genera en data/
    python data/generar_datasets.py --out /ruta/alternativa
"""
import os
import sys
import argparse
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

# ─────────────────────────────────────────────────────────────────────────────
# PARÁMETROS AJUSTABLES
# ─────────────────────────────────────────────────────────────────────────────
N_ALUMNOS    = 500
SEED         = 42
P_OFFTYPE    = 0.18          # prob de comportarse como tipo adyacente por dimensión

B_TIPO       = {'excelente': -6.0, 'regular': -4.0, 'malo': -2.0}
W_PROGRESO   = -3.0
W_ASISTENCIA = -2.0
W_BLOQUEO    = +1.5
SIGMA_HAZARD = 0.3

MU_NOTA      = {'excelente': 8.0, 'regular': 5.5, 'malo': 3.5}
SIGMA_NOTA   = {'excelente': 1.5, 'regular': 1.8, 'malo': 1.5}
MU_ASIST     = {'excelente': 0.93, 'regular': 0.85, 'malo': 0.65}
SIGMA_ASIST  = {'excelente': 0.05, 'regular': 0.08, 'malo': 0.10}

# ─────────────────────────────────────────────────────────────────────────────
# MALLA CURRICULAR  (código: (nombre, tipo, año_plan, [correlativas]))
# ─────────────────────────────────────────────────────────────────────────────
MATERIAS = {
    140: ("Introducción a la Administración de Empresas", "C", 1, []),
    141: ("Sistemas Numéricos",                           "C", 1, []),
    142: ("Análisis Matemático I",                        "A", 1, []),
    143: ("Metodología de la Investigación",              "C", 1, []),
    144: ("Introducción a la Programación",               "C", 1, []),
    145: ("Arquitectura de Computadoras",                 "C", 1, [141]),
    146: ("Álgebra I",                                    "C", 1, []),
    147: ("Paradigmas de Programación",                   "C", 1, [144]),
    148: ("Programación I",                               "C", 1, [144]),
    149: ("Sistemas de Representación",                   "C", 2, []),
    150: ("Física I",                                     "C", 2, []),
    151: ("Cálculo Numérico",                             "C", 2, [142]),
    152: ("Estructura de Datos y Algoritmos",             "A", 2, [144]),
    153: ("Sistemas de Información I",                    "A", 2, []),
    154: ("Álgebra II",                                   "C", 2, [146]),
    155: ("Filosofía",                                    "C", 2, []),
    156: ("Programación II",                              "C", 2, [147, 148]),
    157: ("Teoría de Lenguajes",                          "C", 2, [147, 148]),
    158: ("Análisis Matemático II",                       "C", 2, [142]),
    159: ("Química General",                              "C", 3, []),
    160: ("Física II",                                    "C", 3, [150]),
    161: ("Sistemas Operativos",                          "A", 3, [152]),
    162: ("Sistemas de Información II",                   "A", 3, [153]),
    163: ("Sistemas de Bases de Datos",                   "A", 3, [152]),
    164: ("Probabilidad y Estadística",                   "A", 3, [154]),
    165: ("Programación Avanzada",                        "A", 3, [156]),
    166: ("Teleinformática",                              "C", 3, [145]),
    167: ("Física III",                                   "C", 3, [160]),
    168: ("Inglés I",                                     "C", 3, []),
    169: ("Inglés II",                                    "C", 3, []),
    170: ("Tecnología Informática",                       "C", 4, [161]),
    171: ("Ingeniería del Software",                      "C", 4, [162]),
    172: ("Seminario de Integración Profesional",         "A", 4, [156, 162]),
    173: ("Investigación Operativa",                      "C", 4, [164]),
    174: ("Arquitectura de Redes",                        "C", 4, [166]),
    175: ("Dirección de Proyectos Informáticos",          "C", 4, [162]),
    176: ("Auditoría de Sistemas",                        "C", 4, [162]),
    177: ("Teología",                                     "C", 4, []),
    178: ("Modelos y Simulación",                         "C", 4, [164]),
    179: ("Derecho Informático",                          "C", 5, []),
    180: ("Ética Profesional",                            "C", 5, []),
    181: ("Tecnologías Emergentes",                       "A", 5, [170]),
    182: ("Sistemas Inteligentes",                        "A", 5, [165]),
    183: ("Proyecto Final de Ingeniería en Informática",  "A", 5, [172, 175]),
    184: ("Gestión Ambiental",                            "C", 5, []),
    185: ("Aseguramiento de la Calidad del Software",     "C", 5, [171]),
    186: ("Seguridad Informática",                        "C", 5, [176]),
    187: ("Elementos de Economía",                        "C", 5, []),
}

MATERIAS_BOTTLENECK = {144, 147, 148, 152, 156, 162, 164}

_ADJACENT = {
    'excelente': ['regular'],
    'regular':   ['excelente', 'malo'],
    'malo':      ['regular'],
}

# ─────────────────────────────────────────────────────────────────────────────
# UTILIDADES
# ─────────────────────────────────────────────────────────────────────────────

def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -30, 30)))


def calcular_hazard(tipo_abandono: str, progreso: float, asistencia_acum: float,
                    indice_bloqueo: float, rng) -> float:
    logit = (B_TIPO[tipo_abandono]
             + W_PROGRESO   * progreso
             + W_ASISTENCIA * asistencia_acum
             + W_BLOQUEO    * indice_bloqueo
             + rng.normal(0, SIGMA_HAZARD))
    return float(sigmoid(logit))


def generar_nota(tipo_notas: str, rng, ayuda: bool = False) -> float:
    nota = rng.normal(MU_NOTA[tipo_notas], SIGMA_NOTA[tipo_notas])
    if ayuda:
        nota += float(np.clip(rng.normal(0.3, 0.2), 0.0, 0.8))
    return float(np.clip(nota, 1.0, 10.0))


def generar_asistencia(tipo_asist: str, rng, ayuda: bool = False) -> float:
    asist = rng.normal(MU_ASIST[tipo_asist], SIGMA_ASIST[tipo_asist])
    if ayuda:
        asist += 0.03
    return float(np.clip(asist, 0.3, 1.0))


def calcular_indice_bloqueo_materia(aprobadas: set, materia_code: int) -> float:
    corrs = MATERIAS[materia_code][3]
    if not corrs:
        return 0.0
    return round(sum(1 for c in corrs if c not in aprobadas) / len(corrs), 2)


def calcular_indice_bloqueo_global(aprobadas: set) -> float:
    no_aprobadas = [m for m in MATERIAS if m not in aprobadas]
    if not no_aprobadas:
        return 0.0
    bloqueadas = sum(
        1 for m in no_aprobadas
        if not all(c in aprobadas for c in MATERIAS[m][3])
    )
    return bloqueadas / len(no_aprobadas)


def calcular_promedio_correlativas(notas_aprobadas: dict, materia_code: int) -> float:
    corrs = MATERIAS[materia_code][3]
    vals = [notas_aprobadas[c] for c in corrs if c in notas_aprobadas]
    return round(float(np.mean(vals)), 2) if vals else 0.0


def generar_offtype(tipo: str, rng) -> tuple:
    """Returns (tipo_notas, tipo_asist, tipo_abandono). Each dimension independently off-type."""
    def _maybe_flip(t):
        if rng.random() < P_OFFTYPE:
            adj = _ADJACENT[t]
            return adj[int(rng.integers(0, len(adj)))]
        return t
    return _maybe_flip(tipo), _maybe_flip(tipo), _maybe_flip(tipo)


# ── Fechas ────────────────────────────────────────────────────────────────────

def _fecha(anio, mes, lo, hi, rng):
    return datetime(anio, mes, int(rng.integers(lo, hi + 1)))


def fecha_parcial(tipo_mat, cuatr, anio, instancia, rng):
    if tipo_mat == 'A':
        return _fecha(anio, 6 if instancia == 1 else 11, 10, 20, rng)
    return _fecha(anio, 4 if cuatr == 1 else 9, 10, 25, rng)


def fecha_recuperatorio(tipo_mat, cuatr, anio, instancia, rng):
    if tipo_mat == 'A':
        return _fecha(anio, 6 if instancia == 1 else 11, 21, 28, rng)
    return _fecha(anio, 5 if cuatr == 1 else 10, 5, 20, rng)


def fecha_final(tipo_mat, cuatr, anio, instancia, rng):
    slots = {
        ('A', 0): [(anio, 12, 1, 29), (anio+1, 2, 1, 27), (anio+1, 7, 1, 30)],
        ('C', 1): [(anio, 6, 10, 28), (anio+1, 2, 1, 27), (anio+1, 7, 1, 30)],
        ('C', 2): [(anio, 11, 10, 28), (anio+1, 2, 1, 27), (anio+1, 7, 1, 30)],
    }
    y, m, lo, hi = slots[(tipo_mat, 0 if tipo_mat == 'A' else cuatr)][instancia - 1]
    return _fecha(y, m, lo, hi, rng)


# ─────────────────────────────────────────────────────────────────────────────
# CAPA 1: PERFIL LATENTE
# ─────────────────────────────────────────────────────────────────────────────

def generar_perfil(alumno_id: str, rng) -> dict:
    tipo = rng.choice(['excelente', 'regular', 'malo'], p=[0.25, 0.50, 0.25])

    # Ayuda económica: P(ayuda|excelente)=0.54, P(ayuda|no-excelente)=0.02
    p_ayuda = 0.54 if tipo == 'excelente' else 0.02
    ayuda = int(rng.random() < p_ayuda)

    # Colegio técnico por tipo
    p_tec = {'excelente': 0.90, 'regular': 0.40, 'malo': 0.01}[tipo]
    colegio_tec = int(rng.random() < p_tec)

    # Promedio colegio (Gaussiana suave, sin cortes duros entre tipos)
    mu_pc   = {'excelente': 8.0, 'regular': 6.5, 'malo': 5.5}[tipo]
    sig_pc  = {'excelente': 0.8, 'regular': 1.0, 'malo': 1.2}[tipo]
    lo_pc   = {'excelente': 5.0, 'regular': 4.0, 'malo': 3.0}[tipo]
    hi_pc   = {'excelente': 10.0,'regular': 9.0, 'malo': 8.0}[tipo]
    prom_col = float(np.clip(rng.normal(mu_pc, sig_pc), lo_pc, hi_pc))

    tipo_notas, tipo_asist, tipo_abandono = generar_offtype(tipo, rng)

    anio_ingreso = int(rng.choice([2015, 2016, 2017, 2018, 2019, 2020]))
    edad_ingreso = float(np.clip(rng.normal(19, 1.5), 17, 23))
    fecha_nac    = datetime(anio_ingreso, 3, 1) - timedelta(days=int(edad_ingreso * 365.25))
    genero       = 'Masculino' if rng.random() < 0.9 else 'Femenino'

    return {
        'IdAlumno':              alumno_id,
        'TipoAlumno':            tipo,
        'TipoEfectivoNotas':     tipo_notas,
        'TipoEfectivoAsistencia':tipo_asist,
        'TipoEfectivoAbandono':  tipo_abandono,
        'AyudaFinanciera':       ayuda,
        'ColegioTecnico':        colegio_tec,
        'PromedioColegio':       round(prom_col, 2),
        'AnioIngreso':           anio_ingreso,
        'FechaNac':              fecha_nac.strftime('%d-%m-%Y'),
        'Genero':                genero,
    }


# ─────────────────────────────────────────────────────────────────────────────
# CAPA 3: SIMULACIÓN DE EXÁMENES POR MATERIA
# ─────────────────────────────────────────────────────────────────────────────

def simular_cursada(materia_code: int, tipo_mat: str, cuatr: int, anio: int,
                    tipo_notas: str, tipo_asist: str, ayuda: bool,
                    aprobadas: set, notas_aprobadas: dict,
                    n_veces_recursada: int, n_materias_simultaneas: int,
                    rng) -> tuple:
    """
    Simula una cursada completa.
    Returns: (registros_examen: list[dict], aprobada: bool, nota_final: float | None)
    """
    _, _, ano_plan, _ = MATERIAS[materia_code]
    asistencia     = generar_asistencia(tipo_asist, rng, ayuda)
    ind_bloqueo    = calcular_indice_bloqueo_materia(aprobadas, materia_code)
    nota_prom_corr = calcular_promedio_correlativas(notas_aprobadas, materia_code)

    registros = []

    def _reg(tipo_examen, instancia, nota, fecha):
        return {
            'Materia':                    materia_code,
            'Tipo':                       tipo_mat,
            'Cuatrimestre':               0 if tipo_mat == 'A' else cuatr,
            'Anio':                       anio,
            'TipoExamen':                 tipo_examen,
            'Instancia':                  instancia,
            'Asistencia':                 round(asistencia, 2),
            'VecesRecursada':             n_veces_recursada,
            'AñoCarrera':                 ano_plan,
            'NotaPromedioCorrelativas':   nota_prom_corr,
            'MateriasAprobadasHastaMomento': len(aprobadas),
            'CargaSimultanea':            n_materias_simultaneas,
            'IndiceBloqueo':              ind_bloqueo,
            'ExamenRendido':              1,
            'AusenteExamen':              0,
            'Nota':                       round(nota, 2),
            'FechaExamen':                fecha.strftime('%d-%m-%Y'),
        }

    # ── Flujo cuatrimestral (tipo C) ─────────────────────────────────────────
    if tipo_mat == 'C':
        nota_p1 = generar_nota(tipo_notas, rng, ayuda)
        registros.append(_reg('Parcial', 1, nota_p1,
                              fecha_parcial('C', cuatr, anio, 1, rng)))
        if nota_p1 < 4:
            nota_r1 = generar_nota(tipo_notas, rng, ayuda)
            registros.append(_reg('Recuperatorio', 1, nota_r1,
                                  fecha_recuperatorio('C', cuatr, anio, 1, rng)))
            nota_p1_final = nota_r1
        else:
            nota_p1_final = nota_p1

        if nota_p1_final < 4 or asistencia < 0.75:
            return registros, False, None

        for inst in range(1, 4):
            nota_f = round(generar_nota(tipo_notas, rng, ayuda), 2)
            registros.append(_reg('Final', inst, nota_f,
                                  fecha_final('C', cuatr, anio, inst, rng)))
            if nota_f >= 4:
                return registros, True, nota_f

        return registros, False, None

    # ── Flujo anual (tipo A) ──────────────────────────────────────────────────
    nota_p1 = generar_nota(tipo_notas, rng, ayuda)
    registros.append(_reg('Parcial', 1, nota_p1,
                          fecha_parcial('A', 0, anio, 1, rng)))
    if nota_p1 < 4:
        nota_r1 = generar_nota(tipo_notas, rng, ayuda)
        registros.append(_reg('Recuperatorio', 1, nota_r1,
                              fecha_recuperatorio('A', 0, anio, 1, rng)))
        nota_p1_final = nota_r1
    else:
        nota_p1_final = nota_p1

    if nota_p1_final < 4:
        return registros, False, None

    nota_p2 = generar_nota(tipo_notas, rng, ayuda)
    registros.append(_reg('Parcial', 2, nota_p2,
                          fecha_parcial('A', 0, anio, 2, rng)))
    if nota_p2 < 4:
        nota_r2 = generar_nota(tipo_notas, rng, ayuda)
        registros.append(_reg('Recuperatorio', 2, nota_r2,
                              fecha_recuperatorio('A', 0, anio, 2, rng)))
        nota_p2_final = nota_r2
    else:
        nota_p2_final = nota_p2

    if nota_p2_final < 4 or asistencia < 0.75:
        return registros, False, None

    for inst in range(1, 4):
        nota_f = round(generar_nota(tipo_notas, rng, ayuda), 2)
        registros.append(_reg('Final', inst, nota_f,
                              fecha_final('A', 0, anio, inst, rng)))
        if nota_f >= 4:
            return registros, True, nota_f

    return registros, False, None


# ─────────────────────────────────────────────────────────────────────────────
# CAPA 2: TRAYECTORIA CUATRIMESTRAL
# ─────────────────────────────────────────────────────────────────────────────

def simular_trayectoria(perfil: dict, rng) -> tuple:
    """
    Returns: (registros_examen, registros_materia, estado_final, fecha_abandono)
    estado_final in {'graduado', 'abandonó', 'timeout-abandonó'}
    """
    alumno_id      = perfil['IdAlumno']
    tipo_notas     = perfil['TipoEfectivoNotas']
    tipo_asist     = perfil['TipoEfectivoAsistencia']
    tipo_abandono  = perfil['TipoEfectivoAbandono']
    ayuda          = bool(perfil['AyudaFinanciera'])

    aprobadas:       set  = set()
    notas_aprobadas: dict = {}
    asistencia_hist: list = []
    pendiente_recursa: dict = {}   # materia_code → n_veces_fallida

    registros_examen  = []
    registros_materia = []

    carga_base = {'excelente': 5, 'regular': 4, 'malo': 3}[tipo_notas]

    for anio in range(perfil['AnioIngreso'], 2026):
        for cuatr in [1, 2]:

            # ── Hazard de abandono ──────────────────────────────────────────
            progreso      = len(aprobadas) / 48
            asist_acum    = float(np.mean(asistencia_hist)) if asistencia_hist else MU_ASIST[tipo_asist]
            ind_bloqueo_g = calcular_indice_bloqueo_global(aprobadas)

            p_abandon = calcular_hazard(tipo_abandono, progreso, asist_acum, ind_bloqueo_g, rng)

            if rng.random() < p_abandon:
                mes = 6 if cuatr == 1 else 11
                dia = int(rng.integers(1, 28))
                fecha_ab = datetime(anio, mes, dia).strftime('%d-%m-%Y')
                return registros_examen, registros_materia, 'abandonó', fecha_ab

            # ── Seleccionar materias ────────────────────────────────────────
            disponibles = [
                m for m in MATERIAS
                if m not in aprobadas
                and m not in pendiente_recursa
                and all(c in aprobadas for c in MATERIAS[m][3])
                and (MATERIAS[m][1] == 'C' or cuatr == 1)   # anuales solo C1
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

                # Enriquecer con datos demográficos del alumno
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

                delay = anio - (perfil['AnioIngreso'] + MATERIAS[mat_code][2] - 1)

                registros_materia.append({
                    'IdAlumno':            alumno_id,
                    'Materia':             mat_code,
                    'Tipo':                tipo_mat,
                    'Cuatrimestre':        0 if tipo_mat == 'A' else cuatr,
                    'AnioCursada':         anio,
                    'FechaNac':            perfil['FechaNac'],
                    'AyudaFinanciera':     perfil['AyudaFinanciera'],
                    'ColegioTecnico':      perfil['ColegioTecnico'],
                    'PromedioColegio':     perfil['PromedioColegio'],
                    'Asistencia':          round(asist_cursada, 2),
                    'Recursa':             0 if aprobada else 1,
                    'AñoCarrera':          MATERIAS[mat_code][2],
                    'DelayRespectoPlan':   delay,
                    'NotaPromedioPrevias': calcular_promedio_correlativas(notas_aprobadas, mat_code),
                    'EsMateriaBottleneck': int(mat_code in MATERIAS_BOTTLENECK),
                    'IndiceBloqueo':       calcular_indice_bloqueo_materia(aprobadas, mat_code),
                })

                if aprobada:
                    aprobadas.add(mat_code)
                    notas_aprobadas[mat_code] = nota_final
                    pendiente_recursa.pop(mat_code, None)
                else:
                    pendiente_recursa[mat_code] = n_veces + 1

            if len(aprobadas) == 48:
                return registros_examen, registros_materia, 'graduado', ''

    return registros_examen, registros_materia, 'timeout-abandonó', ''


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

_EXAMEN_COLS = [
    'IdAlumno','Materia','Tipo','Cuatrimestre','Anio','TipoExamen','Instancia',
    'Genero','FechaNac','AyudaFinanciera','ColegioTecnico','PromedioColegio',
    'Asistencia','VecesRecursada','ExamenRendido','AusenteExamen','Nota',
    'FechaExamen','AñoCarrera','NotaPromedioCorrelativas',
    'MateriasAprobadasHastaMomento','CargaSimultanea','IndiceBloqueo',
]
_MATERIA_COLS = [
    'IdAlumno','Materia','Tipo','Cuatrimestre','AnioCursada','FechaNac',
    'AyudaFinanciera','ColegioTecnico','PromedioColegio','Asistencia','Recursa',
    'AñoCarrera','DelayRespectoPlan','NotaPromedioPrevias',
    'EsMateriaBottleneck','IndiceBloqueo',
]
_ALUMNO_COLS = [
    'IdAlumno','FechaNac','Genero','AyudaFinanciera','ColegioTecnico',
    'PromedioColegio','Fecha','Abandona','AnioIngreso','EstadoFinal',
    'MateriasAprobadas','AñoCarreraActual','TasaProgresion','PrimerAñoCompleto',
    'MateriasRecursadasTotal','AñosDesdeIngreso','IndiceBloqueo',
]


def generar_datasets(output_dir: str = None, n_alumnos: int = N_ALUMNOS) -> tuple:
    if output_dir is None:
        output_dir = os.path.dirname(os.path.abspath(__file__))
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(SEED)

    todos_examenes = []
    todos_materias = []
    todos_alumnos  = []
    audit          = []

    print(f'Generando {n_alumnos} alumnos...')
    for i in range(1, n_alumnos + 1):
        alumno_id = f'ALU{i:04d}'
        perfil    = generar_perfil(alumno_id, rng)

        regs_ex, regs_mat, estado, fecha_ab = simular_trayectoria(perfil, rng)

        todos_examenes.extend(regs_ex)
        todos_materias.extend(regs_mat)

        aprobadas_set  = {r['Materia'] for r in regs_mat if r['Recursa'] == 0}
        mat_aprobadas  = len(aprobadas_set)
        mat_recursadas = sum(1 for r in regs_mat if r['Recursa'] == 1)

        todos_alumnos.append({
            'IdAlumno':              alumno_id,
            'FechaNac':              perfil['FechaNac'],
            'Genero':                perfil['Genero'],
            'AyudaFinanciera':       perfil['AyudaFinanciera'],
            'ColegioTecnico':        perfil['ColegioTecnico'],
            'PromedioColegio':       perfil['PromedioColegio'],
            'Fecha':                 fecha_ab,
            'Abandona':              0 if estado == 'graduado' else 1,
            'AnioIngreso':           perfil['AnioIngreso'],
            'EstadoFinal':           estado,
            'MateriasAprobadas':     mat_aprobadas,
            'AñoCarreraActual':      min(int(mat_aprobadas / 10) + 1, 5),
            'TasaProgresion':        round(mat_aprobadas / 48, 3),
            'PrimerAñoCompleto':     int(mat_aprobadas >= 8),
            'MateriasRecursadasTotal': mat_recursadas,
            'AñosDesdeIngreso':      2026 - perfil['AnioIngreso'],
            'IndiceBloqueo':         0.0,
        })

        audit.append({
            'IdAlumno':                alumno_id,
            'TipoAlumno':              perfil['TipoAlumno'],
            'TipoEfectivoNotas':       perfil['TipoEfectivoNotas'],
            'TipoEfectivoAsistencia':  perfil['TipoEfectivoAsistencia'],
            'TipoEfectivoAbandono':    perfil['TipoEfectivoAbandono'],
        })

        if i % 50 == 0:
            print(f'  {i}/{n_alumnos} alumnos procesados...')

    df_ex  = pd.DataFrame(todos_examenes)[_EXAMEN_COLS]
    df_mat = pd.DataFrame(todos_materias)[_MATERIA_COLS]
    df_alm = pd.DataFrame(todos_alumnos)[_ALUMNO_COLS]
    df_aud = pd.DataFrame(audit)

    df_ex.to_csv( os.path.join(output_dir, 'nivel_examen.csv'),  index=False)
    df_mat.to_csv(os.path.join(output_dir, 'nivel_materia.csv'), index=False)
    df_alm.to_csv(os.path.join(output_dir, 'nivel_alumno.csv'),  index=False)
    df_aud.to_csv(os.path.join(output_dir, 'audit_tipos.csv'),   index=False)

    n_ex  = len(df_ex)
    n_mat = len(df_mat)
    print(f'\nnivel_examen.csv  : {n_ex:>8,}', end='')
    print('' if 190_000 <= n_ex  <= 260_000 else '  [WARN] fuera del rango orientativo 190k-260k')
    print(f'nivel_materia.csv : {n_mat:>8,}', end='')
    print('' if 32_000  <= n_mat <= 45_000  else '  [WARN] fuera del rango orientativo 32k-45k')
    print(f'nivel_alumno.csv  : {len(df_alm):>8,}')
    print(f'audit_tipos.csv   : {len(df_aud):>8,}')

    return df_ex, df_mat, df_alm, df_aud


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default=None, help='Output directory (default: same as script)')
    args = parser.parse_args()
    generar_datasets(output_dir=args.out)
