"use client";

import { useState } from "react";
import Link from "next/link";

const features = [
  {
    title: "Qualsiasi documento",
    desc: "INPS, Agenzia Entrate, ISEE, cartelle esattoriali, contratti, lettere legali. BuroBot capisce tutto.",
  },
  {
    title: "Risposta in 5 secondi",
    desc: "Carica una foto o un PDF. In pochi secondi sai esattamente cosa significa e cosa fare.",
  },
  {
    title: "Genera la risposta",
    desc: "Hai torto o ragione? BuroBot scrive al posto tuo la lettera di risposta o il ricorso formale.",
  },
  {
    title: "100% privato",
    desc: "I tuoi documenti non vengono mai condivisi. Elaborazione sicura e crittografata.",
  },
  {
    title: "Scadenze chiare",
    desc: "Mai perdere una scadenza. BuroBot evidenzia sempre le date limite e le conseguenze.",
  },
  {
    title: "Solo italiano",
    desc: "Addestrato sulla normativa italiana aggiornata. Conosce INPS, MEF, AdE meglio di un CAF.",
  },
];

const docTypesGuide = [
  {
    id: "cartelle",
    category: "Cartelle & Accertamenti",
    formats: "PDF, JPG, PNG, WEBP",
    problem: "Linguaggio giuridico ostile e volutamente complesso, sanzioni nascoste che raddoppiano e date di scadenza di 60 giorni che decorrono in modo non trasparente.",
    solution: "Rileva gli importi effettivi dovuti, calcola la scadenza reale a partire dalla notifica e compila istanze di autotutela o bozze di ricorso.",
    mockup: {
      document_type: "Cartella di Pagamento (AdE Riscossione)",
      urgenza: "alta",
      scadenza: "Entro 60gg dalla notifica",
      importo: "€1.432,50",
      spiegazione: "Si tratta di una cartella esattoriale relativa a tasse non pagate nel 2023. Comprende sanzioni e interessi di mora aggiuntivi che possono essere contestati se non hai ricevuto prima l'avviso bonario.",
      azioni: [
        "Verifica se la cartella ti è stata notificata regolarmente via PEC.",
        "Se non hai mai ricevuto l'atto originario, puoi presentare ricorso.",
        "Se l'importo è corretto, richiedi la rateizzazione fino a 72 rate."
      ]
    }
  },
  {
    id: "inps",
    category: "Comunicazioni INPS",
    formats: "PDF, JPG, PNG, WEBP",
    problem: "Lettere complesse che richiedono la restituzione di somme erogate (es. indebiti pensionistici o ricalcoli ISEE) senza spiegare chiaramente il motivo.",
    solution: "Verifica se l'errore è imputabile all'INPS (rendendo l'indebito insequestrabile e non restituibile per legge) e scrive la contestazione formale.",
    mockup: {
      document_type: "Notifica di Indebito Pensionistico",
      urgenza: "media",
      scadenza: "Entro 30gg per opposizione",
      importo: "€2.800,00",
      spiegazione: "L'INPS richiede la restituzione di somme erogate in eccedenza sulla pensione. La legge italiana stabilisce che se l'errore è dell'INPS e tu eri in buona fede, le somme non vanno restituite.",
      azioni: [
        "Controlla se hai comunicato correttamente tutti i tuoi redditi nei modelli RED.",
        "Genera la lettera di contestazione formale basata sulla normativa della sanatoria INPS.",
        "Invia la diffida tramite raccomandata A/R o PEC."
      ]
    }
  },
  {
    id: "multe",
    category: "Multe & Verbali",
    formats: "PDF, JPG, PNG, WEBP",
    problem: "Tempi strettissimi: solo 5 giorni per lo sconto del 30% e 60 giorni per il ricorso. Scritte minuscole e scarse informazioni sui vizi di forma rilevabili.",
    solution: "Calcola la scadenza esatta per pagare al minimo, evidenzia vizi formali comuni (es. taratura autovelox) e scrive l'istanza in autotutela.",
    mockup: {
      document_type: "Verbale CdS (Polizia Municipale)",
      urgenza: "alta",
      scadenza: "5gg sconto / 60gg ricorso",
      importo: "€168,00 (scontato €117,60)",
      spiegazione: "Verbale di contestazione per eccesso di velocità rilevato tramite autovelox. La notifica deve avvenire entro 90 giorni dall'infrazione, altrimenti il verbale è nullo.",
      azioni: [
        "Verifica che la data di notifica non superi i 90gg dal giorno della multa.",
        "Se il verbale non cita gli estremi del decreto di taratura dell'autovelox, puoi fare ricorso.",
        "Scegli se pagare ridotto o generare il ricorso per il Prefetto."
      ]
    }
  },
  {
    id: "contratti",
    category: "Contratti Civili",
    formats: "PDF",
    problem: "Clausole vessatorie scritte in piccolo, obbligo di rinnovo automatico tacito e penali sproporzionate in caso di recesso anticipato.",
    solution: "Scansiona il documento per evidenziare i vincoli temporali, le finestre di disdetta preventiva e segnala le clausole illegittime da far modificare.",
    mockup: {
      document_type: "Contratto di Locazione Abitativa",
      urgenza: "bassa",
      scadenza: "Disdetta 6 mesi prima",
      importo: null,
      spiegazione: "Contratto di affitto 4+4. BuroBot rileva una clausola vessatoria sulla manutenzione straordinaria a carico dell'inquilino, che per legge spetta invece al locatore.",
      azioni: [
        "Chiedi l'eliminazione della clausola vessatoria sulla manutenzione.",
        "Prendi nota del termine di 6 mesi per l'invio della raccomandata di disdetta.",
        "Registra il contratto all'Agenzia delle Entrate entro 30 giorni per evitare nullità."
      ]
    }
  },
  {
    id: "bollette",
    category: "Bollette & Conguagli",
    formats: "PDF, JPG, PNG, WEBP",
    problem: "Fatture con conguagli retroattivi esorbitanti risalenti a diversi anni fa o tariffe unilaterali modificate senza preavviso.",
    solution: "Evidenzia se le richieste di conguaglio sono cadute in prescrizione (che in Italia è di 2 anni per luce, gas e acqua) e genera il reclamo formale.",
    mockup: {
      document_type: "Fattura Conguaglio Gas (Servizio Elettrico)",
      urgenza: "media",
      scadenza: "Scadenza bolletta 28/06/2026",
      importo: "€874,20",
      spiegazione: "Conguaglio per consumi stimati dal 2023 al 2025. Per legge, i consumi più vecchi di 2 anni sono prescritti e non possono essere pretesi dal fornitore.",
      azioni: [
        "Eccepisci la prescrizione biennale per la quota di consumi risalente a più di 2 anni fa.",
        "Invia la richiesta di storno e ricalcolo della fattura tramite PEC.",
        "Non sospendere il pagamento della quota non prescritta per evitare il distacco."
      ]
    }
  }
];

