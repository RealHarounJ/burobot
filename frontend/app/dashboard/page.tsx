"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, signOut } from "@/lib/supabase";
import { api } from "@/lib/api";

interface Analysis {
  tipo_documento: string;
  spiegazione: string;
  scadenza: string | null;
  importo: string | null;
  azioni: string[];
  urgenza: "alta" | "media" | "bassa";
  genera_risposta?: boolean;
}

interface ResponseLetter {
  id: string;
  response_type: string;
  letter_text: string;
  created_at: string;
}

interface Document {
  id: string;
  file_name: string;
  document_type: string;
  created_at: string;
  analysis: Analysis;
  original_text?: string;
  response_letters?: ResponseLetter[];
}

const urgencyLabel: Record<string, string> = {
  alta: "🔴 Urgente",
  media: "🟡 Media priorità",
  bassa: "🟢 Nessuna urgenza",
};

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [error, setError] = useState("");
  const [dragover, setDragover] = useState(false);
  const [history, setHistory] = useState<Document[]>([]);
  const [usage, setUsage] = useState<any>(null);
  
  // Letter generation states
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [userSituation, setUserSituation] = useState("");
  const [responseType, setResponseType] = useState("contestazione");
  const [generatedLetter, setGeneratedLetter] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || url.includes("xxxx.supabase.co")) {
      setError("Attenzione: Le chiavi di Supabase non sono ancora state configurate nelle variabili d'ambiente di Vercel. La dashboard non funzionerà.");
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/login?redirect=/dashboard");
        return;
      }
      setUser(user);
      loadHistoryAndUsage();
    });
  }, [router]);

  const loadHistoryAndUsage = async () => {
    try {
      const histData = await api.getHistory();
      setHistory(histData.documents || []);
      const usageData = await api.getUsage();
      setUsage(usageData);
    } catch (err) {
      console.error("Errore nel caricamento storico/usage", err);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

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
    setSelectedDoc(null);
    setGeneratedLetter("");
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setSelectedDoc(null);
    setGeneratedLetter("");

    try {
      const data = await api.analyzeDocument(file);
      if (data.success && data.document_id) {
        // Fetch full document with empty response letters
        const newDoc: Document = {
          id: data.document_id,
          file_name: file.name,
          document_type: data.analysis.tipo_documento,
          created_at: new Date().toISOString(),
          analysis: data.analysis,
          response_letters: []
        };
        setSelectedDoc(newDoc);
        setFile(null);
        loadHistoryAndUsage();
      } else {
        throw new Error("Impossibile salvare il documento");
      }
    } catch (e: any) {
      setError(e.message || "Errore sconosciuto durante l'analisi.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDocFromHistory = async (docId: string) => {
    setLoading(true);
    setError("");
    setFile(null);
    setGeneratedLetter("");
    setUserSituation("");
    try {
      // We call the single document detail endpoint to get original_text and response_letters
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      const res = await fetch(`${API_URL}/api/documents/${docId}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`
        }
      });
      if (!res.ok) throw new Error("Errore nel caricamento del documento");
      
      const fullDoc = await res.json();
      setSelectedDoc(fullDoc);
      
      // If there are already generated letters, display the latest one
      if (fullDoc.response_letters && fullDoc.response_letters.length > 0) {
        setGeneratedLetter(fullDoc.response_letters[0].letter_text);
        setResponseType(fullDoc.response_letters[0].response_type);
      }
    } catch (err: any) {
      setError(err.message || "Errore nel caricamento del documento.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLetter = async () => {
    if (!selectedDoc) return;
    if (!userSituation.trim()) {
      setError("Spiega brevemente la tua situazione per generare la risposta.");
      return;
    }
    setGeneratingLetter(true);
    setError("");

    try {
      const res = await api.generateResponse(selectedDoc.id, userSituation, responseType);
      if (res.success && res.letter) {
        setGeneratedLetter(res.letter);
        // Refresh document details to include the new letter in history
        handleSelectDocFromHistory(selectedDoc.id);
      } else {
        throw new Error("Errore nella generazione della lettera");
      }
    } catch (err: any) {
      setError(err.message || "Impossibile generare la lettera.");
    } finally {
      setGeneratingLetter(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLetter);
    alert("Lettera copiata negli appunti!");
  };

  const handleReset = () => {
    setFile(null);
    setSelectedDoc(null);
    setGeneratedLetter("");
    setUserSituation("");
    setError("");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", display: "flex", flexDirection: "column" }}>
      {/* Navbar */}
      <nav style={{
        padding: "16px 40px",
        background: "rgba(10,10,15,0.9)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(99,102,241,0.15)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        zIndex: 10
      }}>
        <Link href="/" style={{ fontSize: "1.3rem", fontWeight: 800, background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textDecoration: "none" }}>
          🤖 BuroBot
        </Link>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <Link href="/pricing" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.9rem" }}>
            Piani {usage?.plan && <span className="badge" style={{ padding: "2px 8px", fontSize: "0.75rem", marginLeft: "4px" }}>{usage.plan.toUpperCase()}</span>}
          </Link>
          <Link href="/profile" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.9rem" }}>Profilo</Link>
          <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.9rem" }}>Esci</button>
        </div>
      </nav>

      {/* Main Grid Layout */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "30px",
        maxWidth: "1300px",
        width: "100%",
        margin: "0 auto",
        padding: "40px 24px"
      }}>
        
        {/* LEFT COLUMN: Upload & Histroy */}
        <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
          
          {/* UPLOAD BOX */}
          <div className="glass-card" style={{ padding: "30px" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "16px" }}>Analizza Documento</h2>
            
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
              style={{ padding: "30px 20px" }}
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
                  <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>
                    {file.type === "application/pdf" ? "📄" : "🖼️"}
                  </div>
                  <p style={{ fontWeight: 600, color: "#f1f5f9", fontSize: "0.9rem", wordBreak: "break-all" }}>{file.name}</p>
                  <p style={{ color: "#6b7280", fontSize: "0.8rem", marginTop: "4px" }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>📤</div>
                  <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "#f1f5f9" }}>
                    Trascina qui il file o clicca
                  </p>
                  <p style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: "4px" }}>
                    PDF, JPG, PNG o WEBP • Max 10MB
                  </p>
                </div>
              )}
            </div>

            {file && !loading && (
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button onClick={handleAnalyze} className="btn-primary" style={{ flex: 1, padding: "12px", fontSize: "0.9rem", justifyContent: "center" }}>
                  🔍 Analizza ora
                </button>
                <button onClick={handleReset} className="btn-secondary" style={{ padding: "12px", fontSize: "0.9rem" }}>
                  Annulla
                </button>
              </div>
            )}

            {loading && (
              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <div className="spinner" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>BuroBot sta leggendo il documento ed elaborando...</p>
              </div>
            )}

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "12px", padding: "12px", marginTop: "16px", color: "#f87171", fontSize: "0.85rem" }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* HISTORY LIST */}
          <div className="glass-card" style={{ padding: "30px", flex: 1, display: "flex", flexDirection: "column" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "16px" }}>Cronologia Analisi</h2>
            
            {history.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "150px" }}>
                <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Nessun documento analizzato finora.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
                {history.map((doc) => (
                  <div
                    key={doc.id}
                    className="feature-card"
                    onClick={() => handleSelectDocFromHistory(doc.id)}
                    style={{
                      cursor: "pointer",
                      padding: "12px 16px",
                      background: selectedDoc?.id === doc.id ? "rgba(99,102,241,0.1)" : "var(--bg-card)",
                      borderColor: selectedDoc?.id === doc.id ? "rgba(99,102,241,0.4)" : "var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <p style={{ fontWeight: 600, color: "#f1f5f9", fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px" }}>
                        {doc.file_name}
                      </p>
                      <span className={`badge urgency-${doc.analysis.urgenza}`} style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                        {doc.analysis.urgenza}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "4px" }}>
                      {doc.document_type} • {new Date(doc.created_at).toLocaleDateString("it-IT")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Results & Letter Generator */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {selectedDoc ? (
            <div className="glass-card animate-fade-up" style={{ padding: "30px", height: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Analysis Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "20px" }}>
                <div>
                  <span className="badge" style={{ marginBottom: "6px" }}>{selectedDoc.document_type}</span>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 800 }}>{selectedDoc.file_name}</h2>
                </div>
                <div style={{ display: "flex", gap: "8px", flexDirection: "column", alignItems: "flex-end" }}>
                  <span className={`badge urgency-${selectedDoc.analysis.urgenza}`} style={{ borderRadius: "8px" }}>
                    {urgencyLabel[selectedDoc.analysis.urgenza]}
                  </span>
                  <button onClick={handleReset} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.75rem" }}>Chiudi</button>
                </div>
              </div>

              {/* Deadline & Amounts */}
              {(selectedDoc.analysis.scadenza || selectedDoc.analysis.importo) && (
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {selectedDoc.analysis.scadenza && (
                    <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "10px 16px" }}>
                      <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "2px" }}>Scadenza Rilevata</p>
                      <p style={{ fontWeight: 700, color: "#fbbf24", fontSize: "0.95rem" }}>⏰ {selectedDoc.analysis.scadenza}</p>
                    </div>
                  )}
                  {selectedDoc.analysis.importo && (
                    <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "10px 16px" }}>
                      <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "2px" }}>Importo Rilevato</p>
                      <p style={{ fontWeight: 700, color: "#f87171", fontSize: "0.95rem" }}>💶 {selectedDoc.analysis.importo}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Spiegazione */}
              <div>
                <h3 style={{ fontWeight: 700, marginBottom: "8px", color: "#a78bfa", fontSize: "1.05rem" }}>📖 Significato del documento</h3>
                <p style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: "0.95rem" }}>{selectedDoc.analysis.spiegazione}</p>
              </div>

              {/* Azioni Consigliate */}
              <div>
                <h3 style={{ fontWeight: 700, marginBottom: "8px", color: "#a78bfa", fontSize: "1.05rem" }}>✅ Cosa devi fare ora</h3>
                <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {selectedDoc.analysis.azioni.map((a, i) => (
                    <li key={i} style={{ color: "#cbd5e1", lineHeight: 1.5, fontSize: "0.95rem" }}>{a}</li>
                  ))}
                </ol>
              </div>

              {/* Letter Generator section */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "24px" }}>
                <h3 style={{ fontWeight: 800, marginBottom: "12px", color: "#a78bfa", fontSize: "1.1rem" }}>✍️ Scrivi Risposta Formale</h3>
                
                {generatedLetter ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Risposta Generata ({responseType === "contestazione" ? "Ricorso/Contestazione" : "Richiesta Informazioni"}):</span>
                      <button onClick={copyToClipboard} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.75rem" }}>📋 Copia Lettera</button>
                    </div>
                    <textarea
                      readOnly
                      value={generatedLetter}
                      style={{
                        width: "100%",
                        height: "220px",
                        background: "rgba(10, 10, 15, 0.8)",
                        border: "1px solid rgba(99, 102, 241, 0.2)",
                        borderRadius: "12px",
                        padding: "16px",
                        color: "#cbd5e1",
                        fontSize: "0.9rem",
                        fontFamily: "monospace",
                        lineHeight: "1.5",
                        outline: "none",
                        resize: "none"
                      }}
                    />
                    <button
                      onClick={() => setGeneratedLetter("")}
                      className="btn-secondary"
                      style={{ padding: "10px", justifyContent: "center", fontSize: "0.85rem" }}
                    >
                      Genera un'altra risposta
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: "1.5" }}>
                      Spiega a BuroBot la tua situazione (es. "Ho già pagato questo tributo il 12/03", o "Voglio richiedere la rateizzazione dell'importo"). BuroBot scriverà per te una lettera formale o un ricorso.
                    </p>

                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: "150px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Tipo di risposta</label>
                        <select
                          value={responseType}
                          onChange={(e) => setResponseType(e.target.value)}
                          style={{
                            background: "rgba(10, 10, 15, 0.6)",
                            border: "1px solid rgba(99, 102, 241, 0.2)",
                            borderRadius: "8px",
                            padding: "10px",
                            color: "white",
                            fontSize: "0.9rem",
                            outline: "none"
                          }}
                        >
                          <option value="contestazione">Ricorso o Contestazione</option>
                          <option value="rateizzazione">Richiesta di Rateizzazione</option>
                          <option value="autotutela">Istanza di Autotutela</option>
                          <option value="informazioni">Richiesta di Chiarimenti</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>La tua situazione / motivazioni</label>
                      <textarea
                        value={userSituation}
                        onChange={(e) => setUserSituation(e.target.value)}
                        placeholder="Descrivi cosa vorresti dire o quali prove hai (es. Ricevuta pagamento, errore dell'ufficio...)"
                        style={{
                          width: "100%",
                          height: "90px",
                          background: "rgba(10, 10, 15, 0.6)",
                          border: "1px solid rgba(99, 102, 241, 0.2)",
                          borderRadius: "12px",
                          padding: "12px",
                          color: "white",
                          fontSize: "0.9rem",
                          outline: "none",
                          resize: "none"
                        }}
                      />
                    </div>

                    <button
                      disabled={generatingLetter}
                      onClick={handleGenerateLetter}
                      className="btn-primary"
                      style={{ justifyContent: "center", padding: "12px", fontSize: "0.9rem" }}
                    >
                      {generatingLetter ? (
                        <div className="spinner" style={{ width: 18, height: 18 }} />
                      ) : (
                        "✍️ Genera lettera formale"
                      )}
                    </button>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="glass-card" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", minHeight: "350px", textAlign: "center" }}>
              <div style={{ fontSize: "4rem", marginBottom: "20px" }}>🤖</div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "8px" }}>Pronto ad aiutarti</h2>
              <p style={{ color: "#94a3b8", maxWidth: "340px", fontSize: "0.95rem", lineHeight: 1.6 }}>
                Carica un documento o selezionane uno dalla cronologia per vedere l'analisi dettagliata e generare risposte formali.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
