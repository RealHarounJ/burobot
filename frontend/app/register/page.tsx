"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const plan = searchParams.get("plan") || "free";
  const redirectUrl = searchParams.get("redirect") || "/dashboard";
  const inviteId = searchParams.get("invite");
  const inviteEmail = searchParams.get("email");

  useEffect(() => {
    if (inviteEmail) {
      setEmail(inviteEmail);
    }
  }, [inviteEmail]);

  // Check if already logged in and warn if configuration is missing
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || url.includes("xxxx.supabase.co")) {
      setError("Attenzione: Le chiavi di Supabase non sono ancora state configurate nelle variabili d'ambiente di Vercel. La registrazione non funzionerà.");
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push(redirectUrl);
      }
    });
  }, [router, redirectUrl]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError("La password deve essere di almeno 6 caratteri.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      setSuccess("Account creato con successo! Verificando la sessione...");
      
      // Attempt login immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setSuccess("Account creato! Accedi per continuare.");
        setTimeout(() => {
          router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
        }, 1500);
      } else {
        if (inviteId) {
          try {
            const { api } = await import("@/lib/api");
            await api.acceptInvite(inviteId);
          } catch (inviteErr) {
            console.error("Errore accettazione invito:", inviteErr);
          }
        }
        setTimeout(() => {
          if (plan !== "free") {
            // If they chose a plan, send them to pricing or directly trigger checkout
            router.push(`/pricing?checkout=${plan}`);
          } else {
            router.push(redirectUrl);
          }
          router.refresh();
        }, 1500);
      }
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "420px" }}>
      <div className="glass-card" style={{ padding: "40px" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "8px", textAlign: "center" }}>
          Inizia con <span className="gradient-text">BuroBot</span>
        </h2>
        <p style={{ color: "var(--text-muted)", textAlign: "center", marginBottom: "32px", fontSize: "0.95rem" }}>
          Crea un account gratuito in pochi secondi
        </p>

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            padding: "12px 16px",
            borderRadius: "12px",
            marginBottom: "20px",
            fontSize: "0.9rem"
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            color: "#4ade80",
            padding: "12px 16px",
            borderRadius: "12px",
            marginBottom: "20px",
            fontSize: "0.9rem"
          }}>
            ✓ {success}
          </div>
        )}

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label htmlFor="name" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
              Nome Completo
            </label>
            <input
              id="name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Mario Rossi"
              className="input-field"
            />
          </div>

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
              disabled={!!inviteEmail}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label htmlFor="password" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
              Password
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

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              justifyContent: "center",
              padding: "14px",
              width: "100%",
              marginTop: "10px",
              fontSize: "1rem"
            }}
          >
            {loading ? <div className="spinner" style={{ width: 20, height: 20 }} /> : "Registrati →"}
          </button>
        </form>
      </div>

      <p style={{ textAlign: "center", marginTop: "24px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
        Hai già un account?{" "}
        <Link href={`/login${searchParams.toString() ? '?' + searchParams.toString() : ''}`} style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>
          Accedi
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}
      className="hero-bg"
    >
      <div style={{ position: "absolute", top: "24px", left: "24px" }}>
        <Link href="/" style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary)", textDecoration: "none" }}>
          BuroBot
        </Link>
      </div>

      <Suspense fallback={<div className="spinner" />}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
