"""Utility functions for data processing and validation."""
import hashlib
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
import numpy as np
import pandas as pd
import logging

from .config import THRESHOLDS

logger = logging.getLogger(__name__)


def stable_features_hash(items: List[Dict[str, Any]]) -> str:
    """
    Generate a stable hash from a list of feature dictionaries.
    Useful for caching predictions or tracking data consistency.
    
    Args:
        items: List of feature dictionaries
    
    Returns:
        Hex digest of the hash
    """
    # Convert to JSON string with sorted keys for consistency
    json_str = json.dumps(items, sort_keys=True, default=str)
    return hashlib.md5(json_str.encode()).hexdigest()


def normalize_feature_types(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize feature types to ensure consistency.
    Converts numpy types, handles None values, etc.
    
    Args:
        features: Dictionary of feature name to value
    
    Returns:
        Normalized feature dictionary
    """
    normalized = {}
    
    for key, value in features.items():
        # Handle numpy types
        if isinstance(value, (np.integer, np.floating)):
            normalized[key] = float(value) if isinstance(value, np.floating) else int(value)
        # Handle numpy arrays (convert to list)
        elif isinstance(value, np.ndarray):
            normalized[key] = value.tolist()
        # Handle pandas types
        elif hasattr(value, 'item'):  # pandas scalar
            normalized[key] = value.item()
        # Handle None/NaN
        elif value is None or (isinstance(value, float) and np.isnan(value)):
            normalized[key] = None
        else:
            normalized[key] = value
    
    return normalized


def sort_feature_columns(features_df: pd.DataFrame, expected_order: List[str]) -> pd.DataFrame:
    """
    Sort DataFrame columns to match expected order.
    Fills missing columns with NaN.
    
    Args:
        features_df: DataFrame with features
        expected_order: List of column names in expected order
    
    Returns:
        DataFrame with columns sorted and filled
    """
    # Add missing columns with NaN
    for col in expected_order:
        if col not in features_df.columns:
            features_df[col] = np.nan
    
    # Reorder columns
    available_cols = [col for col in expected_order if col in features_df.columns]
    return features_df[available_cols]


def clamp_grades(preds: List[float]) -> List[float]:
    """
    Clamp predicted grades to valid range [1, 10].
    
    Args:
        preds: List of predicted grades
    
    Returns:
        List of clamped grades
    """
    min_grade = THRESHOLDS["min_grade"]
    max_grade = THRESHOLDS["max_grade"]
    
    clamped = [max(min_grade, min(max_grade, float(pred))) for pred in preds]
    return clamped


def prepare_features_list(items: List[Any]) -> pd.DataFrame:
    """
    Convert a list of feature dictionaries or Pydantic models to a pandas DataFrame.
    Handles normalization and sorting.
    
    Args:
        items: List of feature dictionaries or Pydantic models (ItemFeatures)
    
    Returns:
        DataFrame with normalized features
    """
    # Extract features from items (handle both dicts and Pydantic models)
    features_list = []
    for item in items:
        # Handle Pydantic models (they have .dict() or .model_dump())
        if hasattr(item, "model_dump"):
            item_dict = item.model_dump()
            # For ItemFeatures, all fields are features (extra="allow")
            features = item_dict
        elif hasattr(item, "dict"):
            item_dict = item.dict()
            features = item_dict.get("features", item_dict)
        # Handle plain dicts
        elif isinstance(item, dict):
            features = item.get("features", item)
        else:
            features = item
        
        normalized_features = normalize_feature_types(features)
        features_list.append(normalized_features)
    
    # Convert to DataFrame
    df = pd.DataFrame(features_list)
    
    return df


def build_features_for_prediction(
    items: List[Any],
    encoders: Optional[Dict[str, Any]],
    feature_order: Dict[str, List[str]],
    scaler: Optional[Any] = None
) -> np.ndarray:
    """
    Build features for prediction, replicating the exact preprocessing from training.
    
    Args:
        items: List of feature dictionaries
        encoders: Dictionary of LabelEncoder objects (keyed by column name)
        feature_order: Dictionary with 'numeric_features', 'categorical_features', 'all_features'
        scaler: StandardScaler object (optional, if None no scaling is applied)
    
    Returns:
        numpy array ready for model prediction (shape: [n_samples, n_features])
    """
    # Convert items to DataFrame
    df = prepare_features_list(items)
    
    # Parse edad from FechaNacimiento if needed
    if "edad" not in df.columns and "FechaNacimiento" in df.columns:
        try:
            birth = pd.to_datetime(df["FechaNacimiento"], dayfirst=True, errors="coerce")
            ref_year = datetime.now().year
            df["edad"] = (ref_year - birth.dt.year).astype(float)
        except Exception as e:
            logger.warning(f"Error parsing FechaNacimiento: {e}")
            df["edad"] = np.nan
    
    # Drop columns that shouldn't be features (same as training)
    columns_to_drop = [
        "id", "ID", "email", "nombre", "Email", "Nombre",
        "AnioAM2", "TutorAM2", "ProfesorAM2", "VecesRecursadaAM2",
        "AsistenciaAM2", "PeriodoAM2", "ModalidadAM2", "TipoMateriaAM2",
        "Parcial1AM2", "Parcial2AM2", "Recuperatorio1AM2", "Recuperatorio2AM2",
        "Final1AM2", "Final2AM2", "Final3AM2", "ApruebaAM2",
        "Carrera",
        "ApruebaAM1", "Abandona",
        "NotaFinalAM1", "Final1AM1", "Final2AM1", "Final3AM1"  # Target variables
    ]
    existing_drop_cols = [col for col in columns_to_drop if col in df.columns]
    if existing_drop_cols:
        df = df.drop(columns=existing_drop_cols)
    
    # Apply imputation rules (same as training)
    # Imputación 1: Recuperatorio1AM1 vacío → Parcial1AM1
    if "Recuperatorio1AM1" in df.columns and "Parcial1AM1" in df.columns:
        recup1 = pd.to_numeric(df["Recuperatorio1AM1"], errors="coerce")
        parcial1 = pd.to_numeric(df["Parcial1AM1"], errors="coerce")
        recup1_nan_mask = recup1.isna()
        parcial1_exists = parcial1.notna()
        fill_mask = recup1_nan_mask & parcial1_exists
        if fill_mask.any():
            df.loc[fill_mask, "Recuperatorio1AM1"] = df.loc[fill_mask, "Parcial1AM1"]
    
    # Imputación 2: Recuperatorio2AM1 vacío → Parcial2AM1
    if "Recuperatorio2AM1" in df.columns and "Parcial2AM1" in df.columns:
        recup2 = pd.to_numeric(df["Recuperatorio2AM1"], errors="coerce")
        parcial2 = pd.to_numeric(df["Parcial2AM1"], errors="coerce")
        recup2_nan_mask = recup2.isna()
        parcial2_exists = parcial2.notna()
        fill_mask = recup2_nan_mask & parcial2_exists
        if fill_mask.any():
            df.loc[fill_mask, "Recuperatorio2AM1"] = df.loc[fill_mask, "Parcial2AM1"]
    
    # Convert numeric columns
    numeric_cols = [
        "edad", "Parcial1AM1", "Parcial2AM1", "Recuperatorio1AM1", "Recuperatorio2AM1",
        "AsistenciaAM1", "VecesRecursadaAM1", "PromedioNotasColegio", "AniosUniversidad"
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    
    # NOTE: NO FEATURE ENGINEERING - Only base features are used (v2.0.0)
    # Removed all derived features: promedio_parciales, max_parcial, min_parcial, 
    # tendencia_parciales, tiene_recuperatorio, promedio_historico, rango_parciales, std_parciales
    
    # Handle categorical columns with LabelEncoder
    categorical_cols = ["Genero", "ProfesorAM1", "ColegioTecnico", "AyudaFinanciera"]
    if encoders:
        for col in categorical_cols:
            if col in df.columns:
                # Transform non-null values
                non_null_mask = df[col].notna()
                if non_null_mask.sum() > 0 and col in encoders:
                    try:
                        # Try to transform known values
                        values_to_encode = df.loc[non_null_mask, col].astype(str)
                        # For unknown values, use -1 (consistent with training)
                        encoded_values = []
                        for val in values_to_encode:
                            if val in encoders[col].classes_:
                                encoded_values.append(encoders[col].transform([val])[0])
                            else:
                                encoded_values.append(-1)  # Unknown category
                        df.loc[non_null_mask, col] = encoded_values
                    except Exception as e:
                        logger.warning(f"Error encoding {col}: {e}, using -1")
                        df.loc[non_null_mask, col] = -1
                
                # Fill NaN with -1
                df[col] = df[col].fillna(-1).astype(int)
    else:
        # No encoders available, fill with -1
        for col in categorical_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(-1).astype(int)
    
    # Handle missing values in numeric columns (conservative imputation)
    # Use 0 for missing values (conservative approach)
    numeric_features = feature_order.get("numeric_features", [])
    for col in numeric_features:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    
    # Reorder and select features according to feature_order
    all_features = feature_order.get("all_features", [])
    
    # Handle FechaNacimiento - convert to numeric (year) if present
    # Check if FechaNacimiento_numeric is expected in feature_order
    if "FechaNacimiento_numeric" in all_features:
        if "FechaNacimiento" in df.columns:
            try:
                dates = pd.to_datetime(df["FechaNacimiento"], dayfirst=True, errors="coerce")
                df["FechaNacimiento_numeric"] = dates.dt.year.fillna(dates.dt.year.median() if dates.dt.year.notna().any() else datetime.now().year)
            except Exception as e:
                logger.warning(f"Error converting FechaNacimiento: {e}")
                df["FechaNacimiento_numeric"] = datetime.now().year
        elif "FechaNacimiento_numeric" not in df.columns:
            # If FechaNacimiento_numeric is expected but not provided, use default
            df["FechaNacimiento_numeric"] = datetime.now().year
    
    categorical_features = feature_order.get("categorical_features", [])
    
    # Ensure all required features exist (add missing ones as 0 or -1)
    for feat in all_features:
        if feat not in df.columns:
            if feat in numeric_features:
                df[feat] = 0.0  # Default for numeric
            elif feat in categorical_features:
                df[feat] = -1  # Default for categorical
            else:
                df[feat] = 0.0  # Default fallback
    
    # Select and reorder features
    X = df[all_features].copy()
    
    # Separate numeric and categorical
    X_numeric = X[numeric_features].values if numeric_features else np.array([]).reshape(len(X), 0)
    X_categorical = X[categorical_features].values if categorical_features else np.array([]).reshape(len(X), 0)
    
    # Scale numeric features if scaler is provided
    if scaler is not None and len(numeric_features) > 0:
        X_numeric_scaled = scaler.transform(X_numeric)
    else:
        X_numeric_scaled = X_numeric
    
    # Combine scaled numeric + categorical
    if len(numeric_features) > 0 and len(categorical_features) > 0:
        X_final = np.hstack([X_numeric_scaled, X_categorical])
    elif len(numeric_features) > 0:
        X_final = X_numeric_scaled
    elif len(categorical_features) > 0:
        X_final = X_categorical
    else:
        raise ValueError("No features available for prediction!")
    
    return X_final

