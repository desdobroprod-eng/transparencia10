// Configuração compartilhada dos entes monitorados.
export const ENTES: { chave: string; nome: string; curto: string; tipo: "estado" | "municipio" }[] = [
  { chave: "maranhao_estado", nome: "Estado do Maranhão (SECMA)", curto: "Estado MA", tipo: "estado" },
  { chave: "sao_luis", nome: "São Luís", curto: "São Luís", tipo: "municipio" },
  { chave: "raposa", nome: "Raposa", curto: "Raposa", tipo: "municipio" },
  { chave: "sao_jose_ribamar", nome: "São José de Ribamar", curto: "S.J. Ribamar", tipo: "municipio" },
  { chave: "paco_lumiar", nome: "Paço do Lumiar", curto: "Paço do Lumiar", tipo: "municipio" },
  { chave: "pinheiro", nome: "Pinheiro", curto: "Pinheiro", tipo: "municipio" },
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

// Faixas NEUTRAS de quantidade de pontos a verificar (sem usar o termo "risco"
// nem "alto/médio/baixo"). Cor é apenas apoio visual, sempre com rótulo.
export const RISCO = {
  critico: { label: "Vários pontos a verificar", cor: "#475569", bg: "bg-slate-100", texto: "text-slate-700", borda: "border-slate-300" },
  atencao: { label: "Alguns pontos a verificar", cor: "#64748b", bg: "bg-slate-100", texto: "text-slate-600", borda: "border-slate-300" },
  baixo: { label: "Poucos pontos a verificar", cor: "#94a3b8", bg: "bg-slate-50", texto: "text-slate-600", borda: "border-slate-200" },
  normal: { label: "Nada a verificar", cor: "#cbd5e1", bg: "bg-gray-50", texto: "text-gray-500", borda: "border-gray-200" },
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
  FRACIONAMENTO_LICITACAO: "Dispensas em sequência — a verificar",
  FORNECEDOR_MONOPOLIO: "Concentração de contratos no fornecedor",
  CONTRATO_SEM_LICITACAO: "Dispensa/inexigibilidade acima do teto",
  CONTRATO_VENCIDO_RENOVADO: "Contrato vencido ainda ativo",
  CONTRATO_RETIFICADO: "Contrato com alteração registrada",
};

export function rotuloRegra(regra: string): string {
  return REGRA_LABEL[regra] ?? regra.replace(/_/g, " ").toLowerCase();
}
