from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import subprocess
from datetime import datetime

app = FastAPI(title="AI Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_git_commit():
    try:
        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            capture_output=True,
            text=True,
            cwd='.'
        )
        if result.returncode == 0:
            return result.stdout.strip()[:7]
    except:
        pass
    return "unknown"

@app.get("/health")
async def health():
    """Health check endpoint"""
    commit_hash = get_git_commit()
    return {
        "status": "healthy",
        "service": "ai-service",
        "timestamp": datetime.now().isoformat(),
        "commit": commit_hash,
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    return {"message": "AI Service is running"}

@app.get("/api/models")
async def get_models():
    """Placeholder endpoint for ML models"""
    return {
        "models": [],
        "message": "No models deployed yet"
    }

