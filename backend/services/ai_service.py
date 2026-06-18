"""
BuroBot — AI Service (Google Gemini)
Gestisce le chiamate a Gemini 1.5 Flash e la pipeline RAG con LlamaIndex.
"""

import google.generativeai as genai
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings
from llama_index.core.node_parser import SentenceSplitter
import asyncio
import os
import json
from pathlib import Path

# Configura Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

KNOWLEDGE_BASE_PATH = Path(__file__).parent.parent / "knowledge_base"

# Cache indice RAG
_rag_index = None

SYSTEM_PROMPT = """Sei BuroBot, un assistente esperto in burocrazia italiana.
Il tuo compito è analizzare documenti burocratici italiani e spiegare:
1. Cosa significa il documento in linguaggio semplice e chiaro
2. Qual è la scadenza (se presente)
3. Cosa deve fare l'utente
4. Se ci sono sanzioni o conseguenze in caso di inazione

Regole:
- Usa un linguaggio semplice, come se parlassi con una persona anziana
- Sii specifico sulle date e gli importi
- Non inventare informazioni non presenti nel documento
- Se non sei sicuro, dillo chiaramente
- Rispondi SEMPRE in italiano
- Usa emoji per rendere la risposta più leggibile
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


def _build_analyze_prompt(text: str, rag_context: str = "") -> str:
    return f"""{SYSTEM_PROMPT}

Analizza questo documento burocratico italiano e rispondi SOLO con un JSON valido nel seguente formato:
{{
  "tipo_documento": "nome del tipo di documento identificato",
  "spiegazione": "spiegazione in linguaggio semplice (max 3 paragrafi)",
  "scadenza": "data scadenza o null se non presente",
  "importo": "importo in euro o null se non presente",
  "azioni": ["azione 1", "azione 2"],
  "urgenza": "alta|media|bassa",
  "genera_risposta": true
}}

---DOCUMENTO---
{text[:4000]}
---FINE DOCUMENTO---
{rag_context}

Rispondi SOLO con il JSON, nessun testo aggiuntivo."""


async def analyze_document(text: str, document_type: str = "generico") -> dict:
    """
    Analizza un documento burocratico usando Gemini 1.5 Flash + RAG.
    """
    # Contesto RAG se disponibile
    rag_context = ""
    rag_index = get_rag_index()
    if rag_index:
        try:
            query_engine = rag_index.as_query_engine(similarity_top_k=3)
            rag_result = await asyncio.to_thread(
                query_engine.query,
                f"Informazioni su documenti di tipo {document_type} e come rispondere"
            )
            rag_context = f"\n\nContesto normativo:\n{rag_result}"
        except Exception:
            pass

    prompt = _build_analyze_prompt(text, rag_context)

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=1500,
        )
    )

    response = await asyncio.to_thread(model.generate_content, prompt)
    raw = response.text.strip()

    # Pulisci eventuali markdown code blocks
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)


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
        model_name="gemini-1.5-flash",
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

Rispondi in modo chiaro, utile e in italiano. Usa emoji per rendere la risposta più leggibile."""

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config=genai.GenerationConfig(temperature=0.3, max_output_tokens=1000)
    )

    response = await asyncio.to_thread(model.generate_content, prompt)
    return response.text
