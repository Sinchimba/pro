# Smart Meeting Platform

Real-time video meeting system with bidirectional speech ↔ sign language conversion.

## Objectives
1. Real-time video meeting system (local network + remote, via WebRTC)
2. Bidirectional speech ↔ sign language translation
3. Integrated two-way communication for deaf/mute and hearing users

## Project structure
#pro
- `backend/` — Node/Express + Socket.io signaling server (WebRTC connection setup, room management)
- `frontend/` — React + Vite + TypeScript client (video call UI, captions, sign panel)
- `ai-service/` — FastAPI service (sign recognition via MediaPipe, text-to-sign clip lookup)
- `assets/sign-clips/` — pre-recorded sign language video clips for the fixed vocabulary
- `docs/` — architecture notes, scope decisions, demo script

## Setup

Each service has its own `.env.example` — copy to `.env` and fill in values before running.

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# AI service
cd ai-service && pip install -r requirements.txt && uvicorn main:app --reload
```

## Status
See `docs/SCOPE.md` for the mentor-approved scope and `docs/ARCHITECTURE.md` for how the pieces connect.
