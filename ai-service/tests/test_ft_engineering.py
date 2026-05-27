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


def test_coherencia_nota_vs_recursado():
    """
    Un alumno con alta probabilidad de recursado debe tener nota predicha
    menor que uno con baja probabilidad, ceteris paribus.
    """
    import joblib
    from pathlib import Path

    models_dir = Path(__file__).parents[1] / 'src' / 'models' / 'models-trained'
    modelo_examen = joblib.load(models_dir / 'modelo_examen.pkl')
    examen_cols   = list(modelo_examen.feature_names_in_)

    assert 'ProbRecursa' in examen_cols, (
        "modelo_examen no fue reentrenado con ProbRecursa. "
        "Ejecutar Task 3 (reentrenamiento) primero."
    )

    import pandas as pd

    base = {col: 0.0 for col in examen_cols}
    base.update({
        'Asistencia': 0.90, 'NotaPromedioParcialCursada': 8.0,
        'PromedioNotaGeneral': 7.5, 'TasaAprobacionGeneral': 0.85,
        'ProbRecursa': 0.05, 'TasaRecursaMateria': 0.05,
    })

    alto_riesgo = base.copy()
    alto_riesgo.update({
        'Asistencia': 0.50, 'NotaPromedioParcialCursada': 2.0,
        'PromedioNotaGeneral': 3.5, 'TasaAprobacionGeneral': 0.25,
        'ProbRecursa': 0.85, 'TasaRecursaMateria': 0.65,
    })

    X_bajo = pd.DataFrame([base])[examen_cols]
    X_alto = pd.DataFrame([alto_riesgo])[examen_cols]

    nota_bajo = modelo_examen.predict(X_bajo)[0]
    nota_alto = modelo_examen.predict(X_alto)[0]

    assert nota_alto < nota_bajo, (
        f"Se esperaba nota_alto ({nota_alto:.2f}) < nota_bajo ({nota_bajo:.2f})"
    )
