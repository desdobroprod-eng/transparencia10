"use client";

import { useEffect, useState, useCallback } from "react";

// Em produção (GitHub Pages), usar a raiz relativa
// Em dev, usar /transparencia10/data
const BASE = typeof window !== "undefined" && window.location.hostname.includes("github.io")
  ? "/transparencia10/data"
  : "/data";

export interface EsteStats {
  total_gasto: number;
  total_contratos: number;
  total_alertas: number;
  nivel_risco: "critico" | "atencao" | "baixo" | "normal";
}

export interface StatsGeral {
  ultima_atualizacao: string | null;
  stats: Record<string, EsteStats>;
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
  ano?: number;
  cnpj?: string;
  fornecedor?: string;
  // Campos da Fase 4 — cruzamento com servidores públicos
  categoria?: "financeiro" | "conflito_interesse" | "nepotismo";
  orgao_servidor?: string;
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
  ano?: number;
  alertas?: Alerta[];
}

export interface Meta {
  ultima_coleta: string;
  total_registros: number;
  fonte: string;
}

interface DadosBrutos {
  stats: StatsGeral | null;
  alertas: Alerta[];
  contratos: Contrato[];
  meta: Meta | null;
}

interface UseTransparenciaResult {
  stats: StatsGeral | null;
  alertas: Alerta[];
  contratos: Contrato[];
  meta: Meta | null;
  loading: boolean;
  erro: string | null;
  ultimaAtualizacao: Date | null;
  refetch: () => void;
}

function filtrarPorPeriodo<T extends { ano?: number; data_publicacao?: string; detectado_em?: string }>(
  items: T[],
  periodo: string
): T[] {
  if (periodo === "tempo_real") return items;
  const anoFiltro = parseInt(periodo, 10);
  return items.filter((item) => {
    if (item.ano !== undefined) return item.ano === anoFiltro;
    const dataStr = item.data_publicacao ?? item.detectado_em ?? "";
    if (!dataStr) return true;
    return new Date(dataStr).getFullYear() === anoFiltro;
  });
}

export function useTransparencia(periodo: string): UseTransparenciaResult {
  const [brutos, setBrutos] = useState<DadosBrutos>({
    stats: null,
    alertas: [],
    contratos: [],
    meta: null,
  });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setErro(null);
    try {
      const [sRes, aRes, cRes, mRes] = await Promise.all([
        fetch(`${BASE}/stats.json`),
        fetch(`${BASE}/alertas.json`),
        fetch(`${BASE}/contratos.json`),
        fetch(`${BASE}/meta.json`),
      ]);

      const s: StatsGeral = sRes.ok
        ? await sRes.json()
        : { stats: {}, total_alertas: 0, ultima_atualizacao: null };
      const a: { alertas: Alerta[] } = aRes.ok
        ? await aRes.json()
        : { alertas: [] };
      const c: { contratos: Contrato[] } = cRes.ok
        ? await cRes.json()
        : { contratos: [] };
      const m: Meta = mRes.ok
        ? await mRes.json()
        : { ultima_coleta: "", total_registros: 0, fonte: "" };

      setBrutos({
        stats: s,
        alertas: Array.isArray(a) ? a : (a.alertas ?? []),
        contratos: Array.isArray(c) ? c : (c.contratos ?? []),
        meta: m,
      });
      setUltimaAtualizacao(new Date());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const alertasFiltrados = filtrarPorPeriodo(brutos.alertas, periodo);
  const contratosFiltrados = filtrarPorPeriodo(brutos.contratos, periodo);

  return {
    stats: brutos.stats,
    alertas: alertasFiltrados,
    contratos: contratosFiltrados,
    meta: brutos.meta,
    loading,
    erro,
    ultimaAtualizacao,
    refetch: fetchData,
  };
}
