"""
BuroBot — Documents Router
Gestisce upload, analisi e storico documenti.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import os
from supabase import create_client, Client
from dependencies import get_current_user
from services.ocr_service import extract_text
from services.ai_service import analyze_document, generate_response_letter, match_bonuses_with_ai

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
FREE_PLAN_LIMIT = 3

# Email degli amministratori — hanno accesso illimitato senza pagare
ADMIN_EMAILS = {
    os.getenv("ADMIN_EMAIL", "").strip().lower(),
    "harounjaafar3@gmail.com",  # proprietario — accesso illimitato
    "haroun@burobot.it",
}



def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Configurazione database mancante")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


async def check_usage_limit(user_id: str, supabase: Client, email: str = ""):
    """Controlla se l'utente free ha superato il limite mensile."""
    from datetime import datetime, timezone

    # ADMIN BYPASS — accesso illimitato per test
    if email.strip().lower() in ADMIN_EMAILS:
        return True

    try:
        profile = supabase.table("profiles").select("plan").eq("id", user_id).single().execute()
        plan = profile.data.get("plan", "free") if (profile and profile.data) else "free"
    except Exception:
        # Se il profilo non esiste nel database (es. trigger non eseguito), lo creiamo on-the-fly
        try:
            supabase.table("profiles").insert({
                "id": user_id,
                "email": email,
                "plan": "free"
            }).execute()
        except Exception as insert_err:
            print(f"Errore creazione profilo on-the-fly: {insert_err}")
        plan = "free"
        
    if plan != "free":
        return True

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
            detail=f"Limite piano gratuito raggiunto ({FREE_PLAN_LIMIT} documenti/mese). "
                   "Vai su /pricing per sbloccare documenti illimitati."
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
    """Riceve un file, estrae il testo e lo analizza con AI."""
    supabase = get_supabase()
    await check_usage_limit(user.id, supabase, getattr(user, "email", ""))

    allowed_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Formato non supportato. Usa JPG, PNG o PDF.")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande. Max 10MB.")

    try:
        extracted_text = await extract_text(file_bytes, file.content_type)
        if not extracted_text or len(extracted_text.strip()) < 20:
            raise HTTPException(
                status_code=422,
                detail="Impossibile leggere il testo dal documento. "
                       "Assicurati che l'immagine sia nitida."
            )

        analysis = await analyze_document(extracted_text)

        doc_record = supabase.table("documents").insert({
            "user_id": user.id,
            "original_text": extracted_text[:5000],
            "analysis": analysis,
            "file_name": file.filename,
            "document_type": analysis.get("tipo_documento", "generico")
        }).execute()

        document_id = doc_record.data[0]["id"] if doc_record.data else None
        return {"success": True, "document_id": document_id, "analysis": analysis}

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

    doc = supabase.table("documents") \
        .select("*").eq("id", request.document_id).eq("user_id", user.id) \
        .single().execute()

    if not doc.data:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    letter = await generate_response_letter(
        document_text=doc.data["original_text"],
        user_situation=request.user_situation,
        response_type=request.response_type
    )

    # Salva la lettera nel database
    supabase.table("response_letters").insert({
        "document_id": request.document_id,
        "user_id": user.id,
        "response_type": request.response_type,
        "letter_text": letter
    }).execute()

    return {"success": True, "letter": letter}


@router.get("/history")
async def get_history(user=Depends(get_current_user)):
    """Restituisce lo storico documenti dell'utente."""
    supabase = get_supabase()
    docs = supabase.table("documents") \
        .select("id, file_name, document_type, created_at, analysis") \
        .eq("user_id", user.id) \
        .order("created_at", desc=True) \
        .limit(50).execute()
    return {"documents": docs.data or []}


