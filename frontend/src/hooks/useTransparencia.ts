"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  cnpj?: string;
  fornecedor?: string;
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
  alertas?: Alerta[];
}

interface UseTransparenciaResult {
  stats: StatsGeral | null;
  alertas: Alerta[];
  contratos: Contrato[];
  loading: boolean;
  erro: string | null;
  ultimaAtualizacao: Date | null;
  refetch: () => void;
}

export function useTransparencia(ano: string): UseTransparenciaResult {
  const [stats, setStats] = useState<StatsGeral | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setErro(null);
    try {
      const params = ano !== "tempo_real" ? `?ano=${ano}` : "";
      const [sRes, aRes, cRes] = await Promise.all([
        fetch(`${API}/stats${params}`),
        fetch(`${API}/alertas${params}`),
        fetch(`${API}/contratos${params}`),
      ]);

      if (!sRes.ok || !aRes.ok || !cRes.ok) {
        throw new Error("Erro ao buscar dados da API");
      }

      const s: StatsGeral = await sRes.json();
      const a: { alertas: Alerta[] } = await aRes.json();
      const c: { contratos: Contrato[] } = await cRes.json();

      setStats(s);
      setAlertas(a.alertas ?? []);
      setContratos(c.contratos ?? []);
      setUltimaAtualizacao(new Date());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [ano]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  return { stats, alertas, contratos, loading, erro, ultimaAtualizacao, refetch: fetchData };
}
