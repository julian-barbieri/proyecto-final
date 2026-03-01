import os
import sys
import warnings
import pandas as pd
import numpy as np

from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import (RandomForestClassifier, GradientBoostingClassifier,
                               RandomForestRegressor, GradientBoostingRegressor)
from sklearn.model_selection import RandomizedSearchCV
from xgboost import XGBClassifier, XGBRegressor
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                              f1_score, roc_auc_score,
                              mean_absolute_error, mean_squared_error, r2_score)

warnings.filterwarnings('ignore')

sys.path.append(os.path.dirname(__file__))
from ft_engineering import ft_engineering_procesado


# ---------------------------------------------------------------------------
# Configuracion de modelos y grillas de hiperparametros
# ---------------------------------------------------------------------------

CLASSIFICATION_MODELS = {
    'LogisticRegression': {
        'model': LogisticRegression(max_iter=1000, random_state=42),
        'params': {
            'C':       [0.01, 0.1, 1, 10, 100],
            'solver':  ['lbfgs', 'liblinear'],
            'penalty': ['l2'],
        },
    },
    'DecisionTree': {
        'model': DecisionTreeClassifier(random_state=42),
        'params': {
            'max_depth':        [3, 5, 7, 10, None],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf':  [1, 2, 4],
            'criterion':        ['gini', 'entropy'],
        },
    },
    'RandomForest': {
        'model': RandomForestClassifier(random_state=42),
        'params': {
            'n_estimators':      [50, 100, 200],
            'max_depth':         [3, 5, 10, None],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf':  [1, 2, 4],
        },
    },
    'GradientBoosting': {
        'model': GradientBoostingClassifier(random_state=42),
        'params': {
            'n_estimators':  [50, 100, 200],
            'learning_rate': [0.01, 0.05, 0.1, 0.2],
            'max_depth':     [3, 5, 7],
            'subsample':     [0.7, 0.8, 1.0],
        },
    },
    'XGBoost': {
        'model': XGBClassifier(random_state=42, verbosity=0, eval_metric='logloss'),
        'params': {
            'n_estimators':      [50, 100, 200],
            'learning_rate':     [0.01, 0.05, 0.1, 0.2],
            'max_depth':         [3, 5, 7],
            'subsample':         [0.7, 0.8, 1.0],
            'colsample_bytree':  [0.7, 0.8, 1.0],
        },
    },
}

REGRESSION_MODELS = {
    'LinearRegression': {
        'model': LinearRegression(),
        'params': {
            'fit_intercept': [True, False],
        },
    },
    'Ridge': {
        'model': Ridge(),
        'params': {
            'alpha':         [0.01, 0.1, 1, 10, 100],
            'fit_intercept': [True, False],
        },
    },
    'RandomForest': {
        'model': RandomForestRegressor(random_state=42),
        'params': {
            'n_estimators':      [50, 100, 200],
            'max_depth':         [3, 5, 8, None],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf':  [1, 2, 4],
        },
    },
    'GradientBoosting': {
        'model': GradientBoostingRegressor(random_state=42),
        'params': {
            'n_estimators':  [50, 100, 200],
            'learning_rate': [0.01, 0.05, 0.1, 0.2],
            'max_depth':     [3, 5, 7],
            'subsample':     [0.7, 0.8, 1.0],
        },
    },
    'XGBoost': {
        'model': XGBRegressor(random_state=42, verbosity=0),
        'params': {
            'n_estimators':      [50, 100, 200],
            'learning_rate':     [0.01, 0.05, 0.1, 0.2],
            'max_depth':         [3, 5, 7],
            'subsample':         [0.7, 0.8, 1.0],
            'colsample_bytree':  [0.7, 0.8, 1.0],
        },
    },
}


# ---------------------------------------------------------------------------
# Evaluacion de clasificacion
# ---------------------------------------------------------------------------

