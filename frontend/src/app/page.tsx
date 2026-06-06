
"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ENTES: Record<string, string> = {
  maranhao_estado: "Sec. Cultura MA (Estado)",
  sao_luis: "Sec. Cultura São Luís",
  sao_jose_ribamar: "Sec. Cultura S.J. Ribamar",
  paco_lumiar: "Sec. Cultura Paço do Lumiar",
};

const NIVEL_COR: Record<string, string> = {
  critico: "bg-red-600",
  atencao: "bg-yellow-500",
  baixo: "bg-green-600",
  normal: "bg-gray-500",
};

export default function Home() {
  const [stats, setStats] = useState<any>(null);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  async function fetchData() {
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`${API}/stats`),
        fetch(`${API}/alertas`),
      ]);
      const s = await sRes.json();
      const a = await aRes.json();
      setStats(s);
      setAlertas(a.alertas || []);
    } catch {
      // silencioso — retry no próximo tick
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
      setTick((t) => t + 1);
    }, 30_000); // atualiza a cada 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6 font-mono">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            🔍 Transparencia10
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Monitoramento de gastos públicos — Secretarias de Cultura MA
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>Dados públicos — Fontes oficiais</p>
          <p className="text-green-400">
            {stats?.ultima_atualizacao
              ? `Atualizado: ${new Date(stats.ultima_atualizacao).toLocaleString("pt-BR")}`
              : "Aguardando coleta..."}
          </p>
        </div>
      </div>

      {/* Cards por ente */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        {Object.entries(ENTES).map(([chave, nome]) => {
          const s = stats?.stats?.[chave];
          return (
            <div key={chave} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-2">{nome}</p>
              <p className="text-2xl font-bold text-white">
                {s?.total_contratos ?? "—"}
              </p>
              <p className="text-xs text-gray-500">contratos cultura</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${s?.total_alertas > 0 ? "bg-red-500" : "bg-green-500"}`} />
                <span className="text-xs">
                  {s?.total_alertas ?? 0} alerta{s?.total_alertas !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feed de alertas */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <span className="text-red-400">⚠</span>
          Indicadores de Anomalia
          <span className="text-xs text-gray-500 font-normal ml-2">
            (dado público — indicativo, não acusação)
          </span>
        </h2>

        {loading && (
          <div className="text-gray-500 text-sm">Carregando...</div>
        )}

        {!loading && alertas.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded p-4 text-gray-500 text-sm">
            Nenhum indicador de anomalia detectado no momento.
          </div>
        )}

        <div className="space-y-3">
          {alertas.map((alerta, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex gap-4"
            >
              {/* Score badge */}
              <div className="flex-shrink-0">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg ${
                  alerta.score >= 80 ? "bg-red-700" : alerta.score >= 60 ? "bg-yellow-600" : "bg-gray-700"
                }`}>
                  {alerta.score}
                </div>
                <p className="text-xs text-center mt-1 text-gray-500">score</p>
              </div>

              {/* Detalhes */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-300">
                    {alerta.regra?.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-gray-500">
                    {ENTES[alerta.ente] || alerta.ente}
                  </span>
                </div>
                <p className="text-sm text-gray-200">{alerta.motivo}</p>
                {alerta.cnpj && (
                  <p className="text-xs text-gray-500 mt-1">
                    CNPJ:{" "}
                    <a
                      href={`https://publica.cnpj.ws/cnpj/${alerta.cnpj}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline"
                    >
                      {alerta.cnpj}
                    </a>
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-1">
                  Detectado: {alerta.detectado_em
                    ? new Date(alerta.detectado_em).toLocaleString("pt-BR")
                    : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rodapé legal */}
      <footer className="mt-12 border-t border-gray-800 pt-6 text-xs text-gray-600">
        <p>
          Todos os dados exibidos são <strong className="text-gray-500">públicos</strong>, obtidos
          exclusivamente de fontes oficiais: Portal Nacional de Contratações Públicas (PNCP),
          SICONFI/Tesouro Nacional, Portal da Transparência Federal e Receita Federal (CNPJ).
        </p>
        <p className="mt-1">
          Os "indicadores de anomalia" são sinalizações automáticas baseadas em regras
          objetivas sobre dados públicos. <strong className="text-gray-500">Não constituem acusação</strong>{" "}
          e devem ser investigados pelos órgãos competentes (TCE-MA, CGU, MPF).
        </p>
      </footer>
    </main>
  );
}
