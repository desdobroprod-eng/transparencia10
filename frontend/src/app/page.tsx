"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { useDados } from "@/hooks/useDados";
import { ENTES, formatBRL, formatBRLcheio, RISCO, type NivelRisco } from "@/lib/config";
import KpiCard from "@/components/visao/KpiCard";
import ChipRisco from "@/components/visao/ChipRisco";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

export default function VisaoGeralPage() {
  const { loading, erro, stats, meta, cruzamentos, emendas, explicacoes, ultimaAtualizacao } = useDados();

  const emendasResumo = useMemo(() => {
    const total = emendas.length;
    const valor = emendas.reduce((s, e) => s + (e.valor_empenhado || 0), 0);
    const fornecedor = emendas.filter((e) => e.fornecedor_contratado).length;
    return { total, valor, fornecedor };
  }, [emendas]);

  const dadosBarras = useMemo(
    () =>
      ENTES.map((e) => {
        const s = stats[e.chave];
        return {
          chave: e.chave,
          nome: e.curto,
          gasto: s?.total_gasto ?? 0,
          nivel: (s?.nivel_risco ?? "normal") as NivelRisco,
        };
      }),
    [stats]
  );

  const gastoTotal = useMemo(
    () => Object.values(stats).reduce((acc, s) => acc + (s?.total_gasto ?? 0), 0),
    [stats]
  );

  const dataFmt = ultimaAtualizacao
    ? ultimaAtualizacao.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  // ----- Estado de erro -----
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

  // ----- Estado de carregamento -----
  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="mt-8 h-72 w-full" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </section>
    );
  }

  const cat = meta?.alertas_por_categoria ?? {
    financeiro: 0,
    conflito_interesse: 0,
    nepotismo: 0,
  };
  const categorias = [
    { rotulo: "Financeiro (empresa/contrato)", valor: cat.financeiro, cor: RISCO.critico.cor },
    { rotulo: "Coincidência nominal (a verificar)", valor: cat.conflito_interesse + cat.nepotismo, cor: "#7c3aed" },
  ];
  const maxCat = Math.max(1, ...categorias.map((c) => c.valor));

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gastos com cultura nas secretarias do Maranhão
          </p>
          <p className="mt-1 text-xs text-gray-400">Atualizado em {dataFmt}</p>
        </div>
        <a
          href="/transparencia10/inicio"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#C8102E] px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-[#a30d26]"
        >
          <span>🏛️</span> Sobre o portal
        </a>
      </header>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard rotulo="Gasto total" valor={formatBRL(gastoTotal)} detalhe="Soma dos entes" />
        <KpiCard
          rotulo="Total de contratos"
          valor={(meta?.total_contratos ?? 0).toLocaleString("pt-BR")}
        />
        <KpiCard
          rotulo="Total de alertas"
          valor={(meta?.total_alertas ?? 0).toLocaleString("pt-BR")}
        />
        <KpiCard
          rotulo="Cruzamentos sócio × servidor"
          valor={cruzamentos.length.toLocaleString("pt-BR")}
        />
      </div>

      {/* Destaque — emendas parlamentares para a cultura */}
      {emendasResumo.total > 0 && (
        <a
          href="/transparencia10/emendas"
          className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Novo · Emendas parlamentares para a cultura
            </p>
            <p className="mt-1 text-sm text-gray-600">
              <strong className="text-gray-900">{emendasResumo.total.toLocaleString("pt-BR")}</strong>{" "}
              emendas ({formatBRL(emendasResumo.valor)} empenhados) —{" "}
              <strong className="text-orange-700">{emendasResumo.fornecedor}</strong> com emenda e contrato público no mesmo CNPJ.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Ver emendas →
          </span>
        </a>
      )}

      {/* Gráfico de barras — gasto por ente */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-base font-semibold text-gray-900">Gasto por ente</h2>
          <p className="text-xs text-gray-400">
            O Estado concentra valores em escala bilionária; municípios na casa dos milhões.
          </p>
        </div>
        <div className="mt-4" style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dadosBarras}
              layout="vertical"
              margin={{ top: 8, right: 96, bottom: 8, left: 8 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nome"
                width={110}
                tick={{ fontSize: 12, fill: "#374151" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [formatBRLcheio(Number(v)), "Gasto"]}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Bar dataKey="gasto" radius={[0, 4, 4, 0]} barSize={22}>
                {dadosBarras.map((d) => (
                  <Cell key={d.chave} fill={(RISCO[d.nivel] ?? RISCO.normal).cor} />
                ))}
                <LabelList
                  dataKey="gasto"
                  position="right"
                  formatter={(v) => formatBRL(Number(v))}
                  style={{ fontSize: 11, fill: "#4b5563" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pontos a verificar por ente */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-gray-900">Pontos a verificar por ente</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {ENTES.map((e) => {
            const s = stats[e.chave];
            return (
              <ChipRisco
                key={e.chave}
                nome={e.curto}
                nivel={(s?.nivel_risco ?? "normal") as NivelRisco}
                contratos={s?.total_contratos ?? 0}
                alertas={s?.total_alertas ?? 0}
              />
            );
          })}
        </div>
      </div>

      {/* Entenda os números (explicação em linguagem simples por ente) */}
      {explicacoes?.entes && (
        <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-blue-900">
            <span aria-hidden>💬</span> Entenda em linguagem simples
          </h2>
          <ul className="mt-3 space-y-2.5">
            {ENTES.map((e) =>
              explicacoes.entes[e.chave] ? (
                <li key={e.chave} className="text-sm leading-snug text-blue-900">
                  <strong className="font-semibold">{e.curto}:</strong>{" "}
                  {explicacoes.entes[e.chave]}
                </li>
              ) : null
            )}
          </ul>
          {explicacoes.fonte_ia && (
            <p className="mt-3 text-xs text-blue-700/70">
              Explicações geradas automaticamente a partir dos dados oficiais.
            </p>
          )}
        </div>
      )}

      {/* Composição de alertas */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-base font-semibold text-gray-900">Composição de alertas</h2>
          <a
            href="/transparencia10/cruzamentos"
            className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
          >
            Ver coincidências de nomes (sócio × servidor) →
          </a>
        </div>
        <ul className="mt-4 space-y-3">
          {categorias.map((c) => (
            <li key={c.rotulo}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{c.rotulo}</span>
                <span className="font-semibold text-gray-900">
                  {c.valor.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(c.valor / maxCat) * 100}%`,
                    backgroundColor: c.cor,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
