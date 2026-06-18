"use client";

import { useMemo, useState } from "react";
import { useDados, type Emenda } from "@/hooks/useDados";
import { formatBRL } from "@/lib/config";
import KpiCard from "@/components/visao/KpiCard";

function norm(s: string): string {
  return (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

function fmtCnpj(c: string): string {
  const d = (c || "").replace(/\D/g, "");
  if (d.length !== 14) return c || "—";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export default function EmendasPage() {
  const { emendas, loading, erro } = useDados();

  const [esfera, setEsfera] = useState<"todas" | "estadual" | "federal">("todas");
  const [busca, setBusca] = useState("");
  const [soFornecedor, setSoFornecedor] = useState(false);

  const filtradas = useMemo(() => {
    const q = norm(busca);
    return emendas
      .filter((e) => (esfera === "todas" ? true : e.esfera === esfera))
      .filter((e) => (soFornecedor ? e.fornecedor_contratado : true))
      .filter((e) =>
        !q
          ? true
          : norm(e.parlamentar).includes(q) ||
            norm(e.objeto).includes(q) ||
            norm(e.beneficiada).includes(q),
      )
      .sort((a, b) => (b.valor_empenhado || 0) - (a.valor_empenhado || 0));
  }, [emendas, esfera, busca, soFornecedor]);

  const kpis = useMemo(() => {
    const total = emendas.length;
    const empenhado = emendas.reduce((s, e) => s + (e.valor_empenhado || 0), 0);
    const comCnpj = emendas.filter((e) => e.cnpj_favorecido).length;
    const fornecedor = emendas.filter((e) => e.fornecedor_contratado).length;
    return { total, empenhado, comCnpj, fornecedor };
  }, [emendas]);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Emendas Parlamentares para a Cultura
          </h1>
          <p className="max-w-3xl text-sm text-gray-500">
            Emendas destinadas à função Cultura no Maranhão, conforme o Portal da
            Transparência do Estado. Mostra qual parlamentar indicou o recurso,
            para qual objeto e quem foi o favorecido — permitindo acompanhar o
            caminho do dinheiro da emenda até a ponta.
          </p>
        </header>

        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            <strong>Erro ao carregar dados:</strong> {erro}.
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard rotulo="Emendas de cultura" valor={kpis.total} detalhe="Estaduais + federais (MA)" />
          <KpiCard rotulo="Valor empenhado" valor={formatBRL(kpis.empenhado)} detalhe="Soma das emendas" />
          <KpiCard rotulo="Com favorecido (CNPJ)" valor={kpis.comCnpj} detalhe="Beneficiário identificado" />
          <KpiCard
            rotulo="Favorecido também fornecedor"
            valor={<span className="text-orange-700">{kpis.fornecedor}</span>}
            detalhe="CNPJ recebeu emenda E tem contrato"
          />
        </div>

        {/* Destaque do cruzamento emenda × contrato */}
        {kpis.fornecedor > 0 && (
          <div className="rounded-xl border-l-4 border-orange-400 bg-orange-50 px-5 py-4 text-sm leading-relaxed text-orange-900">
            <strong>{kpis.fornecedor}</strong> emenda(s) têm como favorecido um CNPJ
            que também aparece como <strong>fornecedor contratado</strong> nos dados
            do portal. Isso mostra a ligação entre a indicação do recurso e a empresa
            que o recebeu — um ponto natural para acompanhamento. Coincidência de CNPJ
            é um fato verificável; não constitui, por si só, indício de irregularidade.
          </div>
        )}

        {/* Filtros */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-gray-600">Esfera:</span>
              {([["todas", "Todas"], ["estadual", "Estaduais"], ["federal", "Federais"]] as const).map(
                ([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setEsfera(k)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      esfera === k
                        ? "bg-blue-600 text-white shadow-sm"
                        : "border border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={soFornecedor}
                  onChange={(e) => setSoFornecedor(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                Só favorecido contratado
              </label>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar parlamentar, objeto…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
              />
            </div>
          </div>
        </section>

        {/* Tabela */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Emendas
              <span className="rounded-full bg-gray-200 px-2 py-0.5 font-mono text-xs text-gray-600">
                {filtradas.length}
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white" />
          ) : filtradas.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
              Nenhuma emenda para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Parlamentar</th>
                    <th className="px-4 py-3 font-semibold">Ano</th>
                    <th className="px-4 py-3 font-semibold">Objeto / Beneficiado</th>
                    <th className="px-4 py-3 font-semibold">Favorecido</th>
                    <th className="px-4 py-3 text-right font-semibold">Empenhado</th>
                    <th className="px-4 py-3 text-right font-semibold">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtradas.slice(0, 400).map((e, i) => (
                    <LinhaEmenda key={`${e.id}-${i}`} e={e} />
                  ))}
                </tbody>
              </table>
              {filtradas.length > 400 && (
                <p className="px-4 py-3 text-xs text-gray-400">
                  Exibindo as 400 maiores de {filtradas.length}. Refine a busca para ver outras.
                </p>
              )}
            </div>
          )}
        </section>

        <footer className="border-t border-gray-200 pt-6 text-xs text-gray-400">
          <p>
            Fonte: Portal da Transparência do Maranhão — Emendas Estaduais e
            Federais (export oficial), recorte da função Cultura. Os valores
            refletem o que consta na fonte na data da coleta.
          </p>
        </footer>
      </div>
    </main>
  );
}

function LinhaEmenda({ e }: { e: Emenda }) {
  return (
    <tr className="align-top hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{e.parlamentar || "—"}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              e.esfera === "federal"
                ? "bg-purple-100 text-purple-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {e.esfera === "federal" ? "Federal" : "Estadual"}
          </span>
          {e.unidade && <span className="text-xs text-gray-500">{e.unidade}</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600">{e.ano || "—"}</td>
      <td className="max-w-md px-4 py-3 text-gray-700">
        <div className="line-clamp-3">{e.objeto || e.beneficiada || "—"}</div>
        {e.subfuncao && (
          <div className="mt-1 text-xs text-gray-400">{e.subfuncao}</div>
        )}
      </td>
      <td className="px-4 py-3">
        {e.cnpj_favorecido ? (
          <a
            href={`https://portaldatransparencia.gov.br/pessoa-juridica/${e.cnpj_favorecido}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir no Portal da Transparência federal (fonte oficial)"
            className="text-blue-600 underline hover:text-blue-800"
          >
            {fmtCnpj(e.cnpj_favorecido)}
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        )}
        {e.fornecedor_contratado && (
          <span className="mt-1 block rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
            também é fornecedor
          </span>
        )}
        {e.detalhe_url && (
          <a
            href={e.detalhe_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-xs text-blue-600 underline hover:text-blue-800"
          >
            ver no Portal Federal →
          </a>
        )}
      </td>
      <td className="px-4 py-3 text-right font-medium text-gray-900">
        {formatBRL(e.valor_empenhado || 0)}
      </td>
      <td className="px-4 py-3 text-right text-gray-600">{formatBRL(e.valor_pago || 0)}</td>
    </tr>
  );
}
