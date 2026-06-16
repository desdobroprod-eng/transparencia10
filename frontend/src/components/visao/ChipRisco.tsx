"use client";

import { RISCO, type NivelRisco } from "@/lib/config";

export default function ChipRisco({
  nome,
  nivel,
  contratos,
  alertas,
}: {
  nome: string;
  nivel: NivelRisco;
  contratos: number;
  alertas: number;
}) {
  const r = RISCO[nivel] ?? RISCO.normal;
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${r.borda}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{nome}</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${r.bg} ${r.texto}`}
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: r.cor }}
          />
          {r.label}
        </span>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <span>
          <span className="font-semibold text-gray-700">{contratos}</span> contratos
        </span>
        <span>
          <span className="font-semibold text-gray-700">{alertas}</span> alertas
        </span>
      </div>
    </div>
  );
}
