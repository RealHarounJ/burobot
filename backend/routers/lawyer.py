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

import json
import re

def parse_json_robustly(raw: str) -> dict:
    """
    Rimuove markdown e sanitizza newline non escaped all'interno delle stringhe JSON.
    """
    raw = raw.strip()
    # Rimuovi markdown blocks
    if "```" in raw:
        match = re.search(r'```(?:json)?\s*({.*?})\s*```', raw, re.DOTALL)
        if match:
            raw = match.group(1)
    raw = raw.strip()
    
    # Sostituisci apostrofi o virgolette escape errati
    raw = raw.replace(r"\'", "'").replace("\\'", "'")
    
    # Strategia 1: prova a caricare direttamente
    try:
        return json.loads(raw)
    except Exception:
        pass

    # Strategia 2: sanitizza i newline fisici dentro i valori stringa JSON
    try:
        sanitized = []
        in_string = False
        escape = False
        for char in raw:
            if char == '"' and not escape:
                in_string = not in_string
            escape = (char == '\\' and not escape)
            if char == '\n' and in_string:
                sanitized.append('\\n')
            elif char == '\r':
                continue
            else:
                sanitized.append(char)
        return json.loads("".join(sanitized))
    except Exception as e:
        raise ValueError(f"Impossibile parsare JSON: {str(e)} (raw: {raw[:200]}...)")


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
        result = parse_json_robustly(response.text)
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower():
            raise HTTPException(status_code=429, detail="Quota AI superata. Riprovare tra un minuto.")
        raise HTTPException(status_code=500, detail=f"Errore durante l'analisi: {err}")

    return ContractAnalysisResponse(**result)



# ─── Nuovi Modelli per Scadenzario, FAQ, Ricerca e Parcella ───────────────────

class DeadlineRequest(BaseModel):
    tipo_atto: str          # es. "memoria_171_bis", "appello", "opposizione_decreto_ingiuntivo"
    data_notifica: str      # YYYY-MM-DD o formato testuale

class DeadlineItem(BaseModel):
    fase: str
    giorni: int
    termine_ultimo: str
    descrizione: str
    riferimento_normativo: str

class DeadlineResponse(BaseModel):
    scadenze: List[DeadlineItem]
    suggerimenti: List[str]

class FaqRequest(BaseModel):
    domanda_cliente: str
    area_legale: str        # es. "famiglia", "lavoro", "sinistro", "locazione"
    dettagli_caso: str

class FaqResponse(BaseModel):
    risposta_formale: str
    risposta_semplice: str
    consigli_avvocato: str

class ResearchRequest(BaseModel):
    argomento: str
    parole_chiave: Optional[str] = ""

class RulingItem(BaseModel):
    riferimento: str        # es. "Cassazione Civile, Sez. III, Sentenza n. 12345/2024"
    massima: str            # principio di diritto espresso
    riassunto: str          # breve sintesi del caso
    rilevanza: str          # "alta", "media", "bassa"

class ResearchResponse(BaseModel):
    sentenze: List[RulingItem]
    sintesi_orientamento: str

class FeeRequest(BaseModel):
    tipo_procedimento: str   # es. "civile_ordinario", "lavoro", "separazione_consensuale", "penale"
    valore_causa: str        # es. "fino_26000", "fino_52000", "fino_260000"
    fasi: List[str]          # es. ["studio", "introduzione", "istruttoria", "decisione"]

class FeeBreakdownItem(BaseModel):
    fase: str
    valore_medio: float
    valore_minimo: float
    valore_massimo: float

class FeeResponse(BaseModel):
    dettaglio_fasi: List[FeeBreakdownItem]
    totale_medio: float
    cpa: float              # 4%
    iva: float              # 22%
    totale_lordo: float
    spiegazione: str


# ─── Endpoint: Scadenzario Processuale ─────────────────────────────────────────

