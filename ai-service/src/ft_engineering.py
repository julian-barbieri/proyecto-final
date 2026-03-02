import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from feature_engine.imputation import MeanMedianImputer
from feature_engine.encoding import OneHotEncoder as FeOneHotEncoder

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
        # IdAlumno se conserva hasta despues del join con materia/examen
        target = 'Abandona'

        # -- 0a) Features agregadas desde nivel_materia (por IdAlumno) ---------
        # Se agrupa nivel_materia por IdAlumno para obtener el historial academico
        # de cada alumno a nivel de cursadas
        mat_agg = materia.groupby('IdAlumno').agg(
            # Total de materias cursadas (una fila en nivel_materia = una cursada)
            CantMaterias      = ('Recursa',    'count'),
            # Cuantas de esas cursadas termino recursando (Recursa=1)
            CantRecursa       = ('Recursa',    'sum'),
            # Promedio de asistencia a clases a lo largo de todas las cursadas
            PromedioAsistencia= ('Asistencia', 'mean'),
            # Cantidad de anos distintos en los que tuvo actividad academica
            CantAniosCursados = ('AnioCursada','nunique'),
        ).reset_index()
        # Nota: PromedioColegio NO se agrega desde mat_agg porque alumno.csv
        # ya lo contiene directamente. Agregarlo causaria duplicados (_x/_y).
        # Proporcion de materias recursadas sobre el total cursado
        # Se reemplaza 0 por NaN para evitar division por cero; luego se rellena con 0
        mat_agg['TasaRecursa'] = (
            mat_agg['CantRecursa'] / mat_agg['CantMaterias'].replace(0, np.nan)
        )

        # -- 0b) Features agregadas desde nivel_examen (por IdAlumno) ----------
        # total_intentos: cantidad de filas en nivel_examen por alumno
        # (incluye presentes Y ausentes), usado para calcular TasaAusencia
        total_intentos = examen.groupby('IdAlumno').size().rename('TotalIntentos')

        # Filtramos solo los examenes donde el alumno se presento a rendir
        ex_presentes   = examen[examen['AusenteExamen'] == 0]

        ex_agg = ex_presentes.groupby('IdAlumno').agg(
            # Cantidad de examenes efectivamente rendidos
            CantExamenesRendidos = ('Nota',       'count'),
            # Promedio de notas en los examenes rendidos
            PromedioNota         = ('Nota',       'mean'),
            # Cuantas veces llego a rendir la instancia Final
            # (llegar al final implica haber superado instancias previas)
            CantFinalesRendidos  = ('TipoExamen', lambda x: (x == 'Final').sum()),
        ).reset_index()

        # Agregacion de ausencias sobre el total de intentos (presentes + ausentes)
        aus_agg = examen.groupby('IdAlumno').agg(
            # Suma de AusenteExamen=1: cuantas veces no se presento a rendir
            CantAusencias = ('AusenteExamen', 'sum'),
        ).reset_index()
        aus_agg = aus_agg.merge(total_intentos.reset_index(), on='IdAlumno')
        # Proporcion de ausencias sobre el total de intentos de examen
        aus_agg['TasaAusencia'] = (
            aus_agg['CantAusencias'] / aus_agg['TotalIntentos'].replace(0, np.nan)
        )

        # Conteo de examenes aprobados (nota >= 4) por alumno
        aprobados_agg = (
            ex_presentes[ex_presentes['Nota'] >= 4]
            .groupby('IdAlumno').size()
            .rename('CantAprobados')
            .reset_index()
        )

        # -- 0c) Join y relleno de nulos para alumnos sin actividad ------------
        # Se usa left join para conservar los 500 alumnos de nivel_alumno.
        # Los alumnos sin registros en materia/examen (abandonaron antes de cursar)
        # quedaran con NaN, que luego se rellenan con 0.
        df = df.merge(mat_agg, on='IdAlumno', how='left')
        df = df.merge(ex_agg,  on='IdAlumno', how='left')
        df = df.merge(
            aus_agg[['IdAlumno', 'CantAusencias', 'TasaAusencia']],
            on='IdAlumno', how='left'
        )
        df = df.merge(aprobados_agg, on='IdAlumno', how='left')

        # Alumnos sin actividad en materia/examen reciben 0 en todas las features
        # agregadas (ausencia de actividad es informacion valida, no un dato faltante)
        fill_zero = [
            'CantMaterias', 'CantRecursa', 'TasaRecursa',
            'PromedioAsistencia', 'CantAniosCursados',
            'CantExamenesRendidos', 'PromedioNota', 'CantFinalesRendidos',
            'CantAusencias', 'TasaAusencia', 'CantAprobados',
        ]
        df[fill_zero] = df[fill_zero].fillna(0)

        # Proporcion de examenes aprobados sobre los rendidos
        # Si no rindio ningun examen, la tasa es 0
        df['TasaAprobacion'] = np.where(
            df['CantExamenesRendidos'] > 0,
            df['CantAprobados'] / df['CantExamenesRendidos'],
            0.0
        )

        df = df.drop(columns=['IdAlumno', 'Fecha'])

    elif dataset == 'materia':
        df = materia.copy()
        # IdAlumno se conserva hasta despues de todos los joins
        target = 'Recursa'

        # -- 0a) Features desde nivel_alumno (join 1-a-muchos por IdAlumno) ----
        # nivel_materia ya tiene AyudaFinanciera, ColegioTecnico, PromedioColegio
        # y FechaNac. 
        # Lo que falta es Genero y AnioIngreso (para calcular
        # cuantos anos lleva el alumno en la carrera al momento de cada cursada)
        alumno_extra = alumno[['IdAlumno', 'Genero', 'AnioIngreso']].copy()
        df = df.merge(alumno_extra, on='IdAlumno', how='left')

        # AniosDesdeIngreso: diferencia entre el año de cursada y el de ingreso
        # Indica la "senioridad" del alumno; valores altos pueden indicar rezago
        df['AniosDesdeIngreso'] = df['AnioCursada'] - df['AnioIngreso']
        df = df.drop(columns=['AnioIngreso'])

        # -- 0b) Features desde nivel_examen por (IdAlumno, Materia) -----------
        # Captura el historial especifico del alumno en ESTA materia:
        # cuantas veces intentó rendir, cuántas faltó, promedio de notas.
        ex_presentes_mat = examen[examen['AusenteExamen'] == 0]

        # Total de intentos de examen para este (alumno, materia): presentes + ausentes
        ex_intentos = examen.groupby(['IdAlumno', 'Materia']).agg(
            VecesRendidaExamenMateria = ('AusenteExamen', 'count'),
            # Cuantas veces el alumno no se presento al examen de esta materia
            VecesAusenteMateria       = ('AusenteExamen', 'sum'),
        ).reset_index()

        # Metricas de rendimiento en examen para esta materia (solo presentes)
        ex_notas_mat = ex_presentes_mat.groupby(['IdAlumno', 'Materia']).agg(
            # Promedio de notas obtenidas en esta materia
            PromedioNotaMateria  = ('Nota', 'mean'),
            # Cantidad de examenes aprobados (nota >= 4) en esta materia
            CantAprobadosMateria = ('Nota', lambda x: (x >= 4).sum()),
            # Total de examenes rendidos (para calcular la tasa de aprobacion)
            CantRendidosMateria  = ('Nota', 'count'),
        ).reset_index()

        ex_mat_agg = ex_intentos.merge(ex_notas_mat, on=['IdAlumno', 'Materia'], how='left')
        
        # Proporcion de examenes aprobados en esta materia sobre los rendidos
        ex_mat_agg['TasaAprobacionMateria'] = np.where(
            ex_mat_agg['CantRendidosMateria'] > 0,
            ex_mat_agg['CantAprobadosMateria'] / ex_mat_agg['CantRendidosMateria'],
            0.0
        )

        # -- 0c) Features desde nivel_examen por IdAlumno (rendimiento general) -
        # Captura el rendimiento global del alumno en TODAS las materias,
        # independientemente de cual se este prediciendo
        ex_general = ex_presentes_mat.groupby('IdAlumno').agg(
            # Promedio de notas general del alumno en todos los examenes rendidos
            PromedioNotaGeneral    = ('Nota', 'mean'),
            # Cantidad de examenes aprobados en total (para calcular la tasa general)
            CantAprobadosGeneral   = ('Nota', lambda x: (x >= 4).sum()),
            CantRendidosGeneral    = ('Nota', 'count'),
        ).reset_index()
        
        # Proporcion general de aprobacion: indica el perfil academico global del alumno
        ex_general['TasaAprobacionGeneral'] = np.where(
            ex_general['CantRendidosGeneral'] > 0,
            ex_general['CantAprobadosGeneral'] / ex_general['CantRendidosGeneral'],
            0.0
        )

        # -- 0d) Join y relleno de nulos ----------------------------------------
        # Join por (IdAlumno, Materia): cada fila de materia recibe su historial
        # de examenes especifico para esa materia
        df = df.merge(
            ex_mat_agg[['IdAlumno', 'Materia', 'VecesRendidaExamenMateria',
                         'VecesAusenteMateria', 'PromedioNotaMateria',
                         'TasaAprobacionMateria']],
            on=['IdAlumno', 'Materia'], how='left'
        )
        # Join por IdAlumno: cada fila recibe el rendimiento global del alumno
        df = df.merge(
            ex_general[['IdAlumno', 'PromedioNotaGeneral', 'TasaAprobacionGeneral']],
            on='IdAlumno', how='left'
        )

        # Alumnos sin historial de examenes para esta materia o en general -> 0
        fill_zero = [
            'VecesRendidaExamenMateria', 'VecesAusenteMateria',
            'PromedioNotaMateria', 'TasaAprobacionMateria',
            'PromedioNotaGeneral', 'TasaAprobacionGeneral',
        ]
        df[fill_zero] = df[fill_zero].fillna(0)

        df = df.drop(columns=['IdAlumno'])

    elif dataset == 'examen':
        df = examen.copy()
        # Filtramos examenes no rendidos: sin nota no hay target valido
        df = df[df['AusenteExamen'] == 0].reset_index(drop=True)
        # IdAlumno se conserva hasta despues de los joins con alumno/materia
        df = df.drop(columns=['ExamenRendido', 'AusenteExamen', 'FechaExamen'])
        target = 'Nota'

        # -- 0a) Features desde nivel_alumno (join 1-a-muchos por IdAlumno) ----
        # nivel_examen ya tiene Genero, AyudaFinanciera, ColegioTecnico,
        # PromedioColegio y FechaNac. Lo que agrega alumno es AnioIngreso,
        # necesario para calcular cuantos anos lleva el alumno en la carrera
        # al momento de rendir este examen
        alumno_extra = alumno[['IdAlumno', 'AnioIngreso']].copy()
        df = df.merge(alumno_extra, on='IdAlumno', how='left')

        # AniosDesdeIngreso: senioridad del alumno al momento del examen
        # Valores altos con malas notas podrian indicar rezago cronico
        df['AniosDesdeIngreso'] = df['Anio'] - df['AnioIngreso']
        df = df.drop(columns=['AnioIngreso'])

        # -- 0b) Features desde nivel_materia por (IdAlumno, Materia) ----------
        # Historial del alumno en ESTA materia especifica a nivel de cursadas.
        # Se agrupa sobre materia completo (no filtrado) para incluir todas
        # las cursadas independientemente del resultado en examenes
        mat_por_materia = materia.groupby(['IdAlumno', 'Materia']).agg(
            # Cuantas veces curso esta materia (1 = primera vez, 2+ = la recurso)
            VecesCursadaMateria            = ('Recursa', 'count'),
            # Proporcion de cursadas de esta materia que terminaron en recursar
            # Se usa mean porque Recursa es binaria (0/1): mean = tasa directa
            TasaRecursaMateria             = ('Recursa', 'mean'),
            # Promedio historico de asistencia a clases de esta materia
            # Diferente de Asistencia del examen actual: este es el promedio
            # de todas las cursadas previas, no solo la del periodo actual
            PromedioAsistenciaHistMateria  = ('Asistencia', 'mean'),
        ).reset_index()

        # -- 0c) Features desde nivel_materia por IdAlumno (rendimiento general) -
        # Captura el perfil academico global del alumno a nivel de cursadas,
        # independientemente de la materia que se esta examinando
        mat_general = materia.groupby('IdAlumno').agg(
            # Total de cursadas del alumno (en todas las materias)
            TotalCursadasGeneral      = ('Recursa', 'count'),
            # Proporcion general de cursadas que terminaron en recursar
            TasaRecursaGeneral        = ('Recursa', 'mean'),
            # Promedio de asistencia en todas las cursadas
            PromedioAsistenciaGeneral = ('Asistencia', 'mean'),
        ).reset_index()

        # -- 0d) Join y relleno de nulos ----------------------------------------
        # Join por (IdAlumno, Materia): cada examen recibe el historial del
        # alumno en esa materia especifica. Se usa la columna Materia original
        # (string 'AM1'/'AM2') ya que el encoding ocurre en el paso 1
        df = df.merge(
            mat_por_materia,
            on=['IdAlumno', 'Materia'], how='left'
        )
        # Join por IdAlumno: cada examen recibe el perfil general del alumno
        df = df.merge(mat_general, on='IdAlumno', how='left')

        # Alumnos sin historial en nivel_materia (no deberia ocurrir en examen
        # ya que solo hay examenes de alumnos que cursaron, pero por robustez)
        fill_zero = [
            'VecesCursadaMateria', 'TasaRecursaMateria',
            'PromedioAsistenciaHistMateria',
            'TotalCursadasGeneral', 'TasaRecursaGeneral',
            'PromedioAsistenciaGeneral',
        ]
        df[fill_zero] = df[fill_zero].fillna(0)

        # -- 0e) Features derivadas del flujo academico (dominio especifico) ----
        # Basadas en las reglas del dataset: Parcial → Recuperatorio → Final
        # y los umbrales explicitos definidos en el dominio universitario

        # PosicionFlujo: posicion ordinal del examen dentro del flujo academico.
        # Parcial1=1, Recup1=2, Parcial2=3, Recup2=4, Final1=5, Final2=6, Final3=7.
        # A mayor posicion, mas instancias fallidas previas → señal de dificultad
        # acumulada del alumno en esta cursada.
        posicion_map = {
            ('Parcial',       1): 1, ('Recuperatorio', 1): 2,
            ('Parcial',       2): 3, ('Recuperatorio', 2): 4,
            ('Final',         1): 5, ('Final',          2): 6, ('Final', 3): 7,
        }
        df['PosicionFlujo'] = df.apply(
            lambda row: posicion_map.get((row['TipoExamen'], row['Instancia']), 0),
            axis=1,
        )

        # AsistenciaBajaRiesgo: flag binario si la asistencia esta por debajo del
        # umbral critico del 75%. Segun las reglas del sistema, Asistencia < 0.75
        # impide rendir finales (aparece como ausente). Aunque ya filtramos
        # examenes no rendidos, captura alumnos en riesgo de quedar bloqueados.
        df['AsistenciaBajaRiesgo'] = (df['Asistencia'] < 0.75).astype(int)

        # NotaPromedioParcialCursada / CantParcialesAprobados:
        # Para cada (IdAlumno, Materia, Anio), agrega las notas de los Parciales
        # efectivamente rendidos en esa cursada. Es el predictor mas directo para
        # Finales: el rendimiento en los parciales anticipa la nota del final.
        # Para filas de tipo Parcial (sin parciales previos), se rellena con 0.
        parciales_cursada = (
            examen[
                (examen['TipoExamen']    == 'Parcial') &
                (examen['AusenteExamen'] == 0)
            ]
            .groupby(['IdAlumno', 'Materia', 'Anio'])
            .agg(
                NotaPromedioParcialCursada = ('Nota', 'mean'),
                # Cantidad de parciales de esta cursada con nota >= 4 (aprobados)
                CantParcialesAprobados     = ('Nota', lambda x: (x >= 4).sum()),
            )
            .reset_index()
        )
        df = df.merge(parciales_cursada, on=['IdAlumno', 'Materia', 'Anio'], how='left')
        # Filas sin parciales previos (p.ej., la propia fila es un Parcial 1)
        df['NotaPromedioParcialCursada'] = df['NotaPromedioParcialCursada'].fillna(0)
        df['CantParcialesAprobados']     = df['CantParcialesAprobados'].fillna(0)

        # EsUltimaInstancia: flag binario si es Final instancia 3, es decir,
        # la ultima oportunidad antes de recursar. El alumno que llega aqui
        # ya fallo Final1 y Final2, lo que puede influir en su desempeño.
        df['EsUltimaInstancia'] = (
            (df['TipoExamen'] == 'Final') & (df['Instancia'] == 3)
        ).astype(int)

        # TieneFinalAM1: flag binario si el alumno tiene aprobado el Final de AM1
        # (nota >= 4). Segun las correlatividades del sistema, es requisito
        # indispensable para poder rendir el Final de AM2. Para examenes de AM1
        # la feature no aplica directamente, pero el modelo puede aprender
        # que todos los alumnos con TieneFinalAM1=0 rindiendo AM2 estan bloqueados.
        alumnos_final_am1 = examen[
            (examen['Materia']       == 'AM1') &
            (examen['TipoExamen']    == 'Final') &
            (examen['AusenteExamen'] == 0) &
            (examen['Nota']          >= 4)
        ]['IdAlumno'].unique()
        df['TieneFinalAM1'] = df['IdAlumno'].isin(alumnos_final_am1).astype(int)

        df = df.drop(columns=['IdAlumno'])

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
    binary_vars = [c for c in ['Genero', 'Materia', 'AyudaFinanciera', 'ColegioTecnico',
                               'AsistenciaBajaRiesgo', 'EsUltimaInstancia', 'TieneFinalAM1']
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
