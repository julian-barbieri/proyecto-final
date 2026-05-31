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
