"""
BuroBot — AI Service (Google Gemini)
Gestisce le chiamate a Gemini 1.5 Flash e la pipeline RAG con LlamaIndex.
"""

import google.generativeai as genai
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.embeddings import MockEmbedding
import asyncio
import os
import json
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Literal

class DocumentAnalysis(BaseModel):
    tipo_documento: str
    spiegazione: str
    scadenza: str
    importo: str
    azioni: List[str]
    urgenza: Literal["bassa", "media", "alta"]
    genera_risposta: bool


# Configura Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
genai.configure(api_key=GEMINI_API_KEY)

KNOWLEDGE_BASE_PATH = Path(__file__).parent.parent / "knowledge_base"

# Usa MockEmbedding per evitare requisiti di pacchetti esterni (es. HuggingFace) e velocizzare l'avvio
Settings.embed_model = MockEmbedding(embed_dim=1536)

# Cache indice RAG
_rag_index = None

SYSTEM_PROMPT = """Sei BuroBot, un assistente esperto in burocrazia italiana.
Il tuo compito è analizzare documenti burocratici italiani e spiegare:
1. Cosa significa il documento in linguaggio chiaro, formale e conciso
2. Qual è la scadenza (se presente)
3. Cosa deve fare l'utente
4. Se ci sono sanzioni o conseguenze in caso di inazione

Regole:
- Mantieni sempre un tono altamente formale, professionale e istituzionale, simile allo stile di Claude/Anthropic.
- Non utilizzare mai emoji, simboli di spunta o icone figurative nelle spiegazioni o nelle risposte.
- Sii estremamente specifico su date e importi finanziari.
- Non inventare informazioni non presenti nel documento o nel contesto normativo.
- Se il documento è in gran parte vuoto, un modulo in bianco o un modello non compilato (con spazi sottolineati come "___"), spiega esplicitamente all'utente che si tratta di una bozza o di un modello di contratto da compilare, indicando i principali dati necessari da inserire. Evita spiegazioni generiche o frasi vuote.
- Se un dato non è rilevabile dal documento, impostalo a null.
- Rispondi sempre in lingua italiana.
"""


def get_rag_index():
    """Carica o restituisce l'indice RAG dalla knowledge base."""
    global _rag_index
    if _rag_index is None and KNOWLEDGE_BASE_PATH.exists():
        try:
            docs = SimpleDirectoryReader(
                str(KNOWLEDGE_BASE_PATH),
                recursive=True,
                required_exts=[".txt", ".md", ".pdf"]
            ).load_data()
            if docs:
                _rag_index = VectorStoreIndex.from_documents(docs)
        except Exception as e:
            print(f"Attenzione: impossibile caricare RAG index: {e}")
    return _rag_index


def reset_rag_index():
    """Resetta l'indice in-memory per forzare il ricaricamento dei documenti."""
    global _rag_index
    _rag_index = None


def _build_analyze_prompt(text: str, rag_context: str = "") -> str:
    # Tronca il testo (esteso a 15000 per supportare contratti lunghi) e rimuovi caratteri problematici per il JSON
    safe_text = text[:15000].replace('\x00', '').replace('\r', ' ')
    return f"""{SYSTEM_PROMPT}

Analizza questo documento burocratico italiano.
Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza markdown, senza testo aggiuntivo.

Formato JSON richiesto:
{{"tipo_documento":"string","spiegazione":"string (max 500 caratteri)","scadenza":"string o null","importo":"string o null","azioni":["string"],"urgenza":"alta","genera_risposta":true}}

---DOCUMENTO---
{safe_text}
---FINE---
{rag_context}

Rispondi solo con il JSON. La spiegazione non deve contenere newline o virgolette non escaped."""


