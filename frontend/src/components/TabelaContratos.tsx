"use client";

import { useState } from "react";
import { Contrato, Alerta } from "@/hooks/useTransparencia";

interface TabelaContratosProps {
  contratos: Contrato[];
}

const ENTES_LABEL: Record<string, string> = {
  maranhao_estado: "Estado MA",
  sao_luis: "São Luís",
  raposa: "Raposa",
  sao_jose_ribamar: "S.J. Ribamar",
  paco_lumiar: "Paço do Lumiar",
};

function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function BadgeRisco({ score }: { score: number }) {
  const cor =
    score >= 80
      ? "bg-red-100 text-red-700 border border-red-300"
      : score >= 60
      ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
      : "bg-green-100 text-green-700 border border-green-300";

  const label = score >= 80 ? "Alto" : score >= 60 ? "Médio" : "Baixo";

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cor}`}>
      {label} ({score})
    </span>
  );
}

function LinhaExpansivel({ contrato }: { contrato: Contrato }) {
  const [aberto, setAberto] = useState(false);

  const corLinha =
    contrato.score_risco >= 80
      ? "bg-red-50 hover:bg-red-100"
      : contrato.score_risco >= 60
      ? "bg-yellow-50 hover:bg-yellow-100"
      : "bg-white hover:bg-gray-50";

  const alertas: Alerta[] = contrato.alertas ?? [];

  return (
    <>
      <tr
        className={`cursor-pointer border-b border-gray-100 transition-colors ${corLinha}`}
        onClick={() => setAberto((v) => !v)}
        title="Clique para ver detalhes"
      >
        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
          {ENTES_LABEL[contrato.ente] ?? contrato.ente}
        </td>
        <td className="px-4 py-3 text-sm text-gray-800 max-w-[160px] truncate">
          {contrato.fornecedor}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 max-w-[220px] truncate">
          {contrato.objeto}
        </td>
        <td className="px-4 py-3 text-sm font-mono text-right whitespace-nowrap">
          {formatBRL(contrato.valor)}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
          {contrato.modalidade}
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <BadgeRisco score={contrato.score_risco} />
        </td>
        <td className="px-4 py-3 text-center text-gray-400 text-xs">
          {aberto ? "▲" : "▼"}
        </td>
      </tr>

      {aberto && (
        <tr className="border-b border-gray-100">
          <td
            colSpan={7}
            className="px-6 py-4 bg-gray-50"
          >
            {alertas.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhum alerta registrado para este contrato.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Alertas deste contrato ({alertas.length})
                </p>
                {alertas.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                      a.nivel === "critico"
                        ? "bg-red-50 border-red-200"
                        : a.nivel === "atencao"
                        ? "bg-yellow-50 border-yellow-200"
                        : "bg-green-50 border-green-200"
                    }`}
                  >
                    <span className="font-mono text-xs bg-white border rounded px-1.5 py-0.5 whitespace-nowrap">
                      Score {a.score}
                    </span>
                    <div>
                      <p className="text-gray-800">{a.motivo}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Regra: {a.regra.replace(/_/g, " ")} —{" "}
                        {a.detectado_em
                          ? new Date(a.detectado_em).toLocaleString("pt-BR")
                          : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function TabelaContratos({ contratos }: TabelaContratosProps) {
  if (contratos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
        Nenhum contrato encontrado para o período selecionado.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 text-left font-semibold">Ente</th>
              <th className="px-4 py-3 text-left font-semibold">Fornecedor</th>
              <th className="px-4 py-3 text-left font-semibold">Objeto</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
              <th className="px-4 py-3 text-left font-semibold">Modalidade</th>
              <th className="px-4 py-3 text-right font-semibold">Risco</th>
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {contratos.map((c, i) => (
              <LinhaExpansivel key={`${c.id}-${i}`} contrato={c} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
        Clique em uma linha para expandir os alertas do contrato.
      </div>
    </div>
  );
}
