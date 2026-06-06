import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transparencia10 — Gastos Públicos MA",
  description: "Monitoramento em tempo real das Secretarias de Cultura do Maranhão",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
