import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from feature_engineering import ft_engineering_procesado


def test_alumno_incluye_features_bloqueo_delay():
    X_train, _, _, _ = ft_engineering_procesado('alumno')
    assert 'IndiceBloqueoPromedio' in X_train.columns
    assert 'DelayPromedioRespectoPlan' in X_train.columns
