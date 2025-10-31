"""Training script for grades prediction model (Linear Regression)."""
import argparse
import json
import logging
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

import numpy as np
import pandas as pd
from joblib import dump
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)


def get_git_commit() -> str:
    """Get current git commit hash (first 7 chars)."""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent.parent
        )
        if result.returncode == 0:
            return result.stdout.strip()[:7]
    except Exception:
        pass
    return "unknown"


def parse_fecha_nacimiento_to_edad(df: pd.DataFrame) -> pd.Series:
    """
    Parse FechaNacimiento to edad (age in years).
    Uses same formula as Kaggle: year difference from current year.
    """
    if "FechaNacimiento" not in df.columns:
        logger.warning("FechaNacimiento column not found, edad will be NaN")
        return pd.Series(index=df.index, dtype=float)
    
    try:
        birth = pd.to_datetime(df["FechaNacimiento"], dayfirst=True, errors="coerce")
        ref_year = datetime.now().year
        edad = (ref_year - birth.dt.year).astype(float)
        logger.info(f"Calculated edad from FechaNacimiento (range: {edad.min():.1f} - {edad.max():.1f})")
        return edad
    except Exception as e:
        logger.error(f"Error parsing FechaNacimiento: {e}")
        return pd.Series(index=df.index, dtype=float)


def identify_columns_to_drop() -> List[str]:
    """
    Return list of columns to drop (identifiers, redundant, or target-related).
    Based on typical Kaggle preprocessing.
    """
    # Columns to drop: identifiers, redundant info, or direct target indicators
    columns_to_drop = [
        # Identifiers and metadata that shouldn't be features
        # Note: These are examples - adjust based on actual dataset structure
        "id", "ID", "email", "nombre", "Email", "Nombre",
        # AM2 columns (we're training on AM1)
        "AnioAM2", "TutorAM2", "ProfesorAM2", "VecesRecursadaAM2",
        "AsistenciaAM2", "PeriodoAM2", "ModalidadAM2", "TipoMateriaAM2",
        "Parcial1AM2", "Parcial2AM2", "Recuperatorio1AM2", "Recuperatorio2AM2",
        "Final1AM2", "Final2AM2", "Final3AM2", "ApruebaAM2",
        # Redundant columns (if we keep AM1 versions)
        "Carrera",  # All same in this dataset
        # Direct target indicators (will be derived properly)
        "ApruebaAM1",  # Binary outcome, not needed for regression
        "Abandona",  # Different target
    ]
    return columns_to_drop


def prepare_target(df: pd.DataFrame) -> pd.Series:
    """
    Prepare target variable for regression.
    IMPORTANT: Only use Final grades as target, NOT parciales.
    This avoids data leakage since parciales are used as features.
    
    Priority: NotaFinalAM1 > average of Final1AM1/Final2AM1/Final3AM1
    
    Returns NaN for rows without final grades (these will be filtered out).
    """
    # Try explicit final grade column first
    if "NotaFinalAM1" in df.columns:
        target = pd.to_numeric(df["NotaFinalAM1"], errors="coerce")
        valid_count = target.notna().sum()
        if valid_count > 0:
            logger.info(f"Using NotaFinalAM1 as target ({valid_count} valid values)")
            return target
    
    # Try average of Final exams
    final_cols = ["Final1AM1", "Final2AM1", "Final3AM1"]
    available_finals = [col for col in final_cols if col in df.columns]
    if available_finals:
        finals_df = df[available_finals].apply(pd.to_numeric, errors="coerce")
        # Only calculate mean if at least one final exists
        has_any_final = finals_df.notna().any(axis=1)
        target = pd.Series(index=df.index, dtype=float)
        target[has_any_final] = finals_df[has_any_final].mean(axis=1, skipna=True)
        
        valid_count = target.notna().sum()
        if valid_count > 0:
            logger.info(f"Using average of {available_finals} as target ({valid_count} valid values)")
            logger.warning(f"Removing {len(df) - valid_count} rows without final grades")
            return target
    
    # NO FALLBACK to parciales - that would cause data leakage
    logger.error("No final grades found! Cannot use parciales as target (they are features).")
    logger.error("Only rows with Final1AM1, Final2AM1, Final3AM1, or NotaFinalAM1 can be used.")
    return pd.Series(index=df.index, dtype=float)  # All NaN


