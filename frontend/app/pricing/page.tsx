"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    period: "/mese",
    desc: "Per provare BuroBot",
    features: [
      "3 documenti al mese",
      "Spiegazione in linguaggio semplice",
      "Analisi scadenze",
    ],
    btnText: "Usa Gratis",
    featured: false,
  },
  {
    id: "base",
    name: "Base",
    price: "€9.99",
    period: "/mese",
    desc: "Per privati e famiglie",
    features: [
      "Documenti illimitati",
      "Generazione lettere di risposta / ricorsi",
      "Storico completo dei documenti analizzati",
      "Elaborazione prioritaria",
      "Supporto email standard",
    ],
    btnText: "Attiva Base",
    featured: true,
  },
  {
    id: "pmi",
    name: "PMI",
    price: "€49.00",
    period: "/mese",
    desc: "Per piccole aziende e artigiani",
    features: [
      "Tutto del piano Base",
      "Fino a 5 account collaboratori",
      "Analisi contratti commerciali",
      "API access limitato",
      "Supporto prioritario WhatsApp/Email",
    ],
    btnText: "Attiva PMI",
    featured: false,
  },
  {
    id: "studio",
    name: "Studio",
    price: "€99.00",
    period: "/mese",
    desc: "Per commercialisti, CAF e legali",
    features: [
      "Tutto del piano PMI",
      "Account collaboratori illimitati",
      "Export PDF personalizzato con logo",
      "Integrazione diretta con gestionali CAF",
      "Account manager dedicato",
    ],
    btnText: "Attiva Studio",
    featured: false,
  },
];

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUser(user);
        try {
          const usage = await api.getUsage();
          setCurrentPlan(usage.plan || "free");
        } catch (err) {
          console.error("Errore nel recupero del piano corrente", err);
        }
      }
    });
  }, []);

  // Handle auto-checkout from redirect parameters
  useEffect(() => {
    const checkoutPlan = searchParams.get("checkout");
    if (checkoutPlan && user && currentPlan === "free") {
      handleSubscribe(checkoutPlan);
    }
  }, [searchParams, user, currentPlan]);

  const handleSubscribe = async (planId: string) => {
    if (planId === "free") {
      router.push("/dashboard");
      return;
    }

    if (!user) {
      router.push(`/register?plan=${planId}&redirect=/pricing?checkout=${planId}`);
      return;
    }

    setLoadingPlan(planId);
    setError(null);

    try {
      const { checkout_url } = await api.createCheckout(planId);
      if (checkout_url) {
        window.location.href = checkout_url;
      } else {
        throw new Error("URL di checkout non ricevuto");
      }
    } catch (err: any) {
      setError("Errore nella creazione della sessione di pagamento. Contatta l'assistenza.");
      setLoadingPlan(null);
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: "60px" }}>
        <span className="badge" style={{ marginBottom: "16px" }}>Piani e Prezzi</span>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 900, marginBottom: "20px" }}>
          Scegli il piano ideale per <span className="gradient-text">le tue esigenze</span>
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "1.15rem", maxWidth: "600px", margin: "0 auto" }}>
          Nessun costo nascosto. Puoi disdire il tuo abbonamento in qualsiasi momento con un semplice click.
        </p>

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            padding: "16px",
            borderRadius: "12px",
            marginTop: "30px",
            maxWidth: "600px",
            marginRight: "auto",
            marginLeft: "auto",
            fontSize: "0.95rem"
          }}>
            ❌ {error}
          </div>
        )}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "30px",
        alignItems: "stretch"
      }}>
        {plans.map((p) => {
          const isCurrent = currentPlan === p.id;
          return (
            <div
              key={p.id}
              className={`pricing-card ${p.featured ? "featured" : ""}`}
              style={{
                display: "flex",
                flexDirection: "column",
                border: p.featured ? "2px solid #6366f1" : "1px solid rgba(99, 102, 241, 0.15)",
                transform: p.featured ? "scale(1.03)" : "none",
                zIndex: p.featured ? 2 : 1
              }}
            >
              {p.featured && (
                <span style={{
                  position: "absolute",
                  top: "-15px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "linear-gradient(135deg, #6366f1, #a78bfa)",
                  color: "white",
                  padding: "6px 16px",
                  borderRadius: "50px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  boxShadow: "0 4px 15px rgba(99,102,241,0.4)"
                }}>
                  CONSIGLIATO
                </span>
              )}

              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "8px" }}>{p.name}</h3>
                <p style={{ color: "#94a3b8", fontSize: "0.9rem", minHeight: "40px" }}>{p.desc}</p>
                <div style={{ display: "flex", alignItems: "baseline", marginTop: "16px" }}>
                  <span style={{ fontSize: "2.5rem", fontWeight: 900, color: "white" }}>{p.price}</span>
                  <span style={{ color: "#94a3b8", fontSize: "1rem", marginLeft: "4px" }}>{p.period}</span>
                </div>
              </div>

              <div style={{ flex: 1, marginBottom: "32px" }}>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {p.features.map((f, idx) => (
                    <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "0.95rem", color: "#e2e8f0" }}>
                      <span style={{ color: "#22c55e", fontWeight: "bold" }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                disabled={loadingPlan !== null || isCurrent}
                onClick={() => handleSubscribe(p.id)}
                className={p.featured ? "btn-primary" : "btn-secondary"}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "14px",
                  fontSize: "0.95rem"
                }}
              >
                {loadingPlan === p.id ? (
                  <div className="spinner" style={{ width: 20, height: 20 }} />
                ) : isCurrent ? (
                  "Piano Attivo"
                ) : (
                  p.btnText
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  return (
    <main style={{ minHeight: "100vh", paddingTop: "100px" }} className="hero-bg">
      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "16px 40px",
        background: "rgba(10,10,15,0.8)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(99,102,241,0.15)",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <Link href="/" style={{ fontSize: "1.4rem", fontWeight: 800, background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textDecoration: "none" }}>
          🤖 BuroBot
        </Link>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          {user ? (
            <>
              <Link href="/dashboard" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.95rem" }}>Dashboard</Link>
              <Link href="/profile" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.95rem" }}>Profilo</Link>
            </>
          ) : (
            <>
              <Link href="/login" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.95rem" }}>Accedi</Link>
              <Link href="/register" className="btn-primary" style={{ padding: "10px 20px", fontSize: "0.9rem" }}>
                Inizia gratis →
              </Link>
            </>
          )}
        </div>
      </nav>

      <Suspense fallback={<div className="spinner" style={{ margin: "100px auto" }} />}>
        <PricingContent />
      </Suspense>
    </main>
  );
}
