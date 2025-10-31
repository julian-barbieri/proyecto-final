"""Get worst possible prediction with v2.0.0 model."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.model_registry import ensure_models_loaded
from app.utils import build_features_for_prediction, clamp_grades

def get_worst_prediction():
    """Calculate worst possible prediction."""
    print("=" * 70)
    print("PREDICCIÓN MÁS BAJA POSIBLE - Modelo v2.0.0")
    print("=" * 70)
    
    artifacts = ensure_models_loaded("grades", "v2.0.0")
    model = artifacts["model"]
    scaler = artifacts["scaler"]
    encoders = artifacts["encoders"]
    feature_order = artifacts["feature_order"]
    
    # Get feature importance to know which features hurt most
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
        numeric_features = feature_order["numeric_features"]
        categorical_features = feature_order["categorical_features"]
        all_feature_names = numeric_features + categorical_features
        
        feature_importance = list(zip(all_feature_names, importances))
        feature_importance.sort(key=lambda x: x[1], reverse=True)
        
        print("\nTop 5 features más importantes (minimizar estas):")
        for rank, (feat_name, importance) in enumerate(feature_importance[:5], 1):
            percentage = (importance / sum(importances)) * 100
            print(f"  {rank}. {feat_name}: {percentage:.2f}%")
    
    # Worst case: minimize all important features
    worst_item = {
        # Minimize top important numeric features
        "Recuperatorio1AM1": 1,  # MÁS IMPORTANTE (21.77%) - MINIMIZE
        "Parcial1AM1": 1,        # 2do más importante (20.74%) - MINIMIZE
        "PromedioNotasColegio": 1,  # 3ro más importante (17.31%) - MINIMIZE
        "AsistenciaAM1": 0.0,    # 4to más importante (12.13%) - MINIMIZE
        "AniosUniversidad": 5,   # 5to más importante (11.80%) - Higher might be worse? Test both
        
        # Minimize other numeric features
        "Parcial2AM1": 1,
        "Recuperatorio2AM1": 1,
        "VecesRecursadaAM1": 5,  # High number (repeated many times)
        "edad": 25,  # Older might be worse?
        
        # Categorical - use valid encoder values
        "Genero": "M",  # Valid value
        "ProfesorAM1": "Agustina",  # Valid value
        "ColegioTecnico": "No",
        "AyudaFinanciera": "No",
        
        # FechaNacimiento
        "FechaNacimiento": "01/01/1999"  # Older year
    }
    
    print("\n" + "=" * 70)
    print("VALORES MINIMIZADOS:")
    print("=" * 70)
    print(f"  - Recuperatorio1AM1: {worst_item['Recuperatorio1AM1']} (MÁS IMPORTANTE: minimizado)")
    print(f"  - Parcial1AM1: {worst_item['Parcial1AM1']} (2do más importante: minimizado)")
    print(f"  - PromedioNotasColegio: {worst_item['PromedioNotasColegio']} (3ro más importante: minimizado)")
    print(f"  - AsistenciaAM1: {worst_item['AsistenciaAM1']} (4to más importante: 0%)")
    print(f"  - Todas las notas al mínimo: 1")
    print(f"  - Sin asistencia: 0.0")
    print(f"  - Muchas recursadas: {worst_item['VecesRecursadaAM1']}")
    
    # Build features and predict
    X = build_features_for_prediction(
        items=[worst_item],
        encoders=encoders,
        feature_order=feature_order,
        scaler=scaler
    )
    
    preds = model.predict(X)
    preds_clamped = clamp_grades(preds.tolist())
    
    worst_prediction = preds_clamped[0]
    
    print("\n" + "=" * 70)
    print("PREDICCIÓN MÁS BAJA:")
    print("=" * 70)
    print(f"\n[RESULTADO] Predicción más baja: {worst_prediction:.2f}")
    print(f"[OK] En rango [1, 10]: {1 <= worst_prediction <= 10}")
    
    # Compare with optimal
    optimal_item = {
        "Recuperatorio1AM1": 10,
        "Parcial1AM1": 10,
        "PromedioNotasColegio": 10,
        "AsistenciaAM1": 1.0,
        "AniosUniversidad": 1,
        "Parcial2AM1": 10,
        "Recuperatorio2AM1": 10,
        "VecesRecursadaAM1": 0,
        "edad": 20,
        "Genero": "F",
        "ProfesorAM1": "Pedro",
        "ColegioTecnico": "Si",
        "AyudaFinanciera": "Si",
        "FechaNacimiento": "01/01/2004"
    }
    
    X_optimal = build_features_for_prediction(
        items=[optimal_item],
        encoders=encoders,
        feature_order=feature_order,
        scaler=scaler
    )
    
    preds_optimal = model.predict(X_optimal)
    preds_optimal_clamped = clamp_grades(preds_optimal.tolist())
    
    print(f"\n[COMPARACIÓN] Predicción óptima: {preds_optimal_clamped[0]:.2f}")
    print(f"[DIFERENCIA] Rango de predicciones: {worst_prediction:.2f} - {preds_optimal_clamped[0]:.2f}")
    print(f"[DIFERENCIA] Amplitud: {preds_optimal_clamped[0] - worst_prediction:.2f} puntos")
    
    # Generate JSON
    print("\n" + "=" * 70)
    print("JSON PARA PREDICCIÓN MÁS BAJA:")
    print("=" * 70)
    json_str = f"""{{
  "items": [
    {{
      "edad": {worst_item['edad']},
      "Genero": "{worst_item['Genero']}",
      "ColegioTecnico": "{worst_item['ColegioTecnico']}",
      "AsistenciaAM1": {worst_item['AsistenciaAM1']},
      "Parcial1AM1": {worst_item['Parcial1AM1']},
      "Parcial2AM1": {worst_item['Parcial2AM1']},
      "Recuperatorio1AM1": {worst_item['Recuperatorio1AM1']},
      "Recuperatorio2AM1": {worst_item['Recuperatorio2AM1']},
      "PromedioNotasColegio": {worst_item['PromedioNotasColegio']},
      "AniosUniversidad": {worst_item['AniosUniversidad']},
      "VecesRecursadaAM1": {worst_item['VecesRecursadaAM1']},
      "ProfesorAM1": "{worst_item['ProfesorAM1']}",
      "AyudaFinanciera": "{worst_item['AyudaFinanciera']}",
      "FechaNacimiento": "{worst_item['FechaNacimiento']}"
    }}
  ]
}}"""
    
    print(json_str)
    
    # Test with even worse values
    print("\n" + "=" * 70)
    print("PRUEBA CON VALORES AÚN MÁS EXTREMOS:")
    print("=" * 70)
    
    extreme_item = worst_item.copy()
    extreme_item["AsistenciaAM1"] = 0.0  # Already 0
    extreme_item["VecesRecursadaAM1"] = 10  # Even more repeated
    
    X_extreme = build_features_for_prediction(
        items=[extreme_item],
        encoders=encoders,
        feature_order=feature_order,
        scaler=scaler
    )
    
    preds_extreme = model.predict(X_extreme)
    preds_extreme_clamped = clamp_grades(preds_extreme.tolist())
    
    print(f"[RESULTADO] Predicción extrema: {preds_extreme_clamped[0]:.2f}")
    print(f"[COMPARACIÓN] vs básica: {worst_prediction:.2f} vs {preds_extreme_clamped[0]:.2f}")
    
    if preds_extreme_clamped[0] < worst_prediction:
        print(f"[ACTUALIZADO] La predicción extrema es más baja: {preds_extreme_clamped[0]:.2f}")
        worst_prediction = preds_extreme_clamped[0]
    
    print(f"\n[FINAL] Peor predicción posible: {worst_prediction:.2f}")


if __name__ == "__main__":
    get_worst_prediction()

