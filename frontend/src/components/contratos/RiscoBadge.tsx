"use client";

// Faixa de risco a partir do score numérico (0-100).
// Sempre acompanha rótulo textual — nunca apenas cor.
export function faixaRisco(score: number): {
  label: string;
  classe: string;
} {
  if (score >= 80) {
    return { label: "Alto", classe: "bg-red-100 text-red-700 border border-red-300" };
  }
  if (score >= 60) {
    return { label: "Médio", classe: "bg-amber-100 text-amber-700 border border-amber-300" };
  }
  return { label: "Baixo", classe: "bg-green-100 text-green-700 border border-green-300" };
}

export default function RiscoBadge({ score }: { score: number }) {
  const f = faixaRisco(score);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${f.classe}`}
      title={`Score de risco: ${score}/100`}
    >
      {f.label}
      <span className="font-mono font-normal opacity-70">{score}</span>
    </span>
  );
}
