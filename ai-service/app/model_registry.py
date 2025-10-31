"""Model registry for loading and saving ML models."""
import joblib
from pathlib import Path
from typing import Optional, Dict, Tuple, List, Any
import logging

from .config import MODEL_DIR, MODEL_VERSION

logger = logging.getLogger(__name__)


def get_model_paths(name: str, version: Optional[str] = None) -> Dict[str, Path]:
    """
    Get paths for model artifacts (model, scaler, encoder, etc.).
    
    Args:
        name: Model name (e.g., 'grades', 'dropout')
        version: Model version (defaults to MODEL_VERSION)
    
    Returns:
        Dictionary with artifact paths
    """
    version = version or MODEL_VERSION
    base_path = MODEL_DIR / name / version
    
    # Support both naming conventions:
    # - New: {name}_model.joblib, {name}_scaler.joblib, {name}_encoders.joblib
    # - Old: {name}_model.pkl, {name}_scaler.pkl, {name}_encoder.pkl
    model_paths = [
        base_path / f"{name}_model.joblib",
        base_path / f"{name}_model.pkl",
    ]
    scaler_paths = [
        base_path / f"{name}_scaler.joblib",
        base_path / f"{name}_scaler.pkl",
    ]
    encoder_paths = [
        base_path / f"{name}_encoders.joblib",  # Note: encoders (plural) for new format
        base_path / f"{name}_encoder.pkl",
    ]
    
    # Find existing paths
    model_path = next((p for p in model_paths if p.exists()), model_paths[0])
    scaler_path = next((p for p in scaler_paths if p.exists()), scaler_paths[0])
    encoder_path = next((p for p in encoder_paths if p.exists()), encoder_paths[0])
    
    return {
        "model": model_path,
        "scaler": scaler_path,
        "encoder": encoder_path,
        "feature_order": base_path / "feature_order.json",
        "meta": base_path / "meta.json",
        "metadata": base_path / "metadata.json",  # Legacy
        "base": base_path,
    }


def load_model(name: str, version: Optional[str] = None):
    """
    Load a trained model from disk.
    
    Args:
        name: Model name (e.g., 'grades', 'dropout')
        version: Model version (defaults to MODEL_VERSION)
    
    Returns:
        Loaded model object, or None if not found
    """
    paths = get_model_paths(name, version)
    model_path = paths["model"]
    
    if not model_path.exists():
        logger.warning(f"Model not found: {model_path}")
        return None
    
    try:
        model = joblib.load(model_path)
        logger.info(f"Loaded model: {name} (version: {version or MODEL_VERSION})")
        return model
    except Exception as e:
        logger.error(f"Error loading model {name}: {e}")
        raise


def save_model(name: str, artifact: any, artifact_type: str = "model", version: Optional[str] = None):
    """
    Save a model artifact to disk.
    
    Args:
        name: Model name (e.g., 'grades', 'dropout')
        artifact: Model object to save
        artifact_type: Type of artifact ('model', 'scaler', 'encoder')
        version: Model version (defaults to MODEL_VERSION)
    """
    paths = get_model_paths(name, version)
    base_path = paths["base"]
    base_path.mkdir(parents=True, exist_ok=True)
    
    artifact_path = base_path / f"{name}_{artifact_type}.pkl"
    
    try:
        joblib.dump(artifact, artifact_path)
        logger.info(f"Saved {artifact_type}: {artifact_path}")
    except Exception as e:
        logger.error(f"Error saving {artifact_type} {name}: {e}")
        raise


def load_scaler(name: str, version: Optional[str] = None):
    """Load a scaler from disk."""
    paths = get_model_paths(name, version)
    scaler_path = paths["scaler"]
    
    if not scaler_path.exists():
        logger.warning(f"Scaler not found: {scaler_path}")
        return None
    
    try:
        scaler = joblib.load(scaler_path)
        logger.info(f"Loaded scaler: {name} (version: {version or MODEL_VERSION})")
        return scaler
    except Exception as e:
        logger.error(f"Error loading scaler {name}: {e}")
        return None


