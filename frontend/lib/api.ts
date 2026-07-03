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
};
