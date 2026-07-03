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
const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, base: 1, pmi: 1, studio: 1 };
const hasPlan = (userPlan: string, required: string) =>
  (PLAN_RANK[userPlan] ?? 0) >= (PLAN_RANK[required] ?? 0);

const urgencyLabel: Record<string, { label: string; color: string; bg: string }> = {
  alta:  { label: "Urgente",          color: "#f87171", bg: "rgba(239,68,68,0.12)"  },
  media: { label: "Priorità media",   color: "#fbbf24", bg: "rgba(245,158,11,0.12)" },
  bassa: { label: "Nessuna urgenza",  color: "#4ade80", bg: "rgba(34,197,94,0.12)"  },
};

const planBadge: Record<string, { label: string; cls: string }> = {
  free:   { label: "FREE",   cls: "badge-free"   },
  pro:    { label: "PRO",    cls: "badge-studio" },
  base:   { label: "PRO",    cls: "badge-studio" },
  pmi:    { label: "PRO",    cls: "badge-studio" },
  studio: { label: "PRO",    cls: "badge-studio" },
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
    pdf.text(`Scadenza: `, margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(scadenza, margin + 20, y);
    y += 7;
  }
  if (importo) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(`Importo: `, margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(importo, margin + 18, y);
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
      {enabled ? "Modalità Facile ON" : "Modalità Facile"}
    </button>
  );
}

