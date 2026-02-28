import pandas as pd
import os


def cargar_datos(data_dir: str = 'data') -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Carga los datasets del proyecto desde archivos CSV.

    Parámetros
    ----------
    data_dir : str
        Ruta al directorio que contiene los archivos CSV.
        Por defecto: 'data'

    Retorna
    -------
    tuple con tres DataFrames: (alumno, materia, examen)
        - alumno  : nivel_alumno.csv  — perfil demográfico de cada alumno
        - materia : nivel_materia.csv — registro de cursadas por alumno y materia
        - examen  : nivel_examen.csv  — instancias de examen con notas

    Ejemplo de uso
    --------------
    from cargar_datos import cargar_datos

    alumno, materia, examen = cargar_datos()
    alumno, materia, examen = cargar_datos(data_dir='mi_carpeta/data')
    """
    archivos = {
        'alumno':  'nivel_alumno.csv',
        'materia': 'nivel_materia.csv',
        'examen':  'nivel_examen.csv',
    }

    dataframes = {}
    for nombre, archivo in archivos.items():
        ruta = os.path.join(data_dir, archivo)
        if not os.path.exists(ruta):
            raise FileNotFoundError(f"No se encontró el archivo: {ruta}")
        dataframes[nombre] = pd.read_csv(ruta)
        print(f"[OK] {archivo:<25} → {dataframes[nombre].shape[0]:>5} filas, {dataframes[nombre].shape[1]} columnas")

    return dataframes['alumno'], dataframes['materia'], dataframes['examen']
