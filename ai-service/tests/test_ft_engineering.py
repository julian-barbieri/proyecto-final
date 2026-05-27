import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'src'))

from feature_engineering.ft_engineering import ft_engineering_procesado


def test_examen_tiene_promedio_nota_general():
    X_train, X_test, _, _ = ft_engineering_procesado('examen')
    assert 'PromedioNotaGeneral' in X_train.columns
    assert X_train['PromedioNotaGeneral'].between(0, 10).all()


def test_examen_tiene_tasa_aprobacion_general():
    X_train, X_test, _, _ = ft_engineering_procesado('examen')
    assert 'TasaAprobacionGeneral' in X_train.columns
    assert X_train['TasaAprobacionGeneral'].between(0, 1).all()
