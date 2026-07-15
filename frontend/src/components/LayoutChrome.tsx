"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import Rodape from "@/components/Rodape";
import PortaoSenha from "@/components/PortaoSenha";
import { AuthProvider, useAuth } from "@/lib/auth";

const BASE = "/transparencia10";

// A landing (/inicio) é pública e imersiva (header/rodapé próprios).
// As demais rotas formam o painel de dados e ficam atrás do portão de senha.
export default function LayoutChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const rota = pathname.replace(BASE, "").replace(/\/$/, "") || "/";
  const ehLanding = rota === "/inicio";

  return (
    <AuthProvider>
      {ehLanding ? children : <Painel rota={rota}>{children}</Painel>}
    </AuthProvider>
  );
}

function Painel({ rota, children }: { rota: string; children: React.ReactNode }) {
  const { senha, pronto } = useAuth();
  const router = useRouter();

  // URL raiz sem autenticação → manda para a landing pública (evita "muro" de
  // senha logo na porta). Rotas de dados específicas mostram o portão.
  // router.replace já prefixa o basePath automaticamente — passar rota "crua".
  useEffect(() => {
    if (pronto && !senha && rota === "/") router.replace("/inicio");
  }, [pronto, senha, rota, router]);

  if (!pronto) return null; // aguarda ler o sessionStorage (sem flash)

  if (!senha) {
    if (rota === "/") return null; // redirecionando para /inicio
    return <PortaoSenha />;
  }

  return (
    <>
      <NavBar />
      <main className="flex-1">{children}</main>
      <Rodape />
    </>
  );
}
