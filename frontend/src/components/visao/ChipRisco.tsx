"use client";

import { type NivelRisco } from "@/lib/config";

export default function ChipRisco({
  nome,
  contratos,
  alertas,
}: {
  nome: string;
  nivel?: NivelRisco; // mantido por compatibilidade; sem rótulo de risco
  contratos: number;
  alertas: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <span className="text-sm font-semibold text-gray-900">{nome}</span>
      <div className="mt-3 flex flex-col gap-1 text-xs text-gray-500">
        <span>
          <span className="font-semibold text-gray-700">{contratos}</span> contratos
        </span>
        <span>
          <span className="font-semibold text-gray-700">{alertas}</span> pontos a verificar
        </span>
      </div>
    </div>
  );
}
