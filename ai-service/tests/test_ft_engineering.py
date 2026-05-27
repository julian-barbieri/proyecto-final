import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'src'))

from feature_engineering.ft_engineering import ft_engineering_procesado


def test_examen_tiene_promedio_nota_general():
    X_train, X_test, _, _ = ft_engineering_procesado('examen')
    for split in (X_train, X_test):
        assert 'PromedioNotaGeneral' in split.columns
        assert split['PromedioNotaGeneral'].between(0, 10).all()


def test_examen_tiene_tasa_aprobacion_general():
    X_train, X_test, _, _ = ft_engineering_procesado('examen')
    for split in (X_train, X_test):
        assert 'TasaAprobacionGeneral' in split.columns
        assert split['TasaAprobacionGeneral'].between(0, 1).all()


def test_examen_tiene_prob_recursa():
    X_train, X_test, _, _ = ft_engineering_procesado('examen')
    for split in (X_train, X_test):
        assert 'ProbRecursa' in split.columns
        assert split['ProbRecursa'].between(0, 1).all()


def test_examen_prob_recursa_no_es_constante():
    """ProbRecursa debe tener varianza real (no ser siempre 0 del fallback)."""
    X_train, _, _, _ = ft_engineering_procesado('examen')
    assert X_train['ProbRecursa'].std() > 0.01
