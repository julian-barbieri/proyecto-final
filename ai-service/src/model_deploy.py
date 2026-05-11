# ---------------------------------------------------------------------------
# 1) Importacion de librerias
# ---------------------------------------------------------------------------
import os
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, create_model
from typing import Any, Dict, List, Type


# ---------------------------------------------------------------------------
# 2) Instanciamos la aplicacion
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# 3) Grupos OHE conocidos
#    Prefijo → categorias posibles.
#    Se detecta cuales estan presentes en cada modelo al cargar los .pkl.
# ---------------------------------------------------------------------------
_OHE_GROUPS: Dict[str, List[str]] = {
    'TipoExamen': ['Final', 'Parcial', 'Recuperatorio'],
    'Tipo':       ['A', 'C'],
}


# ---------------------------------------------------------------------------
# 4) Carga de modelos entrenados
# ---------------------------------------------------------------------------
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
        'Ejecuta python models/training/main.py antes de iniciar la API.'
    ) from exc

# Feature names leidas directamente del atributo que sklearn guarda en el fit().
# Se convierten a str Python para evitar que numpy.str_ cause problemas en Pydantic.
_ALUMNO_COLS  = [str(f) for f in model_alumno.feature_names_in_]
_MATERIA_COLS = [str(f) for f in model_materia.feature_names_in_]
_EXAMEN_COLS  = [str(f) for f in model_examen.feature_names_in_]


# ---------------------------------------------------------------------------
# 5) Funciones auxiliares
# ---------------------------------------------------------------------------

def _detectar_ohe(feature_names: List[str]) -> Dict[str, List[str]]:
    """Retorna los grupos OHE presentes en feature_names."""
    ohe_found: Dict[str, List[str]] = {}
    for prefix, categories in _OHE_GROUPS.items():
        present = [cat for cat in categories if f'{prefix}_{cat}' in feature_names]
        if present:
            ohe_found[prefix] = present
    return ohe_found


def _crear_pydantic_model(
    name: str,
    feature_names: List[str],
    ohe_map: Dict[str, List[str]],
) -> Type[BaseModel]:
    """
    Genera un Pydantic model dinamico a partir de feature_names:
    - Columnas OHE se reemplazan por el campo raw categorico (str).
    - PromedioColegio_x / _y (artifact del merge) se exponen como un unico
      campo PromedioColegio (float).
    - El resto son float con default 0.0.
    """
    ohe_cols         = {f'{prefix}_{cat}' for prefix, cats in ohe_map.items() for cat in cats}
    promedio_dup_cols = {'PromedioColegio_x', 'PromedioColegio_y'}

    fields: Dict[str, Any] = {}
    seen:   set             = set()

    for feat in feature_names:
        if feat in ohe_cols:
            continue
        if feat in promedio_dup_cols:
            if 'PromedioColegio' not in seen:
                fields['PromedioColegio'] = (float, 0.0)
                seen.add('PromedioColegio')
            continue
        fields[feat] = (float, 0.0)

    for prefix, cats in ohe_map.items():
        fields[prefix] = (str, cats[0] if cats else '')

    return create_model(name, **fields)


def _registros_a_df(
    registros: list,
    feature_names: List[str],
    ohe_map: Dict[str, List[str]],
) -> pd.DataFrame:
    """Convierte una lista de instancias Pydantic a DataFrame listo para predict()."""
    promedio_dup_cols = {'PromedioColegio_x', 'PromedioColegio_y'}
    has_promedio_dup  = bool(set(feature_names) & promedio_dup_cols)

    filas = []
    for r in registros:
        row = r.model_dump()

        # Expansion OHE: reemplaza el campo raw por columnas binarias
        for prefix, categories in ohe_map.items():
            raw_val = row.pop(prefix, None)
            for cat in categories:
                col_name = f'{prefix}_{cat}'
                if col_name in feature_names:
                    row[col_name] = 1 if raw_val == cat else 0

        # Durante el entrenamiento, el merge de nivel_alumno con los agregados
        # de nivel_materia genero PromedioColegio_x y PromedioColegio_y.
        # Ambas representan el mismo valor; se replican aqui para que los nombres
        # del DataFrame coincidan con los que el modelo vio durante el fit().
        if has_promedio_dup:
            pc = row.pop('PromedioColegio', 0.0)
            row['PromedioColegio_x'] = pc
            row['PromedioColegio_y'] = pc

        filas.append(row)

    return pd.DataFrame(filas)[feature_names]


# ---------------------------------------------------------------------------
# 6) OHE maps y Pydantic models (generados al arrancar el servidor)
# ---------------------------------------------------------------------------
_alumno_ohe  = _detectar_ohe(_ALUMNO_COLS)
_materia_ohe = _detectar_ohe(_MATERIA_COLS)
_examen_ohe  = _detectar_ohe(_EXAMEN_COLS)

AlumnoInput  = _crear_pydantic_model('AlumnoInput',  _ALUMNO_COLS,  _alumno_ohe)
MateriaInput = _crear_pydantic_model('MateriaInput', _MATERIA_COLS, _materia_ohe)
ExamenInput  = _crear_pydantic_model('ExamenInput',  _EXAMEN_COLS,  _examen_ohe)


# ---------------------------------------------------------------------------
# 7) Health check
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# 8) Endpoints de prediccion
# ---------------------------------------------------------------------------

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

    df = _registros_a_df(registros, _ALUMNO_COLS, _alumno_ohe)

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

    df = _registros_a_df(registros, _MATERIA_COLS, _materia_ohe)

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

    df = _registros_a_df(registros, _EXAMEN_COLS, _examen_ohe)

    predicciones = model_examen.predict(df).tolist()

    return [
        {'Nota': round(float(pred), 2)}
        for pred in predicciones
    ]
