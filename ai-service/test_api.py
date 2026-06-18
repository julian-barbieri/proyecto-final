"""Script para validar los endpoints de la API con los datasets de test."""
import json
import math
import urllib.request
import urllib.error
import pandas as pd

BASE_URL = "http://localhost:8000"

OHE_GROUPS = {
    "TipoExamen": ["Final", "Parcial", "Recuperatorio"],
    "Tipo":       ["A", "C"],
}
INTERNAL_EXAMEN = {"ProbRecursa"}


def post_json(path, payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def row_to_dict_alumno(row):
    return {col: float(row[col]) for col in row.index}


def row_to_dict_materia(row):
    return {col: float(row[col]) for col in row.index}


def row_to_dict_examen(row):
    d = {}
    ohe_cols = {f"{prefix}_{cat}" for prefix, cats in OHE_GROUPS.items() for cat in cats}
    for col in row.index:
        if col in INTERNAL_EXAMEN or col in ohe_cols:
            continue
        d[col] = float(row[col])

    for prefix, categories in OHE_GROUPS.items():
        for cat in categories:
            col_name = f"{prefix}_{cat}"
            if col_name in row.index and row[col_name] == 1:
                d[prefix] = cat
                break
        else:
            d[prefix] = categories[0]

    return d


def test_endpoint(name, path, X, y, row_fn, n=5):
    print(f"\n{'='*60}")
    print(f"  Endpoint: {path}  ({n} muestras)")
    print(f"{'='*60}")

    sample_X = X.head(n)
    sample_y = y.head(n)

    payload = [row_fn(row) for _, row in sample_X.iterrows()]
    results = post_json(path, payload)

    errors = []
    for i, (res, (_, true_row)) in enumerate(zip(results, sample_y.iterrows())):
        true_val = true_row.iloc[0]
        if name == "alumno":
            pred_val = res["Abandona"]
            pred_label = "true" if pred_val else "false"
            true_label = "true" if true_val == 1 else "false"
            match = pred_label == true_label
            prob = res.get("probabilidad", "N/A")
            print(f"  [{i+1}] pred={pred_label} (prob={prob}) | real={true_label}  {'OK' if match else 'DIFF'}")
        elif name == "materia":
            pred_val = res["Recursa"]
            pred_label = "true" if pred_val else "false"
            true_label = "true" if true_val == 1 else "false"
            match = pred_label == true_label
            prob = res.get("probabilidad", "N/A")
            print(f"  [{i+1}] pred={pred_label} (prob={prob}) | real={true_label}  {'OK' if match else 'DIFF'}")
        elif name == "examen":
            pred_nota = res["Nota"]
            error = abs(pred_nota - true_val)
            errors.append(error)
            print(f"  [{i+1}] pred={pred_nota:.2f} | real={true_val:.2f}  (error={error:.2f})")

    if errors:
        mae = sum(errors) / len(errors)
        print(f"\n  MAE (muestra): {mae:.4f}")

    print(f"\n  Status: OK - endpoint responde correctamente")


def main():
    print("\nHealth check...")
    req = urllib.request.Request(f"{BASE_URL}/health")
    with urllib.request.urlopen(req) as resp:
        health = json.loads(resp.read())
    print(f"  Status: {health['status']}")
    for m, info in health["modelos_cargados"].items():
        print(f"  modelo_{m}: {info['n_features']} features")

    base = "src/models/dataset-test"
    X_alumno  = pd.read_csv(f"{base}/X_test_alumno.csv")
    y_alumno  = pd.read_csv(f"{base}/y_test_alumno.csv")
    X_materia = pd.read_csv(f"{base}/X_test_materia.csv")
    y_materia = pd.read_csv(f"{base}/y_test_materia.csv")
    X_examen  = pd.read_csv(f"{base}/X_test_examen.csv")
    y_examen  = pd.read_csv(f"{base}/y_test_examen.csv")

    test_endpoint("alumno",  "/predict/alumno",  X_alumno,  y_alumno,  row_to_dict_alumno)
    test_endpoint("materia", "/predict/materia", X_materia, y_materia, row_to_dict_materia)
    test_endpoint("examen",  "/predict/examen",  X_examen,  y_examen,  row_to_dict_examen)

    print("\n\nTodos los endpoints respondieron correctamente.")


if __name__ == "__main__":
    main()
