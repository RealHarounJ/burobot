"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type Tab = "redattore" | "analisi";

type TipoAtto =
  | "diffida"
  | "messa_in_mora"
  | "contratto_locazione"
  | "contratto_prestazione"
  | "lettera_formale"
  | "ricorso"
  | "accordo_transattivo";

interface DraftResult {
  atto: string;
  note_avvocato: string;
}

interface ContractAnalysis {
  sommario: string;
  clausole_rischiose: string[];
  clausole_mancanti: string[];
  punti_chiave: string[];
  valutazione_generale: "favorevole" | "neutro" | "sfavorevole";
  raccomandazioni: string[];
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const TIPI_ATTO: { value: TipoAtto; label: string }[] = [
  { value: "diffida", label: "Diffida formale" },
  { value: "messa_in_mora", label: "Messa in mora (art. 1219 c.c.)" },
  { value: "contratto_locazione", label: "Contratto di locazione" },
  { value: "contratto_prestazione", label: "Contratto di prestazione d'opera" },
  { value: "lettera_formale", label: "Lettera legale formale" },
  { value: "ricorso", label: "Ricorso" },
  { value: "accordo_transattivo", label: "Accordo transattivo" },
];

const VALUTAZIONE_STYLE: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  favorevole: { color: "#4ade80", bg: "rgba(74,222,128,0.10)", label: "Favorevole", icon: "✓" },
  neutro:     { color: "#fbbf24", bg: "rgba(251,191,36,0.10)", label: "Neutro",     icon: "~" },
  sfavorevole:{ color: "#f87171", bg: "rgba(248,113,113,0.10)",label: "Sfavorevole",icon: "✕" },
};

