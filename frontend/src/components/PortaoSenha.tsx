"use client";

// Tela de acesso ao painel de dados. A landing (/inicio) segue pública; aqui
// pedimos a senha que decifra os dados sensíveis (nomes de pessoas e empresas).

import { useState } from "react";
import Link from "next/link";
import { LogoIcon } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

export default function PortaoSenha() {
  const { entrar } = useAuth();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!senha || carregando) return;
    setCarregando(true);
    setErro(false);
    const ok = await entrar(senha);
    if (!ok) {
      setErro(true);
      setSenha("");
    }
    setCarregando(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0B0C] px-5 py-16 text-[#F7F3EC]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoIcon size={56} />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">
            Painel de dados restrito
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#F7F3EC]/60">
            O conteúdo do painel envolve dados de pessoas e empresas e está
            disponível apenas para acesso autorizado. Informe a senha para
            continuar.
          </p>
        </div>

        <form onSubmit={enviar} className="space-y-3">
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha de acesso"
            autoFocus
            aria-label="Senha de acesso ao painel"
            className="w-full rounded-lg border border-[#F7F3EC]/15 bg-[#F7F3EC]/5 px-4 py-3 text-[#F7F3EC] placeholder-[#F7F3EC]/40 outline-none transition focus:border-[#E2B100]/70 focus:ring-1 focus:ring-[#E2B100]/40"
          />

          {erro && (
            <p className="text-sm text-[#E8998D]" role="alert">
              Senha incorreta. Tente novamente.
            </p>
          )}

          <button
            type="submit"
            disabled={carregando || !senha}
            className="w-full rounded-lg bg-[#C8102E] px-4 py-3 font-semibold text-white transition hover:bg-[#a60d26] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {carregando ? "Verificando…" : "Acessar painel"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/inicio"
            className="text-sm text-[#F7F3EC]/55 underline-offset-4 transition hover:text-[#F7F3EC] hover:underline"
          >
            ← Conhecer o projeto (página pública)
          </Link>
        </div>
      </div>
    </div>
  );
}