def evaluate_classification(dataset_name, X_train, X_test, y_train, y_test):
    print(f'\n{"="*60}')
    print(f'  CLASIFICACION: {dataset_name.upper()}')
    print(f'{"="*60}')

    results = []

    for name, config in CLASSIFICATION_MODELS.items():
        print(f'\n  [{name}] Entrenando...')

        n_iter = min(20, _combinations(config['params']))
        search = RandomizedSearchCV(
            estimator=config['model'],
            param_distributions=config['params'],
            n_iter=n_iter,
            scoring='f1',
            cv=5,
            random_state=42,
            n_jobs=-1,
            refit=True,
        )
        search.fit(X_train, y_train)
        best = search.best_estimator_

        y_pred  = best.predict(X_test)
        y_proba = best.predict_proba(X_test)[:, 1] if hasattr(best, 'predict_proba') else None

        row = {
            'Modelo':    name,
            'Accuracy':  round(accuracy_score(y_test, y_pred), 4),
            'Precision': round(precision_score(y_test, y_pred, zero_division=0), 4),
            'Recall':    round(recall_score(y_test, y_pred, zero_division=0), 4),
            'F1':        round(f1_score(y_test, y_pred, zero_division=0), 4),
            'ROC_AUC':   round(roc_auc_score(y_test, y_proba), 4) if y_proba is not None else None,
            'MejoresParams': search.best_params_,
        }
        results.append(row)

        print(f'    Accuracy:  {row["Accuracy"]}')
        print(f'    Precision: {row["Precision"]}')
        print(f'    Recall:    {row["Recall"]}')
        print(f'    F1:        {row["F1"]}')
        print(f'    ROC-AUC:   {row["ROC_AUC"]}')
        print(f'    Params:    {search.best_params_}')

    df = pd.DataFrame(results)
    best_row = df.loc[df['F1'].idxmax()]

    print(f'\n{"*"*60}')
    print(f'  MEJOR MODELO ({dataset_name.upper()}): {best_row["Modelo"]}')
    print(f'    F1:      {best_row["F1"]}')
    print(f'    ROC-AUC: {best_row["ROC_AUC"]}')
    print(f'    Params:  {best_row["MejoresParams"]}')
    print(f'{"*"*60}')

    return df


# ---------------------------------------------------------------------------
# Evaluacion de regresion
# ---------------------------------------------------------------------------

def evaluate_regression(dataset_name, X_train, X_test, y_train, y_test):
    print(f'\n{"="*60}')
    print(f'  REGRESION: {dataset_name.upper()}')
    print(f'{"="*60}')

    results = []

    for name, config in REGRESSION_MODELS.items():
        print(f'\n  [{name}] Entrenando...')

        n_iter = min(20, _combinations(config['params']))
        search = RandomizedSearchCV(
            estimator=config['model'],
            param_distributions=config['params'],
            n_iter=n_iter,
            scoring='neg_mean_squared_error',
            cv=5,
            random_state=42,
            n_jobs=-1,
            refit=True,
        )
        search.fit(X_train, y_train)
        best = search.best_estimator_

        y_pred = best.predict(X_test)

        row = {
            'Modelo': name,
            'MAE':    round(mean_absolute_error(y_test, y_pred), 4),
            'RMSE':   round(np.sqrt(mean_squared_error(y_test, y_pred)), 4),
            'R2':     round(r2_score(y_test, y_pred), 4),
            'MejoresParams': search.best_params_,
        }
        results.append(row)

        print(f'    MAE:  {row["MAE"]}')
        print(f'    RMSE: {row["RMSE"]}')
        print(f'    R2:   {row["R2"]}')
        print(f'    Params: {search.best_params_}')

    df = pd.DataFrame(results)
    best_row = df.loc[df['R2'].idxmax()]

    print(f'\n{"*"*60}')
    print(f'  MEJOR MODELO ({dataset_name.upper()}): {best_row["Modelo"]}')
    print(f'    MAE:  {best_row["MAE"]}')
    print(f'    RMSE: {best_row["RMSE"]}')
    print(f'    R2:   {best_row["R2"]}')
    print(f'    Params: {best_row["MejoresParams"]}')
    print(f'{"*"*60}')

    return df


# ---------------------------------------------------------------------------
# Utilidad: cuenta combinaciones totales del espacio de hiperparametros
# ---------------------------------------------------------------------------

def _combinations(params: dict) -> int:
    total = 1
    for v in params.values():
        total *= len(v)
    return total


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    all_results = {}

    # -- Clasificacion --------------------------------------------------------
    for ds in ['alumno', 'materia']:
        print(f'\n{"#"*60}')
        print(f'  Procesando dataset: {ds.upper()}')
        print(f'{"#"*60}')
        X_train, X_test, y_train, y_test = ft_engineering_procesado(dataset=ds)
        all_results[ds] = evaluate_classification(ds, X_train, X_test, y_train, y_test)

    # -- Regresion ------------------------------------------------------------
    print(f'\n{"#"*60}')
    print(f'  Procesando dataset: EXAMEN')
    print(f'{"#"*60}')
    X_train, X_test, y_train, y_test = ft_engineering_procesado(dataset='examen')
    all_results['examen'] = evaluate_regression('examen', X_train, X_test, y_train, y_test)

    # -- Resumen final --------------------------------------------------------
    print(f'\n{"="*60}')
    print('  RESUMEN FINAL')
    print(f'{"="*60}')

    metric_cols = {
        'alumno':  ['Modelo', 'Accuracy', 'Precision', 'Recall', 'F1', 'ROC_AUC'],
        'materia': ['Modelo', 'Accuracy', 'Precision', 'Recall', 'F1', 'ROC_AUC'],
        'examen':  ['Modelo', 'MAE', 'RMSE', 'R2'],
    }

    for ds, df in all_results.items():
        print(f'\n  Dataset: {ds.upper()}')
        print(df[metric_cols[ds]].to_string(index=False))
