"use client";

import type { Contrato } from "@/hooks/useDados";
import { NOME_ENTE, formatBRLcheio, rotuloRegra } from "@/lib/config";
import RiscoBadge from "./RiscoBadge";

// Painel de drill-down exibido quando uma linha é expandida.
// Mostra objeto completo, unidade e os alertas (indícios) do contrato.
export default function DetalheContrato({
  contrato,
  explicacao,
}: {
  contrato: Contrato;
  explicacao?: string;
}) {
  return (
    <div className="space-y-4 bg-gray-50 px-4 py-4 text-sm text-gray-700">
      {explicacao && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-blue-800">
            <span aria-hidden>💬</span> Em linguagem simples
          </p>
          <p className="leading-snug text-blue-900">{explicacao}</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ente</p>
          <p>{NOME_ENTE[contrato.ente] ?? contrato.ente}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Unidade</p>
          <p>{contrato.unidade || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Modalidade</p>
          <p>{contrato.modalidade || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Valor</p>
          <p className="font-medium">{formatBRLcheio(contrato.valor)}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Objeto</p>
        <p className="mt-0.5 whitespace-pre-line leading-snug">{contrato.objeto || "—"}</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Indícios ({contrato.alertas.length})
        </p>

        {contrato.alertas.length === 0 ? (
          <p className="text-gray-500">Nenhum indício neste contrato.</p>
        ) : (
          <ul className="space-y-2">
            {contrato.alertas.map((al) => (
              <li
                key={al.id}
                className="rounded-md border border-gray-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-gray-800">{al.motivo}</p>
                  <RiscoBadge score={al.score} />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {rotuloRegra(al.regra)}
                </p>
                {al.fornecedor && (
                  <p className="mt-1 text-xs text-gray-500">Fornecedor: {al.fornecedor}</p>
                )}
                {al.orgao_servidor && (
                  <p className="mt-1 text-xs text-gray-500">
                    Órgão do servidor: {al.orgao_servidor}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
