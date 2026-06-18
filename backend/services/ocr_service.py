"""
BuroBot — OCR Service
Estrae testo da immagini e PDF caricati dall'utente.
"""

import pytesseract
from PIL import Image
from pypdf import PdfReader
import io
import base64
from openai import AsyncOpenAI
import os

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Estrae testo da un'immagine usando GPT-4o Vision (più accurato di pytesseract).
    Fallback su pytesseract se necessario.
    """
    try:
        # Prima prova con GPT-4o Vision per massima accuratezza
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Estrai tutto il testo presente in questa immagine di un documento burocratico italiano. Mantieni la struttura originale. Rispondi SOLO con il testo estratto, nessun commento."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=2000
        )
        return response.choices[0].message.content
        
    except Exception:
        # Fallback: pytesseract locale
        try:
            image = Image.open(io.BytesIO(image_bytes))
            text = pytesseract.image_to_string(image, lang='ita')
            return text.strip()
        except Exception as e:
            raise ValueError(f"Impossibile estrarre testo dall'immagine: {e}")


async def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Estrae testo da un PDF. Gestisce sia PDF testuali che scansionati.
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text_parts = []
        
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text and page_text.strip():
                text_parts.append(page_text)
        
        if text_parts:
            return "\n\n".join(text_parts)
        
        # PDF scansionato: usa la prima pagina come immagine
        raise ValueError("PDF senza testo estraibile (PDF scansionato)")
        
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Errore lettura PDF: {e}")


async def extract_text(file_bytes: bytes, content_type: str) -> str:
    """
    Dispatcher principale per l'estrazione del testo.
    
    Args:
        file_bytes: Contenuto del file in bytes
        content_type: MIME type del file
    
    Returns:
        Testo estratto
    """
    if content_type in ["image/jpeg", "image/png", "image/webp", "image/heic"]:
        return await extract_text_from_image(file_bytes)
    elif content_type == "application/pdf":
        try:
            return await extract_text_from_pdf(file_bytes)
        except ValueError:
            # PDF scansionato: tratta come immagine
            return await extract_text_from_image(file_bytes)
    else:
        raise ValueError(f"Formato file non supportato: {content_type}")
