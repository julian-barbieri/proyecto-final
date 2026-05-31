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
P_OFFTYPE    = 0.12          # prob de comportarse como tipo adyacente por dimensión

B_TIPO       = {'excelente': -4.5, 'regular': -2.0, 'malo': -0.5}
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
