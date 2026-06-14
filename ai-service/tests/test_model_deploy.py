import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / 'src'))
from model_deploy import (
    app, _crear_pydantic_model, _registros_a_df,
    _ALUMNO_COLS, _MATERIA_COLS, _EXAMEN_COLS,
)

ALUMNO_FEATURES  = {'PromedioNotaGeneral', 'PromedioAsistencia', 'AyudaFinanciera',
                    'CantExamenesRendidos', 'CantFinalesRendidos'}
MATERIA_FEATURES = {'PromedioNotaGeneral', 'PromedioAsistencia', 'AyudaFinanciera',
                    'Materia', 'PromedioColegio'}
EXAMEN_FEATURES  = {'PromedioNotaGeneral', 'PromedioAsistencia', 'AyudaFinanciera',
                    'NotaPromedioParcialCursada', 'TasaRecursaGeneral', 'Materia'}


def test_crear_pydantic_model_campos_son_floats():
    Model = _crear_pydantic_model('TestModel', ['FeatureA', 'FeatureB'])
    instance = Model()
    assert instance.FeatureA == 0.0
    assert instance.FeatureB == 0.0


def test_crear_pydantic_model_solo_campos_dados():
    Model = _crear_pydantic_model('TestModel', ['FeatureA', 'FeatureB'])
    assert set(Model.model_fields.keys()) == {'FeatureA', 'FeatureB'}


def test_registros_a_df_columnas_exactas():
    Model = _crear_pydantic_model('TestModel', ['X1', 'X2'])
    reg = Model(X1=1.5, X2=2.0)
    df = _registros_a_df([reg], ['X1', 'X2'])
    assert list(df.columns) == ['X1', 'X2']
    assert df.iloc[0]['X1'] == pytest.approx(1.5)


def test_registros_a_df_multiples_filas():
    Model = _crear_pydantic_model('TestModel', ['X1'])
    regs = [Model(X1=float(i)) for i in range(3)]
    df = _registros_a_df(regs, ['X1'])
    assert df.shape == (3, 1)


def test_columnas_alumno_son_correctas():
    assert set(_ALUMNO_COLS) == ALUMNO_FEATURES


def test_columnas_materia_son_correctas():
    assert set(_MATERIA_COLS) == MATERIA_FEATURES


def test_columnas_examen_son_correctas():
    assert set(_EXAMEN_COLS) == EXAMEN_FEATURES
