# 🤖 BuroBot — AI Anti-Burocrazia Italiana

> Carica un documento burocratico italiano. BuroBot lo spiega in 5 secondi e genera la risposta al posto tuo.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Cos'è BuroBot

BuroBot è un SaaS web che usa **GPT-4o mini + RAG** per:
1. **Capire** documenti italiani (INPS, Agenzia Entrate, ISEE, contratti...)
2. **Spiegare** in linguaggio semplice cosa significano e cosa fare
3. **Generare** automaticamente lettere di risposta e ricorsi

**Target:** privati, PMI, commercialisti, CAF

---

## 🏗️ Stack Tecnico

| Layer | Tecnologia |
|---|---|
| Frontend | Next.js 14 + TailwindCSS |
| Backend | FastAPI (Python) |
| AI | GPT-4o mini + LlamaIndex RAG |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth |
| Pagamenti | Stripe |
| Deploy | Vercel (FE) + Railway (BE) |

---

## 🚀 Setup Locale

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Compila le variabili in .env
uvicorn main:app --reload
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Compila le variabili in .env.local
npm run dev
```

### 3. Database Supabase

1. Crea un progetto su [supabase.com](https://supabase.com)
2. Vai in **SQL Editor**
3. Esegui `docs/supabase_schema.sql`

### 4. Stripe

1. Crea un account su [stripe.com](https://stripe.com)
2. Crea 3 prodotti con prezzi ricorrenti mensili:
   - BuroBot Base: €9.99/mese
   - BuroBot PMI: €49/mese  
   - BuroBot Studio: €199/mese
3. Copia i `price_id` nel `.env`
4. Configura il webhook: `POST /api/billing/webhook`

---

## 💰 Modello di Business

| Piano | Prezzo | Documenti/mese |
|---|---|---|
| **Free** | €0 | 3 |
| **Base** | €9.99/mese | Illimitati |
| **PMI** | €49/mese | Illimitati + multi-utente |
| **Studio** | €199/mese | Illimitati + white-label |

---

## 📁 Struttura Progetto

```
burobot/
├── backend/              # FastAPI API
│   ├── main.py
│   ├── routers/
│   │   ├── documents.py  # Upload + analisi documenti
│   │   ├── ai.py         # Endpoint AI diretto
│   │   └── billing.py    # Stripe
│   ├── services/
│   │   ├── ai_service.py # GPT-4o + RAG
│   │   └── ocr_service.py # Estrazione testo
│   └── knowledge_base/   # Documenti normativi italiani
│
├── frontend/             # Next.js app
│   ├── app/
│   │   ├── page.tsx      # Landing page
│   │   ├── dashboard/    # Area utente
│   │   └── pricing/      # Prezzi
│   └── components/
│
└── docs/
    └── supabase_schema.sql
```

---

## 🗺️ Roadmap

- [x] Backend FastAPI core
- [x] Integrazione GPT-4o mini
- [x] RAG pipeline con LlamaIndex
- [x] Sistema auth Supabase
- [x] Pagamenti Stripe
- [ ] Frontend landing page
- [ ] Dashboard utente
- [ ] Knowledge base normativa italiana
- [ ] Deploy production
- [ ] App mobile (PWA)

---

## 👤 Autore

Haroun Jaafar — UNIVPM, Finanza Aziendale + AI
