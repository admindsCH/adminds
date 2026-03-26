import type { Metadata } from "next";
import { Inter, DM_Serif_Display, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-serif",
  weight: "400",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Adminds — Rapports AI et administratif psychiatrique en minutes",
    template: "%s | Adminds",
  },
  description:
    "Psychiatres en Suisse : participez à la création d'un outil IA qui rédige vos rapports AI en minutes. Rejoignez nos co-créateurs et façonnez le produit qui vous manque.",
  keywords: [
    "psychiatre",
    "rapport assurance invalidité",
    "rapport AI",
    "IA médicale",
    "administratif médical",
    "Suisse",
    "Genève",
    "outil psychiatre",
    "rapports médico-légaux",
  ],
  openGraph: {
    title: "Psychiatres, co-construisez l'outil qui réinvente votre quotidien",
    description:
      "Rapports AI, ordonnances, correspondance… vous passez trop de temps sur l'administratif. Participez à la création d'Adminds et façonnez le produit.",
    url: "https://www.adminds.ch",
    siteName: "Adminds",
    locale: "fr_CH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Psychiatres, co-construisez l'outil qui réinvente votre quotidien",
    description:
      "Participez à la création d'un outil IA pour rédiger vos rapports d'assurance invalidité en minutes.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} ${dmSerif.variable} ${instrumentSerif.variable}`}>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-EM2F3EN3LV"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-EM2F3EN3LV');
          gtag('config', 'AW-17968016762');
        `}
      </Script>
      <body className="antialiased">
        <ClerkProvider localization={frFR}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
