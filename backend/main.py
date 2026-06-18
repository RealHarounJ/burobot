"""
BuroBot — FastAPI Backend
Entry point principale dell'applicazione.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routers import documents, ai, billing

app = FastAPI(
    title="BuroBot API",
    description="AI-powered Italian bureaucracy assistant",
    version="1.0.0"
)

# CORS — consenti richieste dal frontend Next.js
origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url.rstrip("/"))
origins.extend(["https://burobot.it", "https://www.burobot.it"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra i router
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])


@app.get("/")
async def root():
    return {"status": "ok", "service": "BuroBot API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
