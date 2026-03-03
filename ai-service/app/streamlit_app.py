"""
streamlit_app.py
================
Aplicación Streamlit de predicción académica.

Permite explorar y usar los tres modelos entrenados:
  - modelo_alumno  → Abandono de carrera (clasificación binaria)
  - modelo_materia → Recursado de materia (clasificación binaria)
  - modelo_examen  → Nota de examen     (regresión 0-10)

Ejecución:
    streamlit run app/streamlit_app.py
"""

# ===========================================================================
# IMPORTS
# ===========================================================================
import sys
import warnings
from pathlib import Path

import matplotlib
matplotlib.use('Agg')   # backend no interactivo, compatible con Streamlit
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
import streamlit as st
from sklearn.metrics import (
    accuracy_score, f1_score, mean_absolute_error,
    mean_squared_error, precision_score, r2_score,
    recall_score, roc_auc_score,
)

warnings.filterwarnings('ignore')

# ---------------------------------------------------------------------------
# Rutas del proyecto (pathlib para compatibilidad multiplataforma)
# ---------------------------------------------------------------------------
APP_DIR    = Path(__file__).parent           # ai-service/app/
ROOT_DIR   = APP_DIR.parent                  # ai-service/
SRC_DIR    = ROOT_DIR / 'src'                # ai-service/src/
MODELS_DIR = SRC_DIR / 'models'              # ai-service/src/models/
OUTPUT_DIR = ROOT_DIR / 'outputs' / 'shap'  # ai-service/outputs/shap/

# Agregar src/ al path para importar módulos propios
sys.path.insert(0, str(SRC_DIR))

try:
    from model_explainability import cargar_modelos, explicar_modelo, reporte_importancia
    from ft_engineering import ft_engineering_procesado
    MODULOS_OK = True
except ImportError as _e:
    MODULOS_OK = False
    _IMPORT_ERROR = str(_e)


# ===========================================================================
# CONFIGURACIÓN GENERAL
# ===========================================================================

# Configuración de cada modelo: tipo, target y textos de la interfaz
MODELOS_INFO = {
    'alumno': {
        'tipo':             'clasificacion',
        'target':           'Abandona',
        'nombre_display':   'Abandono de Carrera',
        'descripcion':      (
            'Predice si un alumno abandonará la carrera '
            'basándose en su historial académico acumulado.'
        ),
        'etiqueta_pos':  'Abandona la carrera',
        'etiqueta_neg':  'Continúa la carrera',
        'icono':         '🎓',
    },
    'materia': {
        'tipo':             'clasificacion',
        'target':           'Recursa',
        'nombre_display':   'Recursado de Materia',
        'descripcion':      (
            'Predice si un alumno necesitará recursar una materia '
            'según su rendimiento en la cursada actual.'
        ),
        'etiqueta_pos':  'Recursa la materia',
        'etiqueta_neg':  'Aprueba la materia',
        'icono':         '📚',
    },
    'examen': {
        'tipo':             'regresion',
        'target':           'Nota',
        'nombre_display':   'Nota de Examen',
        'descripcion':      (
            'Estima la nota que obtendrá un alumno en un examen '
            '(escala 0 a 10) en función de su historial y la cursada.'
        ),
        'etiqueta_pos':  None,
        'etiqueta_neg':  None,
        'icono':         '📝',
    },
}

# Variables que se muestran como selectbox con etiquetas legibles
SELECTBOX_FEATURES = {
    'Genero':               {0: 'Femenino',      1: 'Masculino'},
    'Materia':              {0: 'AM1',            1: 'AM2'},
    'AyudaFinanciera':      {0: 'No',             1: 'Sí'},
    'ColegioTecnico':       {0: 'No',             1: 'Sí'},
    'AsistenciaBajaRiesgo': {0: 'No (>= 75%)',   1: 'Sí (< 75%)'},
    'EsUltimaInstancia':    {0: 'No',             1: 'Sí (Final inst. 3)'},
    'TieneFinalAM1':        {0: 'No',             1: 'Sí'},
}

# Variables float en rango [0, 1] → widget slider
SLIDER_FEATURES = {
    'Asistencia', 'PromedioAsistencia', 'TasaRecursa', 'TasaAusencia',
    'TasaAprobacion', 'TasaRecursaMateria', 'PromedioAsistenciaHistMateria',
    'TasaRecursaGeneral', 'PromedioAsistenciaGeneral',
    'TasaAprobacionMateria', 'TasaAprobacionGeneral',
}

