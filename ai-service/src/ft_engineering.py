import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from feature_engine.imputation import MeanMedianImputer
from feature_engine.encoding import OneHotEncoder as FeOneHotEncoder
from feature_engine.wrappers import SklearnTransformerWrapper

sys.path.append(os.path.dirname(__file__))
from cargar_datos import cargar_datos

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')


def ft_engineering_procesado(dataset: str = 'examen'):
    """
    Limpieza, feature engineering y preprocesamiento de datos.

    Parameters
    ----------
    dataset : str
        'alumno'  -> target: Abandona (clasificacion binaria)
        'materia' -> target: Recursa  (clasificacion binaria)
        'examen'  -> target: Nota     (regresion)

    Returns
    -------
    X_train_processed_fe : pd.DataFrame
    X_test_processed_fe  : pd.DataFrame
    y_train              : pd.Series
    y_test               : pd.Series
    """

    # -- Carga de datos --------------------------------------------------------
    alumno, materia, examen = cargar_datos(data_dir=DATA_DIR)

    # -- 0) Limpieza y eliminacion de examenes no asistidos --------------------
    if dataset == 'alumno':
        df = alumno.copy()
        # 'Fecha' es la fecha de abandono: solo existe si ya abandono (leakage)
        df = df.drop(columns=['IdAlumno', 'Fecha'])
        target = 'Abandona'

    elif dataset == 'materia':
        df = materia.copy()
        df = df.drop(columns=['IdAlumno'])
        target = 'Recursa'

    elif dataset == 'examen':
        df = examen.copy()
        # Eliminamos instancias donde el alumno no se presento a rendir
        df = df[df['AusenteExamen'] == 0].reset_index(drop=True)
        df = df.drop(columns=['IdAlumno', 'ExamenRendido', 'AusenteExamen', 'FechaExamen'])
        target = 'Nota'

    else:
        raise ValueError(
            f"dataset debe ser 'alumno', 'materia' o 'examen'. Recibido: '{dataset}'"
        )

    # -- 1) Ingenieria de features ---------------------------------------------
    # Calcular edad al momento del registro usando FechaNac y anio del evento
    # Se usa el 1° de enero del anio de referencia como fecha de corte
    anio_col   = {'alumno': 'AnioIngreso', 'materia': 'AnioCursada', 'examen': 'Anio'}[dataset]
    birth_date = pd.to_datetime(df['FechaNac'], dayfirst=True)
    ref_date   = pd.to_datetime(df[anio_col].astype(str) + '-01-01')

    df['Edad'] = (ref_date.dt.year - birth_date.dt.year) - (
        (ref_date.dt.month < birth_date.dt.month) |
        ((ref_date.dt.month == birth_date.dt.month) &
         (ref_date.dt.day   < birth_date.dt.day))
    ).astype(int)

    df = df.drop(columns=['FechaNac'])

    # Encoding manual de categoricas binarias: string -> 0/1
    if 'Genero' in df.columns:
        df['Genero'] = df['Genero'].map({'Masculino': 1, 'Femenino': 0})
    if 'Materia' in df.columns: #MATERIA SERIA CATEGORICA PERO SE INGRESA COMO BINARIA YA QUE SON 2
        df['Materia'] = df['Materia'].map({'AM1': 0, 'AM2': 1})

    # -- 2) Identificar variables categoricas, numericas y binarias -----------
    cat_vars    = [c for c in ['TipoExamen'] if c in df.columns]
    binary_vars = [c for c in ['Genero', 'Materia', 'AyudaFinanciera', 'ColegioTecnico']
                   if c in df.columns]
    num_vars    = [c for c in df.columns if c not in cat_vars + binary_vars + [target]]

    print(f'\n[{dataset.upper()}] Variables identificadas:')
    print(f'  Numericas   ({len(num_vars)}): {num_vars}')
    print(f'  Binarias    ({len(binary_vars)}): {binary_vars}')
    print(f'  Categoricas ({len(cat_vars)}): {cat_vars}')
    print(f'  Target: {target}')

    X = df.drop(columns=[target])
    y = df[target]

    # -- 3) Transformaciones con Feature-engine --------------------------------
    # Imputador para nulos en variables numericas (por si existen)
    has_nulls = X[num_vars].isnull().any().any()
    imputer = MeanMedianImputer(imputation_method='median', variables=num_vars) if has_nulls else None

    # One-Hot Encoding para variables categoricas nominales (TipoExamen)
    ohe = FeOneHotEncoder(variables=cat_vars, drop_last=False) if cat_vars else None

    # Escalado estandar solo sobre variables numericas
    scaler = SklearnTransformerWrapper(StandardScaler(), variables=num_vars)

    # -- 4) Division train-test ------------------------------------------------
    # Clasificacion: estratificamos por target para mantener proporcion de clases
    stratify = y if dataset in ['alumno', 'materia'] else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=stratify
    )
    print(f'  Train: {X_train.shape[0]} filas | Test: {X_test.shape[0]} filas')

    # -- 5) Aplicamos el preprocesamiento (fit en train, transform en ambos) ---
    if imputer:
        X_train = imputer.fit_transform(X_train)
        X_test  = imputer.transform(X_test)

    if ohe:
        X_train = ohe.fit_transform(X_train)
        X_test  = ohe.transform(X_test)

    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)

    # -- 6) Convertimos a DataFrame --------------------------------------------
    X_train_processed_fe = pd.DataFrame(X_train).reset_index(drop=True)
    X_test_processed_fe  = pd.DataFrame(X_test).reset_index(drop=True)

    print(f'  Shape final -> X_train: {X_train_processed_fe.shape}, '
          f'X_test: {X_test_processed_fe.shape}')
    print(f'  Columnas: {list(X_train_processed_fe.columns)}')

    return X_train_processed_fe, X_test_processed_fe, \
           y_train.reset_index(drop=True), y_test.reset_index(drop=True)


# ------------------------------------------------------------------------------
if __name__ == '__main__':
    for ds in ['alumno', 'materia', 'examen']:
        print(f'\n{"="*55}')
        print(f' Procesando dataset: {ds.upper()}')
        print(f'{"="*55}')
        X_train, X_test, y_train, y_test = ft_engineering_procesado(dataset=ds)
