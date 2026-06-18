"use client";

import { useState, useRef } from "react";
import Link from "next/link";

interface Analysis {
  tipo_documento: string;
  spiegazione: string;
  scadenza: string | null;
  importo: string | null;
  azioni: string[];
  urgenza: "alta" | "media" | "bassa";
  genera_risposta: boolean;
}

interface Document {
  id: string;
  file_name: string;
  document_type: string;
  created_at: string;
  analysis: Analysis;
}

const urgencyLabel: Record<string, string> = {
  alta: "🔴 Urgente",
  media: "🟡 Media priorità",
  bassa: "🟢 Nessuna urgenza",
};

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [dragover, setDragover] = useState(false);
  const [history] = useState<Document[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(f.type)) {
      setError("Formato non supportato. Usa JPG, PNG o PDF.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File troppo grande. Max 10MB.");
      return;
    }
    setFile(f);
    setError("");
    setAnalysis(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      // TODO: aggiungere Authorization header con token Supabase
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Errore nell'analisi");
      }

      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
      {/* Navbar */}
      <nav style={{
        padding: "16px 40px",
        background: "rgba(10,10,15,0.9)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(99,102,241,0.15)",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <Link href="/" style={{ fontSize: "1.3rem", fontWeight: 800, background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textDecoration: "none" }}>
          🤖 BuroBot
        </Link>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link href="/pricing" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.9rem" }}>Upgrade</Link>
          <button style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.9rem" }}>Esci</button>
        </div>
      </nav>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "8px" }}>Dashboard</h1>
        <p style={{ color: "#6b7280", marginBottom: "40px" }}>Carica un documento per analizzarlo con BuroBot</p>

        {/* Upload Zone */}
        <div
          className={`upload-zone ${dragover ? "dragover" : ""}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragover(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {file ? (
            <div>
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>
                {file.type === "application/pdf" ? "📄" : "🖼️"}
              </div>
              <p style={{ fontWeight: 600, color: "#f1f5f9", marginBottom: "4px" }}>{file.name}</p>
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>📤</div>
              <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f1f5f9", marginBottom: "8px" }}>
                Trascina qui il documento
              </p>
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                oppure clicca per selezionare • JPG, PNG, PDF • Max 10MB
              </p>
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "12px", padding: "14px 18px", marginTop: "16px", color: "#f87171" }}>
            ⚠️ {error}
          </div>
        )}

        {file && !loading && !analysis && (
          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <button onClick={handleAnalyze} className="btn-primary" style={{ fontSize: "1.1rem", padding: "16px 40px" }}>
              🔍 Analizza documento
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", marginTop: "40px" }}>
            <div className="spinner" style={{ margin: "0 auto 16px" }} />
            <p style={{ color: "#6b7280" }}>BuroBot sta analizzando il documento...</p>
          </div>
        )}

        {/* Risultato Analisi */}
        {analysis && (
          <div className="glass-card animate-fade-up" style={{ marginTop: "32px", padding: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
              <div>
                <span className="badge" style={{ marginBottom: "8px", display: "block", width: "fit-content" }}>
                  {analysis.tipo_documento}
                </span>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Risultato Analisi</h2>
              </div>
              <span className={`badge urgency-${analysis.urgenza}`} style={{ borderRadius: "8px" }}>
                {urgencyLabel[analysis.urgenza]}
              </span>
            </div>

            {/* Dettagli rapidi */}
            {(analysis.scadenza || analysis.importo) && (
              <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
                {analysis.scadenza && (
                  <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "10px", padding: "12px 18px" }}>
                    <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "2px" }}>Scadenza</p>
                    <p style={{ fontWeight: 700, color: "#fbbf24" }}>⏰ {analysis.scadenza}</p>
                  </div>
                )}
                {analysis.importo && (
                  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 18px" }}>
                    <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "2px" }}>Importo</p>
                    <p style={{ fontWeight: 700, color: "#f87171" }}>💶 {analysis.importo}</p>
                  </div>
                )}
              </div>
            )}

            {/* Spiegazione */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "12px", color: "#a78bfa" }}>📖 Cosa significa</h3>
              <p style={{ color: "#94a3b8", lineHeight: 1.8, fontSize: "1rem" }}>{analysis.spiegazione}</p>
            </div>

            {/* Azioni */}
            <div style={{ marginBottom: "28px" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "12px", color: "#a78bfa" }}>✅ Cosa fare</h3>
              <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {analysis.azioni.map((a, i) => (
                  <li key={i} style={{ color: "#94a3b8", lineHeight: 1.6 }}>{a}</li>
                ))}
              </ol>
            </div>

            {/* CTA */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button className="btn-primary">✍️ Genera lettera di risposta</button>
              <button className="btn-secondary" onClick={() => { setFile(null); setAnalysis(null); }}>
                📤 Carica altro documento
              </button>
            </div>
          </div>
        )}

        {/* Storico */}
        {history.length > 0 && (
          <div style={{ marginTop: "48px" }}>
            <h2 style={{ fontWeight: 700, fontSize: "1.3rem", marginBottom: "20px" }}>📋 Storico documenti</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {history.map((doc) => (
                <div key={doc.id} className="feature-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px" }}>
                  <div>
                    <p style={{ fontWeight: 600, color: "#f1f5f9", marginBottom: "4px" }}>{doc.file_name}</p>
                    <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>{doc.document_type} • {new Date(doc.created_at).toLocaleDateString("it-IT")}</p>
                  </div>
                  <span className={`badge urgency-${doc.analysis.urgenza}`} style={{ fontSize: "0.8rem", borderRadius: "6px" }}>
                    {urgencyLabel[doc.analysis.urgenza]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