# Columnas OHE de TipoExamen (se reemplazan por un único selectbox)
TIPO_EXAMEN_COLS = {'TipoExamen_Final', 'TipoExamen_Parcial', 'TipoExamen_Recuperatorio'}

# Variables que son enteros (el resto se trata como float)
INT_FEATURES = {
    'AnioIngreso', 'AnioCursada', 'Anio', 'Instancia', 'Edad',
    'CantMaterias', 'CantRecursa', 'CantAniosCursados', 'CantExamenesRendidos',
    'CantFinalesRendidos', 'CantAusencias', 'CantAprobados',
    'VecesRendidaExamenMateria', 'VecesAusenteMateria',
    'VecesRecursada', 'VecesCursadaMateria', 'AniosDesdeIngreso',
    'TotalCursadasGeneral', 'PosicionFlujo', 'CantParcialesAprobados',
}

# Valores por defecto razonables para la predicción individual
DEFAULTS = {
    'AnioIngreso': 2021, 'AnioCursada': 2023, 'Anio': 2023,
    'Instancia': 1, 'Edad': 20, 'AniosDesdeIngreso': 2,
    'CantMaterias': 5, 'CantRecursa': 1, 'CantAniosCursados': 2,
    'CantExamenesRendidos': 8, 'CantFinalesRendidos': 3,
    'CantAusencias': 2, 'CantAprobados': 4,
    'VecesRendidaExamenMateria': 3, 'VecesAusenteMateria': 1,
    'VecesRecursada': 0, 'VecesCursadaMateria': 1,
    'TotalCursadasGeneral': 6, 'PosicionFlujo': 1, 'CantParcialesAprobados': 1,
    'PromedioColegio': 7.0, 'PromedioNota': 6.0,
    'PromedioNotaMateria': 6.0, 'PromedioNotaGeneral': 6.0,
    'NotaPromedioParcialCursada': 6.0,
}

