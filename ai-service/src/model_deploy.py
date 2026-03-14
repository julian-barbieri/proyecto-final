# ---------------------------------------------------------------------------
# 1) Importacion de librerias
# ---------------------------------------------------------------------------
import os
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List


# ---------------------------------------------------------------------------
# 2) Instanciamos la aplicacion
# ---------------------------------------------------------------------------
app = FastAPI(
    title='API de Predicciones Academicas',
    description=(
        'Prediccion de abandono de carrera (alumno), '
        'recursado de materia (materia) y nota de examen (examen).'
    ),
    version='1.0.0',
)


# ---------------------------------------------------------------------------
# 3) Llamamos a los modelos ya entrenados
# ---------------------------------------------------------------------------
_MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

try:
    model_alumno  = joblib.load(os.path.join(_MODELS_DIR, 'modelo_alumno.pkl'))
    model_materia = joblib.load(os.path.join(_MODELS_DIR, 'modelo_materia.pkl'))
    model_examen  = joblib.load(os.path.join(_MODELS_DIR, 'modelo_examen.pkl'))
except FileNotFoundError as exc:
    raise RuntimeError(
        f'Modelo no encontrado: {exc}. '
        'Ejecuta model_training_evaluation.py antes de iniciar la API.'
    ) from exc


# ---------------------------------------------------------------------------
# 3b) Health check
# ---------------------------------------------------------------------------

@app.get('/health', summary='Health check', tags=['Sistema'])
def health():
    """Verifica que la API está activa y los tres modelos están cargados."""
    return {
        'status': 'ok',
        'modelos_cargados': ['modelo_alumno', 'modelo_materia', 'modelo_examen'],
    }


# ---------------------------------------------------------------------------
# 4) Modelos de datos de entrada (validacion con Pydantic)
# ---------------------------------------------------------------------------

class AlumnoInput(BaseModel):
    """
    Features requeridas para predecir si un alumno abandona la carrera.
    Las features de historial deben ser pre-calculadas agregando
    nivel_materia y nivel_examen por IdAlumno.
    """
    # -- Demograficas ----------------------------------------------------------
    Genero: int            # 0=Femenino, 1=Masculino
    Edad: int              # Edad al momento de ingreso a la carrera
    AyudaFinanciera: int   # 0=No, 1=Si
    ColegioTecnico: int    # 0=No, 1=Si
    AnioIngreso: int       # Anio en que ingreso a la carrera

    # -- Historial de cursadas (agregado desde nivel_materia) ------------------
    CantMaterias: int        # Total de materias cursadas
    CantRecursa: int         # Cuantas cursadas terminaron en recursar
    TasaRecursa: float       # CantRecursa / CantMaterias (0.0 si sin actividad)
    PromedioAsistencia: float # Promedio de asistencia en todas las cursadas
    CantAniosCursados: int   # Cantidad de anios distintos con actividad

    # -- Historial de examenes (agregado desde nivel_examen) -------------------
    CantExamenesRendidos: int  # Total de examenes efectivamente rendidos
    PromedioNota: float        # Promedio de notas en examenes rendidos
    CantFinalesRendidos: int   # Cuantas veces llego a instancia Final
    CantAusencias: int         # Total de ausencias a examenes
    TasaAusencia: float        # CantAusencias / TotalIntentos
    CantAprobados: int         # Examenes aprobados (nota >= 4)
    TasaAprobacion: float      # CantAprobados / CantExamenesRendidos


