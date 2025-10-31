"""Main FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from datetime import datetime

from .config import SERVICE_NAME, SERVICE_VERSION, LOG_LEVEL
from .model_registry import list_available_models

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


if __name__ == "__main__":
    import uvicorn
    from .config import API_HOST, API_PORT
    
    uvicorn.run(
        "app.main:app",
        host=API_HOST,
        port=API_PORT,
        log_level=LOG_LEVEL.lower()
    )

