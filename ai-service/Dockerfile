# =============================================================================
# Dockerfile — ai-service
# FastAPI + modelos ML (GradientBoosting, XGBoost, RandomForest)
#
# Construcción:
#   docker build -t edu-predict-ai .
#
# Ejecución standalone (sin docker-compose):
#   docker run -p 8000:8000 edu-predict-ai
# =============================================================================

FROM python:3.10-slim

# -----------------------------------------------------------------------------
# Sistema: curl es necesario para el healthcheck de docker-compose
# -----------------------------------------------------------------------------
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# -----------------------------------------------------------------------------
# Dependencias Python
# Se copia solo requirements.txt primero para aprovechar la caché de capas:
# si el código fuente cambia pero requirements.txt no, Docker reutiliza esta
# capa sin reinstalar los paquetes.
# -----------------------------------------------------------------------------
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# -----------------------------------------------------------------------------
# Código fuente y modelos entrenados
# Se copian solo los directorios que la API necesita en tiempo de ejecución.
# Los datos de entrenamiento (data/) y los outputs de SHAP (outputs/) no son
# necesarios para servir predicciones y se excluyen para mantener la imagen
# liviana. Ver .dockerignore para más detalle.
# -----------------------------------------------------------------------------
COPY src/ ./src/

# -----------------------------------------------------------------------------
# Puerto expuesto
# Debe coincidir con el puerto mapeado en docker-compose.yml (8000:8000)
# -----------------------------------------------------------------------------
EXPOSE 8000

# -----------------------------------------------------------------------------
# Comando de inicio
# --host 0.0.0.0  → acepta conexiones desde fuera del contenedor
# --workers 1     → un worker es suficiente para los modelos en memoria;
#                   aumentar solo si se escala horizontalmente
# -----------------------------------------------------------------------------
CMD ["uvicorn", "src.model_deploy:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1"]
