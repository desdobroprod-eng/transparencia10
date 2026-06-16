// Configuração compartilhada dos entes monitorados.
export const ENTES: { chave: string; nome: string; curto: string; tipo: "estado" | "municipio" }[] = [
  { chave: "maranhao_estado", nome: "Estado do Maranhão (SECMA)", curto: "Estado MA", tipo: "estado" },
  { chave: "sao_luis", nome: "São Luís", curto: "São Luís", tipo: "municipio" },
  { chave: "raposa", nome: "Raposa", curto: "Raposa", tipo: "municipio" },
  { chave: "sao_jose_ribamar", nome: "São José de Ribamar", curto: "S.J. Ribamar", tipo: "municipio" },
  { chave: "paco_lumiar", nome: "Paço do Lumiar", curto: "Paço do Lumiar", tipo: "municipio" },
];

export const NOME_ENTE: Record<string, string> = Object.fromEntries(
  ENTES.map((e) => [e.chave, e.curto])
);

export function formatBRL(valor: number): string {
  return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function formatBRLcheio(valor: number): string {
  return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Cores semânticas de risco (nunca usar só cor — sempre acompanhar de rótulo/ícone)
export const RISCO = {
  critico: { label: "Risco alto", cor: "#dc2626", bg: "bg-red-100", texto: "text-red-700", borda: "border-red-300" },
  atencao: { label: "Atenção", cor: "#d97706", bg: "bg-amber-100", texto: "text-amber-700", borda: "border-amber-300" },
  baixo: { label: "Baixo", cor: "#16a34a", bg: "bg-green-100", texto: "text-green-700", borda: "border-green-300" },
  normal: { label: "Sem indícios", cor: "#6b7280", bg: "bg-gray-100", texto: "text-gray-600", borda: "border-gray-300" },
} as const;

export type NivelRisco = keyof typeof RISCO;
