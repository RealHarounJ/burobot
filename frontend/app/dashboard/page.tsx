"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, signOut } from "@/lib/supabase";
import { api } from "@/lib/api";

/* ─────────── TYPES ─────────── */
interface Analysis {
  tipo_documento: string;
  spiegazione: string;
  scadenza: string | null;
  importo: string | null;
  azioni: string[];
  urgenza: "alta" | "media" | "bassa";
  genera_risposta?: boolean;
}

interface Document {
  id: string;
  file_name: string;
  document_type: string;
  created_at: string;
  analysis: Analysis;
  original_text?: string;
  response_letters?: { id: string; response_type: string; letter_text: string; created_at: string }[];
}

interface Usage {
  plan: string;
  used_this_month: number;
  limit: number | null;
  remaining: number | null;
}

/* ─────────── HELPERS ─────────── */
const PLAN_RANK: Record<string, number> = { free: 0, base: 1, pmi: 2, studio: 3 };
const hasPlan = (userPlan: string, required: string) =>
  (PLAN_RANK[userPlan] ?? 0) >= (PLAN_RANK[required] ?? 0);

const urgencyLabel: Record<string, { label: string; color: string; bg: string }> = {
  alta:  { label: "🔴 Urgente",       color: "#f87171", bg: "rgba(239,68,68,0.12)"  },
  media: { label: "🟡 Media priorità", color: "#fbbf24", bg: "rgba(245,158,11,0.12)" },
  bassa: { label: "🟢 Nessuna urgenza",color: "#4ade80", bg: "rgba(34,197,94,0.12)"  },
};

const planBadge: Record<string, { label: string; cls: string }> = {
  free:   { label: "FREE",   cls: "badge-free"   },
  base:   { label: "BASE",   cls: "badge-base"   },
  pmi:    { label: "PMI",    cls: "badge-pmi"    },
  studio: { label: "STUDIO", cls: "badge-studio" },
};

