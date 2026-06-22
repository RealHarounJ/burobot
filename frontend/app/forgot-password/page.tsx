"use client";

import { useState } from "react";
import Link from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccess("Email di ripristino inviata! Controlla la tua casella di posta.");
    }
    setLoading(false);
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} className="hero-bg">
      <div style={{ position: "absolute", top: "24px", left: "24px" }}>
        <a href="/" style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary)", textDecoration: "none" }}>
          BuroBot
        </a>
      </div>

      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div className="glass-card" style={{ padding: "40px" }}>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "8px", textAlign: "center" }}>
            Ripristina Password
          </h2>
          <p style={{ color: "var(--text-muted)", textAlign: "center", marginBottom: "32px", fontSize: "0.9rem" }}>
            Inserisci la tua email per ricevere il link di ripristino
          </p>

          {error && (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", padding: "12px", borderRadius: "12px", marginBottom: "20px", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", color: "#4ade80", padding: "12px", borderRadius: "12px", marginBottom: "20px", fontSize: "0.85rem" }}>
              ✓ {success}
            </div>
          )}

          <form onSubmit={handleResetRequest} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label htmlFor="email" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
                Indirizzo Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@esempio.it"
                className="input-field"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ justifyContent: "center", padding: "14px", width: "100%", fontSize: "1rem" }}>
              {loading ? <div className="spinner" style={{ width: 20, height: 20 }} /> : "Invia link di ripristino →"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: "24px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Torna al{" "}
          <a href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>
            Login
          </a>
        </p>
      </div>
    </main>
  );
}
