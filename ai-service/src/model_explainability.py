"""
model_explainability.py
=======================
Módulo de explicabilidad de modelos usando SHAP (SHapley Additive exPlanations).

Genera visualizaciones interpretables para los tres modelos del sistema de
predicción académica:
  - modelo_alumno  → clasificador binario (Abandona)
  - modelo_materia → clasificador binario (Recursa)
  - modelo_examen  → regresor             (Nota)

Dependencias adicionales: shap, matplotlib (ya presente en requirements.txt)
"""

import os
import sys
import warnings

import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')          # backend no interactivo: genera .png sin pantalla
import matplotlib.pyplot as plt
import shap

warnings.filterwarnings('ignore')

# ---------------------------------------------------------------------------
# Rutas por defecto (relativas al propio módulo)
# ---------------------------------------------------------------------------
_SRC_DIR    = os.path.dirname(os.path.abspath(__file__))
_MODELS_DIR = os.path.join(_SRC_DIR, 'models')
_OUTPUT_DIR = os.path.join(_SRC_DIR, '..', 'outputs', 'shap')


# ===========================================================================
# 1. CARGA DE MODELOS
# ===========================================================================

def cargar_modelos(models_dir: str = _MODELS_DIR) -> dict:
    """
    Carga los tres modelos serializados (.pkl) desde el directorio indicado.

    Parámetros
    ----------
    models_dir : str
        Ruta al directorio que contiene modelo_alumno.pkl,
        modelo_materia.pkl y modelo_examen.pkl.

    Retorna
    -------
    dict con claves 'alumno', 'materia', 'examen' y los estimadores como valores.
    Levanta RuntimeError si algún archivo no puede cargarse.
    """
    modelos = {}
    datasets = ['alumno', 'materia', 'examen']

    for ds in datasets:
        ruta = os.path.join(models_dir, f'modelo_{ds}.pkl')
        try:
            modelos[ds] = joblib.load(ruta)
            print(f'  [OK] modelo_{ds}.pkl cargado correctamente.')
        except FileNotFoundError:
            raise RuntimeError(
                f'No se encontró el archivo: {ruta}\n'
                f'Ejecutá model_training_evaluation.py primero para generar los .pkl.'
            )
        except Exception as exc:
            raise RuntimeError(f'Error al cargar modelo_{ds}.pkl: {exc}') from exc

    return modelos


# ===========================================================================
# 2. EXPLICACIÓN POR MODELO
# ===========================================================================

