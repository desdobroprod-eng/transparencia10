"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDados, type Cruzamento } from "@/hooks/useDados";
import { ENTES, NOME_ENTE } from "@/lib/config";
import KpiCard from "@/components/visao/KpiCard";
import DisclaimerInvestigacao from "@/components/investigacao/DisclaimerInvestigacao";
import CardCruzamento from "@/components/investigacao/CardCruzamento";
import dynamic from "next/dynamic";

// O grafo só faz sentido no cliente (canvas). Carregado sob demanda, sem SSR.
const GrafoRede = dynamic(
  () => import("@/components/investigacao/GrafoRede"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-400">
        Carregando grafo…
      </div>
    ),
  },
);

function norm(s: string): string {
  return (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

export default function CruzamentosPage() {
  const { cruzamentos, loading, erro } = useDados();

  const [filtroEnte, setFiltroEnte] = useState<string>("todos");
  const [somenteExatos, setSomenteExatos] = useState(false);

  // Entes que de fato têm cruzamentos (evita filtros vazios).
  const entesComDados = useMemo(() => {
    const set = new Set(cruzamentos.map((c) => c.ente));
    return ENTES.filter((e) => set.has(e.chave));
  }, [cruzamentos]);

  // Aplica filtros.
  const filtrados = useMemo(() => {
    return cruzamentos.filter((c) => {
      if (filtroEnte !== "todos" && c.ente !== filtroEnte) return false;
      if (somenteExatos && !c.exato) return false;
      return true;
    });
  }, [cruzamentos, filtroEnte, somenteExatos]);

  // Ordenação: exatos primeiro, depois score desc.
  const ordenados = useMemo(() => {
    return [...filtrados].sort((a, b) => {
      if (a.exato !== b.exato) return a.exato ? -1 : 1;
      return (b.score ?? 0) - (a.score ?? 0);
    });
  }, [filtrados]);

  // KPIs — calculados sobre o conjunto filtrado para refletir o que está em tela.
  const kpis = useMemo(() => {
    const total = filtrados.length;
    const exatos = filtrados.filter((c) => c.exato).length;
    const empresas = new Set(filtrados.map((c) => c.cnpj || c.fornecedor)).size;
    const servidores = new Set(filtrados.map((c) => norm(c.servidor))).size;
    return { total, exatos, empresas, servidores };
  }, [filtrados]);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {/* Título */}
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Coincidências de Nomes: Sócio × Servidor
          </h1>
          <p className="max-w-3xl text-sm text-gray-500">
            Comparação entre nomes de sócios de empresas contratadas (Receita
            Federal) e nomes de servidores públicos (Portal da Transparência),
            apenas para apontar coincidências que merecem verificação.
          </p>
        </header>

        {/* Disclaimer fixo e obrigatório */}
        <DisclaimerInvestigacao />

        {/* Base legal — por que a coincidência merece apuração (sem imputação) */}
        <details className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-700">
            Por que esse cruzamento importa? (base legal)
          </summary>
          <div className="mt-3 space-y-2 leading-relaxed">
            <p>
              Servidor público <strong>pode ser sócio</strong>, mas não pode
              administrar empresa privada (art. 117 da Lei nº 8.112/1990) — o que
              também o impede de ser MEI, EI ou SLU. E o art. 14 da Lei nº
              14.133/2021 <strong>veda</strong> a participação, direta ou
              indireta, de agente público como licitante ou contratado do próprio
              órgão. Contratar com a Administração da mesma esfera pode configurar
              conflito de interesses.
            </p>
            <p>
              Por isso uma coincidência de nome entre sócio e servidor é
              justamente o que merece ser checado. Isto <strong>não</strong>{" "}
              afirma que houve irregularidade em qualquer caso: confirmar
              identidade (CPF) e quem administra a empresa cabe aos órgãos de
              controle. Detalhes na{" "}
              <Link href="/metodologia" className="text-blue-700 underline">
                Metodologia
              </Link>
              .
            </p>
          </div>
        </details>

        {/* Estado de erro */}
        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            <strong>Erro ao carregar dados:</strong> {erro}. Os dados podem
            estar desatualizados ou indisponíveis.
          </div>
        )}

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              rotulo="Cruzamentos"
              valor={kpis.total}
              detalhe="Coincidências de nome detectadas"
            />
            <KpiCard
              rotulo="Nome idêntico"
              valor={
                <span className="text-red-700">{kpis.exatos}</span>
              }
              detalhe="Indício mais forte (homonímia possível)"
            />
            <KpiCard
              rotulo="Empresas envolvidas"
              valor={kpis.empresas}
              detalhe="Fornecedores distintos"
            />
            <KpiCard
              rotulo="Servidores envolvidos"
              valor={kpis.servidores}
              detalhe="Servidores estaduais distintos"
            />
          </div>
        )}

        {/* Filtros */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-gray-600">
                Ente:
              </span>
              <button
                onClick={() => setFiltroEnte("todos")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filtroEnte === "todos"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600"
                }`}
              >
                Todos
              </button>
              {entesComDados.map((e) => (
                <button
                  key={e.chave}
                  onClick={() => setFiltroEnte(e.chave)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filtroEnte === e.chave
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600"
                  }`}
                >
                  {e.curto}
                </button>
              ))}
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={somenteExatos}
                onChange={(e) => setSomenteExatos(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              Somente nome idêntico
            </label>
          </div>
        </section>

        {/* Grafo de rede — peça central, só em telas md+ (ruim no mobile) */}
        <section className="hidden md:block">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Grafo de rede
            </h2>
            <p className="text-xs text-gray-400">
              Arraste os nós · role para dar zoom
            </p>
          </div>
          {loading ? (
            <div className="h-[500px] w-full animate-pulse rounded-xl border border-gray-200 bg-white" />
          ) : ordenados.length === 0 ? (
            <div className="flex h-[500px] w-full items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-gray-400">
              Nenhum cruzamento para os filtros selecionados.
            </div>
          ) : (
            <GrafoRede cruzamentos={ordenados} />
          )}
        </section>

        {/* Lista rankeada de cards (fallback mobile + detalhe) */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Cruzamentos detalhados
              <span className="rounded-full bg-gray-200 px-2 py-0.5 font-mono text-xs text-gray-600">
                {ordenados.length}
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white"
                />
              ))}
            </div>
          ) : ordenados.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
              Nenhum cruzamento para os filtros selecionados.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {ordenados.map((c, i) => (
                <CardCruzamento
                  key={`${c.contrato}-${c.cnpj}-${norm(c.servidor)}-${i}`}
                  c={c}
                />
              ))}
            </div>
          )}
        </section>

        {/* Nota de rodapé reforçando a fonte e o caráter de indício */}
        <footer className="border-t border-gray-200 pt-6 text-xs text-gray-400">
          <p>
            Fontes públicas: quadro societário via Receita Federal (CNPJ) ×
            servidores estaduais via Portal da Transparência do Maranhão.
            Coincidência de nome é{" "}
            <strong className="text-gray-500">indício, não prova</strong>; a
            apuração compete aos órgãos de controle.
          </p>
        </footer>
      </div>
    </main>
  );
}
