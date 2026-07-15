"use client";

// Estado de acesso ao painel. A senha digitada fica só em sessionStorage (some
// ao fechar a aba) e é usada como chave para decifrar os dados protegidos.
// Nunca vai para a URL, cookie ou analytics.

import { createContext, useContext, useEffect, useState } from "react";
import { senhaConfere } from "@/lib/cripto";

const BASE = "/transparencia10/data";
const CHAVE_SESSAO = "t10_acesso";

interface AuthCtx {
  senha: string | null;      // null = não autenticado
  pronto: boolean;           // já leu o sessionStorage (evita flash na hidratação)
  entrar: (senha: string) => Promise<boolean>;
  sair: () => void;
}

const Ctx = createContext<AuthCtx>({
  senha: null,
  pronto: false,
  entrar: async () => false,
  sair: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [senha, setSenha] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(CHAVE_SESSAO);
      if (s) setSenha(s);
    } catch {
      /* sessionStorage indisponível — segue sem persistência */
    }
    setPronto(true);
  }, []);

  async function entrar(tentativa: string): Promise<boolean> {
    const ok = await senhaConfere(tentativa, BASE);
    if (!ok) return false;
    setSenha(tentativa);
    try {
      sessionStorage.setItem(CHAVE_SESSAO, tentativa);
    } catch {
      /* ignora */
    }
    return true;
  }

  function sair() {
    setSenha(null);
    try {
      sessionStorage.removeItem(CHAVE_SESSAO);
    } catch {
      /* ignora */
    }
  }

  return <Ctx.Provider value={{ senha, pronto, entrar, sair }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  return useContext(Ctx);
}