def explicar_modelo(
    model,
    X_test: pd.DataFrame,
    nombre_modelo: str,
    tipo: str,
    output_dir: str = _OUTPUT_DIR,
) -> np.ndarray:
    """
    Genera y guarda los gráficos SHAP para un modelo dado.

    Gráficos producidos
    -------------------
    1. Summary bar plot   : importancia global de cada variable (útil para directivos).
    2. Beeswarm plot      : dirección e intensidad del impacto de cada variable.
    3. Waterfall plot     : explicación individual del caso de mayor riesgo/nota.
    4. Dependence plots   : (solo clasificación) top-2 variables más importantes.

    Parámetros
    ----------
    model        : estimador sklearn/XGBoost ya entrenado.
    X_test       : pd.DataFrame con las features del conjunto de prueba.
    nombre_modelo: str identificador usado en los nombres de archivo ('alumno', etc.).
    tipo         : 'clasificacion' o 'regresion'.
    output_dir   : carpeta donde se guardan los .png.

    Retorna
    -------
    np.ndarray con los SHAP values de la clase positiva (clasificación)
    o directos (regresión). Shape: (n_muestras, n_features).
    """
    if tipo not in ('clasificacion', 'regresion'):
        raise ValueError("El parámetro 'tipo' debe ser 'clasificacion' o 'regresion'.")

    os.makedirs(output_dir, exist_ok=True)

    feature_names = list(X_test.columns)
    X_np = X_test.values  # array numpy para SHAP

    # ------------------------------------------------------------------
    # 2.1  Instanciar TreeExplainer y calcular SHAP values
    # ------------------------------------------------------------------
    print(f'\n  [{nombre_modelo.upper()}] Calculando SHAP values...')
    try:
        explainer = shap.TreeExplainer(model)
        shap_raw  = explainer.shap_values(X_test, check_additivity=False)
    except Exception as exc:
        print(f'  [ERROR] No se pudo instanciar TreeExplainer para {nombre_modelo}: {exc}')
        raise

    # Para clasificadores binarios, shap_values devuelve una lista [clase0, clase1].
    # Usamos siempre la clase positiva (índice 1).
    if tipo == 'clasificacion':
        if isinstance(shap_raw, list):
            shap_vals = shap_raw[1]            # (n_muestras, n_features) clase positiva
            base_val  = (
                explainer.expected_value[1]
                if isinstance(explainer.expected_value, (list, np.ndarray))
                else explainer.expected_value
            )
        else:
            # Algunos modelos devuelven directamente un array 3D (n, f, 2)
            shap_vals = shap_raw[:, :, 1] if shap_raw.ndim == 3 else shap_raw
            base_val  = (
                explainer.expected_value[-1]
                if hasattr(explainer.expected_value, '__len__')
                else explainer.expected_value
            )
    else:
        shap_vals = shap_raw          # (n_muestras, n_features)
        base_val  = (
            float(explainer.expected_value)
            if not hasattr(explainer.expected_value, '__len__')
            else float(explainer.expected_value[0])
        )

    # ------------------------------------------------------------------
    # 2.2  Gráfico 1 — Summary bar (importancia global)
    # ------------------------------------------------------------------
    _guardar_plot(
        nombre=f'{nombre_modelo}_1_summary_bar',
        output_dir=output_dir,
        fn=lambda: shap.summary_plot(
            shap_vals,
            X_test,
            feature_names=feature_names,
            plot_type='bar',
            show=False,
        ),
    )
    print(f'  [OK] Gráfico 1 guardado: {nombre_modelo}_1_summary_bar.png')

    # ------------------------------------------------------------------
    # 2.3  Gráfico 2 — Beeswarm (dirección e intensidad)
    # ------------------------------------------------------------------
    _guardar_plot(
        nombre=f'{nombre_modelo}_2_beeswarm',
        output_dir=output_dir,
        fn=lambda: shap.summary_plot(
            shap_vals,
            X_test,
            feature_names=feature_names,
            plot_type='dot',
            show=False,
        ),
    )
    print(f'  [OK] Gráfico 2 guardado: {nombre_modelo}_2_beeswarm.png')

    # ------------------------------------------------------------------
    # 2.4  Gráfico 3 — Waterfall del caso de mayor riesgo
    # ------------------------------------------------------------------
    # Clasificación: mayor probabilidad predicha de clase 1.
    # Regresión:     mayor nota predicha.
    try:
        if tipo == 'clasificacion':
            idx_riesgo = int(np.argmax(model.predict_proba(X_test)[:, 1]))
        else:
            idx_riesgo = int(np.argmax(model.predict(X_test)))

        # Construimos el objeto Explanation manualmente para el waterfall.
        explicacion_individual = shap.Explanation(
            values        = shap_vals[idx_riesgo],
            base_values   = base_val,
            data          = X_np[idx_riesgo],
            feature_names = feature_names,
        )

        _guardar_plot(
            nombre=f'{nombre_modelo}_3_waterfall_caso_riesgo',
            output_dir=output_dir,
            fn=lambda: shap.plots.waterfall(explicacion_individual, show=False),
        )
        print(
            f'  [OK] Gráfico 3 guardado: {nombre_modelo}_3_waterfall_caso_riesgo.png'
            f'  (índice muestra: {idx_riesgo})'
        )
    except Exception as exc:
        print(f'  [WARN] No se pudo generar el waterfall para {nombre_modelo}: {exc}')

    # ------------------------------------------------------------------
    # 2.5  Gráfico 4 — Dependence plots (solo clasificación)
    # ------------------------------------------------------------------
    if tipo == 'clasificacion':
        # Identificamos las 2 features con mayor importancia SHAP media absoluta.
        importancia_media = np.abs(shap_vals).mean(axis=0)
        top2_idx = np.argsort(importancia_media)[::-1][:2]

        for rank, fidx in enumerate(top2_idx, start=1):
            fname = feature_names[fidx]
            try:
                _guardar_plot(
                    nombre=f'{nombre_modelo}_4_dependence_top{rank}_{fname}',
                    output_dir=output_dir,
                    fn=lambda fn=fname: shap.dependence_plot(
                        fn,
                        shap_vals,
                        X_test,
                        feature_names=feature_names,
                        show=False,
                    ),
                )
                print(
                    f'  [OK] Gráfico 4.{rank} guardado: '
                    f'{nombre_modelo}_4_dependence_top{rank}_{fname}.png'
                )
            except Exception as exc:
                print(
                    f'  [WARN] No se pudo generar dependence_plot '
                    f'para {fname} ({nombre_modelo}): {exc}'
                )

    return shap_vals


