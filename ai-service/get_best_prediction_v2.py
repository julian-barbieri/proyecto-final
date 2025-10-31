"""Get feature importance from v2.0.0 and create optimal JSON for best prediction."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.model_registry import ensure_models_loaded
import numpy as np

def get_feature_importance_v2():
    """Get feature importance from v2.0.0 model."""
    print("=" * 70)
    print("FEATURE IMPORTANCE - Modelo v2.0.0")
    print("=" * 70)
    
    # Load model artifacts
    artifacts = ensure_models_loaded("grades", "v2.0.0")
    model = artifacts["model"]
    feature_order = artifacts["feature_order"]
    
    # Get feature names in the order they are used
    numeric_features = feature_order["numeric_features"]
    categorical_features = feature_order["categorical_features"]
    all_feature_names = numeric_features + categorical_features
    
    # Get feature importance (Random Forest has feature_importances_)
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
        
        # Create list of (feature_name, importance) tuples
        feature_importance = list(zip(all_feature_names, importances))
        
        # Sort by importance (descending)
        feature_importance.sort(key=lambda x: x[1], reverse=True)
        
        print(f"\nTotal de features: {len(all_feature_names)}")
        print(f"\nImportancia de Features (de mayor a menor):\n")
        
        print(f"{'Rank':<6} {'Feature':<30} {'Importance':<12} {'%':<10}")
        print("-" * 70)
        
        total_importance = sum(importances)
        
        for rank, (feature_name, importance) in enumerate(feature_importance, 1):
            percentage = (importance / total_importance) * 100 if total_importance > 0 else 0
            print(f"{rank:<6} {feature_name:<30} {importance:<12.6f} {percentage:<10.2f}%")
        
        # Top 10
        print("\n" + "=" * 70)
        print("TOP 10 FEATURES MÁS IMPORTANTES:")
        print("=" * 70)
        for rank, (feature_name, importance) in enumerate(feature_importance[:10], 1):
            percentage = (importance / total_importance) * 100
            print(f"{rank:2d}. {feature_name:<30} ({percentage:.2f}%)")
        
        return feature_importance[:10]
    else:
        print("\n[ERROR] El modelo no tiene feature_importances_")
        return []


def create_optimal_json(top_features):
    """Create optimal JSON based on feature importance."""
    print("\n" + "=" * 70)
    print("JSON OPTIMIZADO PARA MEJOR PREDICCIÓN")
    print("=" * 70)
    
    # Create optimal values based on top features
    optimal_item = {}
    
    # Based on feature importance, set optimal values
    # Numeric features: maximize positive impact
    # Categorical: use values that exist in encoders
    
    # Top features from v2.0.0 training:
    # 1. Recuperatorio1AM1 (21.77%)
    # 2. Parcial1AM1 (20.74%)
    # 3. PromedioNotasColegio (17.31%)
    # 4. AsistenciaAM1 (12.13%)
    # 5. AniosUniversidad (11.80%)
    
    # Set optimal numeric values (maximize)
    optimal_item["edad"] = 20  # Typical student age
    optimal_item["AsistenciaAM1"] = 1.0  # 100% attendance (high importance: 12.13%)
    optimal_item["VecesRecursadaAM1"] = 0  # Never repeated
    optimal_item["Parcial1AM1"] = 10  # Maximum score (high importance: 20.74%)
    optimal_item["Parcial2AM1"] = 10  # Maximum score
    optimal_item["Recuperatorio1AM1"] = 10  # Maximum score (HIGHEST importance: 21.77%)
    optimal_item["Recuperatorio2AM1"] = 10  # Maximum score
    optimal_item["PromedioNotasColegio"] = 10  # Maximum (high importance: 17.31%)
    optimal_item["AniosUniversidad"] = 1  # Lower years might be better? Actually higher might be better
    
    # Categorical features (use valid encoder values)
    optimal_item["Genero"] = "F"  # Use valid value from encoder
    optimal_item["ProfesorAM1"] = "Pedro"  # Use valid value from encoder
    optimal_item["ColegioTecnico"] = "Si"  # Use valid value
    optimal_item["AyudaFinanciera"] = "Si"  # Use valid value
    
    # FechaNacimiento (will be converted to FechaNacimiento_numeric)
    optimal_item["FechaNacimiento"] = "01/01/2004"  # Recent year
    
    print("\nValores optimizados basados en importancia de features:")
    print(f"  - Recuperatorio1AM1: {optimal_item['Recuperatorio1AM1']} (MÁS IMPORTANTE: 21.77%)")
    print(f"  - Parcial1AM1: {optimal_item['Parcial1AM1']} (2do más importante: 20.74%)")
    print(f"  - PromedioNotasColegio: {optimal_item['PromedioNotasColegio']} (3ro más importante: 17.31%)")
    print(f"  - AsistenciaAM1: {optimal_item['AsistenciaAM1']} (4to más importante: 12.13%)")
    print(f"  - AniosUniversidad: {optimal_item['AniosUniversidad']} (5to más importante: 11.80%)")
    print(f"  - Todas las notas al máximo: 10")
    print(f"  - Asistencia perfecta: 1.0 (100%)")
    
    # Generate JSON
    json_str = f"""{{
  "items": [
    {{
      "edad": {optimal_item['edad']},
      "Genero": "{optimal_item['Genero']}",
      "ColegioTecnico": "{optimal_item['ColegioTecnico']}",
      "AsistenciaAM1": {optimal_item['AsistenciaAM1']},
      "Parcial1AM1": {optimal_item['Parcial1AM1']},
      "Parcial2AM1": {optimal_item['Parcial2AM1']},
      "Recuperatorio1AM1": {optimal_item['Recuperatorio1AM1']},
      "Recuperatorio2AM1": {optimal_item['Recuperatorio2AM1']},
      "PromedioNotasColegio": {optimal_item['PromedioNotasColegio']},
      "AniosUniversidad": {optimal_item['AniosUniversidad']},
      "VecesRecursadaAM1": {optimal_item['VecesRecursadaAM1']},
      "ProfesorAM1": "{optimal_item['ProfesorAM1']}",
      "AyudaFinanciera": "{optimal_item['AyudaFinanciera']}",
      "FechaNacimiento": "{optimal_item['FechaNacimiento']}"
    }}
  ]
}}"""
    
    print("\n" + "=" * 70)
    print("JSON PARA ENVIAR AL ENDPOINT:")
    print("=" * 70)
    print(json_str)
    
    return optimal_item


def test_optimal_prediction(optimal_item):
    """Test the optimal prediction."""
    from app.model_registry import ensure_models_loaded
    from app.utils import build_features_for_prediction, clamp_grades
    
    print("\n" + "=" * 70)
    print("PROBANDO PREDICCIÓN OPTIMIZADA")
    print("=" * 70)
    
    artifacts = ensure_models_loaded("grades", "v2.0.0")
    model = artifacts["model"]
    scaler = artifacts["scaler"]
    encoders = artifacts["encoders"]
    feature_order = artifacts["feature_order"]
    
    X = build_features_for_prediction(
        items=[optimal_item],
        encoders=encoders,
        feature_order=feature_order,
        scaler=scaler
    )
    
    preds = model.predict(X)
    preds_clamped = clamp_grades(preds.tolist())
    
    print(f"\n[RESULTADO] Predicción optimizada: {preds_clamped[0]:.2f}")
    print(f"[OK] En rango [1, 10]: {1 <= preds_clamped[0] <= 10}")
    
    # Compare with lower values
    print("\n" + "=" * 70)
    print("COMPARACIÓN CON VALORES MENORES")
    print("=" * 70)
    
    lower_item = optimal_item.copy()
    lower_item["Recuperatorio1AM1"] = 5
    lower_item["Parcial1AM1"] = 5
    lower_item["PromedioNotasColegio"] = 5
    lower_item["AsistenciaAM1"] = 0.70
    
    X_lower = build_features_for_prediction(
        items=[lower_item],
        encoders=encoders,
        feature_order=feature_order,
        scaler=scaler
    )
    
    preds_lower = model.predict(X_lower)
    preds_lower_clamped = clamp_grades(preds_lower.tolist())
    
    print(f"[RESULTADO] Predicción con valores menores: {preds_lower_clamped[0]:.2f}")
    print(f"[DIFERENCIA] {preds_clamped[0] - preds_lower_clamped[0]:.2f} puntos más alta")


if __name__ == "__main__":
    top_features = get_feature_importance_v2()
    if top_features:
        optimal_item = create_optimal_json(top_features)
        test_optimal_prediction(optimal_item)

