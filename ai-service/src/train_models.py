"""
Entrena los tres modelos del sistema academico y guarda los artefactos.

  modelo_alumno.pkl  -> GradientBoosting clasificador (target: Abandona)
  modelo_materia.pkl -> GradientBoosting clasificador (target: Recursa)
  modelo_examen.pkl  -> GradientBoosting regresor     (target: Nota)

Artefactos generados:
  src/models/models-trained/modelo_*.pkl
  src/models/dataset-test/X_test_*.csv / y_test_*.csv
"""

import os
import sys
import warnings

warnings.filterwarnings("ignore")

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import (
    classification_report, roc_auc_score,
    mean_absolute_error, r2_score,
)

# Asegurar que el package feature_engineering sea importable
SRC_DIR    = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SRC_DIR)

from feature_engineering import ft_engineering_procesado

MODELS_DIR      = os.path.join(SRC_DIR, "models", "models-trained")
TEST_DIR        = os.path.join(SRC_DIR, "models", "dataset-test")

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(TEST_DIR,   exist_ok=True)


def entrenar_clasificador(dataset: str):
    print(f"\n{'='*55}")
    print(f"  Entrenando clasificador: {dataset.upper()}")
    print(f"{'='*55}")

    X_train, X_test, y_train, y_test = ft_engineering_procesado(dataset)

    # Compensar desbalance de clases con sample_weight
    sample_weights = compute_sample_weight("balanced", y_train)

    clf = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        random_state=42,
    )
    clf.fit(X_train, y_train, sample_weight=sample_weights)

    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]

    print(f"\n  Metricas en test:")
    print(classification_report(y_test, y_pred, zero_division=0))
    try:
        print(f"  ROC-AUC: {roc_auc_score(y_test, y_prob):.4f}")
    except Exception:
        pass

    model_path = os.path.join(MODELS_DIR, f"modelo_{dataset}.pkl")
    joblib.dump(clf, model_path)
    print(f"  Modelo guardado: {model_path}")

    pd.DataFrame(X_test).to_csv(os.path.join(TEST_DIR, f"X_test_{dataset}.csv"), index=False)
    pd.Series(y_test, name=y_test.name).to_csv(os.path.join(TEST_DIR, f"y_test_{dataset}.csv"), index=False)
    print(f"  Test set guardado en {TEST_DIR}")


def entrenar_regresor(dataset: str):
    print(f"\n{'='*55}")
    print(f"  Entrenando regresor: {dataset.upper()}")
    print(f"{'='*55}")

    X_train, X_test, y_train, y_test = ft_engineering_procesado(dataset)

    reg = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        random_state=42,
    )
    reg.fit(X_train, y_train)

    y_pred = reg.predict(X_test)

    print(f"\n  Metricas en test:")
    print(f"  MAE  : {mean_absolute_error(y_test, y_pred):.4f}")
    print(f"  R2   : {r2_score(y_test, y_pred):.4f}")

    model_path = os.path.join(MODELS_DIR, f"modelo_{dataset}.pkl")
    joblib.dump(reg, model_path)
    print(f"  Modelo guardado: {model_path}")

    pd.DataFrame(X_test).to_csv(os.path.join(TEST_DIR, f"X_test_{dataset}.csv"), index=False)
    pd.Series(y_test, name=y_test.name).to_csv(os.path.join(TEST_DIR, f"y_test_{dataset}.csv"), index=False)
    print(f"  Test set guardado en {TEST_DIR}")


if __name__ == "__main__":
    entrenar_clasificador("alumno")
    entrenar_clasificador("materia")
    entrenar_regresor("examen")

    print("\n\nTodos los modelos entrenados y guardados correctamente.")