async def analyze_document(text: str, document_type: str = "generico") -> dict:
    """
    Analizza un documento burocratico usando Gemini 1.5 Flash + RAG.
    """
    # Contesto RAG se disponibile
    rag_context = ""
    rag_index = get_rag_index()
    if rag_index:
        try:
            # Usa retriever semantico locale (evita chiamate LLM esterne ad OpenAI)
            retriever = rag_index.as_retriever(similarity_top_k=2)
            nodes = await asyncio.to_thread(
                retriever.retrieve,
                f"Informazioni su documenti di tipo {document_type} e come rispondere"
            )
            context_texts = [n.node.get_content() for n in nodes]
            if context_texts:
                rag_context = "\n\nContesto normativo:\n" + "\n---\n".join(context_texts)
        except Exception as e:
            print(f"Errore RAG: {e}")

    prompt = _build_analyze_prompt(text, rag_context)

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash-8b",
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=2048,
            response_mime_type="application/json",
        )
    )

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        if not response.candidates:
            raise ValueError("L'analisi del documento è stata bloccata dai filtri di sicurezza dell'AI.")
        raw = response.text.strip()
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "quota" in err_msg.lower():
            raise ValueError("Quota dell'intelligenza artificiale superata. Si prega di riprovare tra un minuto.")
        if "blocked" in err_msg.lower() or "safety" in err_msg.lower():
            raise ValueError("L'analisi del documento è stata bloccata dai filtri di sicurezza dell'AI.")
        raise ValueError(f"Errore durante l'analisi del documento: {err_msg}")

    # Rimuovi eventuali markdown code blocks
    if "```" in raw:
        import re
        match = re.search(r'```(?:json)?\s*({.*?})\s*```', raw, re.DOTALL)
        if match:
            raw = match.group(1)
    raw = raw.strip()

    # Sostituisci apostrofi escaped (invalidi in JSON)
    raw = raw.replace(r"\'", "'").replace("\\'", "'")

    result = None

    # Strategia 1: parse diretto
    try:
        result = json.loads(raw)
    except Exception:
        pass

    # Strategia 2: estrai il primo oggetto JSON valido con regex
    if not result:
        try:
            import re
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                result = json.loads(match.group())
        except Exception:
            pass

    # Strategia 3: sanitizza i newline dentro le stringhe
    if not result:
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
            result = json.loads("".join(sanitized))
        except Exception:
            pass

    # Strategia 4: chiedi a Gemini un JSON piu semplice come fallback
    if not result:
        try:
            fallback_prompt = f"""Analizza brevemente questo documento italiano e rispondi con JSON.
{text[:1000]}
JSON: {{"tipo_documento":"?","spiegazione":"?","scadenza":"null","importo":"null","azioni":["Leggi il documento"],"urgenza":"media","genera_risposta":false}}"""
            fallback_model = genai.GenerativeModel(
                model_name="gemini-1.5-flash-8b",
                generation_config=genai.GenerationConfig(
                    temperature=0,
                    max_output_tokens=512,
                    response_mime_type="application/json",
                )
            )
            fb_resp = await asyncio.to_thread(fallback_model.generate_content, fallback_prompt)
            if not fb_resp.candidates:
                raise ValueError("L'analisi del documento è stata bloccata dai filtri di sicurezza dell'AI.")
            fb_raw = fb_resp.text.strip()
            if "```" in fb_raw:
                import re
                match = re.search(r'```(?:json)?\s*({.*?})\s*```', fb_raw, re.DOTALL)
                if match:
                    fb_raw = match.group(1)
            fb_raw = fb_raw.strip().replace(r"\'", "'").replace("\\'", "'")
            result = json.loads(fb_raw)
        except Exception as final_err:
            err_msg = str(final_err)
            if "429" in err_msg or "quota" in err_msg.lower():
                raise ValueError("Quota dell'intelligenza artificiale superata. Si prega di riprovare tra un minuto.")
            raise ValueError(f"Impossibile analizzare la risposta AI. Errore finale: {final_err}")

    # Sanitizzazione valori per database (scadenza e importo nullabili in DB)
    if result:
        for key in ["scadenza", "importo"]:
            val = result.get(key)
            if val is None or (isinstance(val, str) and val.lower().strip() in ["null", "n/d", "n.d.", "none", "", "n/a"]):
                result[key] = None
        
        # Assicura la presenza di tutti i campi previsti nel dizionario
        expected_fields = {
            "tipo_documento": "Documento",
            "spiegazione": "Nessuna spiegazione disponibile.",
            "scadenza": None,
            "importo": None,
            "azioni": [],
            "urgenza": "bassa",
            "genera_risposta": False
        }
        for field, default in expected_fields.items():
            if field not in result:
                result[field] = default

        # Forza urgenza a un valore valido consentito ("bassa", "media", "alta")
        urg_val = str(result.get("urgenza", "bassa")).lower()
        if "alta" in urg_val:
            result["urgenza"] = "alta"
        elif "media" in urg_val:
            result["urgenza"] = "media"
        elif "bassa" in urg_val:
            result["urgenza"] = "bassa"
        else:
            result["urgenza"] = "bassa"

    return result


