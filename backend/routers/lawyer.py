"""
BuroBot — Lawyer Router
Endpoint per funzionalità dedicate agli studi legali:
- Redazione automatica di atti e lettere legali
- Analisi e revisione di contratti
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import asyncio
import google.generativeai as genai
import os

from dependencies import get_current_user

router = APIRouter()

genai.configure(api_key=os.getenv("GEMINI_API_KEY", "").strip())

# ─── Modelli ───────────────────────────────────────────────────────────────────

class DraftRequest(BaseModel):
    tipo_atto: str          # es. "diffida", "contratto_locazione", "lettera_messa_in_mora"
    mittente: str           # nome mittente / studio
    destinatario: str       # nome destinatario
    oggetto: str            # breve descrizione dell'oggetto
    dettagli: str           # fatti e dettagli rilevanti da includere
    importo: Optional[str] = None   # importo in causa (se applicabile)
    scadenza: Optional[str] = None  # scadenza o termine richiesto

class ContractAnalysisRequest(BaseModel):
    testo_contratto: str    # testo completo o estratto del contratto
    tipo_contratto: Optional[str] = "generico"

class DraftResponse(BaseModel):
    atto: str               # testo completo dell'atto redatto
    note_avvocato: str      # note e avvertenze per l'avvocato

class ContractAnalysisResponse(BaseModel):
    sommario: str
    clausole_rischiose: List[str]
    clausole_mancanti: List[str]
    punti_chiave: List[str]
    valutazione_generale: str   # "favorevole", "neutro", "sfavorevole"
    raccomandazioni: List[str]


# ─── Prompt di sistema per il ruolo avvocato ───────────────────────────────────

LAWYER_SYSTEM_PROMPT = """Sei un assistente legale esperto in diritto italiano.
Conosci il Codice Civile, il Codice di Procedura Civile, le norme sul lavoro, i contratti tipici italiani e la prassi forense italiana.

Regole assolute:
- Usa sempre un linguaggio giuridico formale e preciso, tipico della prassi forense italiana.
- Non usare mai emoji, simboli o linguaggio colloquiale.
- Includi sempre riferimenti normativi pertinenti (es. "ai sensi dell'art. 1218 c.c.").
- Non inventare mai fatti non presenti nel testo fornito.
- Rispondi sempre in italiano.
- Ogni atto deve avere: luogo e data, intestazione, corpo con riferimenti normativi, chiusura formale con richiesta esplicita.
"""


# ─── Endpoint: Redazione Atto ──────────────────────────────────────────────────

@router.post("/draft", response_model=DraftResponse)
async def draft_legal_document(request: DraftRequest, user=Depends(get_current_user)):
    """
    Redige automaticamente un atto legale (diffida, contratto, lettera formale)
    sulla base dei dettagli forniti dall'avvocato.
    """
    tipo_map = {
        "diffida": "una lettera di diffida formale",
        "messa_in_mora": "una lettera di messa in mora ai sensi dell'art. 1219 c.c.",
        "contratto_locazione": "un contratto di locazione ad uso abitativo ex L. 431/1998",
        "contratto_prestazione": "un contratto di prestazione d'opera ai sensi dell'art. 2222 c.c.",
        "lettera_formale": "una lettera legale formale",
        "ricorso": "un ricorso formale",
        "accordo_transattivo": "un accordo transattivo ai sensi dell'art. 1965 c.c.",
    }
    descrizione_atto = tipo_map.get(request.tipo_atto, f"un atto di tipo '{request.tipo_atto}'")

    importo_str = f"\n- Importo in causa: {request.importo}" if request.importo else ""
    scadenza_str = f"\n- Termine richiesto: {request.scadenza}" if request.scadenza else ""

    prompt = f"""{LAWYER_SYSTEM_PROMPT}

Redigi {descrizione_atto} con i seguenti dati:

