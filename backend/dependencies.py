"""
BuroBot — Dependencies condivise
Centralizza get_current_user per evitare duplicazioni tra router.
"""

from fastapi import HTTPException, Header
from supabase import create_client
import os

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()


async def get_current_user(authorization: str = Header(None)):
    """Verifica il JWT Supabase e restituisce l'utente autenticato."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token di autenticazione mancante")
    token = authorization.split(" ")[1]
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    try:
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Token non valido o scaduto")
        return user.user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Autenticazione fallita")
