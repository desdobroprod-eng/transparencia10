import type { Metadata } from "next";
import "./globals.css";
import LayoutChrome from "@/components/LayoutChrome";

export const metadata: Metadata = {
  title: "Portal Transparência Cultural do Brasil",
  description:
    "Fiscalização cidadã dos gastos públicos com cultura: contratos, indicadores e cruzamento de dados públicos. Começando pelo Maranhão.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 min-h-screen flex flex-col">
        <LayoutChrome>{children}</LayoutChrome>
      </body>
    </html>
  );
}
