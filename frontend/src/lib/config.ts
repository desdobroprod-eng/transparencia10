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

// Rótulos amigáveis e juridicamente sóbrios para as regras (evita exibir o
// código cru como "TESTA_FERRO_POSSIVEL"). Linguagem factual/condicional.
export const REGRA_LABEL: Record<string, string> = {
  // Cruzamento sócio × servidor (linguagem condicional, sem imputação)
  NOME_IDENTICO_SERVIDOR: "Nome idêntico a servidor — a verificar identidade",
  SOBRENOMES_COINCIDENTES: "Sobrenomes coincidentes — a apurar",
  // (chaves antigas, caso ainda apareçam em dados de coletas anteriores)
  TESTA_FERRO_POSSIVEL: "Coincidência nominal — a apurar",
  PROVAVEL_PARENTE: "Sobrenomes coincidentes — a apurar",
  CONFLITO_INTERESSE_DIRETO: "Nome idêntico a servidor — a verificar identidade",
  // Financeiras (recaem sobre empresa/contrato)
  PRECO_ABUSIVO: "Preço acima da mediana",
  CAPITAL_INCOMPATIVEL: "Capital social inferior ao contrato",
  VALOR_INCONSISTENTE: "Valor incompatível com o porte",
  EMPRESA_NOVA: "Empresa recém-aberta",
  EMPRESA_SANCIONADA: "Empresa em lista de sanção (CEIS/CNEP)",
  DUPLICIDADE_CONTRATO: "Contratos semelhantes em curto intervalo",
  FRACIONAMENTO_LICITACAO: "Possível fracionamento de dispensa",
  FORNECEDOR_MONOPOLIO: "Concentração de contratos no fornecedor",
  CONTRATO_SEM_LICITACAO: "Dispensa/inexigibilidade acima do teto",
  CONTRATO_VENCIDO_RENOVADO: "Contrato vencido ainda ativo",
  CONTRATO_RETIFICADO: "Contrato com alteração registrada",
};

export function rotuloRegra(regra: string): string {
  return REGRA_LABEL[regra] ?? regra.replace(/_/g, " ").toLowerCase();
}
