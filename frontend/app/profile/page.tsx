"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, signOut } from "@/lib/supabase";
import { api } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/login?redirect=/profile");
        return;
      }
      setUser(user);
      
      try {
        const usageData = await api.getUsage();
        setUsage(usageData);
      } catch (err) {
        console.error("Errore caricamento usage", err);
        setError("Impossibile caricare i dettagli del piano.");
      } finally {
        setLoadingUsage(false);
      }
    });
  }, [router]);

  const handleLogout = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  const handleManageBilling = async () => {
    setLoadingPortal(true);
    setError(null);
    try {
      const { portal_url } = await api.createPortal();
      if (portal_url) {
        window.location.href = portal_url;
      } else {
        throw new Error();
      }
    } catch (err) {
      setError("Impossibile aprire il portale Stripe. Forse non hai ancora un abbonamento attivo.");
      setLoadingPortal(false);
    }
  };

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }} className="hero-bg">
        <div className="spinner" />
      </div>
    );
  }

  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Utente";
  const planLabel = usage?.plan ? usage.plan.toUpperCase() : "Caricamento...";

  return (
    <main style={{ minHeight: "100vh", paddingTop: "100px" }} className="hero-bg">
      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "16px 40px",
        background: "#ffffff",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <Link href="/" style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary)", textDecoration: "none" }}>
          🤖 BuroBot
        </Link>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <Link href="/dashboard" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.95rem" }}>Dashboard</Link>
          <Link href="/pricing" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.95rem" }}>Prezzi</Link>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>Disconnetti</button>
        </div>
      </nav>

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 900, marginBottom: "32px" }}>Il tuo <span className="gradient-text">Profilo</span></h1>

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "24px",
            fontSize: "0.95rem"
          }}>
            ❌ {error}
          </div>
        )}

        <div className="glass-card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "28px" }}>
          
          {/* USER INFO */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "24px" }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary), var(--primary-light))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.8rem",
              fontWeight: "bold",
              color: "white"
            }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-main)" }}>{displayName}</h2>
              <p style={{ color: "var(--text-dim)", fontSize: "0.95rem", marginTop: "4px" }}>{user.email}</p>
            </div>
          </div>

          {/* PLAN INFO */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px", color: "var(--text-dim)" }}>Dettagli Abbonamento</h3>
            
            <div style={{
              background: "var(--bg-dark)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <span className="badge" style={{ marginBottom: "6px" }}>Piano Attuale</span>
                <p style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-main)", marginTop: "4px" }}>{planLabel}</p>
              </div>

              {usage?.plan === "free" ? (
                <Link href="/pricing" className="btn-primary" style={{ padding: "10px 20px", fontSize: "0.9rem" }}>
                  Passa a Premium
                </Link>
              ) : (
                <button
                  onClick={handleManageBilling}
                  disabled={loadingPortal}
                  className="btn-secondary"
                  style={{ padding: "10px 20px", fontSize: "0.9rem" }}
                >
                  {loadingPortal ? <div className="spinner" style={{ width: 18, height: 18 }} /> : "Gestisci Fatturazione"}
                </button>
              )}
            </div>
          </div>

          {/* USAGE STATS */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px", color: "var(--text-dim)" }}>Utilizzo Documenti (Mese Corrente)</h3>
            {loadingUsage ? (
              <div className="spinner" style={{ width: 24, height: 24 }} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", color: "var(--text-main)" }}>
                  <span>Documenti analizzati:</span>
                  <span style={{ fontWeight: "bold" }}>
                    {usage?.used_this_month} / {usage?.limit ? usage.limit : "∞"}
                  </span>
                </div>
                
                {usage?.limit && (
                  <div style={{ width: "100%", height: "8px", background: "var(--border)", borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{
                      width: `${Math.min(100, (usage.used_this_month / usage.limit) * 100)}%`,
                      height: "100%",
                      background: "var(--primary)",
                      borderRadius: "10px"
                    }} />
                  </div>
                )}
                
                {usage?.plan === "free" && (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                    Hai ancora {usage.remaining} documenti gratuiti rimasti questo mese. Sblocca caricamenti illimitati con il piano Base.
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
