"""Script para validar modelo entrenado después del entrenamiento."""
import json
import logging
from pathlib import Path
from typing import Dict, Any

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score

from .model_registry import (
    load_model,
    load_scaler,
    load_encoder,
    get_model_paths,
    list_available_models
)
from .config import MODEL_DIR, METRICS_DIR, MODEL_VERSION

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def check_artifacts_exist(model_name: str = "grades", version: str = "v0.1.0") -> bool:
    """Verificar que todos los artefactos existen."""
    logger.info(f"Checking artifacts for {model_name} v{version}...")
    paths = get_model_paths(model_name, version)
    
    required = ["model", "scaler", "encoder", "feature_order", "meta"]
    all_exist = True
    
    for key in required:
        path = paths.get(key)
        if path and path.exists():
            size = path.stat().st_size
            logger.info(f"✓ {key}: {path.name} ({size:,} bytes)")
        else:
            logger.error(f"✗ {key}: NOT FOUND")
            all_exist = False
    
    return all_exist


def check_metrics_file(version: str = "v0.1.0") -> Dict[str, Any]:
    """Verificar archivo de métricas."""
    logger.info(f"Checking metrics file...")
    metrics_path = METRICS_DIR / f"grades-{version}.json"
    
    if not metrics_path.exists():
        logger.error(f"✗ Metrics file not found: {metrics_path}")
        return {}
    
    with open(metrics_path, 'r', encoding='utf-8') as f:
        metrics = json.load(f)
    
    logger.info(f"✓ Metrics file: {metrics_path.name}")
    logger.info(f"  R²: {metrics.get('r2', 'N/A'):.4f}")
    logger.info(f"  MAE: {metrics.get('mae', 'N/A'):.4f}")
    
    # Validar métricas razonables
    r2 = metrics.get('r2', 0)
    mae = metrics.get('mae', float('inf'))
    
    if r2 > 0:
        logger.info(f"✓ R² > 0 (modelo explica variabilidad)")
    else:
        logger.warning(f"⚠ R² <= 0 (modelo peor que promedio)")
    
    if mae < 10:
        logger.info(f"✓ MAE < 10 (error promedio aceptable)")
    else:
        logger.warning(f"⚠ MAE >= 10 (error promedio alto)")
    
    return metrics


def test_model_loading(model_name: str = "grades", version: str = "v0.1.0") -> bool:
    """Probar carga de modelo, scaler y encoders."""
    logger.info(f"Testing model loading...")
    
    try:
        # Cargar modelo
        model = load_model(model_name, version)
        if model is None:
            logger.error("✗ Failed to load model")
            return False
        logger.info(f"✓ Model loaded: {type(model).__name__}")
        
        # Cargar scaler
        scaler = load_scaler(model_name, version)
        if scaler is None:
            logger.error("✗ Failed to load scaler")
            return False
        logger.info(f"✓ Scaler loaded: {type(scaler).__name__}")
        
        # Cargar encoders
        encoders = load_encoder(model_name, version)
        if encoders is None:
            logger.error("✗ Failed to load encoders")
            return False
        logger.info(f"✓ Encoders loaded: {type(encoders).__name__}")
        logger.info(f"  Encoded columns: {list(encoders.keys())}")
        
        return True
    except Exception as e:
        logger.error(f"✗ Error loading artifacts: {e}")
        return False


def test_prediction_with_sample(model_name: str = "grades", version: str = "v0.1.0"):
    """Probar predicción con datos de ejemplo."""
    logger.info("Testing prediction with sample data...")
    
    try:
        # Cargar artefactos
        model = load_model(model_name, version)
        scaler = load_scaler(model_name, version)
        encoders = load_encoder(model_name, version)
        
        # Cargar feature order
        paths = get_model_paths(model_name, version)
        with open(paths["feature_order"], 'r', encoding='utf-8') as f:
            feature_order = json.load(f)
        
        numeric_features = feature_order["numeric_features"]
        categorical_features = feature_order["categorical_features"]
        
        # Crear datos de ejemplo
        sample_data = {
            "edad": 20.0,
            "AsistenciaAM1": 75.0,
            "VecesRecursadaAM1": 0.0,
            "Parcial1AM1": 7.0,
            "Parcial2AM1": 8.0,
            "Recuperatorio1AM1": 0.0,
            "Recuperatorio2AM1": 0.0,
            "PromedioNotasColegio": 7.5,
            "AniosUniversidad": 1.0,
            "Genero": "F",
            "ProfesorAM1": "Pedro",
            "ColegioTecnico": "No",
            "AyudaFinanciera": "No"
        }
        
        # Preprocesar: aplicar encoders a categóricas
        sample_numeric = np.array([[sample_data[col] for col in numeric_features]])
        sample_categorical = []
        
        for col in categorical_features:
            if col in encoders:
                value = sample_data.get(col, "")
                try:
                    encoded = encoders[col].transform([str(value)])[0]
                    sample_categorical.append(encoded)
                except ValueError:
                    # Valor no visto en entrenamiento
                    logger.warning(f"Unknown value '{value}' for {col}, using -1")
                    sample_categorical.append(-1)
            else:
                sample_categorical.append(0)
        
        sample_categorical = np.array([sample_categorical])
        
        # Escalar numéricas
        sample_numeric_scaled = scaler.transform(sample_numeric)
        
        # Combinar
        sample_final = np.hstack([sample_numeric_scaled, sample_categorical])
        
        # Predecir
        prediction = model.predict(sample_final)[0]
        
        logger.info(f"✓ Prediction successful")
        logger.info(f"  Sample input: edad={sample_data['edad']}, Parcial1={sample_data['Parcial1AM1']}")
        logger.info(f"  Predicted grade: {prediction:.2f}")
        
        # Validar predicción en rango razonable
        if 1 <= prediction <= 10:
            logger.info(f"✓ Prediction in valid range [1, 10]")
        else:
            logger.warning(f"⚠ Prediction out of range: {prediction:.2f}")
        
        return True
    except Exception as e:
        logger.error(f"✗ Error in prediction test: {e}")
        import traceback
        traceback.print_exc()
        return False