# Descripciones en lenguaje llano para mostrar como tooltip en cada widget
TOOLTIPS = {
    # --- Identificación temporal ---
    'AnioIngreso':          'Año en que el alumno ingresó a la carrera universitaria.',
    'AnioCursada':          'Año lectivo en que cursó la materia.',
    'Anio':                 'Año en que rindió el examen.',
    'Instancia':            'Número de instancia del examen dentro del año: 1 = primer parcial, 2 = recuperatorio, 3 = final.',

    # --- Datos personales ---
    'Edad':                 'Edad del alumno al momento de cursar o rendir (en años).',
    'Genero':               'Género del alumno.',
    'AyudaFinanciera':      'Indica si el alumno recibe beca u otro tipo de ayuda financiera.',
    'ColegioTecnico':       'Indica si el alumno proviene de un colegio secundario técnico.',
    'PromedioColegio':      'Promedio de calificaciones del colegio secundario (escala 0 a 10).',

    # --- Materia ---
    'Materia':              'Materia cursada o examinada (AM1 = Análisis Matemático 1, AM2 = Análisis Matemático 2).',

    # --- Historial académico general (modelo alumno) ---
    'AniosDesdeIngreso':    'Cantidad de años transcurridos desde que el alumno ingresó a la carrera.',
    'CantMaterias':         'Total de materias cursadas por el alumno hasta la fecha.',
    'CantRecursa':          'Cantidad de materias que el alumno tuvo que recursar.',
    'CantAniosCursados':    'Cantidad de años distintos en los que el alumno tuvo actividad académica.',
    'CantExamenesRendidos': 'Total de exámenes que el alumno se presentó a rendir (sin contar ausencias).',
    'CantFinalesRendidos':  'Cantidad de veces que el alumno llegó a rendir la instancia Final.',
    'CantAusencias':        'Total de veces que el alumno estuvo ausente en un examen inscripto.',
    'CantAprobados':        'Cantidad de exámenes que el alumno aprobó (nota >= 4).',

    # --- Tasas y proporciones generales ---
    'TasaRecursa':          'Proporción de materias recursadas sobre el total cursado. Ej: 0.30 significa que recursó el 30 % de sus materias.',
    'TasaAusencia':         'Proporción de exámenes en los que estuvo ausente sobre el total de inscripciones.',
    'TasaAprobacion':       'Proporción de exámenes aprobados sobre el total de exámenes rendidos.',
    'PromedioAsistencia':   'Promedio de asistencia a clases a lo largo de todas las cursadas del alumno (0 = nunca asistió, 1 = asistió siempre).',
    'PromedioNota':         'Promedio general de notas obtenidas en todos los exámenes rendidos (escala 0 a 10).',

    # --- Historial específico por materia ---
    'VecesRendidaExamenMateria':         'Cantidad de veces que el alumno rindió examenes de esta materia en particular.',
    'VecesAusenteMateria':               'Cantidad de veces que el alumno estuvo ausente en exámenes de esta materia.',
    'VecesRecursada':                    'Cantidad de veces que el alumno recursó esta materia.',
    'VecesCursadaMateria':               'Cantidad de veces que el alumno cursó esta materia (incluyendo recursadas).',
    'PromedioNotaMateria':               'Promedio de notas en los exámenes de esta materia específica (escala 0 a 10).',
    'TasaAprobacionMateria':             'Proporción de exámenes aprobados en esta materia sobre el total rendido en ella.',
    'TasaRecursaMateria':                'Proporción de veces que recursó esta materia sobre el total de veces que la cursó.',
    'PromedioAsistenciaHistMateria':     'Promedio histórico de asistencia a clases en todas las cursadas de esta materia (0 a 1).',

    # --- Historial general (modelo examen) ---
    'TotalCursadasGeneral':              'Total de cursadas registradas en todas las materias del alumno.',
    'TasaRecursaGeneral':                'Tasa de recursado considerando todas las materias cursadas.',
    'PromedioAsistenciaGeneral':         'Promedio de asistencia ponderado sobre todas las materias cursadas (0 a 1).',
    'PromedioNotaGeneral':               'Promedio de notas en todos los exámenes rendidos, sin distinción de materia.',
    'TasaAprobacionGeneral':             'Proporción de exámenes aprobados sobre el total rendido en todas las materias.',

    # --- Contexto del examen actual ---
    'Asistencia':                        'Asistencia a clases en la cursada actual (0 = 0 %, 1 = 100 %). Por debajo de 0.75 se considera riesgo.',
    'PosicionFlujo':                     'Posición del examen dentro del flujo anual (1 = Primer Parcial, 2 = Rec. Parcial, 3 = Segundo Parcial, ... 7 = Tercer Final).',
    'AsistenciaBajaRiesgo':              'Indica si la asistencia está por debajo del 75 %, umbral a partir del cual el alumno pierde regularidad.',
    'EsUltimaInstancia':                 'Indica si este examen es la tercera instancia del Final (último intento disponible en el ciclo).',
    'TieneFinalAM1':                     'Indica si el alumno ya tiene aprobado el Final de Análisis Matemático 1.',
    'NotaPromedioParcialCursada':        'Promedio de las notas obtenidas en los parciales de la cursada actual (escala 0 a 10).',
    'CantParcialesAprobados':            'Cantidad de parciales aprobados durante la cursada actual.',
}


# ===========================================================================
# FUNCIONES CACHEADAS
# ===========================================================================

@st.cache_resource(show_spinner=False)
def _cargar_modelos() -> dict:
    """Carga y cachea los tres modelos .pkl. Se ejecuta una sola vez."""
    return cargar_modelos(str(MODELS_DIR))


@st.cache_data(show_spinner=False)
def _cargar_datos(dataset: str):
    """Carga y cachea X_test e y_test para un dataset dado."""
    _, X_test, _, y_test = ft_engineering_procesado(dataset=dataset)
    return X_test, y_test