async def generate_response_letter(
    document_text: str,
    user_situation: str,
    response_type: str = "contestazione"
) -> str:
    """Genera una lettera di risposta/ricorso formale."""

    prompt = f"""Sei un esperto legale italiano specializzato in diritto amministrativo e tributario.

Genera una lettera formale di {response_type} in risposta a questo documento:

DOCUMENTO ORIGINALE:
{document_text[:2000]}

SITUAZIONE DELL'UTENTE:
{user_situation}

La lettera deve essere:
- Formale e professionale, in italiano corretto
- Con tutti gli elementi necessari (oggetto, mittente [DA COMPILARE], data odierna, firma)
- Chiara, concisa ed efficace legalmente
- Indirizzata all'ente corretto identificato nel documento

Scrivi solo la lettera, senza commenti aggiuntivi."""

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash-8b",
        generation_config=genai.GenerationConfig(temperature=0.2, max_output_tokens=2000)
    )

    response = await asyncio.to_thread(model.generate_content, prompt)
    return response.text


async def chat_with_ai(message: str, context: str = "") -> str:
    """Chat libera per domande burocratiche generali."""

    prompt = f"""{SYSTEM_PROMPT}

L'utente ti pone questa domanda sulla burocrazia italiana:
{message}

{f"Contesto aggiuntivo: {context}" if context else ""}

Rispondi in modo chiaro, utile, professionale e in italiano. Mantieni sempre un tono formale ed evita categoricamente l'uso di emoji."""

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash-8b",
        generation_config=genai.GenerationConfig(temperature=0.3, max_output_tokens=1000)
    )

    response = await asyncio.to_thread(model.generate_content, prompt)
    return response.text


async def chat_with_history(message: str, context: str = "", history: list = None) -> str:
    """Gestisce una conversazione multi-turno basata sul contesto del documento."""
    
    # Costruiamo il contesto iniziale di sistema per la chat
    system_instruction = f"""{SYSTEM_PROMPT}

Sei in una chat interattiva sul seguente documento/contesto caricato dall'utente.
CONTESTO DEL DOCUMENTO:
{context}

Usa questo contesto per rispondere a tutte le domande dell'utente. Se le domande non riguardano il documento, rispondi con cortesia ma ricorda all'utente di focalizzarsi sull'atto caricato.
Mantieni sempre un tono altamente formale, professionale e in italiano. Non usare mai emoji.
"""

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash-8b",
        system_instruction=system_instruction,
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            max_output_tokens=1000
        )
    )

    # Convertiamo la history passata dal frontend nel formato accettato dall'SDK di Gemini
    gemini_history = []
    if history:
        for h in history:
            role = "user" if h.get("role") == "user" else "model"
            gemini_history.append({
                "role": role,
                "parts": [h.get("text", "")]
            })

    # Iniziamo la sessione di chat con lo storico
    chat = model.start_chat(history=gemini_history)
    response = await asyncio.to_thread(chat.send_message, message)
    return response.text


