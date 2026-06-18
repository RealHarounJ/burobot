"""
BuroBot — OCR Service (Google Gemini Vision)
Estrae testo da immagini e PDF usando Gemini Vision come motore principale.
"""

import google.generativeai as genai
from PIL import Image
from pypdf import PdfReader
import io
import base64
import asyncio
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


async def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Estrae testo da un'immagine usando Gemini Vision.
    Fallback su pytesseract se Gemini non disponibile.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))

        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = (
            "Estrai tutto il testo presente in questa immagine di un documento burocratico italiano. "
            "Mantieni la struttura originale con a capo e spazi. "
            "Rispondi SOLO con il testo estratto, nessun commento."
        )

        response = await asyncio.to_thread(model.generate_content, [prompt, image])
        text = response.text.strip()

        if not text:
            raise ValueError("Nessun testo estratto da Gemini Vision")

        return text

    except Exception as gemini_error:
        # Fallback: pytesseract locale
        try:
            import pytesseract
            image = Image.open(io.BytesIO(image_bytes))
            text = pytesseract.image_to_string(image, lang="ita")
            return text.strip()
        except Exception as tess_error:
            raise ValueError(
                f"Impossibile estrarre testo. Gemini: {gemini_error}. "
                f"pytesseract: {tess_error}"
            )


async def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Estrae testo da un PDF.
    - PDF testuale: estrazione diretta con pypdf
    - PDF scansionato: converte pagine in immagini e usa Gemini Vision
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text_parts = []

        for page in reader.pages:
            page_text = page.extract_text()
            if page_text and page_text.strip():
                text_parts.append(page_text.strip())

        if text_parts:
            combined = "\n\n".join(text_parts)
            if len(combined.strip()) > 50:
                return combined

        # PDF senza testo estraibile (scansionato) → converte in immagini
        return await _extract_from_scanned_pdf(pdf_bytes)

    except Exception as e:
        raise ValueError(f"Errore lettura PDF: {e}")


async def _extract_from_scanned_pdf(pdf_bytes: bytes) -> str:
    """Converte le pagine di un PDF in immagini e usa Gemini Vision."""
    try:
        import fitz  # pymupdf
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        texts = []

        for page_num in range(min(len(doc), 5)):  # Max 5 pagine
            page = doc[page_num]
            pix = page.get_pixmap(dpi=200)
            img_bytes = pix.tobytes("png")
            page_text = await extract_text_from_image(img_bytes)
            if page_text:
                texts.append(page_text)

        doc.close()
        return "\n\n".join(texts)

    except ImportError:
        # pymupdf non disponibile: usa solo la prima pagina come fallback grezzo
        raise ValueError(
            "PDF scansionato rilevato. Installa pymupdf per supporto completo: "
            "pip install pymupdf"
        )


async def extract_text(file_bytes: bytes, content_type: str) -> str:
    """
    Dispatcher principale per l'estrazione del testo.
    """
    IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}

    if content_type in IMAGE_TYPES:
        return await extract_text_from_image(file_bytes)
    elif content_type == "application/pdf":
        return await extract_text_from_pdf(file_bytes)
    else:
        raise ValueError(f"Formato file non supportato: {content_type}")
