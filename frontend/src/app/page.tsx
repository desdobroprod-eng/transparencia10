"use client";

import { useEffect, useState } from "react";
import { useTransparencia } from "@/hooks/useTransparencia";
import CardEnte from "@/components/CardEnte";
import AlertaBadge from "@/components/AlertaBadge";
import TabelaContratos from "@/components/TabelaContratos";

type Periodo = "tempo_real" | "2024" | "2023" | "2022" | "2021";

const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: "tempo_real", label: "Todos os períodos" },
  { valor: "2024", label: "2024" },
  { valor: "2023", label: "2023" },
  { valor: "2022", label: "2022" },
  { valor: "2021", label: "2021" },
];

const ENTES_CONFIG: { chave: string; nome: string }[] = [
  { chave: "maranhao_estado", nome: "Estado do Maranhão" },
  { chave: "sao_luis", nome: "São Luís" },
  { chave: "sao_jose_ribamar", nome: "S.J. de Ribamar" },
  { chave: "paco_lumiar", nome: "Paço do Lumiar" },
];

const INTERVALO_REFRESH = 14400; // 4 horas em segundos

function IndicadorEstatico() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
      <span className="relative flex h-2 w-2">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
      </span>
      Atualizado a cada 4h
    </span>
  );
}

export default function Home() {
  const [periodo, setPeriodo] = useState<Periodo>("tempo_real");
  const [countdown, setCountdown] = useState(INTERVALO_REFRESH);

  const { stats, alertas, contratos, meta, loading, erro, ultimaAtualizacao, refetch } =
    useTransparencia(periodo);

  // Countdown visual até próxima atualização dos JSONs (4h)
  useEffect(() => {
    setCountdown(INTERVALO_REFRESH);
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          refetch();
          return INTERVALO_REFRESH;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [refetch]);

  const dataFormatada = ultimaAtualizacao
    ? ultimaAtualizacao.toLocaleString("pt-BR")
    : "—";

  const horas = Math.floor(countdown / 3600);
  const minutos = Math.floor((countdown % 3600) / 60);
  const proximaAtualizacao = horas > 0
    ? `${horas}h ${minutos}min`
    : `${minutos}min`;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Banner de atualização automática */}
      <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-center text-xs text-blue-700">
        Dados atualizados automaticamente a cada 4 horas via GitHub Actions
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                  Transparencia10
                </h1>
                <IndicadorEstatico />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Monitoramento de gastos públicos — Secretarias de Cultura do Maranhão
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <p className="text-xs text-gray-400">
              Dados carregados: <span className="text-gray-600">{dataFormatada}</span>
            </p>
            <p className="text-xs text-gray-400">
              Próximo refresh: <span className="text-gray-600">{proximaAtualizacao}</span>
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Seletor de período */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-600 mr-1">Período:</span>
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              onClick={() => setPeriodo(p.valor)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                periodo === p.valor
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Cards de entes */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Visão por Ente
          </h2>
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {ENTES_CONFIG.map((e) => (
                <div
                  key={e.chave}
                  className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-36"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {ENTES_CONFIG.map((e) => {
                const s = stats?.stats?.[e.chave];
                return (
                  <CardEnte
                    key={e.chave}
                    nome={e.nome}
                    total_gasto={s?.total_gasto ?? 0}
                    total_contratos={s?.total_contratos ?? 0}
                    total_alertas={s?.total_alertas ?? 0}
                    nivel_risco={s?.nivel_risco ?? "normal"}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Erro */}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
            <strong>Erro ao carregar dados:</strong> {erro}. Os dados podem estar
            desatualizados.
          </div>
        )}

        {/* Feed de alertas */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              Indicadores de Anomalia
              <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-mono">
                {alertas.length}
              </span>
            </h2>
            <p className="text-xs text-gray-400">
              Dado público — indicativo, não acusação
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-4 h-20 animate-pulse"
                />
              ))}
            </div>
          ) : alertas.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
              Nenhum indicador de anomalia detectado no período selecionado.
            </div>
          ) : (
            <div className="space-y-3">
              {alertas.map((a) => (
                <AlertaBadge
                  key={a.id}
                  nivel={a.nivel}
                  motivo={a.motivo}
                  score={a.score}
                  regra={a.regra}
                  detectado_em={a.detectado_em}
                  cnpj={a.cnpj}
                  fornecedor={a.fornecedor}
                />
              ))}
            </div>
          )}
        </section>

        {/* Tabela de contratos */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              Últimos Contratos
              <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-mono">
                {contratos.length}
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse h-48" />
          ) : (
            <TabelaContratos contratos={contratos} />
          )}
        </section>

        {/* Rodapé legal */}
        <footer className="border-t border-gray-200 pt-6 text-xs text-gray-400 space-y-1">
          {meta && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4 text-xs text-gray-500 flex flex-wrap gap-4">
              <span>
                <strong className="text-gray-600">Última coleta:</strong>{" "}
                {new Date(meta.ultima_coleta).toLocaleString("pt-BR")}
              </span>
              <span>
                <strong className="text-gray-600">Total de registros:</strong>{" "}
                {meta.total_registros.toLocaleString("pt-BR")}
              </span>
              <span>
                <strong className="text-gray-600">Fonte:</strong> {meta.fonte}
              </span>
            </div>
          )}
          <p>
            Todos os dados exibidos são{" "}
            <strong className="text-gray-500">públicos</strong>, obtidos
            exclusivamente de fontes oficiais: Portal Nacional de Contratações
            Públicas (PNCP), SICONFI/Tesouro Nacional, Portal da Transparência
            Federal e Receita Federal (CNPJ).
          </p>
          <p>
            Os &ldquo;indicadores de anomalia&rdquo; são sinalizações automáticas
            baseadas em regras objetivas sobre dados públicos.{" "}
            <strong className="text-gray-500">Não constituem acusação</strong> e
            devem ser investigados pelos órgãos competentes (TCE-MA, CGU, MPF).
          </p>
        </footer>
      </div>
    </main>
  );
}