# ===========================================================================
# 3. REPORTE DE IMPORTANCIA
# ===========================================================================

def reporte_importancia(
    shap_values: np.ndarray,
    feature_names: list,
    output_dir: str = _OUTPUT_DIR,
    nombre_modelo: str = 'modelo',
) -> pd.DataFrame:
    """
    Construye un DataFrame con la importancia media de cada variable según SHAP
    y lo guarda como CSV.

    La importancia se calcula como la media del valor absoluto de los SHAP values
    sobre todas las muestras del conjunto de prueba.

    Parámetros
    ----------
    shap_values   : np.ndarray de shape (n_muestras, n_features).
    feature_names : lista de nombres de features en el mismo orden que shap_values.
    output_dir    : carpeta donde se guarda el CSV.
    nombre_modelo : prefijo para el nombre del archivo CSV.

    Retorna
    -------
    pd.DataFrame con columnas ['Variable', 'ImportanciaMedia'],
    ordenado de mayor a menor importancia.
    """
    os.makedirs(output_dir, exist_ok=True)

    # Calcular importancia media absoluta por variable
    importancia = np.abs(shap_values).mean(axis=0)

    df = pd.DataFrame({
        'Variable':        feature_names,
        'ImportanciaMedia': importancia,
    }).sort_values('ImportanciaMedia', ascending=False).reset_index(drop=True)

    # Guardar CSV
    ruta_csv = os.path.join(output_dir, f'{nombre_modelo}_importancia_shap.csv')
    try:
        df.to_csv(ruta_csv, index=False)
        print(f'  [OK] CSV guardado: {ruta_csv}')
    except Exception as exc:
        print(f'  [WARN] No se pudo guardar el CSV de importancia: {exc}')

    return df


# ===========================================================================
# FUNCIÓN AUXILIAR PRIVADA
# ===========================================================================

def _guardar_plot(nombre: str, output_dir: str, fn) -> None:
    """
    Ejecuta la función generadora de gráfico `fn`, guarda el resultado como .png
    y cierra la figura para evitar superposición en iteraciones sucesivas.

    Parámetros
    ----------
    nombre    : nombre del archivo sin extensión.
    output_dir: directorio de destino.
    fn        : callable sin argumentos que genera el gráfico con matplotlib.
    """
    ruta = os.path.join(output_dir, f'{nombre}.png')
    try:
        fn()
        plt.savefig(ruta, bbox_inches='tight', dpi=150)
        plt.close('all')
    except Exception as exc:
        plt.close('all')
        print(f'  [WARN] Error al guardar {nombre}.png: {exc}')


# ===========================================================================
# BLOQUE PRINCIPAL
# ===========================================================================