/* ─────────── PDF EXPORT (client-side, jsPDF) ─────────── */
async function exportToPDF(doc: Document, letter: string, plan: string, userEmail: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210, margin = 20;
  let y = margin;

  // Header
  pdf.setFillColor(99, 102, 241);
  pdf.rect(0, 0, W, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("BuroBot — Analisi Documento", margin, 12);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  if (hasPlan(plan, "studio")) {
    pdf.text("Studio Professionale", W - margin, 12, { align: "right" });
  }
  y = 28;

  // Title
  pdf.setTextColor(30, 30, 50);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(doc.document_type || doc.file_name || "Documento", margin, y);
  y += 8;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 100, 120);
  const dateStr = doc.created_at ? new Date(doc.created_at).toLocaleDateString("it-IT") : new Date().toLocaleDateString("it-IT");
  pdf.text(`File: ${doc.file_name || "N/D"} — ${dateStr}`, margin, y);
  y += 12;

  // Urgency
  const rawUrgency = doc.analysis?.urgenza || "bassa";
  const urg = rawUrgency.toLowerCase();
  const uLabel = urgencyLabel[urg] || urgencyLabel.bassa;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(urg === "alta" ? 220 : urg === "media" ? 180 : 50, urg === "alta" ? 50 : urg === "media" ? 130 : 180, 50);
  pdf.text(`Urgenza: ${uLabel.label}`, margin, y);
  y += 10;

  // Deadline & Amount
  pdf.setTextColor(30, 30, 50);
  const scadenza = doc.analysis?.scadenza;
  const importo = doc.analysis?.importo;
  if (scadenza) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`⏰ Scadenza: `, margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(scadenza, margin + 30, y);
    y += 7;
  }
  if (importo) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`💶 Importo: `, margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(importo, margin + 28, y);
    y += 7;
  }
  y += 4;

  // Divider
  pdf.setDrawColor(200, 200, 220);
  pdf.line(margin, y, W - margin, y);
  y += 8;

  // Explanation
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(80, 60, 180);
  pdf.text("Spiegazione del documento", margin, y);
  y += 7;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(40, 40, 60);
  const spiegazione = doc.analysis?.spiegazione || "Nessuna spiegazione disponibile.";
  const lines = pdf.splitTextToSize(spiegazione, W - margin * 2);
  pdf.text(lines, margin, y);
  y += lines.length * 5 + 8;

  // Actions
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(80, 60, 180);
  pdf.text("Cosa fare ora", margin, y);
  y += 7;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(40, 40, 60);
  const azioni = doc.analysis?.azioni || [];
  azioni.forEach((a, i) => {
    const aLines = pdf.splitTextToSize(`${i + 1}. ${a}`, W - margin * 2 - 5);
    pdf.text(aLines, margin + 5, y);
    y += aLines.length * 5 + 3;
  });

  // Letter
  if (letter) {
    y += 6;
    pdf.setDrawColor(200, 200, 220);
    pdf.line(margin, y, W - margin, y);
    y += 8;
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(80, 60, 180);
    pdf.text("Lettera di risposta generata", margin, y);
    y += 7;
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(40, 40, 60);
    const lLines = pdf.splitTextToSize(letter, W - margin * 2);
    lLines.forEach((line: string) => {
      if (y > 275) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y);
      y += 5;
    });
  }

  // Footer
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 170);
    pdf.text(`BuroBot © ${new Date().getFullYear()} — ${userEmail} — Pag. ${i}/${pages}`, W / 2, 290, { align: "center" });
  }

  const safeFilename = (doc.file_name || "documento").replace(/\.[^.]+$/, "");
  pdf.save(`burobot_${safeFilename}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/* ─────────── COMPONENTS ─────────── */

function EasyModeToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`easy-toggle ${enabled ? "active" : ""}`}
      title={enabled ? "Disattiva modalità facile" : "Attiva modalità facile (font grandi)"}
    >
      {enabled ? "🔤 Modalità Facile ON" : "🔤 Modalità Facile"}
    </button>
  );
}

function PlanGate({ required, current, children }: { required: string; current: string; children: React.ReactNode }) {
  if (hasPlan(current, required)) return <>{children}</>;
  const planNames: Record<string, string> = { base: "Base", pmi: "PMI", studio: "Studio" };
  const planColors: Record<string, string> = { base: "badge-base", pmi: "badge-pmi", studio: "badge-studio" };
  return (
    <div className={`plan-gate ${required === "studio" ? "plan-gate-studio" : required === "pmi" ? "plan-gate-pmi" : ""}`}>
      <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🔒</div>
      <p style={{ fontWeight: 700, marginBottom: "6px", fontSize: "var(--font-base)" }}>
        Funzionalità {planNames[required] || required}
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)", marginBottom: "16px" }}>
        Attiva il piano {planNames[required]} per sbloccare questa funzione.
      </p>
      <Link href="/pricing" className="btn-primary" style={{ fontSize: "var(--font-sm)", padding: "10px 20px" }}>
        Vai ai Piani →
      </Link>
    </div>
  );
}

function StatCards({ usage, history }: { usage: Usage | null; history: Document[] }) {
  const plan = usage?.plan || "free";
  const pb = planBadge[plan] || planBadge.free;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
      <div className="stat-card">
        <span className={`badge ${pb.cls}`} style={{ fontSize: "var(--font-xs)", padding: "4px 10px", marginBottom: "4px" }}>{pb.label}</span>
        <div className="stat-label">Piano Attivo</div>
      </div>
      <div className="stat-card">
        <div className="stat-value" style={{ color: "#818cf8" }}>{usage?.used_this_month ?? 0}</div>
        <div className="stat-label">Doc. questo mese</div>
      </div>
      <div className="stat-card">
        <div className="stat-value" style={{ color: "#4ade80" }}>{history.length}</div>
        <div className="stat-label">Doc. totali</div>
      </div>
      <div className="stat-card">
        <div className="stat-value" style={{ color: plan === "free" ? "#fbbf24" : "#4ade80" }}>
          {plan === "free" ? (usage?.remaining ?? 0) : "∞"}
        </div>
        <div className="stat-label">{plan === "free" ? "Rimasti mese" : "Illimitati"}</div>
      </div>
    </div>
  );
}

/* ─────────── MAIN DASHBOARD ─────────── */
export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [error, setError] = useState("");
  const [dragover, setDragover] = useState(false);
  const [history, setHistory] = useState<Document[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [easyMode, setEasyMode] = useState(false);

  // Letter
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [userSituation, setUserSituation] = useState("");
  const [responseType, setResponseType] = useState("contestazione");
  const [generatedLetter, setGeneratedLetter] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  // Tab (per piani superiori)
  const [activeTab, setActiveTab] = useState<"analisi" | "contratti" | "team">("analisi");

  const fileRef = useRef<HTMLInputElement>(null);
  const plan = usage?.plan || "free";

  // Easy mode persistenza
  useEffect(() => {
    const saved = localStorage.getItem("burobot_easy");
    if (saved === "1") { setEasyMode(true); document.body.classList.add("easy-mode"); }
  }, []);

  const toggleEasyMode = () => {
    const next = !easyMode;
    setEasyMode(next);
    document.body.classList.toggle("easy-mode", next);
    localStorage.setItem("burobot_easy", next ? "1" : "0");
  };

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || url.includes("xxxx.supabase.co")) {
      setError("Supabase non configurato. Imposta le variabili d'ambiente su Vercel.");
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login?redirect=/dashboard"); return; }
      setUser(user);
      loadData();
    });
  }, [router]);

  const loadData = async () => {
    try {
      const [h, u] = await Promise.all([api.getHistory(), api.getUsage()]);
      setHistory(h.documents || []);
      setUsage(u);
    } catch { /* silent */ }
  };

  const handleFile = (f: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(f.type)) { setError("Formato non supportato. Usa PDF, JPG o PNG."); return; }
    if (f.size > 10 * 1024 * 1024) { setError("File troppo grande. Max 10MB."); return; }
    setFile(f); setError(""); setSelectedDoc(null); setGeneratedLetter("");
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true); setError(""); setSelectedDoc(null); setGeneratedLetter("");
    try {
      const data = await api.analyzeDocument(file);
      if (data.success && data.document_id) {
        const newDoc: Document = {
          id: data.document_id, file_name: file.name,
          document_type: data.analysis.tipo_documento,
          created_at: new Date().toISOString(),
          analysis: data.analysis, response_letters: []
        };
        setSelectedDoc(newDoc); setFile(null); loadData();
      } else throw new Error("Impossibile salvare il documento");
    } catch (e: any) {
      setError(e.message || "Errore durante l'analisi.");
    } finally { setLoading(false); }
  };

  const loadDocFull = async (docId: string) => {
    setLoading(true); setError(""); setFile(null); setGeneratedLetter(""); setUserSituation("");
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/api/documents/${docId}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` }
      });
      if (!res.ok) throw new Error("Errore nel caricamento");
      const full = await res.json();
      setSelectedDoc(full);
      if (full.response_letters?.length > 0) {
        setGeneratedLetter(full.response_letters[0].letter_text);
        setResponseType(full.response_letters[0].response_type);
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleGenerateLetter = async () => {
    if (!selectedDoc) return;
    if (!userSituation.trim()) { setError("Spiega la tua situazione per generare la lettera."); return; }
    setGeneratingLetter(true); setError("");
    try {
      const res = await api.generateResponse(selectedDoc.id, userSituation, responseType);
      if (res.success && res.letter) { setGeneratedLetter(res.letter); loadDocFull(selectedDoc.id); }
      else throw new Error("Errore nella generazione");
    } catch (err: any) { setError(err.message || "Impossibile generare la lettera."); }
    finally { setGeneratingLetter(false); }
  };

  const handleExportPDF = async () => {
    if (!selectedDoc || !user) return;
    setExportingPdf(true);
    try { await exportToPDF(selectedDoc, generatedLetter, plan, user.email); }
    catch (e: any) { setError("Errore export PDF: " + e.message); }
    finally { setExportingPdf(false); }
  };

  const handleReset = () => { setFile(null); setSelectedDoc(null); setGeneratedLetter(""); setUserSituation(""); setError(""); };

  const tabStyle = (tab: string) => ({
    padding: "10px 20px",
    borderRadius: "var(--radius-md)",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "var(--font-sm)",
    transition: "all 0.2s ease",
    background: activeTab === tab ? "var(--primary)" : "transparent",
    color: activeTab === tab ? "white" : "var(--text-muted)",
    boxShadow: activeTab === tab ? "0 0 20px rgba(99,102,241,0.3)" : "none",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", display: "flex", flexDirection: "column" }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        padding: "14px 32px",
        background: "rgba(10,10,15,0.95)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50, gap: "16px",
      }}>
        <Link href="/" style={{
          fontSize: "1.3rem", fontWeight: 900,
          background: "linear-gradient(135deg,#6366f1,#a78bfa)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          textDecoration: "none", whiteSpace: "nowrap",
        }}>
          🤖 BuroBot
        </Link>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <EasyModeToggle enabled={easyMode} onToggle={toggleEasyMode} />
          <Link href="/pricing" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "var(--font-sm)" }}>
            Piani {usage && <span className={`badge ${planBadge[plan]?.cls}`} style={{ marginLeft: "4px", fontSize: "0.7rem", padding: "2px 8px" }}>{planBadge[plan]?.label}</span>}
          </Link>
          <Link href="/profile" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "var(--font-sm)" }}>Profilo</Link>
          <button onClick={async () => { await signOut(); router.push("/"); }}
            style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "var(--font-sm)" }}>
            Esci
          </button>
        </div>
      </nav>

      {/* ── EASY MODE BANNER ── */}
      {easyMode && (
        <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(167,139,250,0.1))", borderBottom: "1px solid var(--border)", padding: "10px 32px", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.5rem" }}>👴👵</span>
          <span style={{ fontWeight: 700, fontSize: "var(--font-base)" }}>Modalità Facile attiva</span>
          <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>— Testi più grandi, interfaccia semplificata</span>
        </div>
      )}

      {/* ── TABS (solo piani PMI e Studio) ── */}
      {hasPlan(plan, "pmi") && (
        <div style={{ background: "rgba(10,10,15,0.6)", borderBottom: "1px solid var(--border)", padding: "12px 32px", display: "flex", gap: "8px" }}>
          <button style={tabStyle("analisi")} onClick={() => setActiveTab("analisi")}>📄 Analisi Documenti</button>
          <button style={tabStyle("contratti")} onClick={() => setActiveTab("contratti")}>📋 Contratti Commerciali</button>
          {hasPlan(plan, "pmi") && <button style={tabStyle("team")} onClick={() => setActiveTab("team")}>👥 Gestione Team</button>}
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, maxWidth: "1400px", width: "100%", margin: "0 auto", padding: "32px 24px" }}>

        {/* STAT CARDS */}
        <StatCards usage={usage} history={history} />

        {/* TAB: CONTRATTI COMMERCIALI */}
        {activeTab === "contratti" && (
          <div className="glass-card animate-fade-up" style={{ padding: "40px", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📋</div>
            <h2 style={{ fontSize: "var(--font-2xl)", fontWeight: 900, marginBottom: "12px" }}>Analisi Contratti Commerciali</h2>
            <p style={{ color: "var(--text-muted)", maxWidth: "500px", margin: "0 auto 24px", lineHeight: 1.7, fontSize: "var(--font-base)" }}>
              Carica un contratto commerciale, di locazione, di fornitura o qualsiasi accordo commerciale. BuroBot lo analizza evidenziando clausole rischiose, obblighi e scadenze.
            </p>
            <div className="upload-zone" onClick={() => fileRef.current?.click()} style={{ maxWidth: "500px", margin: "0 auto" }}>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); setActiveTab("analisi"); } }} />
              <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>📤</div>
              <p style={{ fontWeight: 700, fontSize: "var(--font-lg)" }}>Carica il contratto PDF</p>
              <p style={{ color: "var(--text-dim)", fontSize: "var(--font-sm)", marginTop: "6px" }}>Clicca qui o trascina il file</p>
            </div>
          </div>
        )}

        {/* TAB: TEAM */}
        {activeTab === "team" && (
          <div className="glass-card animate-fade-up" style={{ padding: "40px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
              <div>
                <h2 style={{ fontSize: "var(--font-2xl)", fontWeight: 900, marginBottom: "6px" }}>👥 Gestione Team</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>
                  {hasPlan(plan, "studio") ? "Account collaboratori illimitati" : "Fino a 5 collaboratori"}
                </p>
              </div>
              <button className="btn-primary" style={{ fontSize: "var(--font-sm)", padding: "10px 20px" }}>
                + Invita Collaboratore
              </button>
            </div>
            <div style={{ background: "rgba(99,102,241,0.05)", border: "1px dashed rgba(99,102,241,0.3)", borderRadius: "var(--radius-lg)", padding: "40px", textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📧</div>
              <p style={{ fontWeight: 700, marginBottom: "8px", fontSize: "var(--font-base)" }}>Nessun collaboratore ancora</p>
              <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>Invita i tuoi colleghi via email per condividere i documenti analizzati.</p>
            </div>
            {hasPlan(plan, "studio") && (
              <div style={{ marginTop: "24px", padding: "20px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-lg)" }}>
                <p style={{ fontWeight: 700, color: "#fbbf24", marginBottom: "6px" }}>🌟 Studio Pro</p>
                <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>
                  Il tuo piano Studio include un account manager dedicato. Contatta il tuo referente:
                  <a href="mailto:studio@burobot.it" style={{ color: "#fbbf24", marginLeft: "6px" }}>studio@burobot.it</a>
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB: ANALISI PRINCIPALE */}
        {activeTab === "analisi" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 420px) 1fr", gap: "28px", alignItems: "start" }}>

            {/* LEFT: Upload + History */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

              {/* UPLOAD */}
              <div className="glass-card" style={{ padding: "28px" }}>
                <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  📤 Analizza Documento
                </h2>

                {easyMode && (
                  <div style={{ background: "rgba(99,102,241,0.1)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px", marginBottom: "16px", fontSize: "var(--font-base)" }}>
                    <strong>Come funziona:</strong><br />
                    1️⃣ Clicca qui sotto e scegli il documento<br />
                    2️⃣ Clicca il bottone viola "Analizza ora"<br />
                    3️⃣ Aspetta 10 secondi — BuroBot ti spiega tutto!
                  </div>
                )}

                <div
                  className={`upload-zone ${dragover ? "dragover" : ""}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={(e) => { e.preventDefault(); setDragover(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                >
                  <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf"
                    style={{ display: "none" }}
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  {file ? (
                    <div>
                      <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>{file.type === "application/pdf" ? "📄" : "🖼️"}</div>
                      <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "var(--font-base)", wordBreak: "break-all" }}>{file.name}</p>
                      <p style={{ color: "var(--text-dim)", fontSize: "var(--font-sm)", marginTop: "4px" }}>{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>📂</div>
                      <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "var(--font-lg)" }}>
                        {easyMode ? "Tocca qui per scegliere il documento" : "Trascina il file o clicca"}
                      </p>
                      <p style={{ color: "var(--text-dim)", fontSize: "var(--font-sm)", marginTop: "6px" }}>PDF, JPG, PNG • Max 10MB</p>
                    </div>
                  )}
                </div>

                {file && !loading && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                    <button onClick={handleAnalyze} className="btn-primary" style={{ flex: 1, padding: "14px", fontSize: "var(--font-base)" }}>
                      🔍 Analizza ora
                    </button>
                    <button onClick={handleReset} className="btn-secondary" style={{ padding: "14px 16px", fontSize: "var(--font-base)" }}>✕</button>
                  </div>
                )}

                {loading && (
                  <div style={{ textAlign: "center", padding: "24px 0" }}>
                    <div className="spinner" style={{ margin: "0 auto 12px" }} />
                    <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>
                      {easyMode ? "Sto leggendo il documento, attendi..." : "BuroBot sta analizzando il documento..."}
                    </p>
                  </div>
                )}

                {error && (
                  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "14px", marginTop: "14px", color: "#f87171", fontSize: "var(--font-sm)", lineHeight: 1.5 }}>
                    ⚠️ {error}
                  </div>
                )}

                {/* PIANO FREE WARNING */}
                {plan === "free" && usage && (usage.remaining ?? 0) <= 1 && (
                  <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius-md)", padding: "14px", marginTop: "14px" }}>
                    <p style={{ color: "#fbbf24", fontWeight: 700, fontSize: "var(--font-sm)", marginBottom: "8px" }}>
                      ⚠️ {usage.remaining === 0 ? "Hai esaurito i documenti gratuiti" : `Ti rimane solo ${usage.remaining} documento gratuito`}
                    </p>
                    <Link href="/pricing" className="btn-primary" style={{ fontSize: "var(--font-xs)", padding: "8px 16px" }}>
                      Passa a Base — €9.99/mese →
                    </Link>
                  </div>
                )}
              </div>

              {/* HISTORY */}
              <div className="glass-card" style={{ padding: "28px" }}>
                <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginBottom: "16px" }}>📋 Cronologia</h2>
                {history.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📭</div>
                    <p style={{ fontSize: "var(--font-sm)" }}>Nessun documento analizzato</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "380px", overflowY: "auto", paddingRight: "4px" }}>
                    {history.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => loadDocFull(doc.id)}
                        style={{
                          cursor: "pointer", padding: "12px 16px", borderRadius: "var(--radius-md)",
                          background: selectedDoc?.id === doc.id ? "rgba(99,102,241,0.12)" : "var(--bg-card)",
                          border: `1px solid ${selectedDoc?.id === doc.id ? "rgba(99,102,241,0.5)" : "var(--border)"}`,
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = selectedDoc?.id === doc.id ? "rgba(99,102,241,0.5)" : "var(--border)")}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                          <p style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "var(--font-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "170px" }}>
                            {doc.file_name}
                          </p>
                          <span className={`urgency-${(doc.analysis?.urgenza || "bassa").toLowerCase()}`}>
                            {doc.analysis?.urgenza || "bassa"}
                          </span>
                        </div>
                        <p style={{ fontSize: "var(--font-xs)", color: "var(--text-dim)", marginTop: "4px" }}>
                          {doc.document_type} • {new Date(doc.created_at).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Results */}
            <div style={{ minHeight: "500px" }}>
              {selectedDoc ? (() => {
                const rawUrgency = selectedDoc.analysis?.urgenza || "bassa";
                const urgency = rawUrgency.toLowerCase();
                const uLabel = urgencyLabel[urgency] || urgencyLabel.bassa;
                const scadenza = selectedDoc.analysis?.scadenza;
                const importo = selectedDoc.analysis?.importo;
                const spiegazione = selectedDoc.analysis?.spiegazione || "Nessuna spiegazione disponibile.";
                const azioni = selectedDoc.analysis?.azioni || [];

                return (
                  <div className="glass-card animate-fade-up" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>

                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: "20px" }}>
                      <div style={{ flex: 1 }}>
                        <span className="badge" style={{ marginBottom: "8px" }}>{selectedDoc.document_type}</span>
                        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginTop: "6px", wordBreak: "break-word" }}>{selectedDoc.file_name}</h2>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <span className={`urgency-${urgency}`}>
                          {uLabel.label}
                        </span>
                        {/* Export PDF — tutti i piani */}
                        <button
                          onClick={handleExportPDF}
                          disabled={exportingPdf}
                          className="btn-secondary"
                          style={{ padding: "8px 14px", fontSize: "var(--font-xs)" }}
                          title="Scarica analisi in PDF"
                        >
                          {exportingPdf ? <div className="spinner" style={{ width: 14, height: 14 }} /> : "📄 PDF"}
                        </button>
                        <button onClick={handleReset} className="btn-secondary" style={{ padding: "8px 12px", fontSize: "var(--font-xs)" }}>✕ Chiudi</button>
                      </div>
                    </div>

                    {/* Scadenza + Importo */}
                    {(scadenza || importo) && (
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        {scadenza && (
                          <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "var(--radius-md)", padding: "14px 20px", flex: 1, minWidth: "140px" }}>
                            <p style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>⏰ Scadenza</p>
                            <p style={{ fontWeight: 800, color: "#fbbf24", fontSize: "var(--font-lg)" }}>{scadenza}</p>
                          </div>
                        )}
                        {importo && (
                          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-md)", padding: "14px 20px", flex: 1, minWidth: "140px" }}>
                            <p style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>💶 Importo</p>
                            <p style={{ fontWeight: 800, color: "#f87171", fontSize: "var(--font-lg)" }}>{importo}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Spiegazione */}
                    <div>
                      <h3 style={{ fontWeight: 700, marginBottom: "10px", color: "var(--accent)", fontSize: "var(--font-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                        📖 Cosa significa questo documento
                      </h3>
                      <p style={{ color: "#cbd5e1", lineHeight: 1.8, fontSize: "var(--font-base)" }}>{spiegazione}</p>
                    </div>

                    {/* Azioni */}
                    <div>
                      <h3 style={{ fontWeight: 700, marginBottom: "10px", color: "var(--accent)", fontSize: "var(--font-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                        ✅ Cosa devi fare {easyMode ? "ADESSO" : "ora"}
                      </h3>
                      <ol style={{ paddingLeft: "0", display: "flex", flexDirection: "column", gap: "10px", listStyle: "none" }}>
                        {azioni.map((a, i) => (
                          <li key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", background: "rgba(99,102,241,0.05)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
                            <span style={{ background: "var(--primary)", color: "white", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "var(--font-xs)", flexShrink: 0 }}>{i + 1}</span>
                            <span style={{ color: "#cbd5e1", lineHeight: 1.6, fontSize: "var(--font-base)" }}>{a}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                  <hr className="section-divider" />

                  {/* LETTERA — solo Base+ */}
                  <div>
                    <h3 style={{ fontWeight: 800, marginBottom: "14px", color: "var(--accent)", fontSize: "var(--font-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                      ✍️ {easyMode ? "Scrivi una lettera di risposta" : "Genera Risposta Formale"}
                    </h3>

                    <PlanGate required="base" current={plan}>
                      {generatedLetter ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button onClick={() => navigator.clipboard.writeText(generatedLetter).then(() => alert("Copiato!"))} className="btn-secondary" style={{ fontSize: "var(--font-xs)", padding: "8px 14px" }}>
                              📋 Copia
                            </button>
                            <button onClick={handleExportPDF} disabled={exportingPdf} className="btn-secondary" style={{ fontSize: "var(--font-xs)", padding: "8px 14px" }}>
                              {exportingPdf ? <div className="spinner" style={{ width: 12, height: 12 }} /> : "📄 Scarica PDF"}
                            </button>
                            <button onClick={() => setGeneratedLetter("")} className="btn-secondary" style={{ fontSize: "var(--font-xs)", padding: "8px 14px" }}>
                              🔄 Rigenera
                            </button>
                          </div>
                          <textarea
                            readOnly value={generatedLetter}
                            className="input-field"
                            style={{ height: "240px", fontFamily: "monospace", fontSize: "var(--font-sm)", resize: "vertical" }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                          {easyMode && (
                            <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: "var(--radius-md)", padding: "14px", fontSize: "var(--font-base)" }}>
                              💡 <strong>Come funziona:</strong> Scegli che tipo di risposta vuoi (ricorso, rateizzazione...) e spiega la tua situazione. BuroBot scrive la lettera per te!
                            </div>
                          )}
                          <div>
                            <label style={{ fontSize: "var(--font-sm)", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "8px" }}>Tipo di risposta</label>
                            <select value={responseType} onChange={(e) => setResponseType(e.target.value)} className="input-field">
                              <option value="contestazione">⚖️ Ricorso / Contestazione</option>
                              <option value="rateizzazione">📅 Richiesta Rateizzazione</option>
                              <option value="autotutela">🛡️ Istanza di Autotutela</option>
                              <option value="informazioni">❓ Richiesta di Chiarimenti</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: "var(--font-sm)", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "8px" }}>
                              {easyMode ? "Spiega la tua situazione (cosa è successo, perché non sei d'accordo...)" : "La tua situazione / motivazioni"}
                            </label>
                            <textarea
                              value={userSituation}
                              onChange={(e) => setUserSituation(e.target.value)}
                              placeholder={easyMode ? "Esempio: Ho già pagato questa somma il 15 marzo. Ho la ricevuta." : "Es: Ho già pagato il 12/03 (allego ricevuta), oppure chiedo la rateizzazione..."}
                              className="input-field"
                              style={{ height: "100px" }}
                            />
                          </div>
                          <button
                            disabled={generatingLetter}
                            onClick={handleGenerateLetter}
                            className="btn-primary"
                            style={{ padding: "15px", fontSize: "var(--font-base)" }}
                          >
                            {generatingLetter
                              ? <><div className="spinner" style={{ width: 18, height: 18 }} />{easyMode ? " Sto scrivendo la lettera..." : " Generazione in corso..."}</>
                              : easyMode ? "✍️ Scrivi la lettera per me!" : "✍️ Genera lettera formale"}
                          </button>
                        </div>
                      )}
                    </PlanGate>
                  </div>

                  {/* EXPORT PDF STUDIO con logo */}
                  {hasPlan(plan, "studio") && (
                    <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
                      <p style={{ fontWeight: 700, color: "#fbbf24", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                        🌟 Studio Pro — Export Avanzato
                      </p>
                      <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)", marginBottom: "14px" }}>
                        Il PDF include intestazione professionale con i dati del tuo studio. Personalizzabile con il tuo logo.
                      </p>
                      <button onClick={handleExportPDF} disabled={exportingPdf} className="btn-success" style={{ fontSize: "var(--font-sm)", padding: "10px 20px" }}>
                        {exportingPdf ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Generando...</> : "📄 Scarica PDF Professionale"}
                      </button>
                    </div>
                  )}

                  </div>
                );
              })() : (
                <div className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 40px", minHeight: "500px", textAlign: "center" }}>
                  <div style={{ fontSize: "5rem", marginBottom: "20px" }}>🤖</div>
                  <h2 style={{ fontSize: "var(--font-2xl)", fontWeight: 900, marginBottom: "12px" }}>
                    {easyMode ? "Ciao! Sono BuroBot" : "Pronto ad aiutarti"}
                  </h2>
                  <p style={{ color: "var(--text-muted)", maxWidth: "380px", fontSize: "var(--font-base)", lineHeight: 1.7 }}>
                    {easyMode
                      ? "Carica una lettera o un documento e ti spiego tutto in parole semplici. Poi posso scrivere la risposta al posto tuo!"
                      : "Carica un documento dalla colonna sinistra o selezionane uno dalla cronologia."}
                  </p>
                  {easyMode && (
                    <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "10px", maxWidth: "320px" }}>
                      {["📮 Lettere dell'INPS", "💰 Avvisi di pagamento", "🏛️ Lettere del Comune", "📋 Contratti da firmare"].map((item) => (
                        <div key={item} style={{ background: "rgba(99,102,241,0.08)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 16px", fontSize: "var(--font-base)", color: "var(--text-muted)" }}>
                          {item}
                        </div>
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
