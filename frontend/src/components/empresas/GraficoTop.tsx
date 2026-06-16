"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { type EmpresaRanking } from "@/hooks/useDados";
import { formatBRLcheio } from "@/lib/config";

function truncar(texto: string, max = 32): string {
  if (!texto) return "—";
  return texto.length > max ? texto.slice(0, max).trimEnd() + "…" : texto;
}

interface LinhaGrafico {
  cnpj: string;
  rotulo: string;
  nomeCompleto: string;
  valor: number;
  risco: boolean;
}

export default function GraficoTop({ empresas }: { empresas: EmpresaRanking[] }) {
  const dados: LinhaGrafico[] = empresas.map((e) => ({
    cnpj: e.cnpj || e.nome,
    rotulo: truncar(e.razao_social || e.nome),
    nomeCompleto: e.razao_social || e.nome,
    valor: e.total_valor,
    risco: e.capital_social > 0 && e.total_valor > 50 * e.capital_social,
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          Top 20 por valor contratado
        </h2>
        <p className="text-xs text-gray-400">
          Barras em vermelho: valor contratado muito acima do capital social.
        </p>
      </div>
      <div className="mt-4" style={{ width: "100%", height: 600 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dados}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="rotulo"
              width={220}
              tick={{ fontSize: 11, fill: "#374151" }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <Tooltip
              formatter={(v) => [formatBRLcheio(Number(v)), "Valor contratado"]}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.nomeCompleto ?? ""
              }
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={18}>
              {dados.map((d) => (
                <Cell key={d.cnpj} fill={d.risco ? "#dc2626" : "#1d4ed8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Eixo proporcional ao valor total — passe o mouse para o valor exato.
      </p>
    </div>
  );
}