if __name__ == '__main__':

    # Forzar UTF-8 en la salida estándar (evita UnicodeEncodeError en Windows)
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    # ------------------------------------------------------------------
    # Rutas configurables
    # ------------------------------------------------------------------
    MODELS_DIR = _MODELS_DIR
    OUTPUT_DIR = _OUTPUT_DIR

    # Rutas a los CSV de test generados por model_training_evaluation.py
    CSV_X_TEST = {
        'alumno':  os.path.join(MODELS_DIR, 'X_test_alumno.csv'),
        'materia': os.path.join(MODELS_DIR, 'X_test_materia.csv'),
        'examen':  os.path.join(MODELS_DIR, 'X_test_examen.csv'),
    }
    CSV_Y_TEST = {
        'alumno':  os.path.join(MODELS_DIR, 'y_test_alumno.csv'),
        'materia': os.path.join(MODELS_DIR, 'y_test_materia.csv'),
        'examen':  os.path.join(MODELS_DIR, 'y_test_examen.csv'),
    }

    # Tipo de problema por dataset
    TIPO = {
        'alumno':  'clasificacion',
        'materia': 'clasificacion',
        'examen':  'regresion',
    }

    # ------------------------------------------------------------------
    # 1) Cargar modelos
    # ------------------------------------------------------------------
    print('\n' + '='*60)
    print('  CARGANDO MODELOS')
    print('='*60)
    modelos = cargar_modelos(MODELS_DIR)

    # ------------------------------------------------------------------
    # 2) Cargar datos de test desde CSV
    # ------------------------------------------------------------------
    print('\n' + '='*60)
    print('  CARGANDO DATOS DE TEST')
    print('='*60)

    datos_test = {}
    for ds in ['alumno', 'materia', 'examen']:
        try:
            X_test = pd.read_csv(CSV_X_TEST[ds])
            y_test = pd.read_csv(CSV_Y_TEST[ds]).squeeze()  # Series 1D
            datos_test[ds] = (X_test, y_test)
            print(f'  [OK] {ds.upper():8} X_test: {X_test.shape}  y_test: {y_test.shape}')
        except FileNotFoundError:
            # Si los CSV no existen, los generamos desde ft_engineering
            print(
                f'  [INFO] CSV de {ds} no encontrado. '
                f'Generando desde ft_engineering_procesado...'
            )
            sys.path.append(os.path.dirname(__file__))
            from ft_engineering import ft_engineering_procesado
            _, X_test, _, y_test = ft_engineering_procesado(dataset=ds)
            datos_test[ds] = (X_test, y_test)
            print(f'  [OK] {ds.upper():8} X_test: {X_test.shape}  (generado en memoria)')
        except Exception as exc:
            print(f'  [ERROR] No se pudo cargar el dataset {ds}: {exc}')
            sys.exit(1)

    # ------------------------------------------------------------------
    # 3) Ejecutar explicabilidad por modelo
    # ------------------------------------------------------------------
    print('\n' + '='*60)
    print(f'  GENERANDO GRAFICOS SHAP  ->  {OUTPUT_DIR}')
    print('='*60)

    reportes = {}
    for ds in ['alumno', 'materia', 'examen']:
        print(f'\n{"-"*60}')
        print(f'  Modelo: {ds.upper()}  |  Tipo: {TIPO[ds]}')
        print(f'{"-"*60}')

        X_test, _ = datos_test[ds]
        modelo     = modelos[ds]

        try:
            shap_vals = explicar_modelo(
                model         = modelo,
                X_test        = X_test,
                nombre_modelo = ds,
                tipo          = TIPO[ds],
                output_dir    = OUTPUT_DIR,
            )

            df_importancia = reporte_importancia(
                shap_values   = shap_vals,
                feature_names = list(X_test.columns),
                output_dir    = OUTPUT_DIR,
                nombre_modelo = ds,
            )
            reportes[ds] = df_importancia

        except Exception as exc:
            print(f'  [ERROR] Fallo al procesar {ds.upper()}: {exc}')

    # ------------------------------------------------------------------
    # 4) Imprimir top-5 variables más importantes por modelo
    # ------------------------------------------------------------------
    print('\n' + '='*60)
    print('  TOP 5 VARIABLES MÁS IMPORTANTES (por modelo)')
    print('='*60)

    for ds, df_imp in reportes.items():
        print(f'\n  [{ds.upper()}]')
        top5 = df_imp.head(5)
        for _, row in top5.iterrows():
            barra = '█' * int(row['ImportanciaMedia'] * 40 / df_imp['ImportanciaMedia'].max())
            print(f'    {row["Variable"]:35s}  {row["ImportanciaMedia"]:.4f}  {barra}')

    print(f'\n  Todos los gráficos guardados en: {os.path.abspath(OUTPUT_DIR)}')
    print('  Proceso completado.\n')
