"""
streamlit_app.py
================
Aplicación Streamlit de predicción académica.

Permite explorar los tres modelos entrenados:
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
MODELS_DIR = SRC_DIR / 'models'     # ai-service/src/models-trained/
OUTPUT_DIR = ROOT_DIR / 'outputs' / 'shap'  # ai-service/outputs/shap/

# Agregar src/ al path para importar módulos propios
sys.path.insert(0, str(SRC_DIR))

try:
    from model_explainability import cargar_modelos, explicar_modelo, reporte_importancia
    from feature_engineering.ft_engineering import ft_engineering_procesado
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


# ===========================================================================
# FUNCIONES CACHEADAS
# ===========================================================================

@st.cache_resource(show_spinner=False)
def _cargar_modelos() -> dict:
    """Carga y cachea los tres modelos .pkl. Se ejecuta una sola vez."""
    return cargar_modelos(str(MODELS_DIR))


@st.cache_data(show_spinner=False)
def _cargar_datos(dataset: str):
    """Carga X_test e y_test desde los CSVs generados por el pipeline de entrenamiento."""
    test_dir = MODELS_DIR / 'dataset-test'
    X_test = pd.read_csv(test_dir / f'X_test_{dataset}.csv')
    y_test = pd.read_csv(test_dir / f'y_test_{dataset}.csv').squeeze()
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

tipo          = info['tipo']
modelo_activo = modelos[modelo_key]

X_test = y_test = shap_vals = feature_names = None
_datos_ok = False
_datos_error = ''

with st.spinner('Cargando datos de evaluación...'):
    try:
        X_test, y_test = _cargar_datos(modelo_key)
        # Verificar que las columnas del CSV coincidan con el modelo actual
        model_cols = set(str(f) for f in modelo_activo.feature_names_in_)
        data_cols  = set(X_test.columns)
        if model_cols != data_cols:
            faltantes = model_cols - data_cols
            extras    = data_cols - model_cols
            raise ValueError(
                f'Las columnas del conjunto de test no coinciden con el modelo reentrenado.\n'
                f'Faltan en CSV: {faltantes}\n'
                f'Sobran en CSV: {extras}\n'
                f'Solución: ejecutá el pipeline de entrenamiento para regenerar los CSV de test.'
            )
        shap_vals     = _calcular_shap(modelo_activo, X_test, modelo_key, tipo)
        feature_names = list(X_test.columns)
        _datos_ok     = True
    except Exception as e:
        _datos_error = str(e)


# ===========================================================================
# PESTAÑAS PRINCIPALES
# ===========================================================================

st.title(f"{info['icono']}  Sistema de Predicción Académica")
st.markdown(f"Modelo activo: **{info['nombre_display']}**")

tab_importancia, tab_metricas, tab_comparacion, tab_shap = st.tabs([
    '📋 Importancia de Variables',
    '📊 Métricas',
    '⚖️  Comparación de Modelos',
    '🔍 Explicabilidad SHAP',
])


# ===========================================================================
# PESTAÑA 1 — IMPORTANCIA DE VARIABLES
# ===========================================================================

with tab_importancia:
    st.subheader(f'Importancia de Variables — {info["nombre_display"]}')
    if not _datos_ok:
        st.warning(
            'Los datos de evaluación no coinciden con el modelo reentrenado.\n\n'
            f'**Detalle:** {_datos_error}\n\n'
            'Regenerá los CSV ejecutando el pipeline de entrenamiento y recargá la app.'
        )
    else:
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
# PESTAÑA 2 — MÉTRICAS
# ===========================================================================

with tab_metricas:
    st.subheader(f'Métricas de Evaluación — {info["nombre_display"]}')
    if not _datos_ok:
        st.warning(
            'Los datos de evaluación no coinciden con el modelo reentrenado.\n\n'
            f'**Detalle:** {_datos_error}\n\n'
            'Regenerá los CSV ejecutando el pipeline de entrenamiento y recargá la app.'
        )
    else:
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
# PESTAÑA 3 — COMPARACIÓN DE MODELOS
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
# PESTAÑA 4 — EXPLICABILIDAD SHAP
# ===========================================================================

with tab_shap:
    st.subheader(f'Explicabilidad SHAP — {info["nombre_display"]}')
    if not _datos_ok:
        st.warning(
            'Los datos de evaluación no coinciden con el modelo reentrenado.\n\n'
            f'**Detalle:** {_datos_error}\n\n'
            'Regenerá los CSV ejecutando el pipeline de entrenamiento y recargá la app.'
        )
    else:
        st.markdown(
            'Los gráficos muestran cómo cada variable contribuye a las predicciones del modelo. '
            'Se generan al cargar la app y se persisten en `outputs/shap/`.'
        )

    # Gráficos fijos (siempre generados si existen los PNG)
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
