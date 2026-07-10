import { createClient } from "./supabase";

const API_URL = "https://burobot-production-4c5a.up.railway.app";

async function getAuthHeader(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export const api = {
  async analyzeDocument(file: File) {
    const headers = await getAuthHeader();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/api/documents/analyze`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore sconosciuto" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async getHistory() {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/documents/history`, { headers });
    if (!res.ok) throw new Error("Errore nel caricamento storico");
    return res.json();
  },

  async getUsage() {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/documents/usage`, { headers });
    if (!res.ok) throw new Error("Errore nel caricamento utilizzo");
    return res.json();
  },

  async generateResponse(documentId: string, userSituation: string, responseType = "contestazione") {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/documents/generate-response`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId, user_situation: userSituation, response_type: responseType }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore sconosciuto" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async createCheckout(plan: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/billing/create-checkout`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) throw new Error("Errore nel checkout");
    return res.json();
  },

  async createPortal() {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/billing/create-portal`, {
      method: "POST",
      headers,
    });
    if (!res.ok) throw new Error("Errore nell'apertura del portale di fatturazione");
    return res.json();
  },

  async chat(message: string, context: string, history: any[]) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/ai/chat`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message, context, history }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore sconosciuto" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async matchBonuses(documentId: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/documents/match-bonuses`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore sconosciuto" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async simulatePagoPA(documentId: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/documents/simulate-pagopa`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore sconosciuto" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async sendPec(documentId: string, recipientEmail: string, senderName: string, letterText: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/documents/send-pec`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: documentId,
        recipient_email: recipientEmail,
        sender_name: senderName,
        letter_text: letterText
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore sconosciuto" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async getTeamMembers() {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/billing/team/members`, { headers });
    if (!res.ok) throw new Error("Errore nel recupero dei membri del team");
    return res.json();
  },

  async inviteMember(email: string, role: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/billing/team/invite`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore durante l'invito" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async removeMember(email: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/billing/team/members/${encodeURIComponent(email)}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error("Errore durante la rimozione del collaboratore");
    return res.json();
  },

  async acceptInvite(inviteId: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/billing/team/accept-invite`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ invite_id: inviteId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Impossibile accettare l'invito" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  // ─── Lawyer endpoints ────────────────────────────────────────────────────────

  async draftDocument(payload: {
    tipo_atto: string;
    mittente: string;
    destinatario: string;
    oggetto: string;
    dettagli: string;
    importo?: string;
    scadenza?: string;
  }) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/lawyer/draft`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore durante la redazione" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async analyzeContract(testo_contratto: string, tipo_contratto = "generico") {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/lawyer/analyze-contract`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ testo_contratto, tipo_contratto }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore durante l'analisi" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async calculateDeadlines(tipo_atto: string, data_notifica: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/lawyer/deadlines`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ tipo_atto, data_notifica }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore nel calcolo scadenze" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async generateFaqResponse(domanda_cliente: string, area_legale: string, dettagli_caso: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/lawyer/faq`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ domanda_cliente, area_legale, dettagli_caso }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore nella generazione FAQ" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async searchJurisprudence(argomento: string, parole_chiave = "") {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/lawyer/research`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ argomento, parole_chiave }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore nella ricerca legale" }));
      throw new Error(err.detail);
    }
    return res.json();
  },

  async estimateFees(tipo_procedimento: string, valore_causa: string, fasi: string[]) {
    const headers = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/lawyer/fee-estimator`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ tipo_procedimento, valore_causa, fasi }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Errore nel calcolo del preventivo" }));
      throw new Error(err.detail);
    }
    return res.json();
  },
};

