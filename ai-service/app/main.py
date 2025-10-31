"""Main FastAPI application."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
from datetime import datetime
import time
import numpy as np

from .config import SERVICE_NAME, SERVICE_VERSION, LOG_LEVEL
from .model_registry import list_available_models, ensure_models_loaded
from .schemas import PredictGradesRequest, PredictGradesResponse
from .utils import build_features_for_prediction, clamp_grades, stable_features_hash

# Configure structured logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=SERVICE_NAME,
    version=SERVICE_VERSION,
    description="AI Service for grade and dropout prediction"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """
    Health check endpoint.
    Returns service status and version.
    """
    logger.info("Health check requested")
    return {
        "status": "ok",
        "version": SERVICE_VERSION
    }


@app.get("/info")
async def info():
    """
    Get information about available models and their versions.
    """
    logger.info("Info endpoint requested")
    models = list_available_models()
    
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "models": models,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": f"{SERVICE_NAME} is running",
        "version": SERVICE_VERSION
    }


@app.post("/predict/grades", response_model=PredictGradesResponse)
async def predict_grades(request: PredictGradesRequest):
    """
    Predict grades for a list of students.
    
    Receives a list of items with features and returns predicted grades.
    Features are preprocessed using the same pipeline as training.
    """
    start_time = time.time()
    
    if not request.items:
        raise HTTPException(status_code=400, detail="Items list cannot be empty")
    
    try:
        # Load model artifacts (using MODEL_VERSION from config)
        from .config import MODEL_VERSION
        artifacts = ensure_models_loaded("grades", MODEL_VERSION)
        model = artifacts["model"]
        scaler = artifacts["scaler"]
        encoders = artifacts["encoders"]
        feature_order = artifacts["feature_order"]
        meta = artifacts["meta"]
    except FileNotFoundError as e:
        logger.error(f"Model not available: {e}")
        raise HTTPException(status_code=503, detail=f"Model not available: {str(e)}")
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        raise HTTPException(status_code=503, detail=f"Error loading model: {str(e)}")
    
    try:
        # Convert items to list of dicts for processing
        items_dicts = [item.model_dump() if hasattr(item, "model_dump") else item for item in request.items]
        
        # Build features
        X = build_features_for_prediction(
            items=items_dicts,
            encoders=encoders,
            feature_order=feature_order,
            scaler=scaler
        )
        
        logger.info(f"Built features array with shape: {X.shape}")
        
        # Make predictions
        preds = model.predict(X)
        
        # Clamp predictions to [1, 10] without rounding (keep as float)
        preds_clamped = clamp_grades(preds.tolist())
        
        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000
        
        # Generate features hash
        features_hash = stable_features_hash(items_dicts)
        
        # Build response metadata
        response_meta = {
            "model": "grades",
            "version": meta.get("version", "v2.0.0"),
            "r2": meta.get("metrics", {}).get("r2"),
            "mae": meta.get("metrics", {}).get("mae"),
            "features_hash": features_hash,
            "latency_ms": round(latency_ms, 2),
            "n_items": len(request.items),
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"Prediction completed: {len(preds_clamped)} predictions, latency: {latency_ms:.2f}ms")
        
        return PredictGradesResponse(
            preds=preds_clamped,
            meta=response_meta
        )
        
    except ValueError as e:
        logger.error(f"Invalid features: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid features: {str(e)}")
    except Exception as e:
        logger.error(f"Error during prediction: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    from .config import API_HOST, API_PORT
    
    uvicorn.run(
        "app.main:app",
        host=API_HOST,
        port=API_PORT,
        log_level=LOG_LEVEL.lower()
    )