@router.post("/deadlines", response_model=DeadlineResponse)
async def calculate_deadlines(request: DeadlineRequest, user=Depends(get_current_user)):
    """
    Calcola scadenze processuali italiane a partire da una data di notifica o evento.
    """
    prompt = f"""{LAWYER_SYSTEM_PROMPT}

Calcola le scadenze processuali italiane relative a:
- Tipo di atto/procedura: {request.tipo_atto}
- Data di notifica/decorrenza: {request.data_notifica}

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (senza markdown, senza testo aggiuntivo) nel seguente formato:

{{
  "scadenze": [
    {{
      "fase": "Descrizione sintetica del termine (es. Deposito prima memoria)",
      "giorni": 30,
      "termine_ultimo": "Data stimata calcolata (es. 15 Novembre 2026)",
      "descrizione": "Spiegazione pratica del termine e cosa depositare",
      "riferimento_normativo": "es. Art. 171-bis c.p.c."
    }}
  ],
  "suggerimenti": [
    "Consiglio pratico n.1 per evitare decadenze",
    "Consiglio n.2"
  ]
}}

Assicurati che i calcoli siano allineati con la riforma Cartabia o le normative vigenti. Rispondi solo con il JSON.
"""

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=2000,
            response_mime_type="application/json",
        )
    )

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        result = parse_json_robustly(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore calcolo scadenze: {str(e)}")

    return DeadlineResponse(**result)


# ─── Endpoint: FAQ Clienti ─────────────────────────────────────────────────────

@router.post("/faq", response_model=FaqResponse)
async def generate_faq_response(request: FaqRequest, user=Depends(get_current_user)):
    """
    Genera risposte rapide (formali e informali) da inviare ai clienti.
    """
    prompt = f"""{LAWYER_SYSTEM_PROMPT}

Un cliente fa questa domanda: "{request.domanda_cliente}"
Relativa all'area: {request.area_legale}
Dettagli del caso: {request.dettagli_caso}

Genera tre contenuti per l'avvocato:
1. Una risposta formale da inviare via Email/PEC (precisa, rassicurante ma tecnicamente corretta).
2. Una risposta breve ed elementare adatta a WhatsApp/SMS (semplice, diretta, senza tecnicismi).
3. Consigli strategici ed avvertimenti riservati all'avvocato (cosa chiedere al cliente, che documenti raccogliere).

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (senza markdown, senza testo aggiuntivo):

{{
  "risposta_formale": "Testo email...",
  "risposta_semplice": "Testo breve...",
  "consigli_avvocato": "Consigli interni per il professionista..."
}}

Rispondi solo con il JSON.
"""

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.4,
            max_output_tokens=3000,
            response_mime_type="application/json",
        )
    )

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        result = parse_json_robustly(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore generazione risposte: {str(e)}")

    return FaqResponse(**result)


# ─── Endpoint: Ricercatore Giurisprudenza ──────────────────────────────────────

@router.post("/research", response_model=ResearchResponse)
async def legal_research(request: ResearchRequest, user=Depends(get_current_user)):
    """
    Simula ricerca giurisprudenziale (Cassazione/TAR) basata su sintesi semantica AI.
    """
    keywords_str = f" con parole chiave: {request.parole_chiave}" if request.parole_chiave else ""
    prompt = f"""{LAWYER_SYSTEM_PROMPT}

Esegui una ricerca giurisprudenziale sintetica su: {request.argomento}{keywords_str}.

Trova le 3 sentenze (Cassazione o TAR) più rilevanti e recenti ed esprimi l'orientamento prevalente delle corti.
La massima deve contenere il principio fondamentale.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (senza markdown, senza testo aggiuntivo):

{{
  "sintesi_orientamento": "Descrizione dell'orientamento dominante, contrasti giurisprudenziali, tendenze recenti (max 600 caratteri)",
  "sentenze": [
    {{
      "riferimento": "es. Cassazione Civile, Sez. Unite, Sentenza n. 12345/2023",
      "massima": "Principio di diritto formulato in modo preciso ed esteso",
      "riassunto": "Breve fatto e svolgimento del processo",
      "rivelanza": "alta"
    }}
  ]
}}

Rispondi solo con il JSON.
"""

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.2,
            max_output_tokens=3500,
            response_mime_type="application/json",
        )
    )

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        result = parse_json_robustly(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore ricerca giurisprudenziale: {str(e)}")

    return ResearchResponse(**result)


# ─── Endpoint: Generatore Parcella ─────────────────────────────────────────────

@router.post("/fee-estimator", response_model=FeeResponse)
async def estimate_fees(request: FeeRequest, user=Depends(get_current_user)):
    """
    Calcola onorario stimato secondo i parametri forensi italiani (D.M. 55/2014, D.M. 147/2022).
    """
    fasi_str = ", ".join(request.fasi)
    prompt = f"""{LAWYER_SYSTEM_PROMPT}

Calcola un preventivo/stima dei compensi professionali forensi secondo i Parametri Ministeriali italiani vigenti per:
- Procedimento: {request.tipo_procedimento}
- Scaglione di valore della causa: {request.valore_causa}
- Fasi richieste: {fasi_str}

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (senza markdown, senza testo aggiuntivo):

{{
  "dettaglio_fasi": [
    {{
      "fase": "Nome fase (es. Fase di studio della controversia)",
      "valore_medio": 1200.0,
      "valore_minimo": 600.0,
      "valore_massimo": 2400.0
    }}
  ],
  "totale_medio": 4500.0,
  "cpa": 180.0,
  "iva": 1029.6,
  "totale_lordo": 5709.6,
  "spiegazione": "Breve nota esplicativa sui calcoli applicati, riduzione/aumento medio, spese generali 15% (max 300 caratteri)"
}}

Assicurati che i valori numerici siano coerenti (IVA = 22% su (totale_medio + CPA 4%), CPA = 4% su totale_medio, totale_lordo = totale_medio + CPA + IVA).
Rispondi solo con il JSON.
"""

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=2000,
            response_mime_type="application/json",
        )
    )

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        result = parse_json_robustly(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore preventivo onorari: {str(e)}")

    return FeeResponse(**result)


# ─── Health check ──────────────────────────────────────────────────────────────

@router.get("/status")
async def lawyer_status():
    return {"status": "ok", "module": "lawyer", "features": ["draft", "analyze-contract", "deadlines", "faq", "research", "fee-estimator"]}

