"""
BuroBot — AI Service
Gestisce le chiamate a GPT-4o mini e la pipeline RAG con LlamaIndex.
"""

from openai import AsyncOpenAI
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI as LlamaOpenAI
import os
from pathlib import Path

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Configura LlamaIndex con GPT-4o mini
Settings.llm = LlamaOpenAI(model="gpt-4o-mini", temperature=0.1)
Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
Settings.node_parser = SentenceSplitter(chunk_size=512, chunk_overlap=50)

# Cache dell'indice RAG (caricato una volta all'avvio)
_rag_index = None

KNOWLEDGE_BASE_PATH = Path(__file__).parent.parent / "knowledge_base"

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


async def analyze_document(text: str, document_type: str = "generico") -> dict:
    """
    Analizza un documento burocratico usando GPT-4o mini + RAG.
    
    Args:
        text: Testo estratto dal documento
        document_type: Tipo di documento (es. "inps", "agenzia_entrate", "isee")
    
    Returns:
        dict con spiegazione, azioni richieste, scadenza, urgenza
    """
    
    # Prova prima con RAG se disponibile
    rag_context = ""
    rag_index = get_rag_index()
    if rag_index:
        try:
            query_engine = rag_index.as_query_engine(similarity_top_k=3)
            rag_result = query_engine.query(
                f"Informazioni su documenti di tipo {document_type} e come rispondere"
            )
            rag_context = f"\n\nContesto normativo di riferimento:\n{rag_result}"
        except Exception:
            pass

    user_message = f"""Analizza questo documento burocratico italiano:

---DOCUMENTO---
{text[:4000]}  
---FINE DOCUMENTO---
{rag_context}

Fornisci la risposta in questo formato JSON:
{{
  "tipo_documento": "nome del tipo di documento identificato",
  "spiegazione": "spiegazione in linguaggio semplice (max 3 paragrafi)",
  "scadenza": "data scadenza o null se non presente",
  "importo": "importo in euro o null se non presente",
  "azioni": ["azione 1", "azione 2", "..."],
  "urgenza": "alta/media/bassa",
  "genera_risposta": true/false
}}"""

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message}
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=1500
    )

    import json
    result = json.loads(response.choices[0].message.content)
    return result


async def generate_response_letter(
    document_text: str,
    user_situation: str,
    response_type: str = "contestazione"
) -> str:
    """
    Genera una lettera di risposta/ricorso formale.
    
    Args:
        document_text: Testo del documento originale
        user_situation: Situazione specifica dell'utente
        response_type: Tipo di risposta (contestazione, pagamento, chiarimento)
    
    Returns:
        Testo della lettera formale
    """
    
    prompt = f"""Genera una lettera formale di {response_type} in risposta a questo documento:

DOCUMENTO ORIGINALE:
{document_text[:2000]}

SITUAZIONE DELL'UTENTE:
{user_situation}

La lettera deve essere:
- Formale e professionale
- In italiano corretto
- Con tutti gli elementi necessari (oggetto, mittente placeholder, data, firma)
- Chiara e concisa
- Efficace legalmente"""

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Sei un esperto legale italiano specializzato in diritto amministrativo e tributario. Scrivi lettere formali efficaci."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        max_tokens=2000
    )

    return response.choices[0].message.content