- Mittente: {request.mittente}
- Destinatario: {request.destinatario}
- Oggetto: {request.oggetto}{importo_str}{scadenza_str}
- Fatti rilevanti: {request.dettagli}

L'atto deve essere completo, formalmente corretto secondo la prassi forense italiana, e pronto per essere utilizzato o adattato dall'avvocato.

Dopo l'atto, aggiungi una sezione separata con il titolo "NOTE PER L'AVVOCATO:" contenente eventuali avvertenze, integrazioni suggerite o riferimenti normativi aggiuntivi da valutare.
"""

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            max_output_tokens=4096,
        )
    )

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        if not response.candidates:
            raise ValueError("Risposta bloccata dai filtri di sicurezza.")
        full_text = response.text.strip()
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower():
            raise HTTPException(status_code=429, detail="Quota AI superata. Riprovare tra un minuto.")
        raise HTTPException(status_code=500, detail=f"Errore durante la redazione: {err}")

    # Separa atto e note per l'avvocato
    if "NOTE PER L'AVVOCATO:" in full_text:
        parts = full_text.split("NOTE PER L'AVVOCATO:", 1)
        atto = parts[0].strip()
        note = parts[1].strip()
    else:
        atto = full_text
        note = "Verificare la correttezza dei dati inseriti e adattare l'atto alle specificità del caso concreto prima dell'invio."

    return DraftResponse(atto=atto, note_avvocato=note)


# ─── Endpoint: Analisi Contratto ───────────────────────────────────────────────

@router.post("/analyze-contract", response_model=ContractAnalysisResponse)
async def analyze_contract(request: ContractAnalysisRequest, user=Depends(get_current_user)):
    """
    Analizza un contratto e identifica clausole rischiose, mancanti e punti chiave.
    """
    testo_troncato = request.testo_contratto[:12000]

    prompt = f"""{LAWYER_SYSTEM_PROMPT}

Analizza il seguente contratto di tipo "{request.tipo_contratto}" e fornisci una revisione legale strutturata.

---CONTRATTO---
{testo_troncato}
---FINE---

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (senza markdown, senza testo aggiuntivo) nel seguente formato:

{{
  "sommario": "Descrizione sintetica del contratto (2-3 frasi, max 400 caratteri)",
  "clausole_rischiose": [
    "Descrizione clausola rischiosa 1 con riferimento normativo",
    "Descrizione clausola rischiosa 2"
  ],
  "clausole_mancanti": [
    "Clausola tipicamente necessaria ma assente 1",
    "Clausola mancante 2"
  ],
  "punti_chiave": [
    "Punto chiave 1 (obbligazioni principali, termini, importi)",
    "Punto chiave 2"
  ],
  "valutazione_generale": "favorevole",
  "raccomandazioni": [
    "Raccomandazione specifica 1",
    "Raccomandazione specifica 2"
  ]
}}

Il campo valutazione_generale deve essere esattamente uno di: "favorevole", "neutro", "sfavorevole".
Rispondi solo con il JSON.
"""

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=3000,
            response_mime_type="application/json",
        )
    )

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        if not response.candidates:
            raise ValueError("Risposta bloccata dai filtri di sicurezza.")
        import json, re
        raw = response.text.strip()
        # Rimuovi eventuali markdown code blocks
        if "```" in raw:
            match = re.search(r'```(?:json)?\s*({.*?})\s*```', raw, re.DOTALL)
            if match:
                raw = match.group(1)
        result = json.loads(raw)
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower():
            raise HTTPException(status_code=429, detail="Quota AI superata. Riprovare tra un minuto.")
        raise HTTPException(status_code=500, detail=f"Errore durante l'analisi: {err}")

    return ContractAnalysisResponse(**result)


# ─── Health check ──────────────────────────────────────────────────────────────

@router.get("/status")
async def lawyer_status():
    return {"status": "ok", "module": "lawyer", "features": ["draft", "analyze-contract"]}
