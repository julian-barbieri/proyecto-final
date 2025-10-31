"""Pydantic schemas for request/response validation."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ItemFeatures(BaseModel):
    """Features for a single item (student/record)."""
    # Using dict to allow flexible feature names
    # In production, you might want to define specific fields
    features: Dict[str, Any] = Field(
        ..., 
        description="Dictionary of feature names to values"
    )

    class Config:
        extra = "allow"  # Allow additional fields


class PredictGradesRequest(BaseModel):
    """Request schema for grade prediction."""
    items: List[ItemFeatures] = Field(
        ..., 
        description="List of items with features for grade prediction"
    )


class PredictGradesResponse(BaseModel):
    """Response schema for grade prediction."""
    preds: List[float] = Field(
        ..., 
        description="List of predicted grades (clamped to valid range)"
    )
    meta: Dict[str, Any] = Field(
        default_factory=dict,
        description="Metadata about the prediction (model version, timestamp, etc.)"
    )


class PredictDropoutRequest(BaseModel):
    """Request schema for dropout prediction."""
    items: List[ItemFeatures] = Field(
        ..., 
        description="List of items with features for dropout prediction"
    )


class PredictDropoutResponse(BaseModel):
    """Response schema for dropout prediction."""
    proba: List[float] = Field(
        ..., 
        description="List of dropout probabilities (0-1)"
    )
    labels: List[int] = Field(
        ..., 
        description="List of binary labels (0=no dropout, 1=dropout)"
    )
    threshold: float = Field(
        ..., 
        description="Threshold used for binary classification"
    )
    meta: Dict[str, Any] = Field(
        default_factory=dict,
        description="Metadata about the prediction (model version, timestamp, etc.)"
    )

