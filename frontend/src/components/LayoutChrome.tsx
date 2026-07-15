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

  // A raiz "nua" (alguém digitou a URL) sem sessão → landing pública, para não
  // bater num muro de senha na porta. Mas o botão "Ver o painel" chega como
  // `/?painel=1` (entrada intencional): aí mostramos o portão, sem redirecionar.
  // router.replace já prefixa o basePath — passar rota "crua".
  useEffect(() => {
    if (!pronto || senha || rota !== "/") return;
    const intencional = new URLSearchParams(window.location.search).has("painel");
    if (!intencional) router.replace("/inicio");
  }, [pronto, senha, rota, router]);

  if (!pronto) return null; // aguarda ler o sessionStorage (sem flash)

  if (!senha) {
    const intencional =
      rota !== "/" ||
      new URLSearchParams(window.location.search).has("painel");
    if (!intencional) return null; // raiz nua: redirecionando para /inicio
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
