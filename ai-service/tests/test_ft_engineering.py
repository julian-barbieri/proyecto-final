import pytest

from feature_engineering.ft_engineering import ft_engineering_procesado


EXPECTED_COLS = {
    'alumno': {
        'PromedioNotaGeneral', 'PromedioAsistencia', 'AyudaFinanciera',
        'CantExamenesRendidos', 'CantFinalesRendidos',
        'IndiceBloqueoPromedio', 'DelayPromedioRespectoPlan',
    },
    'materia': {
        'PromedioNotaGeneral', 'PromedioAsistencia', 'AyudaFinanciera',
        'Materia', 'PromedioColegio',
        'IndiceBloqueo', 'DelayRespectoPlan', 'NotaPromedioPrevias', 'EsMateriaBottleneck',
    },
    'examen': {
        'PromedioNotaGeneral', 'PromedioAsistencia', 'AyudaFinanciera',
        'NotaPromedioParcialCursada', 'TasaRecursaGeneral', 'Materia',
        'NotaPromedioCorrelativas', 'IndiceBloqueo', 'CargaSimultanea',
    },
}


@pytest.mark.parametrize('dataset', ['alumno', 'materia', 'examen'])
def test_columnas_feature_set(dataset):
    """X_train y X_test deben tener exactamente las columnas del feature set."""
    X_train, X_test, _, _ = ft_engineering_procesado(dataset)
    expected = EXPECTED_COLS[dataset]
    assert set(X_train.columns) == expected, (
        f"[{dataset}] X_train tiene columnas inesperadas: "
        f"{set(X_train.columns).symmetric_difference(expected)}"
    )
    assert set(X_test.columns) == expected, (
        f"[{dataset}] X_test tiene columnas inesperadas: "
        f"{set(X_test.columns).symmetric_difference(expected)}"
    )


@pytest.mark.parametrize('dataset', ['alumno', 'materia', 'examen'])
def test_split_proporcional(dataset):
    """Train debe ser ~4x más grande que test (80/20)."""
    X_train, X_test, y_train, y_test = ft_engineering_procesado(dataset)
    total = len(X_train) + len(X_test)
    assert len(X_test) == pytest.approx(total * 0.2, rel=0.05)


@pytest.mark.parametrize('dataset', ['alumno', 'materia'])
def test_target_binario(dataset):
    """Para alumno y materia el target debe ser 0 o 1."""
    _, _, y_train, y_test = ft_engineering_procesado(dataset)
    for y in (y_train, y_test):
        assert y.isin([0, 1]).all(), f"[{dataset}] target contiene valores fuera de {{0,1}}"


def test_target_nota_rango():
    """Para examen el target Nota debe estar entre 0 y 10."""
    _, _, y_train, y_test = ft_engineering_procesado('examen')
    for y in (y_train, y_test):
        assert y.between(0, 10).all(), "Nota fuera del rango [0, 10]"


@pytest.mark.parametrize('dataset', ['alumno', 'materia', 'examen'])
def test_sin_nulos(dataset):
    """El feature set no debe tener nulos después del preprocesamiento."""
    X_train, X_test, _, _ = ft_engineering_procesado(dataset)
    assert not X_train.isnull().any().any(), f"X_train de {dataset} tiene nulos"
    assert not X_test.isnull().any().any(), f"X_test de {dataset} tiene nulos"


def test_materia_es_numerica():
    """La columna Materia (ID 140-187) debe ser numérica en materia y examen."""
    for ds in ('materia', 'examen'):
        X_train, X_test, _, _ = ft_engineering_procesado(ds)
        for split in (X_train, X_test):
            assert split['Materia'].between(140, 187).all(), (
                f"[{ds}] Materia contiene valores fuera del rango 140-187"
            )


def test_materia_incluye_features_nuevas():
    X_train, _, _, _ = ft_engineering_procesado('materia')
    for col in ['IndiceBloqueo', 'DelayRespectoPlan', 'NotaPromedioPrevias', 'EsMateriaBottleneck']:
        assert col in X_train.columns, f"Falta columna: {col}"


def test_examen_incluye_features_nuevas():
    X_train, _, _, _ = ft_engineering_procesado('examen')
    for col in ['NotaPromedioCorrelativas', 'IndiceBloqueo', 'CargaSimultanea']:
        assert col in X_train.columns, f"Falta columna: {col}"
