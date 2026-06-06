"use client";

interface CardEnteProps {
  nome: string;
  total_gasto: number;
  total_contratos: number;
  total_alertas: number;
  nivel_risco: "critico" | "atencao" | "baixo" | "normal";
}

const RISCO_CONFIG = {
  critico: { cor: "bg-red-500", label: "Risco Alto", textCor: "text-red-600" },
  atencao: { cor: "bg-yellow-400", label: "Atenção", textCor: "text-yellow-600" },
  baixo: { cor: "bg-green-500", label: "Normal", textCor: "text-green-600" },
  normal: { cor: "bg-gray-400", label: "Sem dados", textCor: "text-gray-500" },
};

function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function BarraRisco({ nivel }: { nivel: keyof typeof RISCO_CONFIG }) {
  const porcentagem =
    nivel === "critico" ? 85 : nivel === "atencao" ? 55 : nivel === "baixo" ? 20 : 0;
  const cfg = RISCO_CONFIG[nivel];

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">Nível de risco</span>
        <span className={`font-semibold ${cfg.textCor}`}>{cfg.label}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${cfg.cor}`}
          style={{ width: `${porcentagem}%` }}
        />
      </div>
    </div>
  );
}

export default function CardEnte({
  nome,
  total_gasto,
  total_contratos,
  total_alertas,
  nivel_risco,
}: CardEnteProps) {
  const cfg = RISCO_CONFIG[nivel_risco];

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-1 ${
        nivel_risco === "critico"
          ? "border-red-300"
          : nivel_risco === "atencao"
          ? "border-yellow-300"
          : "border-gray-200"
      }`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
        {nome}
      </p>

      <p className="text-xl font-bold text-gray-900 mt-1">
        {total_gasto > 0 ? formatBRL(total_gasto) : "—"}
      </p>

      <div className="flex gap-4 mt-1 text-sm text-gray-600">
        <span>
          <span className="font-semibold text-gray-800">{total_contratos}</span>{" "}
          contratos
        </span>
        <span
          className={`font-semibold ${
            total_alertas > 0 ? cfg.textCor : "text-gray-400"
          }`}
        >
          {total_alertas} alerta{total_alertas !== 1 ? "s" : ""}
        </span>
      </div>

      <BarraRisco nivel={nivel_risco} />
    </div>
  );
}
