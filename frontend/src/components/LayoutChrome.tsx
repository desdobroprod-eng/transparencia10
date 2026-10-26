"use client";

import { usePathname } from "next/navigation";
import NavBar from "@/components/NavBar";
import Rodape from "@/components/Rodape";
import PortaoSenha from "@/components/PortaoSenha";
import { AuthProvider, useAuth } from "@/lib/auth";

const BASE = "/transparencia10";

// A landing (/inicio) é pública e imersiva (header/rodapé próprios).
// O painel é público; só a página de coincidência de nomes (sócio × servidor),
// que cita pessoas físicas, fica atrás do portão de senha.
const ROTAS_PROTEGIDAS = ["/cruzamentos"];

export default function LayoutChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const rota = pathname.replace(BASE, "").replace(/\/$/, "") || "/";
  const ehLanding = rota === "/inicio";
  const protegida = ROTAS_PROTEGIDAS.includes(rota);

  return (
    <AuthProvider>
      {ehLanding ? (
        children
      ) : (
        <>
          <NavBar />
          <main className="flex-1">
            {protegida ? <Portao>{children}</Portao> : children}
          </main>
          <Rodape />
        </>
      )}
    </AuthProvider>
  );
}

function Portao({ children }: { children: React.ReactNode }) {
  const { senha, pronto } = useAuth();
  if (!pronto) return null; // aguarda ler o sessionStorage (sem flash)
  if (!senha) return <PortaoSenha />;
  return <>{children}</>;
}
