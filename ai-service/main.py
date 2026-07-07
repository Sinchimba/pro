import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import sign_recognition, text_to_sign

app = FastAPI(
    title="Sign Language AI Service",
    description="Real-time hand landmark classification and text-to-sign clip mapping.",
    version="1.0.0"
)

# Configure CORS so our React app can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(sign_recognition.router, prefix="/recognition", tags=["Recognition"])
app.include_router(text_to_sign.router, prefix="/translation", tags=["Translation"])

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