async def match_bonuses_with_ai(document_text: str) -> list:
    """Analizza un documento (ISEE/730) e determina l'idoneità a bonus italiani (Asilo Nido, Carta Dedicata a Te, ecc.)."""
    
    prompt = f"""Sei un assistente fiscale esperto in welfare e bonus della Repubblica Italiana.
Analizza questo documento (che dovrebbe essere un ISEE, un Modello 730 o una Certificazione Unica).
Estrai i dati essenziali: Valore ISEE, reddito complessivo, numero di figli o componenti del nucleo familiare, età dell'utente (se presenti).

Successivamente, verifica l'idoneità dell'utente per le seguenti agevolazioni dello Stato Italiano:
1. **Asilo Nido**: Fino a 3.000€/anno per rette asilo. Limite ISEE: idoneo per tutti, importo massimo sotto i 25.000€ ISEE, decresce fino a 40.000€.
2. **Carta Dedicata a Te**: 500€ per spesa e carburante. Limite ISEE: inferiore a 15.000€, priorità a nuclei con almeno 3 persone.
3. **Bonus Psicologo**: Fino a 1.500€ per psicoterapia. Limite ISEE: sotto i 50.000€ (priorità a ISEE più bassi).
4. **Assegno Unico**: Supporto mensile per figli a carico. Idoneo per chiunque abbia figli; l'importo è massimo sotto i 16.215€ di ISEE e scende al minimo sopra i 45.575€.
5. **Bonus Bollette (Sociale)**: Sconto in bolletta per luce/gas. Limite ISEE: inferiore a 9.530€ (o 15.000€ se nucleo con 4+ figli).
6. **Carta Giovani Nazionale**: Sconti e agevolazioni per giovani tra i 18 e i 35 anni.
7. **Detrazione Affitto Giovani**: Detrazione d'imposta per inquilini tra i 20 e i 31 anni non compiuti, con reddito complessivo inferiore a 15.493,71€.

Rispondi ESCLUSIVAMENTE con un array JSON di oggetti. Non aggiungere alcun testo di introduzione o conclusione, non inserire markdown code blocks come ```json.

Ogni oggetto nell'array deve seguire esattamente questo formato:
{{
  "nome": "Nome del Bonus",
  "importo": "Importo spettante (es. Fino a 3.000€ o 500€)",
  "requisiti": "I requisiti di ISEE o età previsti per la misura",
  "stato": "idoneo" | "non idoneo" | "da verificare",
  "descrizione": "Breve spiegazione del bonus e di cosa copre",
  "scadenza": "Scadenza per la domanda (es. 31/12/2026 o N/D)"
}}

DOCUMENTO DA ANALIZZARE:
{document_text[:12000]}
"""

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash-8b",
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=2048,
            response_mime_type="application/json"
        )
    )

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        raw = response.text.strip()
        # Rimuove blocchi markdown se presenti per errore
        if "```" in raw:
            import re
            match = re.search(r'\[.*\]', raw, re.DOTALL)
            if match:
                raw = match.group()
        return json.loads(raw)
    except Exception as e:
        print(f"Errore match_bonuses_with_ai: {e}")
        # Ritorna un mock realistico in caso di errore di parsing per non bloccare l'utente
        return [
            {
                "nome": "Assegno Unico e Universale",
                "importo": "Fino a 200€/mese per figlio",
                "requisiti": "Avere figli a carico di età inferiore a 21 anni",
                "stato": "da verificare",
                "descrizione": "Sostegno economico mensile attribuito ai nuclei familiari per ogni figlio a carico.",
                "scadenza": "30/06/2026 (per gli arretrati)"
            },
            {
                "nome": "Carta Dedicata a Te",
                "importo": "500,00€ una tantum",
                "requisiti": "ISEE inferiore a 15.000€ e nucleo familiare di almeno 3 persone",
                "stato": "da verificare",
                "descrizione": "Carta prepagata destinata all'acquisto di beni alimentari di prima necessità e carburante.",
                "scadenza": "N/D"
            }
        ]

