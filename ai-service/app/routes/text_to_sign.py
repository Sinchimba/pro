import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# Load vocabulary path dynamically
DATA_PATH = os.path.join(os.path.dirname(__file__), "../data/sign_vocabulary.json")

class TranslationRequest(BaseModel):
    text: str

class TranslationResponse(BaseModel):
    success: bool
    word: str
    video_url: Optional[str]
    description: Optional[str]

@router.post("/translate", response_model=TranslationResponse)
async def translate_text(request: TranslationRequest):
    try:
        clean_text = request.text.lower().strip().replace(" ", "")
        
        # Load vocabulary file
        if not os.path.exists(DATA_PATH):
            raise HTTPException(status_code=500, detail="Vocabulary registry not found.")
            
        with open(DATA_PATH, "r") as f:
            vocabulary = json.load(f)
            
        if clean_text in vocabulary:
            item = vocabulary[clean_text]
            return TranslationResponse(
                success=True,
                word=item["word"],
                video_url=item["video_url"],
                description=item["description"]
            )
        else:
            return TranslationResponse(
                success=False,
                word=request.text,
                video_url=None,
                description=f"Word '{request.text}' not found in vocabulary."
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
