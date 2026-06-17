"use client";

// Pontuação de verificação (0-100) — termo NEUTRO, sem "risco" nem
// "alto/médio/baixo". Cor de apoio discreta (cinza), nunca vermelho.
export function faixaRisco(score: number): { label: string; classe: string } {
  return { label: "Pontuação", classe: "bg-slate-100 text-slate-700 border border-slate-300" };
}

export default function RiscoBadge({ score }: { score: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
      title={`Pontuação de verificação: ${score}/100`}
    >
      Pontuação
      <span className="font-mono font-semibold">{score}</span>
    </span>
  );
}
