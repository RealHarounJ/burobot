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
    # Tronca il testo e rimuovi caratteri problematici per il JSON
    safe_text = text[:3000].replace('\x00', '').replace('\r', ' ')
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
        model_name="gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=2048,
            response_mime_type="application/json",
        )
    )

    response = await asyncio.to_thread(model.generate_content, prompt)
    raw = response.text.strip()

    # Rimuovi eventuali markdown code blocks
    if "```" in raw:
        import re
        match = re.search(r'```(?:json)?\s*({.*?})\s*```', raw, re.DOTALL)
        if match:
            raw = match.group(1)
    raw = raw.strip()

    # Strategia 1: parse diretto
    try:
        return json.loads(raw)
    except Exception:
        pass

    # Strategia 2: estrai il primo oggetto JSON valido con regex
    try:
        import re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass

    # Strategia 3: sanitizza i newline dentro le stringhe
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
    except Exception:
        pass

    # Strategia 4: chiedi a Gemini un JSON piu semplice come fallback
    try:
        fallback_prompt = f"""Analizza brevemente questo documento italiano e rispondi con JSON.
{text[:1000]}
JSON: {{"tipo_documento":"?","spiegazione":"?","scadenza":null,"importo":null,"azioni":["Leggi il documento"],"urgenza":"media","genera_risposta":false}}"""
        fallback_model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config=genai.GenerationConfig(
                temperature=0,
                max_output_tokens=512,
                response_mime_type="application/json",
            )
        )
        fb_resp = await asyncio.to_thread(fallback_model.generate_content, fallback_prompt)
        return json.loads(fb_resp.text.strip())
    except Exception as final_err:
        raise ValueError(f"Impossibile analizzare la risposta AI. Errore finale: {final_err}")


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
        model_name="gemini-2.5-flash",
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
        model_name="gemini-2.5-flash",
        generation_config=genai.GenerationConfig(temperature=0.3, max_output_tokens=1000)
    )

    response = await asyncio.to_thread(model.generate_content, prompt)
    return response.text