class MateriaInput(BaseModel):
    """
    Features requeridas para predecir si un alumno recursara una materia.
    Las features de historial deben ser pre-calculadas por (IdAlumno, Materia)
    y por IdAlumno desde nivel_examen.
    """
    # -- Datos de la cursada ---------------------------------------------------
    Materia: int        # 0=AM1, 1=AM2
    Asistencia: float   # Asistencia en esta cursada (0.0 a 1.0)
    AyudaFinanciera: int  # 0=No, 1=Si
    ColegioTecnico: int   # 0=No, 1=Si
    PromedioColegio: float # Promedio del colegio secundario (0-10)
    AnioCursada: int      # Anio de la cursada

    # -- Demograficas (desde nivel_alumno) ------------------------------------
    Genero: int            # 0=Femenino, 1=Masculino
    Edad: int              # Edad al momento de la cursada
    AniosDesdeIngreso: int # AnioCursada - AnioIngreso

    # -- Historial en esta materia especifica (desde nivel_examen) ------------
    VecesRendidaExamenMateria: int  # Total de intentos de examen en esta materia
    VecesAusenteMateria: int        # Cuantas veces estuvo ausente en esta materia
    PromedioNotaMateria: float      # Promedio de notas en examenes de esta materia
    TasaAprobacionMateria: float    # Aprobados / Rendidos en esta materia

    # -- Rendimiento general del alumno (desde nivel_examen) ------------------
    PromedioNotaGeneral: float    # Promedio de notas en todas las materias
    TasaAprobacionGeneral: float  # Tasa de aprobacion general


class ExamenInput(BaseModel):
    """
    Features requeridas para predecir la nota que obtendra un alumno en un examen.
    Las features de historial deben ser pre-calculadas desde nivel_materia.
    Las features de dominio (PosicionFlujo, etc.) pueden computarse a partir
    de TipoExamen e Instancia antes de llamar al endpoint.
    """
    # -- Datos del examen -----------------------------------------------------
    Materia: int      # 0=AM1, 1=AM2
    TipoExamen: str   # 'Parcial', 'Recuperatorio' o 'Final'
    Instancia: int    # 1, 2 o 3
    Anio: int         # Anio calendario del examen (ej: 2024)
    Asistencia: float # Asistencia en la cursada (0.0 a 1.0)
    VecesRecursada: int   # Cantidad de veces que el alumno recurso esta materia

    # -- Demograficas ---------------------------------------------------------
    Genero: int            # 0=Femenino, 1=Masculino
    Edad: int              # Edad al momento del examen
    AyudaFinanciera: int   # 0=No, 1=Si
    ColegioTecnico: int    # 0=No, 1=Si
    PromedioColegio: float # Promedio del colegio secundario (0-10)
    AniosDesdeIngreso: int # Anio del examen - AnioIngreso

    # -- Historial en esta materia (desde nivel_materia) ----------------------
    VecesCursadaMateria: int             # Veces que curso esta materia
    TasaRecursaMateria: float            # Tasa de recursado en esta materia
    PromedioAsistenciaHistMateria: float # Promedio historico de asistencia

    # -- Historial general (desde nivel_materia) ------------------------------
    TotalCursadasGeneral: int       # Total de cursadas en todas las materias
    TasaRecursaGeneral: float       # Tasa de recursado general
    PromedioAsistenciaGeneral: float # Promedio de asistencia general

    # -- Features de dominio academico ----------------------------------------
    # Pueden calcularse con: PosicionFlujo = posicion_map[(TipoExamen, Instancia)]
    PosicionFlujo: int              # Posicion ordinal en el flujo (1 Parcial1 → 7 Final3)
    AsistenciaBajaRiesgo: int       # 1 si Asistencia < 0.75
    NotaPromedioParcialCursada: float # Promedio de notas de parciales de esta cursada
    CantParcialesAprobados: int     # Parciales aprobados (nota >= 4) en esta cursada
    EsUltimaInstancia: int          # 1 si es Final instancia 3
    TieneFinalAM1: int              # 1 si el alumno tiene Final de AM1 aprobado


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _to_df(registros: list, campos: List[str]) -> pd.DataFrame:
    """Convierte lista de Pydantic models a DataFrame con columnas ordenadas."""
    return pd.DataFrame([r.model_dump() for r in registros])[campos]


def _ohe_tipo_examen(df: pd.DataFrame) -> pd.DataFrame:
    """
    One-Hot Encoding de TipoExamen identico al aplicado en ft_engineering
    (drop_last=False → 3 columnas: Final, Parcial, Recuperatorio).
    """
    for categoria in ['Final', 'Parcial', 'Recuperatorio']:
        df[f'TipoExamen_{categoria}'] = (df['TipoExamen'] == categoria).astype(int)
    return df.drop(columns=['TipoExamen'])


