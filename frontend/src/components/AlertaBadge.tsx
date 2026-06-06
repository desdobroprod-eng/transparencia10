"use client";

interface AlertaBadgeProps {
  nivel: "critico" | "atencao" | "baixo";
  motivo: string;
  score: number;
  regra: string;
  detectado_em: string;
  cnpj?: string;
  fornecedor?: string;
}

const CONFIG = {
  critico: {
    label: "CRÍTICO",
    bg: "bg-red-100 border-red-400",
    badge: "bg-red-600 text-white",
    icone: "🚨",
  },
  atencao: {
    label: "ATENÇÃO",
    bg: "bg-yellow-50 border-yellow-400",
    badge: "bg-yellow-500 text-white",
    icone: "⚠️",
  },
  baixo: {
    label: "BAIXO",
    bg: "bg-green-50 border-green-400",
    badge: "bg-green-600 text-white",
    icone: "ℹ️",
  },
};

export default function AlertaBadge({
  nivel,
  motivo,
  score,
  regra,
  detectado_em,
  cnpj,
  fornecedor,
}: AlertaBadgeProps) {
  const cfg = CONFIG[nivel];

  const dataFormatada = detectado_em
    ? new Date(detectado_em).toLocaleString("pt-BR")
    : "—";

  return (
    <div className={`border rounded-lg p-4 flex gap-3 ${cfg.bg}`}>
      {/* Ícone + score */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1">
        <span className="text-2xl leading-none">{cfg.icone}</span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}
        >
          {cfg.label}
        </span>
        <span className="text-xs text-gray-500 font-mono">{score}/100</span>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-snug">
          {motivo}
        </p>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="bg-gray-200 px-2 py-0.5 rounded font-mono">
            {regra.replace(/_/g, " ")}
          </span>
          {fornecedor && <span className="truncate">{fornecedor}</span>}
        </div>
        {cnpj && (
          <p className="text-xs text-gray-500 mt-1">
            CNPJ:{" "}
            <a
              href={`https://publica.cnpj.ws/cnpj/${cnpj}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              {cnpj}
            </a>
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">Detectado em: {dataFormatada}</p>
      </div>
    </div>
  );
}
