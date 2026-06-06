"use client";

// Categorias possíveis de alerta (espelho do campo `categoria` do alertas.json)
export type CategoriaAlerta = "financeiro" | "conflito_interesse" | "nepotismo";

interface AlertaBadgeProps {
  nivel: "critico" | "atencao" | "baixo";
  motivo: string;
  score: number;
  regra: string;
  detectado_em: string;
  cnpj?: string;
  fornecedor?: string;
  // Campos da Fase 4 — cruzamento com servidores públicos
  categoria?: CategoriaAlerta;
  orgao_servidor?: string;
}

// Configuração visual por nível de risco
const CONFIG_NIVEL = {
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
} as const;

// Configuração visual por categoria de alerta
const CONFIG_CATEGORIA: Record<
  CategoriaAlerta,
  { icone: string; rotulo: string; badge: string }
> = {
  financeiro: {
    icone: "💰",
    rotulo: "Financeiro",
    badge: "bg-blue-100 text-blue-700 border border-blue-200",
  },
  conflito_interesse: {
    icone: "👤",
    rotulo: "Conflito de Interesse",
    badge: "bg-orange-100 text-orange-700 border border-orange-200",
  },
  nepotismo: {
    icone: "👨‍👩‍👧",
    rotulo: "Nepotismo / Testa-ferro",
    badge: "bg-purple-100 text-purple-700 border border-purple-200",
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
  categoria,
  orgao_servidor,
}: AlertaBadgeProps) {
  const cfgNivel = CONFIG_NIVEL[nivel];
  const cfgCategoria = categoria ? CONFIG_CATEGORIA[categoria] : null;

  const dataFormatada = detectado_em
    ? new Date(detectado_em).toLocaleString("pt-BR")
    : "—";

  return (
    <div className={`border rounded-lg p-4 flex gap-3 ${cfgNivel.bg}`}>
      {/* Ícone de nível + score */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1">
        {/* Ícone principal: categoria (se houver) sobrepõe o ícone de nível */}
        <span className="text-2xl leading-none" title={cfgCategoria?.rotulo ?? cfgNivel.label}>
          {cfgCategoria ? cfgCategoria.icone : cfgNivel.icone}
        </span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfgNivel.badge}`}
        >
          {cfgNivel.label}
        </span>
        <span className="text-xs text-gray-500 font-mono">{score}/100</span>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-snug">
          {motivo}
        </p>

        {/* Tags: regra + categoria */}
        <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
          <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-mono">
            {regra.replace(/_/g, " ")}
          </span>

          {/* Badge de categoria — visível sempre que o campo estiver presente */}
          {cfgCategoria && (
            <span className={`px-2 py-0.5 rounded font-medium ${cfgCategoria.badge}`}>
              {cfgCategoria.icone} {cfgCategoria.rotulo}
            </span>
          )}

          {fornecedor && (
            <span className="text-gray-500 truncate">{fornecedor}</span>
          )}
        </div>

        {/* Órgão do servidor — exibido quando presente (alertas de cruzamento) */}
        {orgao_servidor && (
          <p className="text-xs text-orange-700 mt-1.5 flex items-center gap-1">
            <span>🏛️</span>
            <span>
              <strong>Órgão do servidor:</strong> {orgao_servidor}
            </span>
          </p>
        )}

        {/* CNPJ com link para consulta pública */}
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
