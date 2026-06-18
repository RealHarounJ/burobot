import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BuroBot — L'AI che spiega la burocrazia italiana",
  description: "Carica un documento INPS, Agenzia Entrate o ISEE. BuroBot lo spiega in 5 secondi in linguaggio semplice e genera la risposta al posto tuo.",
  keywords: ["burocrazia italiana", "INPS", "Agenzia Entrate", "ISEE", "AI", "assistente burocratico"],
  openGraph: {
    title: "BuroBot — L'AI che spiega la burocrazia italiana",
    description: "Carica un documento burocratico. BuroBot lo spiega in 5 secondi.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
