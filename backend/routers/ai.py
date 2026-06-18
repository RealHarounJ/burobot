"""
BuroBot — AI Router
Endpoint per chat libera e domande burocratiche dirette.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from dependencies import get_current_user
from services.ai_service import chat_with_ai

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    context: str = ""


@router.post("/chat")
async def chat(request: ChatRequest, user=Depends(get_current_user)):
    """
    Chat libera con BuroBot per domande burocratiche generali.
    Non richiede upload di documenti.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Messaggio vuoto")

    if len(request.message) > 2000:
        raise HTTPException(status_code=400, detail="Messaggio troppo lungo (max 2000 caratteri)")

    try:
        response = await chat_with_ai(request.message, request.context)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore AI: {str(e)}")


@router.get("/status")
async def ai_status():
    """Health check del servizio AI."""
    return {"status": "ok", "model": "gemini-1.5-flash", "rag": "active"}
