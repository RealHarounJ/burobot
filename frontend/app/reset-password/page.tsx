"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La password deve contenere almeno 6 caratteri.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.updateUser({
      password: password,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccess("Password aggiornata con successo! Reindirizzamento al login...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
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
            Nuova Password
          </h2>
          <p style={{ color: "var(--text-muted)", textAlign: "center", marginBottom: "32px", fontSize: "0.9rem" }}>
            Inserisci la tua nuova password d'accesso
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

          <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label htmlFor="password" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
                Nuova Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 6 caratteri"
                className="input-field"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label htmlFor="confirmPassword" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
                Conferma Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Reinserisci la password"
                className="input-field"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ justifyContent: "center", padding: "14px", width: "100%", fontSize: "1rem" }}>
              {loading ? <div className="spinner" style={{ width: 20, height: 20 }} /> : "Aggiorna password →"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
