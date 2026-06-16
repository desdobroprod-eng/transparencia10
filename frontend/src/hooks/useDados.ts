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
  objeto: string;
  valor: number;
  modalidade: string;
  score_risco: number;
  data_publicacao: string;
  ano: number | null;
  unidade: string;
  alertas: Alerta[]; // ligado no carregamento
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
  // derivado: match exato de nome completo
  exato: boolean;
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
}

export interface Dados {
  loading: boolean;
  erro: string | null;
  stats: Record<string, EnteStats>;
  alertas: Alerta[];
  contratos: Contrato[];
  cruzamentos: Cruzamento[];
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
    cruzamentos: [], meta: null, anosDisponiveis: [], ultimaAtualizacao: null,
  });

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [s, a, c, m, sv] = await Promise.all([
          fetch(`${BASE}/stats.json`).then((r) => (r.ok ? r.json() : { stats: {} })),
          fetch(`${BASE}/alertas.json`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${BASE}/contratos.json`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${BASE}/meta.json`).then((r) => (r.ok ? r.json() : null)),
          fetch(`${BASE}/servidores.json`).then((r) => (r.ok ? r.json() : { cruzamentos: [] })),
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

        setD({
          loading: false, erro: null,
          stats: s?.stats ?? {},
          alertas, contratos, cruzamentos,
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
