from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.models.sign_classifier import SignClassifier

router = APIRouter()
classifier = SignClassifier()

class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float

class LandmarkRequest(BaseModel):
    landmarks: List[LandmarkPoint]

class PredictionResponse(BaseModel):
    success: bool
    prediction: Optional[str]
    confidence: float

@router.post("/predict", response_model=PredictionResponse)
async def predict_sign(request: LandmarkRequest):
    try:
        landmarks_dict = [{"x": lm.x, "y": lm.y, "z": lm.z} for lm in request.landmarks]
        result = classifier.process_landmarks(landmarks_dict)
        return PredictionResponse(
            success=True,
            prediction=result,
            confidence=0.85 if result else 0.0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