@st.cache_data(show_spinner=False)
def _calcular_shap(_model, _X_test: pd.DataFrame, nombre_modelo: str, tipo: str) -> np.ndarray:
    """
    Calcula SHAP values para un modelo y los cachea.
    Llama a explicar_modelo() que guarda los .png como efecto secundario.

    Nota: los parámetros con prefijo _ no son hasheados por Streamlit
    (son objetos no serializables como modelos y DataFrames).
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    shap_vals = explicar_modelo(
        model=_model,
        X_test=_X_test,
        nombre_modelo=nombre_modelo,
        tipo=tipo,
        output_dir=str(OUTPUT_DIR),
    )
    plt.close('all')  # limpiar figuras creadas internamente
    return shap_vals


@st.cache_data(show_spinner=False)
def _calcular_metricas(_model, _X_test: pd.DataFrame, _y_test: pd.Series, tipo: str, nombre_modelo: str = '') -> dict:
    """
    Calcula métricas de evaluación en tiempo de ejecución.
    No usa valores hardcodeados: siempre usa el conjunto de test actual.

    nombre_modelo es un parámetro hashable que diferencia entradas de caché
    entre modelos del mismo tipo (ej: 'alumno' vs 'materia', ambos clasificación).
    Sin él, Streamlit usaría solo 'tipo' como clave y devolvería el caché del
    primer modelo al segundo.
    """
    if tipo == 'clasificacion':
        y_pred  = _model.predict(_X_test)
        y_proba = _model.predict_proba(_X_test)[:, 1]
        return {
            'Accuracy':  float(accuracy_score(_y_test, y_pred)),
            'Precision': float(precision_score(_y_test, y_pred, zero_division=0)),
            'Recall':    float(recall_score(_y_test, y_pred, zero_division=0)),
            'F1':        float(f1_score(_y_test, y_pred, zero_division=0)),
            'ROC-AUC':   float(roc_auc_score(_y_test, y_proba)),
        }
    else:
        y_pred = _model.predict(_X_test)
        mse    = float(mean_squared_error(_y_test, y_pred))
        return {
            'MAE':  float(mean_absolute_error(_y_test, y_pred)),
            'RMSE': float(np.sqrt(mse)),
            'R2':   float(r2_score(_y_test, y_pred)),
        }


@st.cache_resource(show_spinner=False)
def _obtener_explainer(_model):
    """Instancia y cachea el TreeExplainer para predicciones individuales."""
    return shap.TreeExplainer(_model)


# ===========================================================================
# FUNCIONES AUXILIARES
# ===========================================================================

def _extraer_base_val(explainer, tipo: str) -> float:
    """
    Extrae el expected_value correcto según el tipo de tarea.

    Comportamiento por modelo:
    - GradientBoosting (sklearn): expected_value puede ser un array de 1 elemento
      (log-odds) o lista de 2 elementos [neg, pos]. Usamos el último elemento.
    - XGBoost binario: suele devolver un array numpy de shape (2,) o escalar.
    - RandomForest regresor: devuelve un escalar.
    """
    ev = explainer.expected_value
    if tipo == 'clasificacion':
        if isinstance(ev, (list, np.ndarray)):
            ev_arr = np.atleast_1d(np.asarray(ev, dtype=float))
            # ev_arr[-1] funciona tanto para len=1 (único valor GBM)
            # como para len=2 (valor clase positiva XGBoost/RF)
            return float(ev_arr[-1])
        return float(ev)
    else:
        if hasattr(ev, '__len__'):
            return float(np.asarray(ev).flat[0])
        return float(ev)


def _shap_individual(model, X_row: pd.DataFrame, tipo: str):
    """
    Calcula SHAP values para una sola fila y retorna (shap_vals_row, base_val).
    Usado para el waterfall de predicción individual.

    Maneja los distintos formatos de salida según modelo:
    - Lista [arr_neg, arr_pos]: GradientBoosting sklearn
    - Array 3D (1, n_features, 2): algunos XGBoost
    - Array 2D (1, n_features): GBM log-odds / regresores
    - Array 1D (n_features,): casos con batch dim eliminado
    """
    explainer = _obtener_explainer(model)
    shap_raw  = explainer.shap_values(X_row, check_additivity=False)

    if tipo == 'clasificacion':
        if isinstance(shap_raw, list):
            # Tomamos el último elemento = clase positiva
            # (funciona si la lista tiene 1 o 2 arrays)
            arr = shap_raw[-1]
            # Si el array tiene dimensión de batch (shape 2D), eliminamos esa dim
            sv = arr[0] if (isinstance(arr, np.ndarray) and arr.ndim == 2) else np.asarray(arr)
        elif isinstance(shap_raw, np.ndarray) and shap_raw.ndim == 3:
            # Shape (1, n_features, n_clases) → clase positiva
            sv = shap_raw[0, :, -1]
        else:
            # Shape (1, n_features) o (n_features,)
            sv = shap_raw[0] if (isinstance(shap_raw, np.ndarray) and shap_raw.ndim > 1) else np.asarray(shap_raw)
    else:
        # Regresor: array (1, n_features) o (n_features,)
        arr = np.asarray(shap_raw)
        sv  = arr[0] if arr.ndim > 1 else arr

    base_val = _extraer_base_val(explainer, tipo)
    return sv, base_val


def _renderizar_waterfall(sv_row, base_val: float, X_row: pd.DataFrame):
    """Renderiza un waterfall SHAP en Streamlit a partir de una fila."""
    explanation = shap.Explanation(
        values        = sv_row,
        base_values   = base_val,
        data          = X_row.values[0],
        feature_names = list(X_row.columns),
    )
    shap.plots.waterfall(explanation, show=False)
    st.pyplot(plt.gcf(), clear_figure=True)


def _widget_feature(nombre: str, col):
    """
    Retorna el valor capturado por el widget apropiado para la feature dada.
    - selectbox  → variables binarias con etiquetas legibles
    - slider     → tasas y proporciones [0, 1]
    - number_input → el resto (int o float)
    Todos los widgets muestran un tooltip con la descripción en lenguaje llano.
    """
    # Etiqueta legible: reemplaza camelCase por espacios
    label   = nombre.replace('_', ' ')
    tooltip = TOOLTIPS.get(nombre, '')

    if nombre in SELECTBOX_FEATURES:
        mapa     = SELECTBOX_FEATURES[nombre]
        opciones = list(mapa.values())
        sel      = col.selectbox(label, opciones, help=tooltip)
        return [k for k, v in mapa.items() if v == sel][0]

    elif nombre in SLIDER_FEATURES:
        default = 0.75 if 'Asistencia' in nombre or 'Promedio' in nombre else 0.5
        return col.slider(label, 0.0, 1.0, default, step=0.01, help=tooltip)

    elif nombre in INT_FEATURES:
        default = DEFAULTS.get(nombre, 1)
        return col.number_input(label, value=default, step=1, min_value=0, help=tooltip)

    else:
        default = DEFAULTS.get(nombre, 5.0)
        return col.number_input(label, value=float(default), step=0.1, min_value=0.0, help=tooltip)


# ===========================================================================
# CONFIGURACIÓN DE PÁGINA
# ===========================================================================

st.set_page_config(
    page_title='Sistema de Predicción Académica',
    page_icon='🎓',
    layout='wide',
    initial_sidebar_state='expanded',
)

# ---------------------------------------------------------------------------
# Control de errores de importación
# ---------------------------------------------------------------------------
if not MODULOS_OK:
    st.error(
        f'No se pudieron importar los módulos necesarios: {_IMPORT_ERROR}\n\n'
        'Verificá que el entorno virtual esté activado y que estés ejecutando '
        'la app desde la carpeta raíz **ai-service/**.'
    )
    st.stop()


# ===========================================================================
# SIDEBAR
# ===========================================================================

with st.sidebar:
    st.title('🎓 Predicción Académica')
    st.markdown('---')

    # Selector de modelo activo
    modelo_key = st.selectbox(
        'Seleccioná el modelo',
        options=['alumno', 'materia', 'examen'],
        format_func=lambda k: f"{MODELOS_INFO[k]['icono']}  {MODELOS_INFO[k]['nombre_display']}",
    )

    info = MODELOS_INFO[modelo_key]
    st.info(f"**{info['nombre_display']}**\n\n{info['descripcion']}")

    st.markdown('---')
    st.caption('Tesis de Predicción Académica · Machine Learning')


# ===========================================================================
# CARGA DE DATOS Y MODELOS (con spinner)
# ===========================================================================

try:
    modelos = _cargar_modelos()
except Exception as e:
    st.error(f'Error al cargar modelos: {e}')
    st.stop()

tipo         = info['tipo']
modelo_activo = modelos[modelo_key]

with st.spinner('Cargando datos y calculando SHAP values... (solo la primera vez)'):
    try:
        X_test, y_test = _cargar_datos(modelo_key)
        shap_vals      = _calcular_shap(
            modelo_activo, X_test, modelo_key, tipo,
        )
    except Exception as e:
        st.error(f'Error al cargar datos o calcular SHAP: {e}')
        st.stop()

feature_names = list(X_test.columns)


# ===========================================================================
# PESTAÑAS PRINCIPALES
# ===========================================================================

st.title(f"{info['icono']}  Sistema de Predicción Académica")
st.markdown(f"Modelo activo: **{info['nombre_display']}**")

tab_prediccion, tab_importancia, tab_metricas, tab_comparacion, tab_shap = st.tabs([
    '🔮 Predicción Individual',
    '📋 Importancia de Variables',
    '📊 Métricas',
    '⚖️  Comparación de Modelos',
    '🔍 Explicabilidad SHAP',
])


# ===========================================================================
# PESTAÑA 1 — PREDICCIÓN INDIVIDUAL
# ===========================================================================

with tab_prediccion:
    st.subheader(f'Predicción individual — {info["nombre_display"]}')
    st.markdown(
        f'Completá los datos de un alumno y {chr(10)}'
        f'el modelo predecirá: **{info["target"]}**.'
    )

    features        = list(modelo_activo.feature_names_in_)
    tiene_ohe_tipo  = any(f in TIPO_EXAMEN_COLS for f in features)
    # Separar features OHE de TipoExamen del resto
    features_form   = [f for f in features if f not in TIPO_EXAMEN_COLS]

    with st.form(key=f'form_{modelo_key}'):
        st.markdown('#### Datos del alumno / cursada / examen')

        # Renderizar widgets en grillas de 3 columnas
        valores_ingresados = {}
        n = len(features_form)
        for i in range(0, n, 3):
            cols_form = st.columns(3)
            for j, feature in enumerate(features_form[i:i+3]):
                valores_ingresados[feature] = _widget_feature(feature, cols_form[j])

        # Widget especial para TipoExamen (si aplica al modelo examen)
        tipo_examen_sel = None
        if tiene_ohe_tipo:
            st.markdown('---')
            st.markdown('**Tipo de Examen**')
            tipo_examen_sel = st.selectbox(
                'Tipo de Examen',
                options=['Parcial', 'Recuperatorio', 'Final'],
            )

        submitted = st.form_submit_button('🔮  Obtener predicción', type='primary')

    # ----- Procesar formulario enviado -----------------------------------
    if submitted:
        try:
            # Construir la fila de entrada
            fila = dict(valores_ingresados)

            # Expandir TipoExamen OHE si corresponde
            if tiene_ohe_tipo and tipo_examen_sel:
                fila['TipoExamen_Parcial']        = 1 if tipo_examen_sel == 'Parcial'       else 0
                fila['TipoExamen_Final']           = 1 if tipo_examen_sel == 'Final'         else 0
                fila['TipoExamen_Recuperatorio']   = 1 if tipo_examen_sel == 'Recuperatorio' else 0

            # Reordenar columnas exactamente como las espera el modelo
            X_input = pd.DataFrame([fila])[features]

            st.markdown('---')
            st.markdown('### Resultado')

            if tipo == 'clasificacion':
                prediccion   = int(modelo_activo.predict(X_input)[0])
                probabilidad = float(modelo_activo.predict_proba(X_input)[0, 1])

                col_res1, col_res2, col_res3 = st.columns(3)
                etiqueta = info['etiqueta_pos'] if prediccion == 1 else info['etiqueta_neg']
                col_res1.metric('Predicción', etiqueta)
                col_res2.metric('Probabilidad', f'{probabilidad:.1%}')
                col_res3.metric('Confianza', 'Alta' if probabilidad > 0.75 else 'Media' if probabilidad > 0.5 else 'Baja')

                st.progress(probabilidad, text=f'Probabilidad de resultado positivo: {probabilidad:.1%}')

                if prediccion == 1:
                    st.error(f'⚠️  **{info["etiqueta_pos"]}** con probabilidad {probabilidad:.1%}')
                else:
                    st.success(f'✅  **{info["etiqueta_neg"]}** con probabilidad {1 - probabilidad:.1%}')

                # Alerta temprana si supera el umbral de 0.65
                if probabilidad > 0.65:
                    st.warning(
                        f'🔔  **Alerta temprana**: la probabilidad de {info["etiqueta_pos"].lower()} '
                        f'supera el 65%. Se recomienda iniciar una intervención docente '
                        f'personalizada para este alumno a la brevedad.'
                    )

            else:  # regresión
                nota_predicha = float(modelo_activo.predict(X_input)[0])
                nota_clamped  = max(0.0, min(10.0, nota_predicha))

                st.metric('Nota predicha', f'{nota_clamped:.2f} / 10')
                st.progress(nota_clamped / 10, text=f'Nota: {nota_clamped:.2f}')

                if nota_clamped >= 6:
                    st.success(f'✅  Nota estimada: **{nota_clamped:.2f}** — aprueba el examen.')
                elif nota_clamped >= 4:
                    st.warning(f'⚠️  Nota estimada: **{nota_clamped:.2f}** — resultado ajustado, puede desaprobar.')
                else:
                    st.error(f'❌  Nota estimada: **{nota_clamped:.2f}** — alto riesgo de desaprobar.')

            # ----- Waterfall SHAP para esta predicción individual --------
            st.markdown('---')
            st.markdown('#### ¿Por qué el modelo predijo este resultado?')
            st.caption(
                'El gráfico de cascada muestra qué variables empujaron la predicción '
                'hacia arriba (rojo) o hacia abajo (azul) para este alumno en particular.'
            )

            try:
                with st.spinner('Calculando explicación SHAP individual...'):
                    sv_ind, base_ind = _shap_individual(modelo_activo, X_input, tipo)
                _renderizar_waterfall(sv_ind, base_ind, X_input)

                # Top 3 variables con mayor impacto absoluto
                top3_idx = np.argsort(np.abs(sv_ind))[::-1][:3]
                top3     = [(features[i], sv_ind[i]) for i in top3_idx]
                st.markdown('**Variables con mayor influencia en esta predicción:**')
                for feat, val in top3:
                    direccion = 'aumentó' if val > 0 else 'redujo'
                    st.markdown(f'- **{feat}** {direccion} la predicción en {abs(val):.4f}')

            except Exception as e:
                st.warning(f'No se pudo generar el waterfall individual: {e}')

        except Exception as e:
            st.error(f'Error al procesar la predicción: {e}')



# ===========================================================================
# PESTAÑA 2 — IMPORTANCIA DE VARIABLES
# ===========================================================================

with tab_importancia:
    st.subheader(f'Importancia de Variables — {info["nombre_display"]}')
    st.markdown(
        'La importancia se calcula como la **media del valor absoluto** de los SHAP values '
        'sobre el conjunto de test. Indica cuánto contribuye cada variable al resultado del '
        'modelo, independientemente de la dirección.'
    )

    df_importancia = reporte_importancia(
        shap_values=shap_vals,
        feature_names=feature_names,
        output_dir=str(OUTPUT_DIR),
        nombre_modelo=modelo_key,
    )

    # Gráfico de barras horizontal (top 20)
    top_n    = min(20, len(df_importancia))
    df_top   = df_importancia.head(top_n).iloc[::-1]
    fig_imp, ax_imp = plt.subplots(figsize=(8, max(4, top_n * 0.4)))
    ax_imp.barh(df_top['Variable'], df_top['ImportanciaMedia'], color='steelblue')
    ax_imp.set_xlabel('Importancia media (|SHAP|)')
    ax_imp.set_title(f'Top {top_n} variables — {info["nombre_display"]}')
    plt.tight_layout()
    st.pyplot(fig_imp, clear_figure=True)

    st.markdown('---')
    st.markdown('#### Tabla completa')
    st.dataframe(
        df_importancia.style.background_gradient(subset=['ImportanciaMedia'], cmap='Blues'),
        use_container_width=True,
    )


# ===========================================================================
# PESTAÑA 3 — MÉTRICAS
# ===========================================================================

with tab_metricas:
    st.subheader(f'Métricas de Evaluación — {info["nombre_display"]}')
    st.caption('Calculadas sobre el conjunto de test cada vez que se carga la app.')

    metricas = _calcular_metricas(modelo_activo, X_test, y_test, tipo, nombre_modelo=modelo_key)

    cols_m = st.columns(len(metricas))
    for col_m, (nombre_m, valor_m) in zip(cols_m, metricas.items()):
        col_m.metric(nombre_m, f'{valor_m:.4f}')

    st.markdown('---')
    st.markdown('#### Interpretación')
    if tipo == 'clasificacion':
        st.markdown(
            '- **Accuracy**: proporción de predicciones correctas sobre el total.\n'
            '- **Precision**: de los casos predichos como positivos, cuántos lo son realmente.\n'
            '- **Recall**: de los casos positivos reales, cuántos fueron detectados.\n'
            '- **F1**: media armónica entre Precision y Recall (equilibra ambas).\n'
            '- **ROC-AUC**: capacidad discriminativa del modelo '
            '(1.0 = perfecto, 0.5 = azar).'
        )
    else:
        st.markdown(
            '- **MAE**: error absoluto medio en unidades de la nota (escala 0–10).\n'
            '- **RMSE**: raíz del error cuadrático medio (penaliza errores grandes).\n'
            '- **R²**: proporción de la varianza explicada por el modelo '
            '(1.0 = perfecto, 0.0 = igual que predecir la media).'
        )


# ===========================================================================
# PESTAÑA 4 — COMPARACIÓN DE MODELOS
# ===========================================================================

with tab_comparacion:
    st.subheader('Comparación de Modelos')
    st.markdown(
        'Métricas de evaluación de los **tres modelos** calculadas sobre sus '
        'respectivos conjuntos de test.'
    )

    with st.spinner('Calculando métricas para todos los modelos...'):
        filas = []
        for mk, mi in MODELOS_INFO.items():
            try:
                Xt, yt = _cargar_datos(mk)
                mt     = _calcular_metricas(modelos[mk], Xt, yt, mi['tipo'], nombre_modelo=mk)
                fila   = {'Modelo': f"{mi['icono']} {mi['nombre_display']}", 'Tipo': mi['tipo']}
                fila.update(mt)
                filas.append(fila)
            except Exception as exc:
                st.warning(f'No se pudo calcular métricas para {mk}: {exc}')

    if filas:
        df_comp = pd.DataFrame(filas).set_index('Modelo')

        df_clas = df_comp[df_comp['Tipo'] == 'clasificacion'].drop(columns='Tipo')
        df_reg  = df_comp[df_comp['Tipo'] == 'regresion'].drop(columns='Tipo')

        if not df_clas.empty:
            st.markdown('#### Modelos de Clasificación')
            st.dataframe(
                df_clas.style.background_gradient(cmap='Greens'),
                use_container_width=True,
            )

        if not df_reg.empty:
            st.markdown('#### Modelos de Regresión')
            st.dataframe(
                df_reg.style.background_gradient(cmap='Blues'),
                use_container_width=True,
            )


# ===========================================================================
# PESTAÑA 5 — EXPLICABILIDAD SHAP
# ===========================================================================

with tab_shap:
    st.subheader(f'Explicabilidad SHAP — {info["nombre_display"]}')
    st.markdown(
        'Los gráficos muestran cómo cada variable contribuye a las predicciones del modelo. '
        'Se generan al cargar la app y se persisten en `outputs/shap/`.'
    )

    # Gráficos fijos (siempre generados)
    for sufijo, titulo in [
        ('1_summary_bar',           'Importancia Global (Summary Bar)'),
        ('2_beeswarm',              'Dirección e Intensidad (Beeswarm)'),
        ('3_waterfall_caso_riesgo', 'Caso de Mayor Riesgo (Waterfall)'),
    ]:
        ruta_png = OUTPUT_DIR / f'{modelo_key}_{sufijo}.png'
        st.markdown(f'### {titulo}')
        if ruta_png.exists():
            st.image(str(ruta_png), use_container_width=True)
        else:
            st.info(f'Imagen no disponible: recargá la app para generarla.')
        st.markdown('---')

    # Dependence plots (solo clasificación; nombres incluyen la feature)
    if tipo == 'clasificacion':
        import glob as _glob
        dep_archivos = sorted(
            _glob.glob(str(OUTPUT_DIR / f'{modelo_key}_4_dependence_*.png'))
        )
        for ruta_dep in dep_archivos:
            nombre_dep = Path(ruta_dep).stem
            # Extraer nombre de la feature del nombre del archivo
            partes     = nombre_dep.split('_', 4)   # modelo_4_dependence_topN_FEATURE
            titulo_dep = partes[-1] if len(partes) >= 5 else nombre_dep
            st.markdown(f'### Dependence Plot — {titulo_dep}')
            st.image(ruta_dep, use_container_width=True)
            st.markdown('---')


# ===========================================================================
# streamlit run app/streamlit_app.py
# ===========================================================================
