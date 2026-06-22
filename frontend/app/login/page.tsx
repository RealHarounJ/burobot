"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  // Check if already logged in and warn if configuration is missing
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || url.includes("xxxx.supabase.co")) {
      setError("Attenzione: Le chiavi di Supabase non sono ancora state configurate nelle variabili d'ambiente di Vercel. Il login non funzionerà.");
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push(redirectUrl);
      }
    });
  }, [router, redirectUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      setSuccess("Accesso effettuato! Reindirizzamento...");
      setTimeout(() => {
        router.push(redirectUrl);
        router.refresh();
      }, 1000);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectUrl)}`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "420px" }}>
      <div className="glass-card" style={{ padding: "40px", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "8px", textAlign: "center" }}>
          Bentornato su <span className="gradient-text">BuroBot</span>
        </h2>
        <p style={{ color: "#94a3b8", textAlign: "center", marginBottom: "32px", fontSize: "0.95rem" }}>
          Inserisci le tue credenziali per accedere
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

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label htmlFor="email" style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8" }}>
              Indirizzo Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@esempio.it"
              style={{
                background: "rgba(10, 10, 15, 0.6)",
                border: "1px solid rgba(99, 102, 241, 0.2)",
                borderRadius: "12px",
                padding: "14px 16px",
                color: "white",
                fontSize: "1rem",
                outline: "none",
                transition: "all 0.3s ease"
              }}
              onFocus={(e) => e.target.style.borderColor = "#6366f1"}
              onBlur={(e) => e.target.style.borderColor = "rgba(99, 102, 241, 0.2)"}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="password" style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8" }}>
                Password
              </label>
              <a href="/forgot-password" style={{ fontSize: "0.8rem", color: "#a78bfa", textDecoration: "none" }}>
                Password dimenticata?
              </a>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                background: "rgba(10, 10, 15, 0.6)",
                border: "1px solid rgba(99, 102, 241, 0.2)",
                borderRadius: "12px",
                padding: "14px 16px",
                color: "white",
                fontSize: "1rem",
                outline: "none",
                transition: "all 0.3s ease"
              }}
              onFocus={(e) => e.target.style.borderColor = "#6366f1"}
              onBlur={(e) => e.target.style.borderColor = "rgba(99, 102, 241, 0.2)"}
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
            {loading ? <div className="spinner" style={{ width: 20, height: 20 }} /> : "Accedi →"}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", margin: "24px 0", gap: "16px" }}>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          <span style={{ fontSize: "0.8rem", color: "#4b5563" }}>OPPURE</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => handleOAuthLogin("google")}
            className="btn-secondary"
            style={{ flex: 1, justifyContent: "center", padding: "12px", fontSize: "0.9rem" }}
          >
            Google
          </button>
          <button
            onClick={() => handleOAuthLogin("github")}
            className="btn-secondary"
            style={{ flex: 1, justifyContent: "center", padding: "12px", fontSize: "0.9rem" }}
          >
            GitHub
          </button>
        </div>
      </div>

      <p style={{ textAlign: "center", marginTop: "24px", color: "#94a3b8", fontSize: "0.9rem" }}>
        Non hai ancora un account?{" "}
        <Link href={`/register${searchParams.toString() ? '?' + searchParams.toString() : ''}`} style={{ color: "#a78bfa", fontWeight: 600, textDecoration: "none" }}>
          Registrati gratis
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
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
        <LoginForm />
      </Suspense>
    </main>
  );
}