function PlanGate({ required, current, children }: { required: string; current: string; children: React.ReactNode }) {
  if (hasPlan(current, required)) return <>{children}</>;
  const planNames: Record<string, string> = { base: "Base", pmi: "PMI", studio: "Studio" };
  const planColors: Record<string, string> = { base: "badge-base", pmi: "badge-pmi", studio: "badge-studio" };
  return (
    <div className={`plan-gate ${required === "studio" ? "plan-gate-studio" : required === "pmi" ? "plan-gate-pmi" : ""}`}>
      <p style={{ fontWeight: 700, marginBottom: "6px", fontSize: "var(--font-base)", color: "var(--text-main)" }}>
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
        <div className="stat-value" style={{ color: "#4ade80" }}>∞</div>
        <div className="stat-label">Limite Analisi</div>
      </div>
    </div>
  );
}

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

  // Normattiva Ingestion
  const [normattivaUrl, setNormattivaUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");

  // Letter
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [userSituation, setUserSituation] = useState("");
  const [responseType, setResponseType] = useState("contestazione");
  const [generatedLetter, setGeneratedLetter] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  // Tab (per piani superiori)
  const [activeTab, setActiveTab] = useState<"analisi" | "contratti" | "team" | "welfare">("analisi");
  const [activeDocTab, setActiveDocTab] = useState("cartelle");

  // AI Copilot States
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // PagoPA States
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // PEC States
  const [showPecModal, setShowPecModal] = useState(false);
  const [pecLoading, setPecLoading] = useState(false);
  const [pecRecipient, setPecRecipient] = useState("");
  const [pecSenderName, setPecSenderName] = useState("");
  const [pecSuccessReceipt, setPecSuccessReceipt] = useState<any>(null);

  // Welfare Matchmaker States
  const [welfareFile, setWelfareFile] = useState<File | null>(null);
  const [welfareLoading, setWelfareLoading] = useState(false);
  const [matchedBonuses, setMatchedBonuses] = useState<any[]>([]);

  // Team Collaborator States
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("collaboratore");
  const [collaborators, setCollaborators] = useState<any[]>([]);

  const loadTeam = async () => {
    try {
      const teamData = await api.getTeamMembers();
      setCollaborators(teamData.members || []);
    } catch (err) {
      console.error("Errore nel caricamento del team:", err);
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const welfareFileRef = useRef<HTMLInputElement>(null);
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
      if (u.plan && u.plan !== "free") {
        await loadTeam();
      }
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

  const handleImportLaw = async () => {
    if (!normattivaUrl.trim()) return;
    if (!hasPlan(plan, "pro")) {
      setImportError("L'importazione di leggi da Normattiva è una funzione riservata agli utenti BuroBot Pro. Vai alla pagina Piani per effettuare l'upgrade.");
      return;
    }
    setImportLoading(true);
    setImportError("");
    setImportSuccess("");
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const API_URL = "https://burobot-production-4c5a.up.railway.app";
      
      const res = await fetch(`${API_URL}/api/ai/knowledge/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ url: normattivaUrl.trim() }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Errore durante l'importazione.");
      }
      
      setImportSuccess(data.message || "Legge importata con successo!");
      setNormattivaUrl("");
    } catch (err: any) {
      setImportError(err.message || "Impossibile completare l'importazione.");
    } finally {
      setImportLoading(false);
    }
  };

  // AI Copilot Chat Handler
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !selectedDoc) return;
    const userMsg = { role: "user" as const, text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const contextText = selectedDoc.original_text || selectedDoc.analysis?.spiegazione || "";
      const historyPayload = chatMessages.map(m => ({ role: m.role, text: m.text }));
      const res = await api.chat(chatInput, contextText, historyPayload);
      const botMsg = { role: "model" as const, text: res.response };
      setChatMessages(prev => [...prev, botMsg]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: "model" as const, text: `Errore: ${e.message || "impossibile ottenere risposta"}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  // PagoPA Payment Handler
  const handlePayPagoPA = async () => {
    if (!selectedDoc) return;
    setPaymentLoading(true);
    try {
      const res = await api.simulatePagoPA(selectedDoc.id);
      if (res.success) {
        setSelectedDoc(prev => {
          if (!prev) return null;
          return {
            ...prev,
            analysis: {
              ...prev.analysis,
              pagato: true,
              pagato_at: "oggi"
            }
          };
        });
        alert("Pagamento PagoPA simulato correttamente! Ricevuta registrata.");
        setShowPayModal(false);
        loadData();
      }
    } catch (e: any) {
      alert(`Errore nel pagamento: ${e.message || "riprova"}`);
    } finally {
      setPaymentLoading(false);
    }
  };

  // PEC Sending Handler
  const handleSendPEC = async () => {
    if (!selectedDoc || !pecRecipient.trim() || !pecSenderName.trim()) return;
    setPecLoading(true);
    setPecSuccessReceipt(null);
    try {
      const letterText = generatedLetter || selectedDoc.analysis?.spiegazione || "";
      const res = await api.sendPec(selectedDoc.id, pecRecipient, pecSenderName, letterText);
      if (res.success) {
        setPecSuccessReceipt(res.receipt);
        setSelectedDoc(prev => {
          if (!prev) return null;
          return {
            ...prev,
            analysis: {
              ...prev.analysis,
              pec_inviata: true,
              pec_inviata_at: "oggi",
              pec_recipient: pecRecipient
            }
          };
        });
        loadData();
      }
    } catch (e: any) {
      alert(`Errore nell'invio PEC: ${e.message || "riprova"}`);
    } finally {
      setPecLoading(false);
    }
  };

  // Welfare Matchmaker Upload Handler
  const handleWelfareUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setWelfareFile(f);
    setWelfareLoading(true);
    setMatchedBonuses([]);
    try {
      const data = await api.analyzeDocument(f);
      if (data.success && data.document_id) {
        const bonusRes = await api.matchBonuses(data.document_id);
        if (bonusRes.success) {
          setMatchedBonuses(bonusRes.bonuses);
        }
        loadData();
      }
    } catch (err: any) {
      alert(`Errore durante l'elaborazione ISEE: ${err.message || "riprova"}`);
    } finally {
      setWelfareLoading(false);
    }
  };

  const loadDocFull = async (docId: string) => {
    setLoading(true); setError(""); setFile(null); setGeneratedLetter(""); setUserSituation("");
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const API_URL = "https://burobot-production-4c5a.up.railway.app";
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
    if (!hasPlan(plan, "pro")) {
      setError("La generazione di ricorsi e lettere formali è una funzione riservata agli utenti BuroBot Pro. Vai alla pagina Piani per effettuare l'upgrade.");
      return;
    }
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
    if (!hasPlan(plan, "pro")) {
      setError("L'esportazione del PDF professionale è una funzione riservata agli utenti BuroBot Pro. Vai alla pagina Piani per effettuare l'upgrade.");
      return;
    }
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
          color: "var(--primary)",
          textDecoration: "none", whiteSpace: "nowrap",
        }}>
          BuroBot
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
          <span style={{ fontWeight: 700, fontSize: "var(--font-base)" }}>Modalità Facile attiva</span>
          <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>— Testi più grandi, interfaccia semplificata</span>
        </div>
      )}

      {/* ── TABS (Navigazione Piattaforma) ── */}
      <div style={{ background: "rgba(10,10,15,0.6)", borderBottom: "1px solid var(--border)", padding: "12px 32px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button style={tabStyle("analisi")} onClick={() => setActiveTab("analisi")}>Analisi Documenti</button>
        <button style={tabStyle("welfare")} onClick={() => setActiveTab("welfare")}>Bonus & Welfare</button>
        {hasPlan(plan, "base") && <button style={tabStyle("contratti")} onClick={() => setActiveTab("contratti")}>Contratti Commerciali</button>}
        {hasPlan(plan, "pmi") && <button style={tabStyle("team")} onClick={() => setActiveTab("team")}>Gestione Team</button>}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, maxWidth: "1400px", width: "100%", margin: "0 auto", padding: "32px 24px" }}>

        {/* STAT CARDS */}
        <StatCards usage={usage} history={history} />

        {/* TAB: CONTRATTI COMMERCIALI */}
        {activeTab === "contratti" && (
          <div className="glass-card animate-fade-up" style={{ padding: "40px", textAlign: "center" }}>
            <h2 style={{ fontSize: "var(--font-2xl)", fontWeight: 900, marginBottom: "12px" }}>Analisi Contratti Commerciali</h2>
            <p style={{ color: "var(--text-muted)", maxWidth: "500px", margin: "0 auto 24px", lineHeight: 1.7, fontSize: "var(--font-base)" }}>
              Carica un contratto commerciale, di locazione, di fornitura o qualsiasi accordo commerciale. BuroBot lo analizza evidenziando clausole rischiose, obblighi e scadenze.
            </p>
            <div className="upload-zone" onClick={() => fileRef.current?.click()} style={{ maxWidth: "500px", margin: "0 auto" }}>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); setActiveTab("analisi"); } }} />
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
                <h2 style={{ fontSize: "var(--font-2xl)", fontWeight: 900, marginBottom: "6px" }}>Gestione Team</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>
                  {hasPlan(plan, "studio") ? "Account collaboratori illimitati" : "Fino a 5 collaboratori"}
                </p>
              </div>
              <button 
                onClick={() => setShowInviteModal(true)} 
                className="btn-primary" 
                style={{ fontSize: "var(--font-sm)", padding: "10px 20px" }}
              >
                + Invita Collaboratore
              </button>
            </div>
            {collaborators.length === 0 ? (
              <div style={{ background: "rgba(99,102,241,0.05)", border: "1px dashed rgba(99,102,241,0.3)", borderRadius: "var(--radius-lg)", padding: "40px", textAlign: "center" }}>
                <p style={{ fontWeight: 700, marginBottom: "8px", fontSize: "var(--font-base)" }}>Nessun collaboratore ancora</p>
                <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>Invita i tuoi colleghi via email per condividere i documenti analizzati.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", marginBottom: "20px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <th style={{ padding: "12px", color: "var(--text-muted)", fontSize: "var(--font-xs)", textTransform: "uppercase" }}>Nome</th>
                      <th style={{ padding: "12px", color: "var(--text-muted)", fontSize: "var(--font-xs)", textTransform: "uppercase" }}>Email</th>
                      <th style={{ padding: "12px", color: "var(--text-muted)", fontSize: "var(--font-xs)", textTransform: "uppercase" }}>Ruolo</th>
                      <th style={{ padding: "12px", color: "var(--text-muted)", fontSize: "var(--font-xs)", textTransform: "uppercase" }}>Stato</th>
                      <th style={{ padding: "12px", color: "var(--text-muted)", fontSize: "var(--font-xs)", textTransform: "uppercase" }}>Azione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collaborators.map((c, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "12px", fontWeight: 600, color: "var(--text-main)", fontSize: "var(--font-sm)" }}>{c.name}</td>
                        <td style={{ padding: "12px", color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>{c.email}</td>
                        <td style={{ padding: "12px", color: "var(--text-muted)", fontSize: "var(--font-sm)", textTransform: "capitalize" }}>{c.role}</td>
                        <td style={{ padding: "12px" }}>
                          <span className={`badge ${c.status === "attivo" ? "badge-success" : "badge-warning"}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <button 
                            onClick={async () => {
                              try {
                                await api.removeMember(c.email);
                                loadTeam();
                              } catch (err: any) {
                                setError("Errore nella rimozione: " + err.message);
                              }
                            }}
                            style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "var(--font-xs)", fontWeight: 600 }}
                          >
                            Rimuovi
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hasPlan(plan, "studio") && (
              <div style={{ marginTop: "24px", padding: "20px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-lg)" }}>
                <p style={{ fontWeight: 700, color: "var(--primary-light)", marginBottom: "6px" }}>Studio Pro</p>
                <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>
                  Il tuo piano Studio include un account manager dedicato. Contatta il tuo referente:
                  <a href="mailto:studio@burobot.it" style={{ color: "var(--primary-light)", marginLeft: "6px" }}>studio@burobot.it</a>
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB: BONUS & WELFARE MATCHMAKER */}
        {activeTab === "welfare" && (
          <div className="glass-card animate-fade-up" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <span className="badge" style={{ marginBottom: "8px" }}>Welfare & Agevolazioni</span>
              <h2 style={{ fontSize: "var(--font-2xl)", fontWeight: 800, marginTop: "6px" }}>Bonus & Welfare Matchmaker</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)", marginTop: "6px", lineHeight: 1.6 }}>
                Carica il tuo ISEE, 730 o CU. BuroBot leggerà i dati economici del tuo nucleo familiare e calcolerà in tempo reale a quali bonus statali o comunali hai diritto.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "28px", alignItems: "start" }}>
              {/* Left Column: Upload ISEE */}
              <div className="glass-card" style={{ padding: "24px", background: "rgba(255,255,255,0.02)" }}>
                <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: "12px" }}>1. Carica l'attestazione</h3>
                
                <div
                  className="upload-zone"
                  style={{ height: "160px", borderStyle: "dashed" }}
                  onClick={() => welfareFileRef.current?.click()}
                >
                  <input
                    ref={welfareFileRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    style={{ display: "none" }}
                    onChange={handleWelfareUpload}
                  />
                  {welfareFile ? (
                    <div>
                      <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "var(--font-sm)", wordBreak: "break-all" }}>{welfareFile.name}</p>
                      <p style={{ color: "var(--text-dim)", fontSize: "var(--font-xs)", marginTop: "4px" }}>{(welfareFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "var(--font-sm)" }}>Scegli ISEE o 730</p>
                      <p style={{ color: "var(--text-dim)", fontSize: "var(--font-xs)", marginTop: "4px" }}>PDF, JPG, PNG • Max 10MB</p>
                    </div>
                  )}
                </div>

                {welfareLoading && (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div className="spinner" style={{ margin: "0 auto 12px" }} />
                    <p style={{ color: "var(--text-muted)", fontSize: "var(--font-xs)" }}>Scansione e calcolo requisiti in corso...</p>
                  </div>
                )}
              </div>

              {/* Right Column: Bonus Results Grid */}
              <div style={{ gridColumn: "span 2" }}>
                <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: "12px" }}>2. Agevolazioni Individuate</h3>
                
                {matchedBonuses.length === 0 ? (
                  <div className="glass-card" style={{ padding: "40px 20px", textAlign: "center", borderStyle: "dashed" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>
                      Nessun documento analizzato. Carica il tuo ISEE per scoprire i bonus compatibili.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {matchedBonuses.map((bonus, idx) => (
                      <div
                        key={idx}
                        className="glass-card"
                        style={{
                          padding: "20px",
                          border: `1px solid ${
                            bonus.stato === "idoneo"
                              ? "rgba(74,222,128,0.3)"
                              : bonus.stato === "non idoneo"
                              ? "rgba(239,68,68,0.2)"
                              : "rgba(251,191,36,0.3)"
                          }`,
                          background: `${
                            bonus.stato === "idoneo"
                              ? "rgba(74,222,128,0.02)"
                              : bonus.stato === "non idoneo"
                              ? "rgba(239,68,68,0.01)"
                              : "rgba(251,191,36,0.02)"
                          }`,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                          <div>
                            <h4 style={{ fontSize: "var(--font-lg)", fontWeight: 700, color: "var(--text-main)" }}>{bonus.nome}</h4>
                            <p style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", marginTop: "4px" }}>Requisiti: {bonus.requisiti}</p>
                          </div>
                          <span
                            className={`urgency-${
                              bonus.stato === "idoneo" ? "bassa" : bonus.stato === "non idoneo" ? "alta" : "media"
                            }`}
                            style={{
                              background:
                                bonus.stato === "idoneo"
                                  ? "rgba(74,222,128,0.15)"
                                  : bonus.stato === "non idoneo"
                                  ? "rgba(239,68,68,0.15)"
                                  : "rgba(251,191,36,0.15)",
                              color:
                                bonus.stato === "idoneo" ? "#4ade80" : bonus.stato === "non idoneo" ? "#f87171" : "#fbbf24",
                              border: "1px solid currentColor",
                              padding: "4px 10px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              textTransform: "uppercase"
                            }}
                          >
                            {bonus.stato === "idoneo" ? "Idoneo" : bonus.stato === "non idoneo" ? "Escluso" : "Verificare"}
                          </span>
                        </div>

                        <p style={{ color: "var(--text-dim)", fontSize: "var(--font-sm)", marginTop: "12px", lineHeight: 1.6 }}>
                          {bonus.descrizione}
                        </p>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <span style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>
                            Scadenza: <strong>{bonus.scadenza}</strong>
                          </span>
                          <span style={{ fontSize: "var(--font-lg)", fontWeight: 800, color: "var(--primary-light)" }}>
                            {bonus.importo}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: ANALISI PRINCIPALE */}
        {activeTab === "analisi" && (
          <div className="dashboard-layout">

            {/* LEFT: Upload + History */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

              {/* UPLOAD */}
              <div className="glass-card" style={{ padding: "28px" }}>
                <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  Analizza Documento
                </h2>

                {easyMode && (
                  <div style={{ background: "rgba(99,102,241,0.1)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px", marginBottom: "16px", fontSize: "var(--font-base)" }}>
                    <strong>Come funziona:</strong><br />
                    1. Clicca qui sotto e scegli il documento<br />
                    2. Clicca il bottone "Analizza ora"<br />
                    3. Aspetta 10 secondi — BuroBot ti spiega tutto!
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
                      <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "var(--font-base)", wordBreak: "break-all" }}>{file.name}</p>
                      <p style={{ color: "var(--text-dim)", fontSize: "var(--font-sm)", marginTop: "4px" }}>{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                  ) : (
                    <div>
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
                      Analizza ora
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
                  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "14px", marginTop: "14px", color: "var(--danger)", fontSize: "var(--font-sm)", lineHeight: 1.5 }}>
                    {error}
                  </div>
                )}

                {/* PIANO FREE WARNING */}
                {plan === "free" && usage && (usage.remaining ?? 0) <= 1 && (
                  <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius-md)", padding: "14px", marginTop: "14px" }}>
                    <p style={{ color: "var(--warning)", fontWeight: 700, fontSize: "var(--font-sm)", marginBottom: "8px" }}>
                      {usage.remaining === 0 ? "Hai esaurito i documenti gratuiti" : `Ti rimane solo ${usage.remaining} documento gratuito`}
                    </p>
                    <Link href="/pricing" className="btn-primary" style={{ fontSize: "var(--font-xs)", padding: "8px 16px" }}>
                      Passa a Base — €9.99/mese
                    </Link>
                  </div>
                )}
              </div>

              {/* HISTORY */}
              <div className="glass-card" style={{ padding: "28px" }}>
                <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginBottom: "16px" }}>Cronologia</h2>
                {history.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}>
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

              {/* NORMATTIVA IMPORT */}
              <div className="glass-card" style={{ padding: "28px" }}>
                <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 800, marginBottom: "16px" }}>
                  Importa da Normattiva
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "var(--font-xs)", marginBottom: "14px", lineHeight: 1.5 }}>
                  Incolla un URL ufficiale di Normattiva (es. URN o link dell'atto) per inserire il testo di legge nella base di conoscenza di BuroBot.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="https://www.normattiva.it/uri-res/..."
                    value={normattivaUrl}
                    onChange={(e) => setNormattivaUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      color: "var(--text-main)",
                      fontSize: "var(--font-sm)",
                    }}
                  />
                  {importError && (
                    <p style={{ color: "var(--danger)", fontSize: "var(--font-xs)", marginTop: "2px" }}>
                      {importError}
                    </p>
                  )}
                  {importSuccess && (
                    <p style={{ color: "#4ade80", fontSize: "var(--font-xs)", marginTop: "2px" }}>
                      {importSuccess}
                    </p>
                  )}
                  <button
                    onClick={handleImportLaw}
                    disabled={importLoading || !normattivaUrl.trim()}
                    className="btn-primary"
                    style={{
                      padding: "10px",
                      fontSize: "var(--font-sm)",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    {importLoading ? (
                      <>
                        <div className="spinner" style={{ width: 14, height: 14, borderWidth: "2px" }} />
                        Importazione...
                      </>
                    ) : (
                      "Importa Legge"
                    )}
                  </button>
                </div>
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
                  <div style={{ display: "flex", gap: "24px", alignItems: "start", flexWrap: "wrap", width: "100%" }}>
                    <div className="glass-card animate-fade-up" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px", flex: 1, minWidth: "300px" }}>

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
                        
                        {/* Toggle AI Copilot */}
                        <button
                          onClick={() => setShowChat(!showChat)}
                          className={`btn-secondary ${showChat ? "active" : ""}`}
                          style={{
                            padding: "8px 14px", fontSize: "var(--font-xs)",
                            background: showChat ? "rgba(99,102,241,0.15)" : "",
                            borderColor: showChat ? "var(--primary)" : ""
                          }}
                        >
                          Copilot AI {showChat ? "ON" : "OFF"}
                        </button>

                        {/* Export PDF — tutti i piani */}
                        <button
                          onClick={handleExportPDF}
                          disabled={exportingPdf}
                          className="btn-secondary"
                          style={{ padding: "8px 14px", fontSize: "var(--font-xs)" }}
                          title="Scarica analisi in PDF"
                        >
                          {exportingPdf ? <div className="spinner" style={{ width: 14, height: 14 }} /> : "PDF"}
                        </button>
                        <button onClick={handleReset} className="btn-secondary" style={{ padding: "8px 12px", fontSize: "var(--font-xs)" }}>Chiudi</button>
                      </div>
                    </div>

                    {/* Scadenza + Importo */}
                    {(scadenza || importo) && (
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        {scadenza && (
                          <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "var(--radius-md)", padding: "14px 20px", flex: 1, minWidth: "140px" }}>
                            <p style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Scadenza</p>
                            <p style={{ fontWeight: 800, color: "var(--warning)", fontSize: "var(--font-lg)" }}>{scadenza}</p>
                          </div>
                        )}
                        {importo && (
                          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-md)", padding: "14px 20px", flex: 1, minWidth: "140px" }}>
                            <p style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Importo</p>
                            <p style={{ fontWeight: 800, color: "var(--danger)", fontSize: "var(--font-lg)" }}>{importo}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PagoPA Sim Widget */}
                    {importo && (
                      <div style={{
                        background: selectedDoc.analysis?.pagato ? "rgba(74,222,128,0.06)" : "rgba(99,102,241,0.06)",
                        border: `1px solid ${selectedDoc.analysis?.pagato ? "rgba(74,222,128,0.3)" : "rgba(99,102,241,0.3)"}`,
                        borderRadius: "var(--radius-md)", padding: "16px 20px",
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ background: selectedDoc.analysis?.pagato ? "#4ade80" : "var(--primary)", width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.8rem", color: "white" }}>
                            pPA
                          </div>
                          <div>
                            <p style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--text-main)" }}>PagoPA / F24 Integrato</p>
                            <p style={{ fontSize: "var(--font-xs)", color: "var(--text-dim)", marginTop: "2px" }}>
                              {selectedDoc.analysis?.pagato ? `Pagato via PagoPA il ${selectedDoc.analysis?.pagato_at || "oggi"}` : "Saldabile direttamente online in sicurezza"}
                            </p>
                          </div>
                        </div>
                        {selectedDoc.analysis?.pagato ? (
                          <span style={{ color: "#4ade80", fontWeight: 700, fontSize: "var(--font-sm)", display: "flex", alignItems: "center", gap: "6px" }}>
                            ✓ Pagato
                          </span>
                        ) : (
                          <button onClick={() => setShowPayModal(true)} className="btn-primary" style={{ padding: "8px 16px", fontSize: "var(--font-xs)" }}>
                            Paga ora con PagoPA
                          </button>
                        )}
                      </div>
                    )}

                    {/* Spiegazione */}
                    <div>
                      <h3 style={{ fontWeight: 700, marginBottom: "10px", color: "var(--accent)", fontSize: "var(--font-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                        Cosa significa questo documento
                      </h3>
                      <p style={{ color: "var(--text-main)", lineHeight: 1.8, fontSize: "var(--font-base)" }}>{spiegazione}</p>
                    </div>

                    {/* Azioni */}
                    <div>
                      <h3 style={{ fontWeight: 700, marginBottom: "10px", color: "var(--accent)", fontSize: "var(--font-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                        Cosa devi fare {easyMode ? "ADESSO" : "ora"}
                      </h3>
                      <ol style={{ paddingLeft: "0", display: "flex", flexDirection: "column", gap: "10px", listStyle: "none" }}>
                        {azioni.map((a, i) => (
                          <li key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", background: "var(--bg-card-hover)", borderRadius: "var(--radius-md)", padding: "12px 16px", border: "1px solid var(--border)" }}>
                            <span style={{ background: "var(--primary)", color: "white", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "var(--font-xs)", flexShrink: 0 }}>{i + 1}</span>
                            <span style={{ color: "var(--text-main)", lineHeight: 1.6, fontSize: "var(--font-base)" }}>{a}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                  <hr className="section-divider" />

                  {/* LETTERA — solo Base+ */}
                  <div>
                    <h3 style={{ fontWeight: 800, marginBottom: "14px", color: "var(--accent)", fontSize: "var(--font-base)", display: "flex", alignItems: "center", gap: "6px" }}>
                      {easyMode ? "Scrivi una lettera di risposta" : "Genera Risposta Formale"}
                    </h3>

                    <PlanGate required="base" current={plan}>
                      {generatedLetter ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button onClick={() => navigator.clipboard.writeText(generatedLetter).then(() => alert("Copiato!"))} className="btn-secondary" style={{ fontSize: "var(--font-xs)", padding: "8px 14px" }}>
                              Copia
                            </button>
                            <button onClick={handleExportPDF} disabled={exportingPdf} className="btn-secondary" style={{ fontSize: "var(--font-xs)", padding: "8px 14px" }}>
                              {exportingPdf ? <div className="spinner" style={{ width: 12, height: 12 }} /> : "Scarica PDF"}
                            </button>
                            <button onClick={() => setGeneratedLetter("")} className="btn-secondary" style={{ fontSize: "var(--font-xs)", padding: "8px 14px" }}>
                              Rigenera
                            </button>
                            {selectedDoc.analysis?.pec_inviata ? (
                              <span style={{ border: "1px solid rgba(74,222,128,0.4)", background: "rgba(74,222,128,0.1)", color: "#4ade80", borderRadius: "var(--radius-md)", padding: "8px 14px", fontSize: "var(--font-xs)", fontWeight: 600 }}>
                                ✓ Spedito via PEC
                              </span>
                            ) : (
                              <button onClick={() => {
                                setPecRecipient(selectedDoc.analysis?.pec_recipient || "ente@pec.amministrazione.it");
                                setPecSenderName(user?.email || "utente@pec.it");
                                setShowPecModal(true);
                              }} className="btn-primary" style={{ fontSize: "var(--font-xs)", padding: "8px 14px" }}>
                                Spedisci via PEC
                              </button>
                            )}
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
                              Come funziona: Scegli che tipo di risposta vuoi (ricorso, rateizzazione...) e spiega la tua situazione. BuroBot scrive la lettera per te!
                            </div>
                          )}
                          <div>
                            <label style={{ fontSize: "var(--font-sm)", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "8px" }}>Tipo di risposta</label>
                            <select value={responseType} onChange={(e) => setResponseType(e.target.value)} className="input-field">
                              <option value="contestazione">Ricorso / Contestazione</option>
                              <option value="rateizzazione">Richiesta Rateizzazione</option>
                              <option value="autotutela">Istanza di Autotutela</option>
                              <option value="informazioni">Richiesta di Chiarimenti</option>
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
                              ? <><div className="spinner" style={{ width: 18, height: 18 }} />{easyMode ? " Scrittura lettera in corso..." : " Generazione in corso..."}</>
                              : easyMode ? "Scrivi la lettera per me!" : "Genera lettera formale"}
                          </button>
                        </div>
                      )}
                    </PlanGate>
                  </div>

                  {/* EXPORT PDF STUDIO con logo */}
                  {hasPlan(plan, "studio") && (
                    <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
                      <p style={{ fontWeight: 700, color: "#fbbf24", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                        Studio Pro — Export Avanzato
                      </p>
                      <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)", marginBottom: "14px" }}>
                        Il PDF include intestazione professionale con i dati del tuo studio. Personalizzabile con il tuo logo.
                      </p>
                      <button onClick={handleExportPDF} disabled={exportingPdf} className="btn-success" style={{ fontSize: "var(--font-sm)", padding: "10px 20px" }}>
                        {exportingPdf ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Generando...</> : "Scarica PDF Professionale"}
                      </button>
                    </div>
                  )}

                  </div>

                  {/* AI COPILOT CHAT SIDEBAR */}
                  {showChat && (
                    <div className="glass-card animate-fade-up" style={{
                      width: "360px", height: "700px", display: "flex", flexDirection: "column", padding: "20px",
                      position: "sticky", top: "100px", flexShrink: 0, background: "rgba(10,10,20,0.85)"
                    }}>
                      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: "12px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, color: "var(--text-main)" }}>Copilot AI</h3>
                          <p style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", marginTop: "2px" }}>Chiedi spiegazioni o modifiche all'atto</p>
                        </div>
                        <button onClick={() => setShowChat(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
                      </div>

                      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px", marginBottom: "12px" }}>
                        {chatMessages.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-dim)", fontSize: "var(--font-xs)", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <p>Sono il tuo assistente burocratico dedicato.</p>
                            <p>Chiedimi pure: <i>"Ci sono termini di ricorso?"</i> o <i>"Rendi la lettera più aggressiva"</i>.</p>
                          </div>
                        ) : (
                          chatMessages.map((msg, i) => (
                            <div key={i} style={{
                              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                              background: msg.role === "user" ? "var(--primary)" : "var(--bg-card-hover)",
                              color: msg.role === "user" ? "#ffffff" : "var(--text-main)",
                              padding: "10px 14px",
                              borderRadius: "var(--radius-md)",
                              borderTopRightRadius: msg.role === "user" ? "0" : "var(--radius-md)",
                              borderTopLeftRadius: msg.role === "model" ? "0" : "var(--radius-md)",
                              maxWidth: "85%",
                              fontSize: "var(--font-sm)",
                              lineHeight: 1.5,
                              border: msg.role === "model" ? "1px solid var(--border)" : "none"
                            }}>
                              {msg.text}
                            </div>
                          ))
                        )}
                        {chatLoading && (
                          <div style={{ alignSelf: "flex-start", background: "var(--bg-card-hover)", padding: "10px 14px", borderRadius: "var(--radius-md)", borderTopLeftRadius: 0, border: "1px solid var(--border)" }}>
                            <div className="spinner" style={{ width: 14, height: 14, borderWidth: "2px" }} />
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="text"
                          placeholder="Scrivi qui..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                          style={{
                            flex: 1, padding: "10px 12px", borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border)", background: "var(--bg-card)",
                            color: "var(--text-main)", fontSize: "var(--font-sm)"
                          }}
                        />
                        <button onClick={handleSendChatMessage} className="btn-primary" style={{ padding: "10px 14px" }}>
                          ➤
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })() : (
                <div className="glass-card animate-fade-up" style={{ display: "flex", flexDirection: "column", padding: "32px", gap: "24px", minHeight: "500px" }}>
                  <div style={{ textAlign: "center", marginBottom: "8px" }}>
                    <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 900, marginBottom: "8px", color: "var(--text-main)" }}>
                      Guida all'Analisi Documenti
                    </h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)", maxWidth: "480px", margin: "0 auto", lineHeight: 1.6 }}>
                      BuroBot è addestrato per estrarre e risolvere i problemi critici dei documenti burocratici italiani. Seleziona una tipologia per esplorarla.
                    </p>
                  </div>

                  {/* Mini Selector Tabs */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                    {docTypesGuide.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveDocTab(item.id)}
                        className={activeDocTab === item.id ? "btn-primary" : "btn-secondary"}
                        style={{
                          padding: "6px 12px",
                          fontSize: "var(--font-xs)",
                          borderRadius: "var(--radius-md)",
                          minHeight: "auto",
                          boxShadow: activeDocTab === item.id ? "0 2px 6px rgba(30, 58, 138, 0.1)" : "none"
                        }}
                      >
                        {item.category.split(" & ")[0]}
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const selected = docTypesGuide.find(d => d.id === activeDocTab) || docTypesGuide[0];
                    return (
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                        background: "var(--bg-dark)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        padding: "20px"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--text-main)" }}>
                            {selected.category}
                          </span>
                          <span className="badge" style={{ fontSize: "var(--font-xs)" }}>
                            Formati: {selected.formats}
                          </span>
                        </div>

                        {/* Problem */}
                        <div style={{
                          background: "#fef2f2",
                          borderLeft: "3.5px solid var(--danger)",
                          padding: "12px 14px",
                          borderRadius: "var(--radius-sm)",
                          borderTop: "1px solid #fee2e2",
                          borderRight: "1px solid #fee2e2",
                          borderBottom: "1px solid #fee2e2"
                        }}>
                          <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--danger)", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                            Il Problema Burocratico
                          </span>
                          <p style={{ fontSize: "var(--font-sm)", color: "#991b1b", lineHeight: 1.5 }}>
                            {selected.problem}
                          </p>
                        </div>

                        {/* Solution */}
                        <div style={{
                          background: "#f0fdf4",
                          borderLeft: "3.5px solid var(--success)",
                          padding: "12px 14px",
                          borderRadius: "var(--radius-sm)",
                          borderTop: "1px solid #dcfce7",
                          borderRight: "1px solid #dcfce7",
                          borderBottom: "1px solid #dcfce7"
                        }}>
                          <span style={{ fontSize: "var(--font-xs)", fontWeight: 700, color: "var(--success)", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                            Come lo risolve BuroBot
                          </span>
                          <p style={{ fontSize: "var(--font-sm)", color: "#166534", lineHeight: 1.5 }}>
                            {selected.solution}
                          </p>
                        </div>

                        {/* Load Mockup Button */}
                        <button
                          onClick={() => {
                            const newDoc = {
                              id: "mock_" + selected.id,
                              file_name: "Esempio_" + selected.category.replace(/[^a-zA-Z0-9]/g, "_") + ".pdf",
                              document_type: selected.mockup.document_type,
                              created_at: new Date().toISOString(),
                              analysis: {
                                tipo_documento: selected.mockup.document_type,
                                spiegazione: selected.mockup.spiegazione,
                                scadenza: selected.mockup.scadenza,
                                importo: selected.mockup.importo,
                                azioni: selected.mockup.azioni,
                                urgenza: selected.mockup.urgenza as any
                              }
                            };
                            setSelectedDoc(newDoc);
                          }}
                          className="btn-primary"
                          style={{
                            marginTop: "8px",
                            width: "100%",
                            padding: "10px",
                            fontSize: "var(--font-sm)"
                          }}
                        >
                          Carica esempio di analisi interattiva
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: PAGOPA PAYMENT SIMULATION */}
      {showPayModal && selectedDoc && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div className="glass-card animate-fade-up" style={{ padding: "32px", maxWidth: "480px", width: "100%", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(20,20,30,0.95)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: "16px", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "var(--font-xl)", fontWeight: 800, color: "var(--text-main)" }}>PagoPA — Checkout</h3>
              <button onClick={() => setShowPayModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "var(--radius-md)", padding: "16px", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", marginBottom: "4px" }}>Ente Creditore</p>
                <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "var(--font-sm)" }}>{selectedDoc.document_type || "Amministrazione Pubblica"}</p>
                
                <p style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", marginTop: "12px", marginBottom: "4px" }}>Codice Avviso (IUV)</p>
                <p style={{ fontFamily: "monospace", color: "var(--text-main)", fontSize: "var(--font-sm)" }}>302847192837482910</p>

                <p style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", marginTop: "12px", marginBottom: "4px" }}>Importo da Pagare</p>
                <p style={{ fontSize: "var(--font-xl)", fontWeight: 800, color: "var(--danger)" }}>{selectedDoc.analysis?.importo}</p>
              </div>

              <div>
                <label style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "8px" }}>Metodo di Pagamento</label>
                <select className="input-field">
                  <option value="card">Carta di Credito / Debito (Simulata)</option>
                  <option value="bancomat">Bancomat Pay (Simulata)</option>
                  <option value="account">Addebito Diretto SEPA (Simulato)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button onClick={() => setShowPayModal(false)} className="btn-secondary" style={{ flex: 1, padding: "12px" }}>
                  Annulla
                </button>
                <button onClick={handlePayPagoPA} disabled={paymentLoading} className="btn-primary" style={{ flex: 1, padding: "12px", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}>
                  {paymentLoading ? (
                    <>
                      <div className="spinner" style={{ width: 14, height: 14, borderWidth: "2px" }} />
                      Elaborazione...
                    </>
                  ) : (
                    "Conferma Pagamento"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PEC DIGITAL TRANSMISSION */}
      {showPecModal && selectedDoc && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div className="glass-card animate-fade-up" style={{ padding: "32px", maxWidth: "520px", width: "100%", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(20,20,30,0.95)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: "16px", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "var(--font-xl)", fontWeight: 800, color: "var(--text-main)" }}>Invio PEC / Raccomandata</h3>
              <button onClick={() => { setShowPecModal(false); setPecSuccessReceipt(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
            </div>

            {pecSuccessReceipt ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "center" }}>
                <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: "var(--radius-md)", padding: "20px" }}>
                  <p style={{ color: "#4ade80", fontWeight: 800, fontSize: "var(--font-lg)", marginBottom: "8px" }}>✓ PEC Spedita con Successo!</p>
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--text-main)" }}>L'atto è stato inviato legalmente e la PA ha rilasciato la ricevuta di avvenuta consegna.</p>
                </div>

                <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "var(--radius-md)", padding: "16px", border: "1px solid var(--border)", textLeft: "left", fontSize: "var(--font-xs)", fontFamily: "monospace", textAlign: "left" }}>
                  <p style={{ marginBottom: "6px" }}><strong>ID Messaggio:</strong> {pecSuccessReceipt.message_id}</p>
                  <p style={{ marginBottom: "6px" }}><strong>Destinatario:</strong> {pecSuccessReceipt.recipient}</p>
                  <p style={{ marginBottom: "6px" }}><strong>Data/Ora Invio:</strong> {new Date(pecSuccessReceipt.timestamp).toLocaleString("it-IT")}</p>
                  <p><strong>Stato Legalmail:</strong> ACCETTATA E CONSEGNATA (Valore di Raccomandata A/R)</p>
                </div>

                <button onClick={() => { setShowPecModal(false); setPecSuccessReceipt(null); }} className="btn-primary" style={{ padding: "12px", marginTop: "12px" }}>
                  Chiudi
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <p style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  L'invio tramite PEC (Posta Elettronica Certificata) ha lo stesso valore legale di una raccomandata con ricevuta di ritorno. BuroBot simulerà l'invio del documento e genererà la ricevuta di consegna ufficiale.
                </p>

                <div>
                  <label style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "8px" }}>Mittente (Tua PEC)</label>
                  <input
                    type="email"
                    value={pecSenderName}
                    onChange={(e) => setPecSenderName(e.target.value)}
                    placeholder="tua-pec@legalmail.it"
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "8px" }}>Destinatario (PEC Ente Pubblico)</label>
                  <input
                    type="email"
                    value={pecRecipient}
                    onChange={(e) => setPecRecipient(e.target.value)}
                    placeholder="protocollo@pec.ente.it"
                    className="input-field"
                  />
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  <button onClick={() => { setShowPecModal(false); setPecSuccessReceipt(null); }} className="btn-secondary" style={{ flex: 1, padding: "12px" }}>
                    Annulla
                  </button>
                  <button onClick={handleSendPEC} disabled={pecLoading || !pecRecipient.trim() || !pecSenderName.trim()} className="btn-primary" style={{ flex: 1, padding: "12px", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}>
                    {pecLoading ? (
                      <>
                        <div className="spinner" style={{ width: 14, height: 14, borderWidth: "2px" }} />
                        Invio in corso...
                      </>
                    ) : (
                      "Spedisci via PEC"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: INVITE COLLABORATOR */}
      {showInviteModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div className="glass-card animate-fade-up" style={{ padding: "32px", maxWidth: "450px", width: "100%", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(20,20,30,0.95)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: "16px", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "var(--font-xl)", fontWeight: 800, color: "var(--text-main)" }}>Invita Collaboratore</h3>
              <button onClick={() => { setShowInviteModal(false); setInviteName(""); setInviteEmail(""); setInviteRole("collaboratore"); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "6px" }}>Nome Completo</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="es. Avv. Mario Rossi"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "6px" }}>Indirizzo Email</label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="es. mario.rossi@studio.it"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "6px" }}>Ruolo nel Team</label>
                <select 
                  className="input-field"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{ color: "black" }}
                >
                  <option value="collaboratore">Collaboratore (Sola Lettura / Modifica)</option>
                  <option value="amministratore">Amministratore Team (Gestione completa)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button 
                  onClick={() => { setShowInviteModal(false); setInviteName(""); setInviteEmail(""); setInviteRole("collaboratore"); }} 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: "12px" }}
                >
                  Annulla
                </button>
                <button 
                  onClick={async () => {
                    if (!inviteName.trim() || !inviteEmail.trim()) return;
                    try {
                      await api.inviteMember(inviteEmail.trim(), inviteRole);
                      await loadTeam();
                    } catch (err: any) {
                      setError("Errore durante l'invio dell'invito: " + err.message);
                    }
                    setShowInviteModal(false);
                    setInviteName("");
                    setInviteEmail("");
                    setInviteRole("collaboratore");
                  }} 
                  disabled={!inviteName.trim() || !inviteEmail.trim()}
                  className="btn-primary" 
                  style={{ flex: 1, padding: "12px" }}
                >
                  Invia Invito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
