"use client";

import { useEffect, useState } from "react";

const BASE = "/transparencia10/data";

export type NivelRisco = "critico" | "atencao" | "baixo" | "normal";

export interface EnteStats {
  total_gasto: number;
  total_contratos: number;
  total_alertas: number;
  nivel_risco: NivelRisco;
  base_gasto?: string;
}

export interface Alerta {
  id: string;
  ente: string;
  contrato_id: string;
  regra: string;
  motivo: string;
  score: number;
  nivel: "critico" | "atencao" | "baixo";
  detectado_em: string;
  ano: number | null;
  cnpj: string;
  fornecedor: string;
  categoria: "financeiro" | "conflito_interesse" | "nepotismo";
  orgao_servidor: string;
}

export interface Contrato {
  id: string;
  ente: string;
  fornecedor: string;
  cnpj: string;
  objeto: string;
  valor: number;
  modalidade: string;
  score_risco: number;
  data_publicacao: string;
  ano: number | null;
  unidade: string;
  // Enriquecimento do fornecedor (BrasilAPI)
  razao_social: string;
  capital_social: number;
  porte: string;
  mei: boolean;
  abertura: string; // data de abertura do CNPJ (ISO)
  situacao: string;
  retificacoes: number;
  alertas: Alerta[]; // ligado no carregamento
}

export interface EmpresaRanking {
  cnpj: string;
  nome: string;
  razao_social: string;
  total_valor: number;
  num_contratos: number;
  capital_social: number;
  porte: string;
  mei: boolean;
  abertura: string;
  entes: string[];
  num_alertas: number;
}

export interface Cruzamento {
  ente: string;
  contrato: string;
  cnpj: string;
  fornecedor: string;
  socio: string;
  servidor: string;
  sobrenomes_comuns: string[];
  score: number;
  // proveniência e situação
  orgao?: string;
  cargo?: string;
  fonte?: string;
  situacao?: "ativo" | "exonerado";
  situacao_fonte?: string;
  // derivado: match exato de nome completo
  exato: boolean;
}

export interface Emenda {
  esfera: "estadual" | "federal";
  id: string;
  ano: string;
  parlamentar: string;
  tipo: string;
  unidade: string;
  objeto: string;
  beneficiada: string;
  cnpj_favorecido: string;
  funcao: string;
  subfuncao: string;
  valor_empenhado: number;
  valor_liquidado: number;
  valor_pago: number;
  fonte: string;
  detalhe_url?: string;
  fornecedor_contratado?: boolean;
}

export interface Meta {
  ultima_coleta: string;
  total_registros: number;
  fonte: string;
  total_contratos: number;
  total_alertas: number;
  alertas_por_categoria: { financeiro: number; conflito_interesse: number; nepotismo: number };
  gasto_cultura_siconfi: Record<string, number>;
  anos_coletados: string[] | string;
  total_emendas_cultura?: number;
  valor_emendas_cultura?: number;
}

export interface Explicacoes {
  entes: Record<string, string>;
  regras: Record<string, string>;
  contratos: Record<string, string>;
  empresas: Record<string, string>;
  fonte_ia?: string;
}

export interface Dados {
  loading: boolean;
  erro: string | null;
  stats: Record<string, EnteStats>;
  alertas: Alerta[];
  contratos: Contrato[];
  cruzamentos: Cruzamento[];
  empresas: EmpresaRanking[]; // fornecedores agregados, ordenados por valor desc
  emendas: Emenda[];
  explicacoes: Explicacoes | null;
  meta: Meta | null;
  anosDisponiveis: number[];
  ultimaAtualizacao: Date | null;
}

function norm(s: string): string {
  return (s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

export function useDados(): Dados {
  const [d, setD] = useState<Dados>({
    loading: true, erro: null, stats: {}, alertas: [], contratos: [],
    cruzamentos: [], empresas: [], emendas: [], explicacoes: null, meta: null, anosDisponiveis: [], ultimaAtualizacao: null,
  });

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [s, a, c, m, sv, ex, emd] = await Promise.all([
          fetch(`${BASE}/stats.json`).then((r) => (r.ok ? r.json() : { stats: {} })),
          fetch(`${BASE}/alertas.json`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${BASE}/contratos.json`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${BASE}/meta.json`).then((r) => (r.ok ? r.json() : null)),
          fetch(`${BASE}/servidores.json`).then((r) => (r.ok ? r.json() : { cruzamentos: [] })),
          fetch(`${BASE}/explicacoes.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`${BASE}/emendas.json`).then((r) => (r.ok ? r.json() : { emendas: [] })).catch(() => ({ emendas: [] })),
        ]);
        if (!vivo) return;

        const alertas: Alerta[] = Array.isArray(a) ? a : a.alertas ?? [];
        const contratosRaw: Contrato[] = Array.isArray(c) ? c : c.contratos ?? [];

        // Liga alertas aos contratos por contrato_id (corrige a expansão da tabela)
        const porContrato: Record<string, Alerta[]> = {};
        for (const al of alertas) {
          if (al.contrato_id) (porContrato[al.contrato_id] ||= []).push(al);
        }
        const contratos = contratosRaw.map((ct) => ({
          ...ct,
          alertas: porContrato[ct.id] ?? [],
        }));

        const cruzRaw: Cruzamento[] = (sv?.cruzamentos ?? []) as Cruzamento[];
        const cruzamentos = cruzRaw.map((cz) => ({
          ...cz,
          exato: norm(cz.socio) === norm(cz.servidor),
        }));

        // Anos efetivamente presentes nos dados (evita filtros vazios)
        const anos = new Set<number>();
        for (const ct of contratos) if (ct.ano) anos.add(ct.ano);
        const anosDisponiveis = [...anos].sort((x, y) => y - x);

        // Ranking de empresas: agrega contratos por CNPJ
        const porCnpj: Record<string, EmpresaRanking> = {};
        for (const ct of contratos) {
          const k = ct.cnpj || ct.fornecedor;
          if (!k) continue;
          const e = (porCnpj[k] ||= {
            cnpj: ct.cnpj, nome: ct.fornecedor, razao_social: ct.razao_social,
            total_valor: 0, num_contratos: 0, capital_social: ct.capital_social,
            porte: ct.porte, mei: ct.mei, abertura: ct.abertura, entes: [], num_alertas: 0,
          });
          e.total_valor += ct.valor || 0;
          e.num_contratos += 1;
          e.num_alertas += ct.alertas.length;
          if (ct.ente && !e.entes.includes(ct.ente)) e.entes.push(ct.ente);
          if (!e.capital_social && ct.capital_social) e.capital_social = ct.capital_social;
          if (!e.razao_social && ct.razao_social) e.razao_social = ct.razao_social;
        }
        const empresas = Object.values(porCnpj).sort((x, y) => y.total_valor - x.total_valor);

        const emendas: Emenda[] = (Array.isArray(emd) ? emd : emd?.emendas ?? []) as Emenda[];

        setD({
          loading: false, erro: null,
          stats: s?.stats ?? {},
          alertas, contratos, cruzamentos, empresas, emendas,
          explicacoes: ex,
          meta: m,
          anosDisponiveis,
          ultimaAtualizacao: m?.ultima_coleta ? new Date(m.ultima_coleta) : new Date(),
        });
      } catch (e) {
        if (vivo) setD((p) => ({ ...p, loading: false, erro: e instanceof Error ? e.message : "Erro" }));
      }
    })();
    return () => { vivo = false; };
  }, []);

  return d;
}
