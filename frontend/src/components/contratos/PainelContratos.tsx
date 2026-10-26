"use client";

// Painel-resumo da página de Contratos. Recebe a lista JÁ FILTRADA, então todos
// os números e gráficos acompanham busca, ente, ano e "somente com indícios".

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Contrato } from "@/hooks/useDados";
import { NOME_ENTE, ENTES, formatBRL, formatBRLcheio } from "@/lib/config";

const COR = "#C8102E";
const COR_SUAVE = "#1B3A8B";

function Kpi({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{rotulo}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{valor}</div>
      {nota && <div className="mt-0.5 text-xs text-gray-500">{nota}</div>}
    </div>
  );
}

function TooltipBRL({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload: { n?: number; nomeCompleto?: string } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow">
      <div className="font-semibold text-gray-900">{p.payload.nomeCompleto ?? label}</div>
      <div className="tabular-nums text-gray-700">{formatBRLcheio(p.value)}</div>
      {p.payload.n !== undefined && (
        <div className="text-gray-500">
          {p.payload.n} contrato{p.payload.n === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

export default function PainelContratos({ contratos }: { contratos: Contrato[] }) {
  const resumo = useMemo(() => {
    const total = contratos.reduce((s, c) => s + (c.valor || 0), 0);
    const comPontos = contratos.filter((c) => c.alertas.length > 0 || c.score_risco > 0).length;

    const porFornecedor = new Map<string, { valor: number; n: number }>();
    for (const c of contratos) {
      const k = c.fornecedor || "—";
      const v = porFornecedor.get(k) ?? { valor: 0, n: 0 };
      v.valor += c.valor || 0;
      v.n += 1;
      porFornecedor.set(k, v);
    }
    const topFornecedores = [...porFornecedor.entries()]
      .sort((a, b) => b[1].valor - a[1].valor)
      .slice(0, 8)
      .map(([nome, v]) => ({
        nome: nome.length > 26 ? nome.slice(0, 25) + "…" : nome,
        nomeCompleto: nome,
        valor: v.valor,
        n: v.n,
      }));

    const porAno = new Map<number, { valor: number; n: number }>();
    for (const c of contratos) {
      if (!c.ano) continue;
      const v = porAno.get(c.ano) ?? { valor: 0, n: 0 };
      v.valor += c.valor || 0;
      v.n += 1;
      porAno.set(c.ano, v);
    }
    const anos = [...porAno.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ano, v]) => ({ ano: String(ano), valor: v.valor, n: v.n }));

    const entes = ENTES.map((e) => {
      const lista = contratos.filter((c) => c.ente === e.chave);
      return {
        nome: e.curto,
        nomeCompleto: NOME_ENTE[e.chave] ?? e.curto,
        valor: lista.reduce((s, c) => s + (c.valor || 0), 0),
        n: lista.length,
      };
    })
      .filter((e) => e.n > 0)
      .sort((a, b) => b.valor - a.valor);

    return { total, comPontos, topFornecedores, anos, entes };
  }, [contratos]);

  const n = contratos.length;
  if (n === 0) return null;
  const media = resumo.total / n;
  const pct = Math.round((resumo.comPontos / n) * 100);

  return (
    <section aria-label="Resumo dos contratos filtrados" className="mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Total contratado" valor={formatBRL(resumo.total)} />
        <Kpi rotulo="Contratos" valor={n.toLocaleString("pt-BR")} />
        <Kpi rotulo="Valor médio" valor={formatBRL(media)} />
        <Kpi
          rotulo="Com pontos a verificar"
          valor={`${pct}%`}
          nota={`${resumo.comPontos.toLocaleString("pt-BR")} de ${n.toLocaleString("pt-BR")}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Maiores fornecedores por valor contratado</h2>
          <div className="mt-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resumo.topFornecedores} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="#eef0f3" />
                <XAxis type="number" tickFormatter={(v) => formatBRL(v)} tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 11, fill: "#374151" }} />
                <Tooltip content={<TooltipBRL />} cursor={{ fill: "#f3f4f6" }} />
                <Bar dataKey="valor" fill={COR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Valor contratado por ano</h2>
            <div className="mt-2 h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resumo.anos} margin={{ left: 8, right: 8 }}>
                  <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "#374151" }} />
                  <YAxis hide />
                  <Tooltip content={<TooltipBRL />} cursor={{ fill: "#f3f4f6" }} />
                  <Bar dataKey="valor" fill={COR_SUAVE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Valor contratado por ente</h2>
            <ul className="mt-3 space-y-2">
              {resumo.entes.map((e) => (
                <li key={e.nome}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium text-gray-800">{e.nome}</span>
                    <span className="tabular-nums text-gray-600">
                      {formatBRL(e.valor)} · {e.n} contrato{e.n === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${resumo.total ? Math.max(1, (e.valor / resumo.total) * 100) : 0}%`,
                        background: COR,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
