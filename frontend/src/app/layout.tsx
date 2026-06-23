import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import LayoutChrome from "@/components/LayoutChrome";

const BASE_URL = "https://desdobroprod-eng.github.io/transparencia10";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Portal Transparência Cultural do Brasil",
    template: "%s | Portal Transparência Cultural",
  },
  description:
    "Fiscalização cidadã dos gastos públicos com cultura: contratos, emendas parlamentares, alertas e cruzamento de dados públicos. Maranhão, Brasil.",
  keywords: [
    "transparência pública",
    "cultura Maranhão",
    "gastos públicos cultura",
    "fiscalização cidadã",
    "emendas parlamentares",
    "PNCP contratos",
    "SECMA",
    "São Luís Maranhão",
    "dados abertos",
    "controle social",
  ],
  authors: [
    { name: "Ben-Hur Real Figueiró", url: "https://10dobroprod.com.br" },
  ],
  creator: "Ben-Hur Real Figueiró",
  publisher: "10Dobro Prod",
  category: "government",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: BASE_URL,
    siteName: "Portal Transparência Cultural do Brasil",
    title: "Portal Transparência Cultural do Brasil",
    description:
      "918 contratos, 335 alertas, 230 emendas parlamentares: fiscalização cidadã dos gastos com cultura no Maranhão.",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Portal Transparência Cultural do Brasil",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Portal Transparência Cultural do Brasil",
    description:
      "Fiscalização cidadã dos gastos com cultura no Maranhão. Dados abertos, contratos, emendas e alertas.",
    creator: "@benhurreal",
    images: [`${BASE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: BASE_URL,
  },
};

// GA4 — conta 10Dobro Prod (G-B2C408LBPZ)
const GA_ID = "G-B2C408LBPZ";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="author" content="Ben-Hur Real Figueiró — 10Dobro Prod" />
        <meta name="copyright" content="10Dobro Prod" />
        <link rel="canonical" href={BASE_URL} />
      </head>
      <body className="bg-gray-50 text-gray-900 min-h-screen flex flex-col">
        <LayoutChrome>{children}</LayoutChrome>
        {/* Google Analytics — 10Dobro Prod (G-B2C408LBPZ) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              page_path: window.location.pathname,
              anonymize_ip: true
            });
          `}
        </Script>
      </body>
    </html>
  );
}
