"""
📦 feature_engineering - Módulo centralizado de Feature Engineering

Este módulo contiene toda la lógica relacionada con:
- Carga de datos (cargar_datos.py)
- Feature engineering y preprocesamiento (ft_engineering.py)

Importación rápida:
    from feature_engineering import cargar_datos
    from feature_engineering import ft_engineering_procesado
"""

# Importar funciones y clases principales para acceso directo
from .cargar_datos import cargar_datos
from .ft_engineering import ft_engineering_procesado, CORRELATIVAS_MAP

__all__ = [
    # Carga de datos
    'cargar_datos',
    
    # Feature engineering
    'ft_engineering_procesado',
    'CORRELATIVAS_MAP',
]

__version__ = '1.0.0'
