# Manuale Tecnico BuroBot — Piattaforma AI All-in-One

Benvenuto nel manuale tecnico ufficiale di **BuroBot**. Questa guida descrive in modo esaustivo l'architettura, le tecnologie utilizzate, la struttura del codice, i flussi operativi ed i passaggi di configurazione necessari per manutenere o rilasciare la piattaforma.

---

## 1. Architettura di Sistema

BuroBot adotta un'architettura disaccoppiata moderna, strutturata in tre livelli principali:

```
[Frontend: Next.js / Vercel] ──> Richieste REST / Auth ──> [Backend: FastAPI / Railway]
     │                                                          │
     ├── Auth & Query Dirette ──> [Database: Supabase] <────────┤ Query Service Role
     │                                  │                       │
     │                                  ▼                       ├── Analisi & OCR (Gemini)
     │                           Profiles, Documents,           ├── Sessioni & Portale (Stripe)
     │                           Invitations                    └── Inviti Email (Resend)
```

### Stack Tecnologico Core:
1. **Frontend**: Next.js 16 (App Router, TypeScript, Vanilla CSS ad alte prestazioni).
2. **Backend**: FastAPI (Python 3.13, Pydantic, Uvicorn, PyPDF2/Pillow per la gestione dei file).
3. **Database & Auth**: Supabase (PostgreSQL con Row Level Security abilitata, storage per file e gestione token JWT).
4. **Modello AI**: Google Gemini 2.5 Flash (`gemini-2.5-flash`) utilizzato sia per la chat sia come motore Vision OCR.
5. **Pagamenti**: Stripe SDK (Integrazione abbonamenti ricorrenti, Webhooks e Portale Clienti self-service).
6. **Email transazionali**: Resend API (Invio inviti tramite e-mail HTML per la gestione collaboratori).

---

## 2. Struttura del Database (Supabase)

Il database si basa su tre tabelle principali collegate alla tabella nativa di autenticazione di Supabase (`auth.users`), protette da politiche RLS (Row Level Security):

