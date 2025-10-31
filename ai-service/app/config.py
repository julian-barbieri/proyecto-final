"""Configuration settings for the AI service."""
import os
from pathlib import Path
from typing import Dict, Any

# Base directories
BASE_DIR = Path(__file__).parent.parent
MODEL_DIR = Path(os.getenv("MODEL_DIR", str(BASE_DIR / "models")))
METRICS_DIR = Path(os.getenv("METRICS_DIR", str(BASE_DIR / "metrics")))
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))

# Ensure directories exist
MODEL_DIR.mkdir(parents=True, exist_ok=True)
METRICS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Model configuration
MODEL_VERSION = os.getenv("MODEL_VERSION", "v2.0.0")  # Production model: Random Forest (max_depth=3) - Base features only

# Timeouts (in seconds)
TIMEOUTS: Dict[str, float] = {
    "model_load": float(os.getenv("MODEL_LOAD_TIMEOUT", "30.0")),
    "prediction": float(os.getenv("PREDICTION_TIMEOUT", "10.0")),
}

# Thresholds
THRESHOLDS: Dict[str, float] = {
    "dropout_default": float(os.getenv("DROPOUT_THRESHOLD", "0.5")),
    "min_grade": float(os.getenv("MIN_GRADE", "1.0")),
    "max_grade": float(os.getenv("MAX_GRADE", "10.0")),
}

# Service configuration
SERVICE_NAME = "ai-service"
SERVICE_VERSION = "v1.0.0"  # Service version (independent of model version)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# API configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

