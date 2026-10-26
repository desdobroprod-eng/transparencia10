"use client";

import type { Contrato, Cruzamento, Emenda, FichaEmpresa } from "@/hooks/useDados";
import { NOME_ENTE, formatBRLcheio } from "@/lib/config";
import FichaCNPJ, { urlPNCP } from "@/components/FichaCNPJ";

// Detalhe exibido quando uma linha de contrato é aberta: dados do contrato com
// link para o PNCP e, abaixo, a ficha do fornecedor (só fatos, com fonte).
export default function DetalheContrato({
  contrato,
  ficha,
  contratosFornecedor,
  emendas,
  cruzamentos,
  explicacao,
}: {
  contrato: Contrato;
  ficha?: FichaEmpresa;
  contratosFornecedor: Contrato[];
  emendas: Emenda[];
  cruzamentos: Cruzamento[];
  explicacao?: string;
}) {
  const linkOficial = urlPNCP(contrato.id);
  const cnpj = (contrato.cnpj || "").replace(/\D/g, "");

  return (
    <div className="bg-gray-50 text-sm text-gray-700">
      <div className="sticky left-0 max-w-[calc(100vw-2.5rem)] space-y-4 px-4 pt-4 lg:max-w-[70rem]">
        {linkOficial && (
          <a
            href={linkOficial}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Ver contrato na fonte oficial (PNCP) <span aria-hidden>↗</span>
          </a>
        )}
        {explicacao && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="mb-1 text-xs font-semibold text-blue-800">Em linguagem simples</p>
            <p className="leading-snug text-blue-900">{explicacao}</p>
          </div>
        )}
        <dl className="grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ente</dt>
            <dd>{NOME_ENTE[contrato.ente] ?? contrato.ente}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Unidade</dt>
            <dd>{contrato.unidade || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Modalidade</dt>
            <dd>{contrato.modalidade || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Valor</dt>
            <dd className="font-medium">{formatBRLcheio(contrato.valor)}</dd>
          </div>
          {contrato.retificacoes > 0 && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Retificações no PNCP</dt>
              <dd>{contrato.retificacoes}</dd>
            </div>
          )}
        </dl>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Objeto</p>
          <p className="mt-0.5 whitespace-pre-line leading-snug">{contrato.objeto || "—"}</p>
        </div>
        <h3 className="pt-1 text-sm font-semibold text-gray-900">Ficha do fornecedor</h3>
      </div>
      <FichaCNPJ
        cnpj={contrato.cnpj}
        nome={contrato.razao_social || contrato.fornecedor}
        ficha={ficha}
        contratos={contratosFornecedor}
        emendas={emendas.filter((e) => e.cnpj_favorecido === cnpj)}
        cruzamentos={cruzamentos}
      />
    </div>
  );
}
