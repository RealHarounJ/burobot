import { createClient } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
};
