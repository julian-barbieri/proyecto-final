FROM python:3.10-slim

WORKDIR /app

COPY requirements-api.txt .
RUN pip install --no-cache-dir -r requirements-api.txt

COPY src/model_deploy.py src/model_deploy.py
COPY src/models/models-trained/ src/models/models-trained/

EXPOSE 8000

CMD ["uvicorn", "src.model_deploy:app", "--host", "0.0.0.0", "--port", "8000"]