@router.get("/usage")
async def get_usage(user=Depends(get_current_user)):
    """Restituisce utilizzo corrente e piano dell'utente."""
    from datetime import datetime, timezone
    supabase = get_supabase()

    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    profile = supabase.table("profiles").select("plan").eq("id", user.id).single().execute()
    plan = profile.data.get("plan", "free") if profile.data else "free"

    count = supabase.table("documents") \
        .select("id", count="exact") \
        .eq("user_id", user.id) \
        .gte("created_at", start_of_month.isoformat()).execute()

    used = count.count or 0
    limit = FREE_PLAN_LIMIT if plan == "free" else None

    return {
        "plan": plan,
        "used_this_month": used,
        "limit": limit,
        "remaining": max(0, limit - used) if limit else None
    }


class MatchBonusesRequest(BaseModel):
    document_id: str


class SimulatePagoPARequest(BaseModel):
    document_id: str


class SendPECRequest(BaseModel):
    document_id: str
    recipient_email: str
    sender_name: str
    letter_text: str


@router.post("/match-bonuses")
async def match_bonuses_endpoint(
    request: MatchBonusesRequest,
    user=Depends(get_current_user)
):
    """Analizza il testo del documento ISEE e restituisce l'elenco dei bonus compatibili."""
    supabase = get_supabase()
    doc = supabase.table("documents") \
        .select("*").eq("id", request.document_id).eq("user_id", user.id) \
        .single().execute()

    if not doc.data:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    text = doc.data.get("original_text", "")
    bonuses = await match_bonuses_with_ai(text)
    
    # Aggiorna l'analisi salvata per includere i bonus
    analysis = doc.data.get("analysis", {})
    analysis["bonuses"] = bonuses
    
    supabase.table("documents") \
        .update({"analysis": analysis}) \
        .eq("id", request.document_id) \
        .execute()

    return {"success": True, "bonuses": bonuses}


@router.post("/simulate-pagopa")
async def simulate_pagopa_endpoint(
    request: SimulatePagoPARequest,
    user=Depends(get_current_user)
):
    """Simula il pagamento PagoPA/F24 e aggiorna lo stato dell'analisi."""
    supabase = get_supabase()
    doc = supabase.table("documents") \
        .select("*").eq("id", request.document_id).eq("user_id", user.id) \
        .single().execute()

    if not doc.data:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    analysis = doc.data.get("analysis", {})
    analysis["pagato"] = True
    analysis["pagato_at"] = "oggi"
    
    supabase.table("documents") \
        .update({"analysis": analysis}) \
        .eq("id", request.document_id) \
        .execute()

    return {
        "success": True, 
        "receipt_id": "REC-PA-983172635", 
        "message": "Pagamento PagoPA simulato con successo"
    }


@router.post("/send-pec")
async def send_pec_endpoint(
    request: SendPECRequest,
    user=Depends(get_current_user)
):
    """Simula l'invio legale via PEC della lettera generata e aggiorna lo stato."""
    supabase = get_supabase()
    doc = supabase.table("documents") \
        .select("*").eq("id", request.document_id).eq("user_id", user.id) \
        .single().execute()

    if not doc.data:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    analysis = doc.data.get("analysis", {})
    analysis["pec_inviata"] = True
    analysis["pec_inviata_at"] = "oggi"
    analysis["pec_recipient"] = request.recipient_email
    
    supabase.table("documents") \
        .update({"analysis": analysis}) \
        .eq("id", request.document_id) \
        .execute()

    return {
        "success": True, 
        "message": "Invio PEC simulato con successo",
        "receipt": {
            "timestamp": "2026-06-30T22:30:00Z",
            "message_id": "<burobot-pec-98213768@legalmail.it>",
            "recipient": request.recipient_email,
            "status": "accettata_e_consegnata"
        }
    }


@router.get("/{document_id}")
async def get_document(document_id: str, user=Depends(get_current_user)):
    """Restituisce un singolo documento con analisi completa."""
    supabase = get_supabase()
    doc = supabase.table("documents") \
        .select("*, response_letters(*)") \
        .eq("id", document_id).eq("user_id", user.id) \
        .single().execute()

    if not doc.data:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    return doc.data