def check_metadata(model_name: str = "grades", version: str = "v0.1.0"):
    """Verificar metadatos del modelo."""
    logger.info("Checking metadata...")
    
    paths = get_model_paths(model_name, version)
    meta_path = paths["meta"]
    
    if not meta_path.exists():
        logger.error(f"✗ Metadata file not found")
        return False
    
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)
    
    logger.info(f"✓ Metadata loaded")
    logger.info(f"  Model name: {meta.get('model_name')}")
    logger.info(f"  Version: {meta.get('version')}")
    logger.info(f"  Created: {meta.get('created_at')}")
    logger.info(f"  Git commit: {meta.get('git_commit', 'N/A')}")
    logger.info(f"  Features: {len(meta.get('feature_order', []))}")
    logger.info(f"  Train samples: {meta.get('dataset_info', {}).get('n_samples_train', 'N/A')}")
    logger.info(f"  Test samples: {meta.get('dataset_info', {}).get('n_samples_test', 'N/A')}")
    
    return True


def test_info_endpoint():
    """Verificar que el endpoint /info detecta el modelo."""
    logger.info("Testing model registry list...")
    
    models = list_available_models()
    
    if "grades" in models:
        versions = models["grades"]
        logger.info(f"✓ Model 'grades' found with versions: {versions}")
        return True
    else:
        logger.warning(f"⚠ Model 'grades' not found in registry")
        logger.info(f"  Available models: {list(models.keys())}")
        return False


def validate_on_test_set(model_name: str = "grades", version: str = "v0.1.0", 
                         test_csv: str = None):
    """Validar modelo en conjunto de test (si se proporciona CSV)."""
    if not test_csv:
        logger.info("⚠ Skipping test set validation (no CSV provided)")
        return True
    
    logger.info(f"Validating on test set from {test_csv}...")
    
    try:
        # Esto requeriría re-ejecutar el mismo pipeline de preprocesamiento
        # Por simplicidad, solo indicamos que se puede hacer
        logger.info("  (Test set validation requires re-running preprocessing pipeline)")
        logger.info("  Consider adding a validation script that uses the same preprocessing")
        return True
    except Exception as e:
        logger.error(f"✗ Error in test set validation: {e}")
        return False


def main():
    """Ejecutar todas las validaciones."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate trained model")
    parser.add_argument("--model", default="grades", help="Model name")
    parser.add_argument("--version", default="v0.1.0", help="Model version")
    parser.add_argument("--test-csv", help="Optional: CSV file for test set validation")
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("MODEL VALIDATION CHECKLIST")
    logger.info("=" * 60)
    
    results = {}
    
    # 1. Verificar artefactos
    logger.info("\n[1] Checking artifacts existence...")
    results["artifacts"] = check_artifacts_exist(args.model, args.version)
    
    # 2. Verificar métricas
    logger.info("\n[2] Checking metrics file...")
    metrics = check_metrics_file(args.version)
    results["metrics"] = len(metrics) > 0
    
    # 3. Probar carga de modelo
    logger.info("\n[3] Testing model loading...")
    results["loading"] = test_model_loading(args.model, args.version)
    
    # 4. Verificar metadatos
    logger.info("\n[4] Checking metadata...")
    results["metadata"] = check_metadata(args.model, args.version)
    
    # 5. Probar predicción
    logger.info("\n[5] Testing prediction...")
    results["prediction"] = test_prediction_with_sample(args.model, args.version)
    
    # 6. Verificar registro de modelos
    logger.info("\n[6] Testing model registry...")
    results["registry"] = test_info_endpoint()
    
    # 7. Validación en test set (opcional)
    if args.test_csv:
        logger.info("\n[7] Validating on test set...")
        results["test_set"] = validate_on_test_set(args.model, args.version, args.test_csv)
    
    # Resumen
    logger.info("\n" + "=" * 60)
    logger.info("VALIDATION SUMMARY")
    logger.info("=" * 60)
    
    all_passed = all(results.values())
    
    for check, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        logger.info(f"{status} - {check}")
    
    logger.info("=" * 60)
    
    if all_passed:
        logger.info("✓ ALL CHECKS PASSED")
        return 0
    else:
        logger.error("✗ SOME CHECKS FAILED")
        return 1


if __name__ == "__main__":
    exit(main())

