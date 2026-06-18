"use client";

import { usePathname } from "next/navigation";
import NavBar from "@/components/NavBar";
import Rodape from "@/components/Rodape";

const BASE = "/transparencia10";

// A landing (/inicio) é imersiva e tem header/rodapé próprios.
// Nas demais rotas (painel), mostramos a navegação padrão.
export default function LayoutChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const rota = pathname.replace(BASE, "").replace(/\/$/, "") || "/";
  const ehLanding = rota === "/inicio";

  if (ehLanding) return <>{children}</>;

  return (
    <>
      <NavBar />
      <main className="flex-1">{children}</main>
      <Rodape />
    </>
  );
}
