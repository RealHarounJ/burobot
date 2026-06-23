"""
BuroBot — AI Router
Endpoint per chat libera e domande burocratiche dirette.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from dependencies import get_current_user
from services.ai_service import chat_with_ai, reset_rag_index
from services.normattiva_service import scrape_normattiva_law

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    context: str = ""


class LawImportRequest(BaseModel):
    url: str


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


@router.post("/knowledge/import")
async def import_law(request: LawImportRequest, user=Depends(get_current_user)):
    """
    Scarica una legge da Normattiva, la converte in markdown e la indicizza nel database RAG.
    """
    url_str = request.url.strip()
    if not url_str:
        raise HTTPException(status_code=400, detail="L'URL non può essere vuoto")

    if "normattiva.it" not in url_str.lower():
        raise HTTPException(
            status_code=400,
            detail="URL non valido. È supportato solo il portale ufficiale Normattiva (www.normattiva.it)."
        )

    try:
        title, filename = await scrape_normattiva_law(url_str)
        # Resetta l'indice in-memory RAG
        reset_rag_index()
        return {
            "status": "success",
            "message": f"Legge '{title}' importata con successo nella base di conoscenza",
            "filename": filename,
            "title": title
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Errore durante l'importazione della legge: {str(e)}"
        )


@router.get("/status")
async def ai_status():
    """Health check del servizio AI."""
    return {"status": "ok", "model": "gemini-1.5-flash", "rag": "active"}
