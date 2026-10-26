"use client";

import { Fragment, useState } from "react";
import type { Contrato, Cruzamento, Emenda, EmpresaRanking, FichaEmpresa } from "@/hooks/useDados";
import { NOME_ENTE, formatBRLcheio } from "@/lib/config";
import FichaCNPJ, { formatarCNPJ } from "@/components/FichaCNPJ";

export { formatarCNPJ };

function digitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

export default function TabelaEmpresas({
  empresas,
  fichas,
  contratos,
  emendas,
  cruzamentos,
}: {
  empresas: EmpresaRanking[];
  fichas: Record<string, FichaEmpresa>;
  contratos: Contrato[];
  emendas: Emenda[];
  cruzamentos: Cruzamento[];
}) {
  const [aberta, setAberta] = useState<string | null>(null);

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
            <th className="px-3 py-3"><span className="sr-only">Ficha</span></th>
            <th className="px-3 py-3">Empresa</th>
            <th className="px-3 py-3 text-right">Contratos</th>
            <th className="px-3 py-3 text-right">Valor total</th>
            <th className="px-3 py-3 text-right">Capital social</th>
            <th className="px-3 py-3">Porte</th>
            <th className="px-3 py-3">Entes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {empresas.map((e, i) => {
            const chave = e.cnpj || e.nome;
            const d = digitos(e.cnpj);
            const estaAberta = aberta === chave;
            return (
              <Fragment key={chave}>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-3 align-top text-gray-400">{i + 1}</td>
                  <td className="px-3 py-3 align-top">
                    <button
                      type="button"
                      onClick={() => setAberta(estaAberta ? null : chave)}
                      aria-expanded={estaAberta}
                      aria-controls={`ficha-${d || i}`}
                      aria-label={`${estaAberta ? "Fechar" : "Ver"} ficha de ${e.razao_social || e.nome}`}
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-1 ${
                        estaAberta
                          ? "border-[#C8102E] bg-[#C8102E] text-white"
                          : "border-gray-300 bg-white text-gray-800 hover:border-[#C8102E] hover:text-[#C8102E]"
                      }`}
                    >
                      <span aria-hidden className={`transition-transform ${estaAberta ? "rotate-90" : ""}`}>▸</span>
                      {estaAberta ? "Fechar" : "Ficha"}
                    </button>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-gray-900">{e.razao_social || e.nome || "—"}</div>
                    <div className="text-xs text-gray-400">{formatarCNPJ(e.cnpj)}</div>
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
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          MEI
                        </span>
                      )}
                      {!e.porte && !e.mei && <span className="text-xs text-gray-400">—</span>}
                    </div>
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
                {estaAberta && (
                  <tr id={`ficha-${d || i}`}>
                    <td colSpan={8} className="p-0">
                      <FichaCNPJ
                        cnpj={e.cnpj}
                        nome={e.razao_social || e.nome}
                        ficha={fichas[d]}
                        contratos={contratos.filter((c) => digitos(c.cnpj) === d)}
                        emendas={emendas.filter((em) => em.cnpj_favorecido === d)}
                        cruzamentos={cruzamentos}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
