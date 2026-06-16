import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import Rodape from "@/components/Rodape";

export const metadata: Metadata = {
  title: "Transparência 10 — Cultura no Maranhão",
  description:
    "Fiscalização cidadã dos gastos das Secretarias de Cultura do Maranhão: contratos, indicadores de risco e cruzamento sócio × servidor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1">{children}</main>
        <Rodape />
      </body>
    </html>
  );
}
