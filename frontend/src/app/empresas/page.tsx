"use client";

import { useMemo, useState } from "react";

import { useDados } from "@/hooks/useDados";
import GraficoTop from "@/components/empresas/GraficoTop";
import TabelaEmpresas, { comRisco } from "@/components/empresas/TabelaEmpresas";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

export default function EmpresasPage() {
  const { loading, erro, empresas } = useDados();
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return empresas;
    return empresas.filter((e) =>
      `${e.razao_social} ${e.nome}`.toLowerCase().includes(termo)
    );
  }, [empresas, busca]);

  const top20 = useMemo(() => empresas.slice(0, 20), [empresas]);

  const linhasTabela = useMemo(
    () => filtradas.slice(0, 50).map(comRisco),
    [filtradas]
  );

  // ----- Erro -----
  if (erro) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-base font-semibold text-red-800">
            Não foi possível carregar os dados
          </h2>
          <p className="mt-1 text-sm text-red-700">{erro}</p>
        </div>
      </section>
    );
  }

  // ----- Carregamento -----
  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-96" />
        <Skeleton className="mt-6 h-10 w-full max-w-sm" />
        <Skeleton className="mt-6 h-[600px] w-full" />
        <Skeleton className="mt-8 h-96 w-full" />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      {/* Cabeçalho */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Maiores Fornecedores</h1>
        <p className="mt-1 text-sm text-gray-600">
          Ranking das empresas que mais receberam em contratos públicos de cultura.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {empresas.length.toLocaleString("pt-BR")} empresas fornecedoras
          identificadas.
        </p>
      </header>

      {/* Gráfico Top 20 */}
      <div className="mt-6">
        <GraficoTop empresas={top20} />
      </div>

      {/* Busca + Tabela */}
      <div className="mt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Ranking de fornecedores
            </h2>
            <p className="text-xs text-gray-400">
              Top {linhasTabela.length} por valor total contratado.
            </p>
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome da empresa…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-72"
          />
        </div>

        <div className="mt-4">
          <TabelaEmpresas empresas={linhasTabela} />
        </div>

        <p className="mt-3 text-xs text-gray-400">
          A marca vermelha (!) sinaliza empresas cujo valor contratado supera em
          mais de 50 vezes o capital social declarado — possível indício de
          empresa de fachada, que merece verificação.
        </p>
      </div>
    </section>
  );
}
