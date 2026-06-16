"use client";

import type { ReactNode } from "react";

export default function KpiCard({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{rotulo}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900 sm:text-3xl">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-gray-400">{detalhe}</p> : null}
    </div>
  );
}