const steps = [
  { n: "01", title: "Carica il documento", desc: "Scatta una foto o carica il PDF direttamente dall'app." },
  { n: "02", title: "BuroBot analizza", desc: "L'AI estrae il testo e lo analizza con la normativa italiana." },
  { n: "03", title: "Ricevi la spiegazione", desc: "Capisci cosa significa, cosa fare e quando farlo." },
  { n: "04", title: "Genera la risposta", desc: "Se serve, BuroBot scrive la lettera formale per te." },
];

const pricing = [
  {
    name: "Free",
    price: "€0",
    period: "/mese",
    desc: "Per provare BuroBot",
    features: ["3 documenti al mese", "Analisi AI base", "Spiegazione in linguaggio semplice"],
    cta: "Inizia gratis",
    href: "/register",
    featured: false,
  },
  {
    name: "Base",
    price: "€9.99",
    period: "/mese",
    desc: "Per privati e famiglie",
    features: ["Documenti illimitati", "Generazione lettere di risposta", "Storico documenti", "Priorità analisi"],
    cta: "Inizia ora",
    href: "/register?plan=base",
    featured: true,
  },
  {
    name: "PMI",
    price: "€49",
    period: "/mese",
    desc: "Per aziende e commercialisti",
    features: ["Tutto di Base", "Multi-utente (5 account)", "API access", "Dashboard analytics", "Supporto prioritario"],
    cta: "Per le aziende",
    href: "/register?plan=pmi",
    featured: false,
  },
];

