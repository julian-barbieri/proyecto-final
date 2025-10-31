"""Utility functions for data processing and validation."""
import hashlib
import json
from typing import List, Dict, Any
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


def prepare_features_list(items: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Convert a list of feature dictionaries to a pandas DataFrame.
    Handles normalization and sorting.
    
    Args:
        items: List of feature dictionaries or Pydantic models
    
    Returns:
        DataFrame with normalized features
    """
    # Extract features from items (handle both dicts and Pydantic models)
    features_list = []
    for item in items:
        # Handle Pydantic models (they have .dict() or .model_dump())
        if hasattr(item, "model_dump"):
            item_dict = item.model_dump()
            features = item_dict.get("features", item_dict)
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