def load_encoder(name: str, version: Optional[str] = None):
    """Load an encoder from disk."""
    paths = get_model_paths(name, version)
    encoder_path = paths["encoder"]
    
    if not encoder_path.exists():
        logger.warning(f"Encoder not found: {encoder_path}")
        return None
    
    try:
        encoder = joblib.load(encoder_path)
        logger.info(f"Loaded encoder: {name} (version: {version or MODEL_VERSION})")
        return encoder
    except Exception as e:
        logger.error(f"Error loading encoder {name}: {e}")
        return None


def list_available_models() -> Dict[str, List[str]]:
    """
    List all available models and their versions.
    
    Returns:
        Dictionary mapping model names to lists of available versions
    """
    models: Dict[str, List[str]] = {}
    
    if not MODEL_DIR.exists():
        return models
    
    for model_name_dir in MODEL_DIR.iterdir():
        if model_name_dir.is_dir():
            versions = []
            for version_dir in model_name_dir.iterdir():
                if version_dir.is_dir():
                    # Check for both .joblib and .pkl formats
                    model_path_joblib = version_dir / f"{model_name_dir.name}_model.joblib"
                    model_path_pkl = version_dir / f"{model_name_dir.name}_model.pkl"
                    if model_path_joblib.exists() or model_path_pkl.exists():
                        versions.append(version_dir.name)
            if versions:
                models[model_name_dir.name] = sorted(versions)
    
    return models


def ensure_models_loaded(name: str, version: Optional[str] = None) -> Dict[str, Any]:
    """
    Load all model artifacts (model, scaler, encoders, feature_order, meta).
    Caches loaded models to avoid reloading.
    
    Args:
        name: Model name (e.g., 'grades', 'dropout')
        version: Model version (defaults to MODEL_VERSION)
    
    Returns:
        Dictionary with keys: 'model', 'scaler', 'encoders', 'feature_order', 'meta'
    
    Raises:
        FileNotFoundError: If model or required artifacts are not found
        Exception: If loading fails
    """
    version = version or MODEL_VERSION
    
    # Cache key
    cache_key = f"{name}:{version}"
    
    # Simple in-memory cache (could be improved with proper caching library)
    if not hasattr(ensure_models_loaded, "_cache"):
        ensure_models_loaded._cache = {}
    
    # Return cached if available
    if cache_key in ensure_models_loaded._cache:
        logger.info(f"Using cached model: {name} (version: {version})")
        return ensure_models_loaded._cache[cache_key]
    
    logger.info(f"Loading model artifacts: {name} (version: {version})")
    
    # Load model
    model = load_model(name, version)
    if model is None:
        raise FileNotFoundError(f"Model not found: {name} (version: {version})")
    
    # Load scaler (may be None if not used)
    scaler = load_scaler(name, version)
    
    # Load encoders (may be None if not used)
    encoders = load_encoder(name, version)
    
    # Load feature order
    import json
    paths = get_model_paths(name, version)
    feature_order_path = paths["feature_order"]
    
    if not feature_order_path.exists():
        raise FileNotFoundError(f"Feature order not found: {feature_order_path}")
    
    with open(feature_order_path, 'r', encoding='utf-8') as f:
        feature_order_data = json.load(f)
    
    # Load metadata
    meta_path = paths["meta"]
    if not meta_path.exists():
        # Try legacy metadata path
        meta_path = paths.get("metadata", meta_path)
        if not meta_path.exists():
            raise FileNotFoundError(f"Metadata not found: {meta_path}")
    
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)
    
    result = {
        "model": model,
        "scaler": scaler,
        "encoders": encoders,
        "feature_order": feature_order_data,
        "meta": meta
    }
    
    # Cache result
    ensure_models_loaded._cache[cache_key] = result
    
    logger.info(f"Successfully loaded all artifacts for {name} (version: {version})")
    return result