export default function Home() {
  const [activeDocTab, setActiveDocTab] = useState("cartelle");
  return (
    <main style={{ minHeight: "100vh" }} className="hero-bg">

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "16px 40px",
        background: "#ffffff",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary)" }}>
          BuroBot
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link href="#pricing" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.95rem" }}>Prezzi</Link>
          <Link href="/login" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.95rem" }}>Accedi</Link>
          <Link href="/register" className="btn-primary" style={{ padding: "10px 20px", fontSize: "0.9rem" }}>
            Inizia gratis
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: "140px", paddingBottom: "100px", textAlign: "center", maxWidth: "900px", margin: "0 auto", padding: "140px 24px 100px" }}>
        <div className="badge" style={{ marginBottom: "24px" }}>
          Piattaforma per la burocrazia italiana
        </div>
        <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: "24px" }}>
          La burocrazia italiana{" "}
          <span className="gradient-text">spiegata in 5 secondi</span>
        </h1>
        <p style={{ fontSize: "1.25rem", color: "var(--text-muted)", maxWidth: "600px", margin: "0 auto 40px", lineHeight: 1.7 }}>
          Carica una foto del documento. BuroBot lo legge, lo spiega in linguaggio semplice
          e genera la risposta al posto tuo. Niente più CAF, niente più confusione.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" className="btn-primary" style={{ fontSize: "1.1rem", padding: "16px 32px" }}>
            Inizia gratis — è gratuito
          </Link>
          <Link href="#come-funziona" className="btn-secondary" style={{ fontSize: "1.1rem", padding: "16px 32px" }}>
            Come funziona
          </Link>
        </div>
        <p style={{ marginTop: "20px", color: "var(--text-dim)", fontSize: "0.9rem" }}>
          Nessuna carta di credito • 3 documenti gratis al mese
        </p>

        {/* Hero mockup */}
        <div className="glass-card animate-float" style={{
          maxWidth: "700px", margin: "60px auto 0",
          padding: "32px", textAlign: "left"
        }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#f59e0b" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e" }} />
          </div>
          <div style={{ background: "var(--bg-card-hover)", borderRadius: "12px", padding: "20px", marginBottom: "16px", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: "8px" }}>Comunicazione_INPS_36bis.pdf</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>L'Agenzia delle Entrate ha rilevato una differenza di €340...</p>
          </div>
          <div style={{ borderLeft: "3px solid var(--primary)", paddingLeft: "16px" }}>
            <p style={{ color: "var(--primary)", fontSize: "0.85rem", fontWeight: 600, marginBottom: "8px" }}>BuroBot:</p>
            <p style={{ color: "var(--text-main)", fontSize: "0.95rem", marginBottom: "12px" }}>
              Questa è una <strong>comunicazione di irregolarità (36-bis)</strong>. L'Agenzia ha trovato una differenza di <strong>€340</strong> nella tua dichiarazione.
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
              Scadenza: <strong>15 luglio</strong> per rispondere.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn-primary" style={{ padding: "10px 18px", fontSize: "0.85rem" }}>Paga con F24</button>
              <button className="btn-secondary" style={{ padding: "10px 18px", fontSize: "0.85rem" }}>Genera ricorso</button>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "80px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: "2.5rem", fontWeight: 800, marginBottom: "16px", color: "var(--text-main)" }}>
          Tutto quello che ti serve
        </h2>
        <p style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: "60px", fontSize: "1.1rem" }}>
          BuroBot gestisce qualsiasi documento burocratico italiano
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px", color: "var(--text-main)" }}>{f.title}</h3>
              <p style={{ color: "var(--text-muted)", lineHeight: 1.6, fontSize: "0.95rem" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DOCUMENT TYPES EXPLORER */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "80px 24px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ textAlign: "center", fontSize: "2.5rem", fontWeight: 800, marginBottom: "12px", color: "var(--text-main)" }}>
          Cosa puoi analizzare con BuroBot?
        </h2>
        <p style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: "40px", fontSize: "1.1rem", maxWidth: "600px", margin: "0 auto 40px" }}>
          BuroBot mira a risolvere problemi concreti causati da documenti scritti in linguaggio burocratico ostile. Seleziona una categoria per vedere come ti aiutiamo.
        </p>

        {/* Filter Tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "40px", flexWrap: "wrap" }}>
          {docTypesGuide.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveDocTab(item.id)}
              className={activeDocTab === item.id ? "btn-primary" : "btn-secondary"}
              style={{
                padding: "10px 18px",
                fontSize: "0.9rem",
                borderRadius: "var(--radius-md)",
                boxShadow: activeDocTab === item.id ? "0 4px 12px rgba(30, 58, 138, 0.1)" : "none"
              }}
            >
              {item.category}
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        {(() => {
          const selected = docTypesGuide.find(d => d.id === activeDocTab) || docTypesGuide[0];
          return (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "40px",
              alignItems: "stretch",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "36px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.02)"
            }}>
              {/* Left Column: Problem & Solution Explanation */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "24px" }}>
                <div>
                  <span className="badge" style={{ marginBottom: "12px" }}>
                    Formati: {selected.formats}
                  </span>
                  <h3 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "12px" }}>
                    {selected.category}
                  </h3>
                </div>

                {/* Il Problema (Red Alert Card style) */}
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fee2e2",
                  borderLeft: "4px solid var(--danger)",
                  borderRadius: "var(--radius-md)",
                  padding: "18px 20px"
                }}>
                  <h4 style={{ color: "var(--danger)", fontWeight: 700, fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                    Il Problema Burocratico
                  </h4>
                  <p style={{ color: "#991b1b", fontSize: "0.95rem", lineHeight: 1.6 }}>
                    {selected.problem}
                  </p>
                </div>

                {/* La Soluzione (Green Alert Card style) */}
                <div style={{
                  background: "#f0fdf4",
                  border: "1px solid #dcfce7",
                  borderLeft: "4px solid var(--success)",
                  borderRadius: "var(--radius-md)",
                  padding: "18px 20px"
                }}>
                  <h4 style={{ color: "var(--success)", fontWeight: 700, fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                    Come lo risolve BuroBot
                  </h4>
                  <p style={{ color: "#166534", fontSize: "0.95rem", lineHeight: 1.6 }}>
                    {selected.solution}
                  </p>
                </div>
              </div>

              {/* Right Column: Visual Mockup Simulation */}
              <div style={{
                background: "var(--bg-dark)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.01)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontFamily: "monospace" }}>Simulazione Analisi</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                  <div>
                    <span className="badge" style={{ fontSize: "0.75rem" }}>{selected.mockup.document_type}</span>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "6px", color: "var(--text-main)" }}>Documento_Esempio.pdf</h4>
                  </div>
                  <span className={`urgency-${selected.mockup.urgenza}`} style={{ textTransform: "capitalize" }}>
                    {selected.mockup.urgenza === "alta" ? "Alta" : selected.mockup.urgenza === "media" ? "Media" : "Bassa"}
                  </span>
                </div>

                {/* Meta details (amount / deadline) if they exist */}
                {(selected.mockup.scadenza || selected.mockup.importo) && (
                  <div style={{ display: "flex", gap: "10px" }}>
                    {selected.mockup.scadenza && (
                      <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-sm)", padding: "10px 14px", flex: 1 }}>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Scadenza Rilevata</span>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--warning)" }}>{selected.mockup.scadenza}</span>
                      </div>
                    )}
                    {selected.mockup.importo && (
                      <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius-sm)", padding: "10px 14px", flex: 1 }}>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Importo da Pagare</span>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--danger)" }}>{selected.mockup.importo}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h5 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: "6px" }}>Cosa significa</h5>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>{selected.mockup.spiegazione}</p>
                </div>

                <div>
                  <h5 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: "6px" }}>Azioni da intraprendere</h5>
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selected.mockup.azioni.map((azione, idx) => (
                      <li key={idx} style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "0.8rem", color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
                        <span style={{ color: "var(--primary)", fontWeight: 700 }}>{idx + 1}.</span>
                        <span>{azione}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* HOW IT WORKS */}
      <section id="come-funziona" style={{ maxWidth: "900px", margin: "0 auto", padding: "80px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: "2.5rem", fontWeight: 800, marginBottom: "60px" }}>
          Come funziona
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
              <div style={{
                minWidth: "56px", height: "56px", borderRadius: "16px",
                background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(167,139,250,0.2))",
                border: "1px solid rgba(99,102,241,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1rem", fontWeight: 800, color: "#a78bfa"
              }}>
                {s.n}
              </div>
              <div style={{ paddingTop: "8px" }}>
                <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "6px" }}>{s.title}</h3>
                <p style={{ color: "#6b7280", lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ maxWidth: "1100px", margin: "0 auto", padding: "80px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: "2.5rem", fontWeight: 800, marginBottom: "16px", color: "var(--text-main)" }}>
          Prezzi semplici e trasparenti
        </h2>
        <p style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: "60px", fontSize: "1.1rem" }}>
          Inizia gratis. Passa al piano pagante solo quando ne hai bisogno.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", alignItems: "center" }}>
          {pricing.map((p, i) => (
            <div key={i} className={`pricing-card ${p.featured ? "featured" : ""}`}>
              {p.featured && (
                <div className="badge" style={{ marginBottom: "16px", fontSize: "0.8rem" }}>Più popolare</div>
              )}
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-main)" }}>{p.name}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px" }}>{p.desc}</p>
              <div style={{ marginBottom: "28px" }}>
                <span style={{ fontSize: "2.8rem", fontWeight: 900, color: "var(--text-main)" }}>{p.price}</span>
                <span style={{ color: "var(--text-muted)" }}>{p.period}</span>
              </div>
              <ul style={{ listStyle: "none", marginBottom: "28px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {p.features.map((f, j) => (
                  <li key={j} style={{ display: "flex", gap: "10px", color: "var(--text-muted)", fontSize: "0.95rem" }}>
                    <span style={{ color: "var(--primary)" }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className={p.featured ? "btn-primary" : "btn-secondary"} style={{ width: "100%", justifyContent: "center" }}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINALE */}
      <section style={{ maxWidth: "700px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <div className="glass-card" style={{ padding: "60px 40px" }}>
          <h2 style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: "16px" }}>
            Basta perdere ore con la burocrazia
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", marginBottom: "32px" }}>
            Unisciti a chi ha già scelto di delegare la burocrazia all'AI.
            Gratis per iniziare, senza carta di credito.
          </p>
          <Link href="/register" className="btn-primary" style={{ fontSize: "1.1rem", padding: "16px 36px" }}>
            Prova BuroBot gratis
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "40px 24px", textAlign: "center", color: "var(--text-dim)" }}>
        <div style={{ fontWeight: 700, color: "var(--primary)", marginBottom: "12px" }}>BuroBot</div>
        <p style={{ fontSize: "0.9rem" }}>© 2026 BuroBot. L'AI che spiega la burocrazia italiana.</p>
        <div style={{ marginTop: "16px", display: "flex", gap: "24px", justifyContent: "center", fontSize: "0.85rem" }}>
          <Link href="/privacy" style={{ color: "#4b5563", textDecoration: "none" }}>Privacy Policy</Link>
          <Link href="/termini" style={{ color: "#4b5563", textDecoration: "none" }}>Termini di Servizio</Link>
          <Link href="/contatti" style={{ color: "#4b5563", textDecoration: "none" }}>Contatti</Link>
        </div>
      </footer>
    </main>
  );
}
