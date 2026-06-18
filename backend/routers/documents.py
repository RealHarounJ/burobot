"""
BuroBot — Documents Router
Gestisce upload, analisi e storico documenti.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
import os
from supabase import create_client, Client

from services.ocr_service import extract_text
from services.ai_service import analyze_document, generate_response_letter

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

FREE_PLAN_LIMIT = 3  # documenti/mese per piano free


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


async def get_current_user(authorization: str = Header(None)):
    """Verifica il JWT Supabase e restituisce l'utente."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token mancante")
    
    token = authorization.split(" ")[1]
    supabase = get_supabase()
    
    try:
        user = supabase.auth.get_user(token)
        return user.user
    except Exception:
        raise HTTPException(status_code=401, detail="Token non valido")


async def check_usage_limit(user_id: str, supabase: Client):
    """Controlla se l'utente free ha superato il limite mensile."""
    from datetime import datetime, timezone
    
    # Recupera piano utente
    profile = supabase.table("profiles").select("plan").eq("id", user_id).single().execute()
    plan = profile.data.get("plan", "free") if profile.data else "free"
    
    if plan != "free":
        return True  # Piani paganti: nessun limite
    
    # Conta documenti del mese corrente
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    count = supabase.table("documents") \
        .select("id", count="exact") \
        .eq("user_id", user_id) \
        .gte("created_at", start_of_month.isoformat()) \
        .execute()
    
    used = count.count or 0
    if used >= FREE_PLAN_LIMIT:
        raise HTTPException(
            status_code=402,
            detail=f"Limite piano gratuito raggiunto ({FREE_PLAN_LIMIT} documenti/mese). Passa a BuroBot Base per continuare."
        )
    return True


class ResponseLetterRequest(BaseModel):
    document_id: str
    user_situation: str
    response_type: str = "contestazione"


@router.post("/analyze")
async def analyze_document_endpoint(
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    """
    Endpoint principale: riceve un file (immagine/PDF), estrae il testo,
    lo analizza con AI e restituisce la spiegazione strutturata.
    """
    supabase = get_supabase()
    
    # Controlla limite utilizzo
    await check_usage_limit(user.id, supabase)
    
    # Valida tipo file
    allowed_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Formato non supportato. Usa JPG, PNG o PDF.")
    
    # Controlla dimensione (max 10MB)
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande. Max 10MB.")
    
    try:
        # Step 1: Estrai testo
        extracted_text = await extract_text(file_bytes, file.content_type)
        
        if not extracted_text or len(extracted_text.strip()) < 20:
            raise HTTPException(status_code=422, detail="Impossibile leggere il testo dal documento. Assicurati che l'immagine sia nitida.")
        
        # Step 2: Analizza con AI + RAG
        analysis = await analyze_document(extracted_text)
        
        # Step 3: Salva in Supabase
        doc_record = supabase.table("documents").insert({
            "user_id": user.id,
            "original_text": extracted_text[:5000],
            "analysis": analysis,
            "file_name": file.filename,
            "document_type": analysis.get("tipo_documento", "generico")
        }).execute()
        
        document_id = doc_record.data[0]["id"] if doc_record.data else None
        
        return {
            "success": True,
            "document_id": document_id,
            "analysis": analysis
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nell'analisi: {str(e)}")


@router.post("/generate-response")
async def generate_response(
    request: ResponseLetterRequest,
    user=Depends(get_current_user)
):
    """Genera una lettera di risposta/ricorso per un documento analizzato."""
    supabase = get_supabase()
    
    # Recupera il documento originale
    doc = supabase.table("documents") \
        .select("*") \
        .eq("id", request.document_id) \
        .eq("user_id", user.id) \
        .single() \
        .execute()
    
    if not doc.data:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    
    letter = await generate_response_letter(
        document_text=doc.data["original_text"],
        user_situation=request.user_situation,
        response_type=request.response_type
    )
    
    return {"success": True, "letter": letter}


@router.get("/history")
async def get_history(user=Depends(get_current_user)):
    """Restituisce lo storico documenti dell'utente."""
    supabase = get_supabase()
    
    docs = supabase.table("documents") \
        .select("id, file_name, document_type, created_at, analysis") \
        .eq("user_id", user.id) \
        .order("created_at", desc=True) \
        .limit(50) \
        .execute()
    
    return {"documents": docs.data or []}


@router.get("/usage")
async def get_usage(user=Depends(get_current_user)):
    """Restituisce l'utilizzo corrente dell'utente."""
    from datetime import datetime, timezone
    supabase = get_supabase()
    
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    profile = supabase.table("profiles").select("plan").eq("id", user.id).single().execute()
    plan = profile.data.get("plan", "free") if profile.data else "free"
    
    count = supabase.table("documents") \
        .select("id", count="exact") \
        .eq("user_id", user.id) \
        .gte("created_at", start_of_month.isoformat()) \
        .execute()
    
    used = count.count or 0
    limit = FREE_PLAN_LIMIT if plan == "free" else None
    
    return {
        "plan": plan,
        "used_this_month": used,
        "limit": limit,
        "remaining": max(0, limit - used) if limit else None
    }