# Columnas exactas que cada modelo espera, leidas directamente desde el atributo
# feature_names_in_ que sklearn almacena en el momento del fit().
# Esto evita cualquier desajuste de nombres u orden con el DataFrame de entrenamiento.
_ALUMNO_COLS  = list(model_alumno.feature_names_in_)
_MATERIA_COLS = list(model_materia.feature_names_in_)
_EXAMEN_COLS  = list(model_examen.feature_names_in_)


# ---------------------------------------------------------------------------
# 5) Endpoints
# ---------------------------------------------------------------------------

@app.post(
    '/predict/alumno',
    summary='Prediccion de abandono',
    response_description='Lista con prediccion de abandono y probabilidad por alumno',
)
def predict_alumno(registros: List[AlumnoInput]):
    """
    Predice si cada alumno abandonara la carrera.

    - **Abandona**: `true` si se predice abandono, `false` si no.
    - **probabilidad**: probabilidad estimada de abandono (0.0 a 1.0).
    """
    if not registros:
        raise HTTPException(status_code=422, detail='La lista de registros no puede estar vacia.')

    df = pd.DataFrame([r.model_dump() for r in registros])

    # Durante el entrenamiento, alumno.csv y mat_agg tenian ambos una columna
    # 'PromedioColegio'. El merge de pandas las renombro automaticamente a
    # 'PromedioColegio_x' (alumno original) y 'PromedioColegio_y' (mat_agg).
    # Ambas representan el mismo valor; se replican aqui para que los nombres
    # del DataFrame coincidan exactamente con los del modelo entrenado.
    if 'PromedioColegio_x' in _ALUMNO_COLS:
        df['PromedioColegio_x'] = df['PromedioColegio']
        df['PromedioColegio_y'] = df['PromedioColegio']
        df = df.drop(columns=['PromedioColegio'])

    df = df[_ALUMNO_COLS]

    predicciones  = model_alumno.predict(df).tolist()
    probabilidades = (
        model_alumno.predict_proba(df)[:, 1].tolist()
        if hasattr(model_alumno, 'predict_proba') else [None] * len(predicciones)
    )

    return [
        {
            'Abandona':     bool(pred),
            'probabilidad': round(prob, 4) if prob is not None else None,
        }
        for pred, prob in zip(predicciones, probabilidades)
    ]


@app.post(
    '/predict/materia',
    summary='Prediccion de recursado',
    response_description='Lista con prediccion de recursado y probabilidad por cursada',
)
def predict_materia(registros: List[MateriaInput]):
    """
    Predice si un alumno recursara la materia en la cursada indicada.

    - **Recursa**: `true` si se predice recursado, `false` si no.
    - **probabilidad**: probabilidad estimada de recursar (0.0 a 1.0).
    """
    if not registros:
        raise HTTPException(status_code=422, detail='La lista de registros no puede estar vacia.')

    df = _to_df(registros, _MATERIA_COLS)

    predicciones  = model_materia.predict(df).tolist()
    probabilidades = (
        model_materia.predict_proba(df)[:, 1].tolist()
        if hasattr(model_materia, 'predict_proba') else [None] * len(predicciones)
    )

    return [
        {
            'Recursa':      bool(pred),
            'probabilidad': round(prob, 4) if prob is not None else None,
        }
        for pred, prob in zip(predicciones, probabilidades)
    ]


@app.post(
    '/predict/examen',
    summary='Prediccion de nota de examen',
    response_description='Lista con la nota predicha por examen',
)
def predict_examen(registros: List[ExamenInput]):
    """
    Predice la nota (0-10) que obtendra un alumno en un examen.

    - **Nota**: nota predicha redondeada a 2 decimales.
    """
    if not registros:
        raise HTTPException(status_code=422, detail='La lista de registros no puede estar vacia.')

    df = pd.DataFrame([r.model_dump() for r in registros])
    df = _ohe_tipo_examen(df)[_EXAMEN_COLS]

    predicciones = model_examen.predict(df).tolist()

    return [
        {'Nota': round(float(pred), 2)}
        for pred in predicciones
    ]
