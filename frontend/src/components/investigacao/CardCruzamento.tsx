"use client";

import { NOME_ENTE } from "@/lib/config";
import type { Cruzamento } from "@/hooks/useDados";

// Card de um cruzamento sócio × servidor.
// Selo vermelho "NOME IDÊNTICO" (exato) ou cinza "Sobrenomes em comum".
export default function CardCruzamento({ c }: { c: Cruzamento }) {
  const exato = c.exato;
  const sobrenomes = (c.sobrenomes_comuns ?? []).filter(Boolean);
  const enteNome = NOME_ENTE[c.ente] ?? c.ente;

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        exato ? "border-red-300" : "border-gray-200"
      }`}
    >
      {/* Selo de classificação do indício */}
      <div className="mb-3 flex items-center justify-between gap-2">
        {exato ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-700 border border-red-300">
            ● Nome idêntico
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 border border-gray-300">
            Sobrenomes em comum
            {sobrenomes.length > 0 && (
              <span className="font-normal text-gray-500">
                : {sobrenomes.join(", ")}
              </span>
            )}
          </span>
        )}
        <span
          className="shrink-0 rounded-md bg-gray-50 px-2 py-0.5 text-xs font-mono text-gray-500"
          title="Score de coincidência"
        >
          score {Number(c.score ?? 0).toFixed(2)}
        </span>
      </div>

      {/* Sócio × Servidor */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Sócio da empresa
          </p>
          <p className="text-sm font-semibold text-gray-900">{c.socio || "—"}</p>
        </div>
        <span
          aria-hidden
          className="hidden text-center text-gray-300 sm:block"
        >
          ↔
        </span>
        <div className="sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Servidor estadual
          </p>
          <p className="text-sm font-semibold text-gray-900">
            {c.servidor || "—"}
          </p>
        </div>
      </div>

      {/* Empresa + ente */}
      <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <p>
          <span className="text-gray-400">Empresa:</span>{" "}
          <span className="font-medium text-gray-700">
            {c.fornecedor || "—"}
          </span>
          {c.cnpj && (
            <span className="ml-1 font-mono text-gray-400">· {c.cnpj}</span>
          )}
        </p>
        <p className="mt-0.5">
          <span className="text-gray-400">Ente / contrato:</span>{" "}
          <span className="font-medium text-gray-700">{enteNome}</span>
          {c.contrato && (
            <span className="ml-1 font-mono text-gray-400">
              · {c.contrato}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