function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function AvvocatoPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("redattore");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redattore state
  const [tipoAtto, setTipoAtto] = useState<TipoAtto>("diffida");
  const [mittente, setMittente] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [oggetto, setOggetto] = useState("");
  const [dettagli, setDettagli] = useState("");
  const [importo, setImporto] = useState("");
  const [scadenza, setScadenza] = useState("");
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Analisi contratto state
  const [testoContratto, setTestoContratto] = useState("");
  const [tipoContratto, setTipoContratto] = useState("generico");
  const [contractResult, setContractResult] = useState<ContractAnalysis | null>(null);

  // Auth check
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/login");
    });
  }, [router]);

  /* ─── Handlers ─────────────────────────────────────────────────────────── */
  async function handleDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!mittente || !destinatario || !oggetto || !dettagli) {
      setError("Compilare tutti i campi obbligatori.");
      return;
    }
    setLoading(true);
    setError("");
    setDraftResult(null);
    try {
      const result = await api.draftDocument({
        tipo_atto: tipoAtto,
        mittente,
        destinatario,
        oggetto,
        dettagli,
        importo: importo || undefined,
        scadenza: scadenza || undefined,
      });
      setDraftResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore durante la redazione.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!testoContratto.trim()) {
      setError("Incollare il testo del contratto da analizzare.");
      return;
    }
    setLoading(true);
    setError("");
    setContractResult(null);
    try {
      const result = await api.analyzeContract(testoContratto, tipoContratto);
      setContractResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore durante l'analisi.");
    } finally {
      setLoading(false);
    }
  }

  /* ─── Render ────────────────────────────────────────────────────────────── */
  return (
    <div style={styles.page}>

      {/* Header */}
      <header style={styles.header}>
        <Link href="/dashboard" style={styles.backBtn}>← Dashboard</Link>
        <div style={styles.headerCenter}>
          <span style={styles.headerIcon}>⚖️</span>
          <div>
            <div style={styles.headerTitle}>BuroBot per Avvocati</div>
            <div style={styles.headerSub}>Redazione atti · Analisi contratti · Powered by Gemini 2.5</div>
          </div>
        </div>
        <div style={styles.headerBadge}>STUDIO PRO</div>
      </header>

      {/* Tabs */}
      <div style={styles.tabBar}>
        <button
          style={{ ...styles.tabBtn, ...(tab === "redattore" ? styles.tabActive : {}) }}
          onClick={() => { setTab("redattore"); setError(""); }}
        >
          📝 Redattore Atti
        </button>
        <button
          style={{ ...styles.tabBtn, ...(tab === "analisi" ? styles.tabActive : {}) }}
          onClick={() => { setTab("analisi"); setError(""); }}
        >
          🔍 Analisi Contratto
        </button>
      </div>

      <div style={styles.content}>

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            ⚠️ {error}
          </div>
        )}

        {/* ── TAB 1: REDATTORE ── */}
        {tab === "redattore" && (
          <div style={styles.twoCol}>
            {/* Form */}
            <form onSubmit={handleDraft} style={styles.card}>
              <div style={styles.cardTitle}>Parametri atto</div>

              <label style={styles.label}>Tipo di atto *</label>
              <select style={styles.select} value={tipoAtto} onChange={e => setTipoAtto(e.target.value as TipoAtto)}>
                {TIPI_ATTO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <label style={styles.label}>Mittente / Studio legale *</label>
              <input style={styles.input} placeholder="Es. Avv. Mario Rossi, Studio Legale Rossi & Associati" value={mittente} onChange={e => setMittente(e.target.value)} />

              <label style={styles.label}>Destinatario *</label>
              <input style={styles.input} placeholder="Es. Sig. Giovanni Bianchi / Bianchi S.r.l." value={destinatario} onChange={e => setDestinatario(e.target.value)} />

              <label style={styles.label}>Oggetto *</label>
              <input style={styles.input} placeholder="Es. Mancato pagamento fattura n. 123/2025" value={oggetto} onChange={e => setOggetto(e.target.value)} />

              <label style={styles.label}>Fatti e dettagli rilevanti *</label>
              <textarea style={styles.textarea} rows={5} placeholder="Descrivere i fatti, le date rilevanti, gli accordi intercorsi, le eventuali comunicazioni precedenti..." value={dettagli} onChange={e => setDettagli(e.target.value)} />

              <div style={styles.row2col}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Importo (opzionale)</label>
                  <input style={styles.input} placeholder="Es. €15.000,00" value={importo} onChange={e => setImporto(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Termine richiesto (opzionale)</label>
                  <input style={styles.input} placeholder="Es. entro 15 giorni dal ricevimento" value={scadenza} onChange={e => setScadenza(e.target.value)} />
                </div>
              </div>

              <button type="submit" style={styles.btnPrimary} disabled={loading}>
                {loading ? "Redazione in corso..." : "✍️ Redigi atto"}
              </button>
            </form>

            {/* Result */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Atto redatto</div>
              {!draftResult && !loading && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>📄</div>
                  <div>Compila il modulo e clicca "Redigi atto".<br/>L&apos;AI genererà un atto formalmente corretto in pochi secondi.</div>
                </div>
              )}
              {loading && (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
                  <div>Redazione in corso con Gemini 2.5...<br/><span style={{ color: "#94a3b8", fontSize: 12 }}>Questo può richiedere 5-10 secondi</span></div>
                </div>
              )}
              {draftResult && (
                <>
                  <div style={styles.actText}>{draftResult.atto}</div>

                  <div style={styles.noteBox}>
                    <div style={styles.noteTitle}>📌 Note per l&apos;avvocato</div>
                    <div style={styles.noteText}>{draftResult.note_avvocato}</div>
                  </div>

                  <button
                    style={{ ...styles.btnSecondary, marginTop: 12 }}
                    onClick={() => copyToClipboard(draftResult.atto, setCopiedDraft)}
                  >
                    {copiedDraft ? "✅ Copiato!" : "📋 Copia testo atto"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: ANALISI CONTRATTO ── */}
        {tab === "analisi" && (
          <div style={styles.twoCol}>
            {/* Form */}
            <form onSubmit={handleAnalyze} style={styles.card}>
              <div style={styles.cardTitle}>Testo contratto</div>

              <label style={styles.label}>Tipo contratto</label>
              <input style={styles.input} placeholder="Es. locazione, appalto, fornitura, lavoro..." value={tipoContratto} onChange={e => setTipoContratto(e.target.value)} />

              <label style={styles.label}>Testo del contratto *</label>
              <textarea
                style={{ ...styles.textarea, minHeight: 280 }}
                rows={14}
                placeholder="Incolla qui il testo completo del contratto da analizzare..."
                value={testoContratto}
                onChange={e => setTestoContratto(e.target.value)}
              />
              <div style={styles.charCount}>{testoContratto.length.toLocaleString()} caratteri</div>

              <button type="submit" style={styles.btnPrimary} disabled={loading || !testoContratto.trim()}>
                {loading ? "Analisi in corso..." : "🔍 Analizza contratto"}
              </button>
            </form>

            {/* Result */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Report di analisi</div>
              {!contractResult && !loading && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>⚖️</div>
                  <div>Incolla il testo del contratto e avvia l&apos;analisi.<br/>L&apos;AI identificherà clausole rischiose e mancanti.</div>
                </div>
              )}
              {loading && (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔎</div>
                  <div>Analisi legale in corso...<br/><span style={{ color: "#94a3b8", fontSize: 12 }}>Questo può richiedere 10-15 secondi</span></div>
                </div>
              )}
              {contractResult && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Valutazione generale */}
                  {(() => {
                    const v = VALUTAZIONE_STYLE[contractResult.valutazione_generale] ?? VALUTAZIONE_STYLE.neutro;
                    return (
                      <div style={{ ...styles.valutazioneBox, background: v.bg, borderColor: v.color }}>
                        <span style={{ fontSize: 20, fontWeight: 700, color: v.color }}>{v.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, color: v.color }}>Valutazione: {v.label}</div>
                          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{contractResult.sommario}</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Clausole rischiose */}
                  {contractResult.clausole_rischiose.length > 0 && (
                    <div>
                      <div style={styles.sectionLabel}>🔴 Clausole rischiose</div>
                      {contractResult.clausole_rischiose.map((c, i) => (
                        <div key={i} style={styles.clausolaRischio}>{c}</div>
                      ))}
                    </div>
                  )}

                  {/* Clausole mancanti */}
                  {contractResult.clausole_mancanti.length > 0 && (
                    <div>
                      <div style={styles.sectionLabel}>⚠️ Clausole mancanti</div>
                      {contractResult.clausole_mancanti.map((c, i) => (
                        <div key={i} style={styles.clausolaMancante}>{c}</div>
                      ))}
                    </div>
                  )}

                  {/* Punti chiave */}
                  {contractResult.punti_chiave.length > 0 && (
                    <div>
                      <div style={styles.sectionLabel}>📌 Punti chiave</div>
                      {contractResult.punti_chiave.map((p, i) => (
                        <div key={i} style={styles.puntoCave}>{p}</div>
                      ))}
                    </div>
                  )}

                  {/* Raccomandazioni */}
                  {contractResult.raccomandazioni.length > 0 && (
                    <div>
                      <div style={styles.sectionLabel}>💡 Raccomandazioni</div>
                      {contractResult.raccomandazioni.map((r, i) => (
                        <div key={i} style={styles.raccomandazione}>{r}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#07090f",
    color: "#f0f4ff",
    fontFamily: "'Inter', 'Outfit', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 28px",
    background: "rgba(13,17,23,0.98)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    backdropFilter: "blur(12px)",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  backBtn: {
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 500,
    transition: "color 0.15s",
  },
  headerCenter: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 700,
    background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  headerSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  headerBadge: {
    padding: "4px 10px",
    borderRadius: 6,
    background: "rgba(167,139,250,0.12)",
    border: "1px solid rgba(167,139,250,0.3)",
    color: "#a78bfa",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.8px",
  },
  tabBar: {
    display: "flex",
    gap: 0,
    padding: "0 28px",
    background: "rgba(13,17,23,0.8)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  tabBtn: {
    padding: "14px 20px",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
    marginBottom: -1,
  },
  tabActive: {
    color: "#60a5fa",
    borderBottomColor: "#60a5fa",
  },
  content: {
    padding: "28px",
    maxWidth: 1400,
    margin: "0 auto",
  },
  errorBox: {
    background: "rgba(239,68,68,0.10)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#f87171",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 13,
    marginBottom: 20,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    alignItems: "start",
  },
  card: {
    background: "rgba(13,17,23,0.9)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#f0f4ff",
    marginBottom: 4,
    paddingBottom: 12,
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.6px",
    marginBottom: 2,
    marginTop: 4,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8,
    color: "#f0f4ff",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8,
    color: "#f0f4ff",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    cursor: "pointer",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8,
    color: "#f0f4ff",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
    resize: "vertical" as const,
    lineHeight: 1.6,
    boxSizing: "border-box" as const,
  },
  row2col: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  btnPrimary: {
    padding: "12px",
    background: "linear-gradient(135deg, #3b82f6, #6366f1)",
    border: "none",
    borderRadius: 9,
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
    transition: "opacity 0.15s",
    fontFamily: "inherit",
  },
  btnSecondary: {
    padding: "10px 16px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "60px 20px",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  actText: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 16,
    fontSize: 12,
    lineHeight: 1.8,
    color: "#cbd5e1",
    fontFamily: "'JetBrains Mono', monospace",
    whiteSpace: "pre-wrap" as const,
    maxHeight: 420,
    overflowY: "auto" as const,
  },
  noteBox: {
    background: "rgba(245,158,11,0.07)",
    border: "1px solid rgba(245,158,11,0.2)",
    borderRadius: 10,
    padding: "14px 16px",
  },
  noteTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#fbbf24",
    textTransform: "uppercase" as const,
    letterSpacing: "0.6px",
    marginBottom: 8,
  },
  noteText: {
    fontSize: 12,
    color: "#fde68a",
    lineHeight: 1.65,
  },
  valutazioneBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 16px",
    borderRadius: 10,
    border: "1px solid",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.6px",
    marginBottom: 8,
  },
  clausolaRischio: {
    padding: "10px 12px",
    background: "rgba(239,68,68,0.07)",
    border: "1px solid rgba(239,68,68,0.15)",
    borderRadius: 8,
    fontSize: 12,
    color: "#fca5a5",
    lineHeight: 1.5,
    marginBottom: 6,
  },
  clausolaMancante: {
    padding: "10px 12px",
    background: "rgba(245,158,11,0.07)",
    border: "1px solid rgba(245,158,11,0.15)",
    borderRadius: 8,
    fontSize: 12,
    color: "#fde68a",
    lineHeight: 1.5,
    marginBottom: 6,
  },
  puntoCave: {
    padding: "10px 12px",
    background: "rgba(59,130,246,0.07)",
    border: "1px solid rgba(59,130,246,0.15)",
    borderRadius: 8,
    fontSize: 12,
    color: "#93c5fd",
    lineHeight: 1.5,
    marginBottom: 6,
  },
  raccomandazione: {
    padding: "10px 12px",
    background: "rgba(167,139,250,0.07)",
    border: "1px solid rgba(167,139,250,0.15)",
    borderRadius: 8,
    fontSize: 12,
    color: "#c4b5fd",
    lineHeight: 1.5,
    marginBottom: 6,
  },
  charCount: {
    fontSize: 11,
    color: "#475569",
    textAlign: "right" as const,
    marginTop: -8,
  },
};
