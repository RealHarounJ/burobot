import Link from "next/link";

const features = [
  {
    icon: "📄",
    title: "Qualsiasi documento",
    desc: "INPS, Agenzia Entrate, ISEE, cartelle esattoriali, contratti, lettere legali. BuroBot capisce tutto.",
  },
  {
    icon: "⚡",
    title: "Risposta in 5 secondi",
    desc: "Carica una foto o un PDF. In pochi secondi sai esattamente cosa significa e cosa fare.",
  },
  {
    icon: "✍️",
    title: "Genera la risposta",
    desc: "Hai torto o ragione? BuroBot scrive al posto tuo la lettera di risposta o il ricorso formale.",
  },
  {
    icon: "🔒",
    title: "100% privato",
    desc: "I tuoi documenti non vengono mai condivisi. Elaborazione sicura e crittografata.",
  },
  {
    icon: "📅",
    title: "Scadenze chiare",
    desc: "Mai perdere una scadenza. BuroBot evidenzia sempre le date limite e le conseguenze.",
  },
  {
    icon: "🇮🇹",
    title: "Solo italiano",
    desc: "Addestrato sulla normativa italiana aggiornata. Conosce INPS, MEF, AdE meglio di un CAF.",
  },
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
  return (
    <main style={{ minHeight: "100vh" }} className="hero-bg">

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "16px 40px",
        background: "rgba(10,10,15,0.8)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(99,102,241,0.15)",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ fontSize: "1.4rem", fontWeight: 800, background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          🤖 BuroBot
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link href="#pricing" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.95rem" }}>Prezzi</Link>
          <Link href="/login" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.95rem" }}>Accedi</Link>
          <Link href="/register" className="btn-primary" style={{ padding: "10px 20px", fontSize: "0.9rem" }}>
            Inizia gratis →
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: "140px", paddingBottom: "100px", textAlign: "center", maxWidth: "900px", margin: "0 auto", padding: "140px 24px 100px" }}>
        <div className="badge" style={{ marginBottom: "24px" }}>
          🇮🇹 Fatto per la burocrazia italiana
        </div>
        <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: "24px" }}>
          La burocrazia italiana{" "}
          <span className="gradient-text">spiegata in 5 secondi</span>
        </h1>
        <p style={{ fontSize: "1.25rem", color: "#94a3b8", maxWidth: "600px", margin: "0 auto 40px", lineHeight: 1.7 }}>
          Carica una foto del documento. BuroBot lo legge, lo spiega in linguaggio semplice
          e genera la risposta al posto tuo. Niente più CAF, niente più confusione.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" className="btn-primary" style={{ fontSize: "1.1rem", padding: "16px 32px" }}>
            🚀 Inizia gratis — è gratuito
          </Link>
          <Link href="#come-funziona" className="btn-secondary" style={{ fontSize: "1.1rem", padding: "16px 32px" }}>
            Come funziona
          </Link>
        </div>
        <p style={{ marginTop: "20px", color: "#4b5563", fontSize: "0.9rem" }}>
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
            <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: "8px" }}>📄 Comunicazione_INPS_36bis.pdf</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>L'Agenzia delle Entrate ha rilevato una differenza di €340...</p>
          </div>
          <div style={{ borderLeft: "3px solid var(--primary)", paddingLeft: "16px" }}>
            <p style={{ color: "var(--primary)", fontSize: "0.85rem", fontWeight: 600, marginBottom: "8px" }}>🤖 BuroBot spiega:</p>
            <p style={{ color: "var(--text-main)", fontSize: "0.95rem", marginBottom: "12px" }}>
              Questa è una <strong>comunicazione di irregolarità (36-bis)</strong>. L'Agenzia ha trovato una differenza di <strong>€340</strong> nella tua dichiarazione.
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
              ⏰ Hai tempo fino al <strong>15 luglio</strong> per rispondere.
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
              <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>{f.icon}</div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px", color: "var(--text-main)" }}>{f.title}</h3>
              <p style={{ color: "var(--text-muted)", lineHeight: 1.6, fontSize: "0.95rem" }}>{f.desc}</p>
            </div>
          ))}
        </div>
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
                <div className="badge" style={{ marginBottom: "16px", fontSize: "0.8rem" }}>⭐ Più popolare</div>
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
          <p style={{ color: "#94a3b8", fontSize: "1.1rem", marginBottom: "32px" }}>
            Unisciti a chi ha già scelto di delegare la burocrazia all'AI.
            Gratis per iniziare, senza carta di credito.
          </p>
          <Link href="/register" className="btn-primary" style={{ fontSize: "1.1rem", padding: "16px 36px" }}>
            🚀 Prova BuroBot gratis
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(99,102,241,0.1)", padding: "40px 24px", textAlign: "center", color: "#374151" }}>
        <div style={{ fontWeight: 700, color: "#6366f1", marginBottom: "12px" }}>🤖 BuroBot</div>
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
