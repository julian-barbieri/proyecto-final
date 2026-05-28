"""Verify model predictions for bajo_rendimiento vs excelencia profiles."""
import joblib
import pandas as pd
import numpy as np

MODELS_DIR = "src/models/models-trained"
modelo_materia = joblib.load(f"{MODELS_DIR}/modelo_materia.pkl")
modelo_alumno  = joblib.load(f"{MODELS_DIR}/modelo_alumno.pkl")

print("=== FEATURE NAMES ===")
print("materia:", list(modelo_materia.feature_names_in_))
print("alumno:", list(modelo_alumno.feature_names_in_))

# ─── PEDRO QUINTERO — bajo_rendimiento profile ───────────────────────────────
# Historial: AM1 2024 notas=[2.1,1.8], AM1 2025 notas=[2.5,1.9], AM1 2026 nota=[2.3]
#            Materia 144 2024 notas=[1.5,2.2]
# Total 7 exams, all < 4, PromedioNota ~2.04, TasaAprobacion=0

pedro_notas = [2.1, 1.8, 2.5, 1.9, 2.3, 1.5, 2.2]
pedro_promedio_nota = sum(pedro_notas) / len(pedro_notas)

pedro_materia = {
    'Edad': 2026 - 2005,              # 21
    'PromedioColegio': 4.5,
    'Asistencia': 0.55,               # AM1 2026 cursada
    'AniosDesdeIngreso': 2026 - 2024, # 2
    'Materia': 142,                   # AM1 codigo_plan
    'PromedioNotaGeneral': pedro_promedio_nota,
    'TasaAprobacionGeneral': 0.0,     # 0 of 7 exams >= 4
    'IndiceBloqueo': 0.0,             # AM1 has no prereqs
    'Genero': 1,                      # Masculino
    'AyudaFinanciera': 0,
    'ColegioTecnico': 0,
}

pedro_alumno = {
    'CantMaterias': 4,                # 4 cursadas
    'PromedioAsistencia': (0.58+0.62+0.55+0.61)/4,
    'CantAniosCursados': 3,           # 2024, 2025, 2026
    'CantExamenesRendidos': 7,
    'PromedioNota': pedro_promedio_nota,
    'CantFinalesRendidos': 0,
    'CantAusencias': 0,
    'TasaAusencia': 0.0,
    'CantAprobados': 0,
    'TasaAprobacion': 0.0,
    'Edad': 2024 - 2005,              # 19 (at ingreso)
    'Genero': 1,
    'AyudaFinanciera': 0,
    'ColegioTecnico': 0,
    'PromedioColegio': 4.5,
}

# ─── LUCAS MARTINEZ — excelencia profile ────────────────────────────────────
# Historial: AM1 2026, asist=0.88, Parcial nota=7.8 (that's his only exam)
# PromedioNota = 7.8, TasaAprobacion = 1.0

lucas_materia = {
    'Edad': 2026 - 2007,              # 19
    'PromedioColegio': 7.2,
    'Asistencia': 0.88,
    'AniosDesdeIngreso': 2026 - 2026, # 0
    'Materia': 142,                   # AM1
    'PromedioNotaGeneral': 7.8,
    'TasaAprobacionGeneral': 1.0,
    'IndiceBloqueo': 0.0,
    'Genero': 1,
    'AyudaFinanciera': 0,
    'ColegioTecnico': 0,
}

lucas_alumno = {
    'CantMaterias': 1,
    'PromedioAsistencia': 0.88,
    'CantAniosCursados': 1,
    'CantExamenesRendidos': 1,
    'PromedioNota': 7.8,
    'CantFinalesRendidos': 0,
    'CantAusencias': 0,
    'TasaAusencia': 0.0,
    'CantAprobados': 1,
    'TasaAprobacion': 1.0,
    'Edad': 2026 - 2007,
    'Genero': 1,
    'AyudaFinanciera': 0,
    'ColegioTecnico': 0,
    'PromedioColegio': 7.2,
}

def predict_proba(model, feature_dict):
    """Build a row aligned to model.feature_names_in_ and predict."""
    cols = list(model.feature_names_in_)
    row = pd.DataFrame([[feature_dict.get(c, 0.0) for c in cols]], columns=cols)
    return model.predict_proba(row)[0][1]  # probability of class 1

print("\n=== PREDICCIONES RECURSADO (modelo_materia) ===")
prob_pedro_recursa = predict_proba(modelo_materia, pedro_materia)
prob_lucas_recursa = predict_proba(modelo_materia, lucas_materia)
print(f"Pedro Quintero (bajo_rendimiento): P(Recursa) = {prob_pedro_recursa:.4f}")
print(f"Lucas Martinez (excelencia):       P(Recursa) = {prob_lucas_recursa:.4f}")
print(f"Diferencia:                        {prob_pedro_recursa - prob_lucas_recursa:.4f}")

print("\n=== PREDICCIONES ABANDONO (modelo_alumno) ===")
prob_pedro_abandona = predict_proba(modelo_alumno, pedro_alumno)
prob_lucas_abandona = predict_proba(modelo_alumno, lucas_alumno)
print(f"Pedro Quintero (bajo_rendimiento): P(Abandona) = {prob_pedro_abandona:.4f}")
print(f"Lucas Martinez (excelencia):       P(Abandona) = {prob_lucas_abandona:.4f}")
print(f"Diferencia:                        {prob_pedro_abandona - prob_lucas_abandona:.4f}")

print("\n=== RESULTADO ===")
ok_recursa = prob_pedro_recursa > 0.60 and prob_lucas_recursa < 0.20
ok_abandona = prob_pedro_abandona > 0.60 and prob_lucas_abandona < 0.20
print(f"Recursado test: {'PASS' if ok_recursa else 'FAIL'} (pedro > 0.60: {prob_pedro_recursa:.3f}, lucas < 0.20: {prob_lucas_recursa:.3f})")
print(f"Abandono test:  {'PASS' if ok_abandona else 'FAIL'} (pedro > 0.60: {prob_pedro_abandona:.3f}, lucas < 0.20: {prob_lucas_abandona:.3f})")
