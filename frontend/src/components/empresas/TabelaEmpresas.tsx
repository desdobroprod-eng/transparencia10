"use client";

import { type EmpresaRanking } from "@/hooks/useDados";
import { NOME_ENTE, formatBRLcheio } from "@/lib/config";

export function formatarCNPJ(cnpj: string): string {
  const d = (cnpj || "").replace(/\D/g, "");
  if (d.length !== 14) return cnpj || "—";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export interface EmpresaComRisco extends EmpresaRanking {
  capitalBaixo: boolean;
  multiplo: number;
}

export function comRisco(e: EmpresaRanking): EmpresaComRisco {
  const capitalBaixo = e.capital_social > 0 && e.total_valor > 50 * e.capital_social;
  const multiplo = e.capital_social > 0 ? e.total_valor / e.capital_social : 0;
  return { ...e, capitalBaixo, multiplo };
}

export default function TabelaEmpresas({
  empresas,
}: {
  empresas: EmpresaComRisco[];
}) {
  if (empresas.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Nenhuma empresa encontrada para o filtro informado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-3 py-3">#</th>
            <th className="px-3 py-3">Empresa</th>
            <th className="px-3 py-3 text-right">Contratos</th>
            <th className="px-3 py-3 text-right">Valor total</th>
            <th className="px-3 py-3 text-right">Capital social</th>
            <th className="px-3 py-3">Porte</th>
            <th className="px-3 py-3 text-right">Alertas</th>
            <th className="px-3 py-3">Entes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {empresas.map((e, i) => (
            <tr
              key={e.cnpj || e.nome}
              className={e.capitalBaixo ? "bg-amber-50/60" : "hover:bg-gray-50"}
            >
              <td className="px-3 py-3 align-top text-gray-400">{i + 1}</td>

              <td className="px-3 py-3 align-top">
                <div className="flex items-start gap-2">
                  {e.capitalBaixo && (
                    <span
                      title={`Valor contratado é ${e.multiplo.toLocaleString("pt-BR", {
                        maximumFractionDigits: 0,
                      })}x o capital social declarado — divergência a verificar.`}
                      className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white"
                      aria-label="Ponto a verificar"
                    >
                      !
                    </span>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {e.razao_social || e.nome || "—"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatarCNPJ(e.cnpj)}
                    </div>
                    {e.capitalBaixo && (
                      <div className="mt-0.5 text-xs font-medium text-amber-700">
                        Valor é{" "}
                        {e.multiplo.toLocaleString("pt-BR", {
                          maximumFractionDigits: 0,
                        })}
                        x o capital social — a verificar
                      </div>
                    )}
                  </div>
                </div>
              </td>

              <td className="px-3 py-3 align-top text-right tabular-nums text-gray-700">
                {e.num_contratos.toLocaleString("pt-BR")}
              </td>

              <td className="px-3 py-3 align-top text-right font-semibold tabular-nums text-gray-900">
                {formatBRLcheio(e.total_valor)}
              </td>

              <td className="px-3 py-3 align-top text-right tabular-nums text-gray-600">
                {e.capital_social > 0 ? formatBRLcheio(e.capital_social) : "—"}
              </td>

              <td className="px-3 py-3 align-top">
                <div className="flex flex-wrap gap-1">
                  {e.porte && (
                    <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {e.porte}
                    </span>
                  )}
                  {e.mei && (
                    <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      MEI
                    </span>
                  )}
                  {!e.porte && !e.mei && (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>
              </td>

              <td className="px-3 py-3 align-top text-right tabular-nums">
                {e.num_alertas > 0 ? (
                  <span className="inline-flex rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {e.num_alertas}
                  </span>
                ) : (
                  <span className="text-gray-400">0</span>
                )}
              </td>

              <td className="px-3 py-3 align-top">
                <div className="flex flex-wrap gap-1">
                  {e.entes.map((c) => (
                    <span
                      key={c}
                      className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                    >
                      {NOME_ENTE[c] ?? c}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