def preprocess_features(df: pd.DataFrame, encoders: Dict[str, LabelEncoder]) -> pd.DataFrame:
    """
    Preprocess features:
    - Parse FechaNacimiento → edad
    - Drop specified columns
    - Label encode categorical columns
    - Handle missing values
    - Create derived features (feature engineering)
    """
    df = df.copy()
    
    # Parse edad from FechaNacimiento
    if "edad" not in df.columns and "FechaNacimiento" in df.columns:
        df["edad"] = parse_fecha_nacimiento_to_edad(df)
    
    # Identify and drop columns
    columns_to_drop = identify_columns_to_drop()
    existing_drop_cols = [col for col in columns_to_drop if col in df.columns]
    if existing_drop_cols:
        logger.info(f"Dropping columns: {existing_drop_cols}")
        df = df.drop(columns=existing_drop_cols)
    
    # Convert numeric columns
    numeric_cols = [
        "edad", "Parcial1AM1", "Parcial2AM1", "Recuperatorio1AM1", "Recuperatorio2AM1",
        "AsistenciaAM1", "VecesRecursadaAM1", "PromedioNotasColegio", "AniosUniversidad"
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    
    # FEATURE ENGINEERING: Create derived features
    logger.info("Creating derived features...")
    
    # 1. Promedio de parciales (antes de finales)
    if "Parcial1AM1" in df.columns and "Parcial2AM1" in df.columns:
        p1 = pd.to_numeric(df["Parcial1AM1"], errors="coerce")
        p2 = pd.to_numeric(df["Parcial2AM1"], errors="coerce")
        # Promedio solo si al menos uno existe
        df["promedio_parciales"] = pd.concat([p1, p2], axis=1).mean(axis=1, skipna=True)
        logger.info("  Created: promedio_parciales")
    
    # 2. Máximo entre parciales
    if "Parcial1AM1" in df.columns and "Parcial2AM1" in df.columns:
        p1 = pd.to_numeric(df["Parcial1AM1"], errors="coerce")
        p2 = pd.to_numeric(df["Parcial2AM1"], errors="coerce")
        df["max_parcial"] = pd.concat([p1, p2], axis=1).max(axis=1, skipna=True)
        logger.info("  Created: max_parcial")
    
    # 3. Mínimo entre parciales
    if "Parcial1AM1" in df.columns and "Parcial2AM1" in df.columns:
        p1 = pd.to_numeric(df["Parcial1AM1"], errors="coerce")
        p2 = pd.to_numeric(df["Parcial2AM1"], errors="coerce")
        df["min_parcial"] = pd.concat([p1, p2], axis=1).min(axis=1, skipna=True)
        logger.info("  Created: min_parcial")
    
    # 4. Tendencia (mejora/deterioro entre parciales)
    if "Parcial1AM1" in df.columns and "Parcial2AM1" in df.columns:
        p1 = pd.to_numeric(df["Parcial1AM1"], errors="coerce")
        p2 = pd.to_numeric(df["Parcial2AM1"], errors="coerce")
        # Tendencia positiva = mejora, negativa = deterioro
        df["tendencia_parciales"] = (p2 - p1).fillna(0)
        logger.info("  Created: tendencia_parciales")
    
    # 5. Indicador de si tiene recuperatorios
    if "Recuperatorio1AM1" in df.columns or "Recuperatorio2AM1" in df.columns:
        recup_cols = []
        if "Recuperatorio1AM1" in df.columns:
            recup_cols.append(pd.to_numeric(df["Recuperatorio1AM1"], errors="coerce"))
        if "Recuperatorio2AM1" in df.columns:
            recup_cols.append(pd.to_numeric(df["Recuperatorio2AM1"], errors="coerce"))
        
        if recup_cols:
            recup_df = pd.concat(recup_cols, axis=1)
            # 1 si tiene al menos un recuperatorio > 0, 0 en caso contrario
            df["tiene_recuperatorio"] = (recup_df > 0).any(axis=1).astype(int)
            logger.info("  Created: tiene_recuperatorio")
    
    # 6. Promedio histórico (ponderado: parciales + recuperatorios)
    if all(col in df.columns for col in ["Parcial1AM1", "Parcial2AM1"]):
        p1 = pd.to_numeric(df["Parcial1AM1"], errors="coerce")
        p2 = pd.to_numeric(df["Parcial2AM1"], errors="coerce")
        recup1 = pd.to_numeric(df.get("Recuperatorio1AM1", pd.Series()), errors="coerce") if "Recuperatorio1AM1" in df.columns else pd.Series(index=df.index)
        recup2 = pd.to_numeric(df.get("Recuperatorio2AM1", pd.Series()), errors="coerce") if "Recuperatorio2AM1" in df.columns else pd.Series(index=df.index)
        
        # Promedio de todas las notas disponibles (parciales y recuperatorios)
        all_scores = pd.concat([p1, p2, recup1, recup2], axis=1)
        df["promedio_historico"] = all_scores.mean(axis=1, skipna=True)
        logger.info("  Created: promedio_historico")
    
    # 7. Rango de parciales (diferencia entre max y min)
    if "max_parcial" in df.columns and "min_parcial" in df.columns:
        df["rango_parciales"] = df["max_parcial"] - df["min_parcial"]
        df["rango_parciales"] = df["rango_parciales"].fillna(0)
        logger.info("  Created: rango_parciales")
    
    # 8. Desviación estándar de parciales (variabilidad)
    if "Parcial1AM1" in df.columns and "Parcial2AM1" in df.columns:
        p1 = pd.to_numeric(df["Parcial1AM1"], errors="coerce")
        p2 = pd.to_numeric(df["Parcial2AM1"], errors="coerce")
        df["std_parciales"] = pd.concat([p1, p2], axis=1).std(axis=1, skipna=True).fillna(0)
        logger.info("  Created: std_parciales")
    
    # Handle categorical columns with LabelEncoder
    categorical_cols = ["Genero", "ProfesorAM1", "ColegioTecnico", "AyudaFinanciera"]
    for col in categorical_cols:
        if col in df.columns:
            # Initialize encoder if not exists
            if col not in encoders:
                encoders[col] = LabelEncoder()
                # Fit on non-null values
                non_null_values = df[col].dropna().astype(str)
                if len(non_null_values) > 0:
                    encoders[col].fit(non_null_values)
                    logger.info(f"Fitted LabelEncoder for {col}: {list(encoders[col].classes_)}")
            
            # Transform
            non_null_mask = df[col].notna()
            if non_null_mask.sum() > 0:
                df.loc[non_null_mask, col] = encoders[col].transform(
                    df.loc[non_null_mask, col].astype(str)
                )
            # Fill NaN with -1 or most frequent
            df[col] = df[col].fillna(-1).astype(int)
    
    return df


def select_feature_columns(df: pd.DataFrame) -> List[str]:
    """Select feature columns for training."""
    # Original numeric features
    base_numeric_features = [
        "edad", "AsistenciaAM1", "VecesRecursadaAM1",
        "Parcial1AM1", "Parcial2AM1", "Recuperatorio1AM1", "Recuperatorio2AM1",
        "PromedioNotasColegio", "AniosUniversidad"
    ]
    
    # Derived features (feature engineering)
    derived_numeric_features = [
        "promedio_parciales",
        "max_parcial",
        "min_parcial",
        "tendencia_parciales",
        "tiene_recuperatorio",
        "promedio_historico",
        "rango_parciales",
        "std_parciales"
    ]
    
    # All numeric features (base + derived)
    numeric_features = base_numeric_features + derived_numeric_features
    
    # Categorical features (already encoded)
    categorical_features = ["Genero", "ProfesorAM1", "ColegioTecnico", "AyudaFinanciera"]
    
    # Select only existing columns
    all_features = numeric_features + categorical_features
    available_features = [col for col in all_features if col in df.columns]
    
    logger.info(f"Selected {len(available_features)} features:")
    logger.info(f"  Base numeric: {[f for f in base_numeric_features if f in available_features]}")
    logger.info(f"  Derived numeric: {[f for f in derived_numeric_features if f in available_features]}")
    logger.info(f"  Categorical: {[f for f in categorical_features if f in available_features]}")
    
    return available_features


def main():
    parser = argparse.ArgumentParser(description="Train grades prediction model")
    parser.add_argument("--csv", required=True, help="Path to CSV dataset")
    parser.add_argument("--sep", default=";", help="CSV separator (default: ;)")
    parser.add_argument("--out", default="models", help="Output directory for models (default: models)")
    parser.add_argument("--version", default="v1.0.0", help="Model version (default: v1.0.0)")
    parser.add_argument("--model", choices=["linear", "random_forest", "gradient_boosting"], 
                       default="random_forest", help="Model type (default: random_forest)")
    parser.add_argument("--n_estimators", type=int, default=100, 
                       help="Number of estimators for tree-based models (default: 100)")
    parser.add_argument("--max_depth", type=int, default=3,
                       help="Max depth for tree-based models (default: 3)")
    args = parser.parse_args()
    
    # Setup paths
    base_dir = Path(__file__).parent.parent
    csv_path = Path(args.csv)
    if not csv_path.is_absolute():
        csv_path = base_dir / csv_path
    
    out_dir = Path(args.out)
    if not out_dir.is_absolute():
        out_dir = base_dir / out_dir
    
    model_dir = out_dir / "grades" / args.version
    metrics_dir = base_dir / "metrics"
    
    model_dir.mkdir(parents=True, exist_ok=True)
    metrics_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Loading dataset from: {csv_path}")
    logger.info(f"Output directory: {model_dir}")
    logger.info(f"Model version: {args.version}")
    
    # Load dataset
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found: {csv_path}")
    
    df = pd.read_csv(csv_path, sep=args.sep, encoding="utf-8")
    logger.info(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")
    
    # Prepare target
    y = prepare_target(df)
    logger.info(f"Target stats: mean={y.mean():.2f}, std={y.std():.2f}, range=[{y.min():.2f}, {y.max():.2f}]")
    
    # Preprocess features
    encoders: Dict[str, LabelEncoder] = {}
    df_processed = preprocess_features(df, encoders)
    
    # Select features
    feature_columns = select_feature_columns(df_processed)
    X = df_processed[feature_columns].copy()
    
    # Handle missing values in numeric columns
    for col in X.columns:
        if X[col].dtype in [np.float64, np.int64]:
            X[col] = X[col].fillna(X[col].median() if X[col].notna().any() else 0)
    
    # Remove rows where target is NaN
    valid_mask = y.notna()
    initial_count = len(X)
    X = X[valid_mask].copy()
    y = y[valid_mask].copy()
    removed_count = initial_count - len(X)
    
    if removed_count > 0:
        logger.warning(f"Removed {removed_count} rows with missing target ({(removed_count/initial_count)*100:.1f}%)")
    
    if len(X) == 0:
        raise ValueError("No valid samples remaining after removing rows with missing target!")
    
    logger.info(f"Final dataset shape: X={X.shape}, y={y.shape}")
    logger.info(f"Feature columns: {feature_columns}")
    
    # Split train/test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=42, shuffle=True
    )
    logger.info(f"Train set: {X_train.shape[0]} samples, Test set: {X_test.shape[0]} samples")
    
    # Separate numeric and categorical for scaling
    # After LabelEncoding, categorical become int, so we need to track them explicitly
    # Define which are numeric (base + derived) vs categorical
    base_numeric = [
        "edad", "AsistenciaAM1", "VecesRecursadaAM1",
        "Parcial1AM1", "Parcial2AM1", "Recuperatorio1AM1", "Recuperatorio2AM1",
        "PromedioNotasColegio", "AniosUniversidad"
    ]
    derived_numeric = [
        "promedio_parciales", "max_parcial", "min_parcial",
        "tendencia_parciales", "tiene_recuperatorio", "promedio_historico",
        "rango_parciales", "std_parciales"
    ]
    categorical = ["Genero", "ProfesorAM1", "ColegioTecnico", "AyudaFinanciera"]
    
    # Build numeric list from feature_columns
    numeric_features = [col for col in feature_columns if col in base_numeric + derived_numeric]
    # Categorical features (were encoded with LabelEncoder)
    categorical_features = [col for col in feature_columns if col in categorical]
    
    # Scale numeric features
    scaler = StandardScaler()
    X_train_numeric = X_train[numeric_features].copy()
    X_test_numeric = X_test[numeric_features].copy()
    
    X_train_scaled = scaler.fit_transform(X_train_numeric)
    X_test_scaled = scaler.transform(X_test_numeric)
    
    # Combine scaled numeric + categorical
    X_train_final = np.hstack([
        X_train_scaled,
        X_train[categorical_features].values
    ])
    X_test_final = np.hstack([
        X_test_scaled,
        X_test[categorical_features].values
    ])
    
    # Train model
    if args.model == "linear":
        logger.info("Training LinearRegression model...")
        model = LinearRegression()
    elif args.model == "random_forest":
        logger.info(f"Training RandomForestRegressor model (n_estimators={args.n_estimators}, max_depth={args.max_depth})...")
        model = RandomForestRegressor(
            n_estimators=args.n_estimators,
            max_depth=args.max_depth,
            random_state=42,
            n_jobs=-1
        )
    elif args.model == "gradient_boosting":
        logger.info(f"Training GradientBoostingRegressor model (n_estimators={args.n_estimators}, max_depth={args.max_depth})...")
        model = GradientBoostingRegressor(
            n_estimators=args.n_estimators,
            max_depth=args.max_depth,
            random_state=42
        )
    else:
        raise ValueError(f"Unknown model type: {args.model}")
    
    model.fit(X_train_final, y_train)
    
    # Predict
    y_pred = model.predict(X_test_final)
    
    # Calculate metrics
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    
    logger.info(f"R² score: {r2:.4f}")
    logger.info(f"MAE: {mae:.4f}")
    
    # Save artifacts
    logger.info("Saving artifacts...")
    
    # Save model
    model_path = model_dir / "grades_model.joblib"
    dump(model, model_path)
    logger.info(f"Saved model: {model_path}")
    
    # Save scaler
    scaler_path = model_dir / "grades_scaler.joblib"
    dump(scaler, scaler_path)
    logger.info(f"Saved scaler: {scaler_path}")
    
    # Save encoders
    encoders_path = model_dir / "grades_encoders.joblib"
    dump(encoders, encoders_path)
    logger.info(f"Saved encoders: {encoders_path}")
    
    # Save feature order
    feature_order_path = model_dir / "feature_order.json"
    with open(feature_order_path, 'w', encoding='utf-8') as f:
        json.dump({
            "numeric_features": numeric_features,
            "categorical_features": categorical_features,
            "all_features": feature_columns
        }, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved feature order: {feature_order_path}")
    
    # Save metadata
    commit_hash = get_git_commit()
    meta = {
        "model_name": "grades",
        "version": args.version,
        "model_type": args.model,
        "model_params": {
            "n_estimators": args.n_estimators if args.model != "linear" else None,
            "max_depth": args.max_depth if args.model != "linear" else None
        },
        "created_at": datetime.now().isoformat(),
        "git_commit": commit_hash,
        "metrics": {
            "r2": float(r2),
            "mae": float(mae)
        },
        "dataset_info": {
            "n_samples_train": int(X_train.shape[0]),
            "n_samples_test": int(X_test.shape[0]),
            "n_features": int(X.shape[1])
        },
        "feature_order": feature_columns,
        "target_stats": {
            "mean": float(y.mean()),
            "std": float(y.std()),
            "min": float(y.min()),
            "max": float(y.max())
        }
    }
    
    meta_path = model_dir / "meta.json"
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved metadata: {meta_path}")
    
    # Save metrics
    metrics_data = {
        "model": "grades",
        "version": args.version,
        "r2": float(r2),
        "mae": float(mae),
        "timestamp": datetime.now().isoformat()
    }
    
    metrics_path = metrics_dir / f"grades-{args.version}.json"
    with open(metrics_path, 'w', encoding='utf-8') as f:
        json.dump(metrics_data, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved metrics: {metrics_path}")
    
    # Log final summary
    logger.info("=" * 60)
    logger.info("Training Summary:")
    logger.info(f"  Model type: {args.model}")
    logger.info(f"  Feature order: {feature_columns}")
    logger.info(f"  X shape: {X.shape}")
    logger.info(f"  R²: {r2:.4f}")
    logger.info(f"  MAE: {mae:.4f}")
    
    # Feature importance for tree-based models
    if args.model in ["random_forest", "gradient_boosting"] and hasattr(model, "feature_importances_"):
        logger.info(f"\n  Top 5 Most Important Features:")
        importances = model.feature_importances_
        feature_names = numeric_features + categorical_features
        top5_idx = np.argsort(importances)[::-1][:5]
        for idx in top5_idx:
            feat_name = feature_names[idx] if idx < len(feature_names) else f"feature_{idx}"
            logger.info(f"    {feat_name}: {importances[idx]:.4f}")
    
    logger.info("=" * 60)
    
    print(json.dumps({
        "status": "success",
        "version": args.version,
        "metrics": {"r2": float(r2), "mae": float(mae)},
        "artifacts": {
            "model": str(model_path.relative_to(base_dir)),
            "scaler": str(scaler_path.relative_to(base_dir)),
            "encoders": str(encoders_path.relative_to(base_dir)),
            "feature_order": str(feature_order_path.relative_to(base_dir)),
            "meta": str(meta_path.relative_to(base_dir))
        }
    }, indent=2))


if __name__ == "__main__":
    main()