### Tabella `public.profiles`
Estende i dati dell'utente loggato. Memorizza il piano attivo, i dettagli di fatturazione e l'eventuale appartenenza a un team:
*   `id` (uuid, primary key): Riferimento a `auth.users.id`.
*   `email` (text): Indirizzo e-mail dell'utente.
*   `full_name` (text): Nome completo.
*   `plan` (text): Livello di abbonamento (`free`, `base`, `pmi`, `studio`).
*   `stripe_customer_id` (text): ID del cliente salvato su Stripe.
*   `team_owner_id` (uuid): Riferimento all'ID dell'utente proprietario del team (se l'utente è un collaboratore associato).

### Tabella `public.documents`
Memorizza i file analizzati dall'utente ed il JSON strutturato restituito da Gemini:
*   `id` (uuid, primary key): Generato casualmente.
*   `user_id` (uuid): Riferimento a `profiles.id`.
*   `file_name` (text): Nome originale del file caricato.
*   `document_type` (text): Tipo identificato (es. Multa, ISEE, Bolletta).
*   `original_text` (text): Testo estratto tramite OCR (fino a 5000 caratteri).
*   `analysis` (jsonb): Contiene i campi strutturati:
    *   `tipo_documento`
    *   `spiegazione` (linguaggio semplice)
    *   `scadenza`
    *   `importo`
    *   `azioni` (lista di consigli)
    *   `urgenza` (`alta`, `media`, `bassa`)
    *   `pagato` / `pec_inviata` (simulazioni)

### Tabella `public.team_invitations`
Gestisce gli inviti in attesa inviati via e-mail:
*   `id` (uuid, primary key): Identificativo dell'invito.
*   `team_owner_id` (uuid): ID del proprietario che ha inviato l'invito.
*   `email` (text): E-mail del collaboratore invitato.
*   `role` (text): Ruolo assegnato (`collaboratore`, `amministratore`).

---

## 3. Dettaglio Componenti Backend (FastAPI)

Il backend è organizzato in router modulari sotto `backend/routers` e servizi sotto `backend/services`:

*   `main.py`: Configura l'applicazione FastAPI, abilita il middleware CORS (con restrizioni per i domini di produzione e localhost), gestisce gli errori globali ed include i tre router principali.
*   `dependencies.py`: Estrae il token JWT dall'header `Authorization`, lo decodifica e valida tramite Supabase Auth, estraendo le info dell'utente corrente.

### `routers/documents.py`
Gestisce tutto ciò che riguarda i file caricati dall'utente:
*   `POST /analyze`: Riceve un file (PDF o Immagine), esegue l'estrazione del testo via OCR (Gemini Vision) ed avvia l'analisi semantica dell'atto strutturandola in JSON. Salva il documento nel database. **Senza limiti mensili** (tutti gli utenti possono analizzare file illimitatamente).
*   `POST /generate-response`: Genera una lettera formale di contestazione o ricorso basata sulla situazione spiegata dall'utente. **Protetto**: Richiede abbonamento Pro (`plan != 'free'`).
*   `POST /match-bonuses`: Analizza l'ISEE o dichiarazione dei redditi dell'utente ed esegue il matching semantico con i bonus statali idonei.
*   `POST /simulate-pagopa` & `POST /send-pec`: Registrano ed aggiornano lo stato dei pagamenti e degli invii simulati nel JSON dell'analisi.

### `routers/billing.py`
Integra i flussi finanziari di Stripe e la gestione del team:
*   `POST /create-checkout`: Crea e restituisce l'URL di una sessione di pagamento Stripe Subscription (per attivare il piano Pro a 4.99€/mese).
*   `POST /create-portal`: Genera l'URL di reindirizzamento al portale clienti self-service di Stripe per disdire o aggiornare l'abbonamento.
*   `POST /webhook`: Ascolta le notifiche asincrone di Stripe (es. pagamento completato, abbonamento annullato) ed aggiorna in tempo reale il campo `plan` all'interno del database Supabase.
*   `POST /team/invite`: Inserisce l'invito in `team_invitations` e invia un'e-mail reale tramite l'API di **Resend** contenente il link di onboarding.
*   `POST /team/accept-invite`: Associa l'utente corrente al team del proprietario impostando il campo `team_owner_id`.

### `services/ai_service.py`
Interfaccia diretta con le API di Gemini (`gemini-2.5-flash`):
*   `analyze_document()`: Prompting di sistema ad hoc per estrarre informazioni burocratiche in formato JSON, con fallback automatico e sanificazione dei tag JSON in caso di formattazioni imperfette.
*   `chat_with_history()`: Sfrutta le sessioni di chat multi-turno native di Gemini per mantenere il contesto delle domande fatte dall'utente sul documento analizzato.

### `services/ocr_service.py`
*   `extract_text()`: Prepara l'immagine o il file PDF e lo trasmette a Gemini Vision con un prompt focalizzato sull'estrazione letterale del testo preservando la struttura spaziale.

---

## 4. Dettaglio Componenti Frontend (Next.js)

Il frontend sfrutta le potenzialità di Next.js App Router per una navigazione ultra-veloce:

*   `lib/supabase.ts`: Inizializza il client Supabase lato client.
*   `lib/api.ts`: Centralizza tutte le chiamate HTTP verso il backend, iniettando automaticamente l'access token JWT di Supabase per l'autenticazione delle rotte protette.

### `app/dashboard/page.tsx`
È il cuore pulsante dell'applicazione. Implementa:
1.  **Layout responsive a schede**:
    *   *Analisi*: Upload del documento, riepilogo dati (scadenza, importi), azioni consigliate, e simulazioni (PagoPA, PEC).
    *   *Contratti*: Caricamento e controllo dei contratti (gated per utenti Pro).
    *   *Team*: Gestione dei collaboratori (aggiunta e rimozione membri reali, gated per utenti Pro).
    *   *Welfare*: Caricamento ISEE ed elenco bonus compatibili.
2.  **AI Copilot Sidebar**: Pannello collassabile a destra che gestisce la chat in tempo reale sul documento.
3.  **Modalità Facile**: Toggle che aumenta le dimensioni dei font e semplifica i testi per favorire l'accessibilità da parte di anziani o persone con difficoltà visive.
4.  **Esportazione PDF**: Generazione dinamica lato client di un documento PDF riepilogativo tramite la libreria `jsPDF` (gated per utenti Pro).

---

## 5. Variabili d'Ambiente Richieste (.env)

Per consentire il funzionamento dei servizi, configurare le seguenti variabili negli ambienti di produzione:

### Backend (.env su Railway)
```env
# API Key per Google AI Studio (Gemini)
GEMINI_API_KEY=chiave_gemini_qui

# Connessione a Supabase
SUPABASE_URL=https://tuo-progetto.supabase.co
SUPABASE_SERVICE_KEY=chiave_segreta_service_role_di_supabase

# Chiavi Stripe
STRIPE_SECRET_KEY=sk_live_... o sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (ottenuto dai webhook di Stripe)
STRIPE_PRICE_BASE=price_... (ID prezzo del piano Pro a 4.99€/mese)

# Email transazionali (Resend)
RESEND_API_KEY=re_... (ottenuto dalla dashboard di Resend)

# URL del Frontend per i redirect
FRONTEND_URL=https://tuo-sito.vercel.app
```

### Frontend (.env.local su Vercel)
```env
# Chiavi Pubbliche di Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tuo-progetto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=chiave_anon_pubblica_di_supabase
```

---

## 6. Flussi Logici Chiave

### 1. Registrazione tramite Invito Team
```
[Link Email] -> /register?invite=ID_INVITO&email=COLLABORATORE_EMAIL
   │
   ├──> Input Email bloccato e pre-compilato
   │
   ├──> Registrazione completata su Supabase
   │
   ├──> Chiamata automatica a POST /team/accept-invite
   │
   └──> Associazione team_owner_id & Rimozione dell'invito
```

### 2. Sblocco Funzionalità Pro (Stripe Webhook)
```
[Pulsante Pricing] -> Richiesta checkout session -> Pagamento su Stripe
   │
   ├──> Stripe invia evento "checkout.session.completed" al nostro Webhook
   │
   ├──> Backend FastAPI valida la firma del Webhook
   │
   ├──> Backend aggiorna il piano dell'utente a 'base' (Pro) nel DB profiles
   │
   └──> Il Frontend rileva la modifica e sblocca Lettere, PDF e Team
```
