import os
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, create_model
from typing import Any, Dict, List, Type


app = FastAPI(
    title='API de Predicciones Academicas',
    description=(
        'Prediccion de abandono de carrera (alumno), '
        'recursado de materia (materia) y nota de examen (examen). '
        'Los schemas de entrada se generan automaticamente desde '
        'feature_names_in_ de cada modelo .pkl.'
    ),
    version='2.0.0',
)


_MODELS_TRAINED_DIR = os.path.join(
    os.path.dirname(__file__), 'models', 'models-trained'
)

try:
    model_alumno  = joblib.load(os.path.join(_MODELS_TRAINED_DIR, 'modelo_alumno.pkl'))
    model_materia = joblib.load(os.path.join(_MODELS_TRAINED_DIR, 'modelo_materia.pkl'))
    model_examen  = joblib.load(os.path.join(_MODELS_TRAINED_DIR, 'modelo_examen.pkl'))
except FileNotFoundError as exc:
    raise RuntimeError(
        f'Modelo no encontrado: {exc}. '
        'Ejecuta python src/train_models.py antes de iniciar la API.'
    ) from exc

_ALUMNO_COLS  = [str(f) for f in model_alumno.feature_names_in_]
_MATERIA_COLS = [str(f) for f in model_materia.feature_names_in_]
_EXAMEN_COLS  = [str(f) for f in model_examen.feature_names_in_]


def _crear_pydantic_model(name: str, feature_names: List[str]) -> Type[BaseModel]:
    fields: Dict[str, Any] = {feat: (float, 0.0) for feat in feature_names}
    return create_model(name, **fields)


def _registros_a_df(registros: list, feature_names: List[str]) -> pd.DataFrame:
    filas = [r.model_dump() for r in registros]
    return pd.DataFrame(filas)[feature_names]


AlumnoInput  = _crear_pydantic_model('AlumnoInput',  _ALUMNO_COLS)
MateriaInput = _crear_pydantic_model('MateriaInput', _MATERIA_COLS)
ExamenInput  = _crear_pydantic_model('ExamenInput',  _EXAMEN_COLS)


@app.get('/health', summary='Health check', tags=['Sistema'])
def health():
    """Verifica que la API esta activa y lista los features de cada modelo."""
    return {
        'status': 'ok',
        'modelos_cargados': {
            'alumno':  {'n_features': len(_ALUMNO_COLS),  'features': _ALUMNO_COLS},
            'materia': {'n_features': len(_MATERIA_COLS), 'features': _MATERIA_COLS},
            'examen':  {'n_features': len(_EXAMEN_COLS),  'features': _EXAMEN_COLS},
        },
    }


@app.post(
    '/predict/alumno',
    summary='Prediccion de abandono',
    response_description='Prediccion de abandono y probabilidad por alumno',
)
def predict_alumno(registros: List[AlumnoInput]):
    """
    Predice si cada alumno abandonara la carrera.

    - **Abandona**: `true` si se predice abandono, `false` si no.
    - **probabilidad**: probabilidad estimada de abandono (0.0 a 1.0).
    """
    if not registros:
        raise HTTPException(status_code=422, detail='La lista de registros no puede estar vacia.')

    df = _registros_a_df(registros, _ALUMNO_COLS)
    predicciones   = model_alumno.predict(df).tolist()
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
    response_description='Prediccion de recursado y probabilidad por cursada',
)
def predict_materia(registros: List[MateriaInput]):
    """
    Predice si un alumno recursara la materia en la cursada indicada.

    - **Recursa**: `true` si se predice recursado, `false` si no.
    - **probabilidad**: probabilidad estimada de recursar (0.0 a 1.0).
    """
    if not registros:
        raise HTTPException(status_code=422, detail='La lista de registros no puede estar vacia.')

    df = _registros_a_df(registros, _MATERIA_COLS)
    predicciones   = model_materia.predict(df).tolist()
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
    response_description='Nota predicha por examen',
)
def predict_examen(registros: List[ExamenInput]):
    """
    Predice la nota (0-10) que obtendra un alumno en un examen.

    - **Nota**: nota predicha redondeada a 2 decimales.
    """
    if not registros:
        raise HTTPException(status_code=422, detail='La lista de registros no puede estar vacia.')

    df = _registros_a_df(registros, _EXAMEN_COLS)
    predicciones = model_examen.predict(df).tolist()

    return [
        {'Nota': round(float(pred), 2)}
        for pred in predicciones
    ]
