"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useDados } from "@/hooks/useDados";
import { NOME_ENTE, formatBRL, formatBRLcheio } from "@/lib/config";
import {
  SITUACOES,
  buscarAprovadas,
  selecionarMissoes,
  urlFotoPublica,
  type Missao,
  type VisitaAprovada,
} from "@/lib/fiscalizacao";
import { urlPNCP } from "@/components/FichaCNPJ";
import FormVisita from "@/components/fiscalizacao/FormVisita";
import mapa from "@/lib/mapa-centro-sao-luis.json";

const OBRAS_GEO = (mapa as unknown as { obras: Record<string, { local: string; aproximado: boolean }> }).obras;

// Three.js só no navegador.
const CenaMissoes = dynamic(() => import("@/components/fiscalizacao/CenaMissoes"), {
  ssr: false,
  loading: () => <div className="h-[380px] animate-pulse rounded-2xl bg-white/5 sm:h-[480px]" />,
});

const CHAVE_DIARIO = "t10_diario_missoes";
const COR_RARIDADE: Record<Missao["raridade"], string> = {
  Lendária: "border-[#E2B100] text-[#E2B100]",
  Épica: "border-[#c084fc] text-[#c084fc]",
  Rara: "border-[#60a5fa] text-[#60a5fa]",
  Comum: "border-white/40 text-white/70",
};

function lerDiario(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_DIARIO) || "[]");
  } catch {
    return [];
  }
}

export default function FiscalizePage() {
  const { contratos, loading } = useDados();
  const missoes = useMemo(() => selecionarMissoes(contratos), [contratos]);
  const [aprovadas, setAprovadas] = useState<VisitaAprovada[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [diario, setDiario] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    buscarAprovadas().then(setAprovadas);
    setDiario(lerDiario());
  }, []);

  const porMissao = useMemo(() => {
    const m = new Map<string, VisitaAprovada[]>();
    for (const v of aprovadas) m.set(v.local_id, [...(m.get(v.local_id) ?? []), v]);
    return m;
  }, [aprovadas]);
  const exploradas = useMemo(() => new Set(porMissao.keys()), [porMissao]);
  const missao = missoes.find((m) => m.id === selecionada) ?? null;
  const geo = missao ? OBRAS_GEO[missao.id] : null;

  function selecionar(id: string) {
    setSelecionada(id);
    setTimeout(() => document.getElementById("painel-missao")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function enviado() {
    if (!missao) return;
    const novo = [...lerDiario(), missao.id];
    try {
      localStorage.setItem(CHAVE_DIARIO, JSON.stringify(novo));
    } catch {
      /* navegador sem armazenamento: segue sem diário */
    }
    setDiario(novo);
    setFormAberto(false);
    setAviso(`Relato da Missão ${String(missao.numero).padStart(2, "0")} recebido! Ele aparece aqui depois da moderação.`);
  }

  return (
    <main className="min-h-screen bg-[#0B0B0C] text-[#F7F3EC]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E2B100]">
            Piloto · fiscalização cidadã
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl" style={{ fontFamily: "Georgia, serif" }}>
            Missão Patrimônio
          </h1>
          <p className="mt-2 max-w-2xl text-[#F7F3EC]/70">
            Cada farol é uma obra de patrimônio contratada com dinheiro público, no endereço do
            contrato. Escolha uma missão, vá até o local e conte o que encontrou: foto, situação e
            comentário. Seu relato aparece aqui depois da moderação.
          </p>
        </header>

        {/* Placar */}
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Missões", missoes.length],
            ["Exploradas pela comunidade", exploradas.size],
            ["Relatos aprovados", aprovadas.length],
            ["Seu diário", diario.length],
          ].map(([r, v]) => (
            <div key={r as string} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <dt className="text-xs uppercase tracking-wide text-[#F7F3EC]/55">{r}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-[#E2B100]">{v as number}</dd>
            </div>
          ))}
        </dl>

        {aviso && (
          <p role="status" className="mt-4 rounded-xl border border-[#E2B100]/40 bg-[#E2B100]/10 p-4 text-sm">
            🏅 {aviso}
          </p>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="h-[380px] animate-pulse rounded-2xl bg-white/5 sm:h-[480px]" />
          ) : (
            <CenaMissoes
              missoes={missoes}
              exploradas={exploradas}
              selecionada={selecionada}
              onSelecionar={selecionar}
            />
          )}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#F7F3EC]/55">
            <span><span className="text-[#C8102E]">●</span> ainda não explorada</span>
            <span><span className="text-[#E2B100]">●</span> já explorada</span>
            <span>altura do farol = valor da obra</span>
            <span>círculo claro = endereço aproximado</span>
            <span>arraste para girar · toque no farol para abrir</span>
          </p>
        </div>

        {/* Painel da missão selecionada */}
        {missao && (
          <section
            id="painel-missao"
            aria-label={`Missão ${missao.numero}`}
            className="mt-8 scroll-mt-20 rounded-2xl border border-[#E2B100]/30 bg-white/[0.04] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E2B100]">
                  Missão {String(missao.numero).padStart(2, "0")} ·{" "}
                  <span className={`rounded border px-1.5 py-0.5 ${COR_RARIDADE[missao.raridade]}`}>{missao.raridade}</span>
                </p>
                <h2 className="mt-2 text-xl font-semibold">{missao.titulo}</h2>
                {geo && (
                  <p className="mt-1 text-sm text-[#F7F3EC]/70">
                    📍 {geo.local}
                    {geo.aproximado && " (local aproximado — o contrato não traz o endereço exato)"}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFormAberto(true)}
                className="rounded-xl bg-[#C8102E] px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-[#a60d26] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E2B100]"
              >
                Registrar visita
              </button>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-[#F7F3EC]/50">Valor contratado</dt>
                <dd className="font-semibold">{formatBRLcheio(missao.contrato.valor)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#F7F3EC]/50">Empresa contratada</dt>
                <dd>{missao.contrato.fornecedor}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#F7F3EC]/50">Órgão</dt>
                <dd>{missao.contrato.unidade || NOME_ENTE[missao.contrato.ente]}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm leading-relaxed text-[#F7F3EC]/80">{missao.contrato.objeto}</p>
            {urlPNCP(missao.id) && (
              <a
                href={urlPNCP(missao.id)!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium text-[#9fb4e0] hover:underline"
              >
                Ver o contrato no PNCP ↗
              </a>
            )}

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[#F7F3EC]/60">
              Relatos da comunidade ({porMissao.get(missao.id)?.length ?? 0})
            </h3>
            {(porMissao.get(missao.id) ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-[#F7F3EC]/55">Ninguém explorou esta missão ainda. Seja o primeiro.</p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {porMissao.get(missao.id)!.map((v) => {
                  const s = SITUACOES.find((x) => x.valor === v.situacao);
                  return (
                    <li key={v.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                      {v.foto_publica && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urlFotoPublica(v.foto_publica)} alt={`Foto enviada por ${v.autor}`} className="h-44 w-full object-cover" loading="lazy" />
                      )}
                      <div className="p-3 text-sm">
                        <p className="font-semibold">{s?.icone} {s?.rotulo}</p>
                        {v.comentario && <p className="mt-1 text-[#F7F3EC]/80">{v.comentario}</p>}
                        <p className="mt-2 text-xs text-[#F7F3EC]/50">
                          {v.autor} · {new Date(v.criado_em).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* Lista de missões (alternativa acessível à cena 3D) */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Todas as missões</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {missoes.map((m) => {
              const n = porMissao.get(m.id)?.length ?? 0;
              const feita = diario.includes(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => selecionar(m.id)}
                    aria-pressed={selecionada === m.id}
                    className={`h-full w-full rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E2B100] ${
                      selecionada === m.id ? "border-[#E2B100] bg-[#E2B100]/10" : "border-white/10 bg-white/[0.04] hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#F7F3EC]/60">Missão {String(m.numero).padStart(2, "0")}</span>
                      <span className={`rounded border px-1.5 py-0.5 ${COR_RARIDADE[m.raridade]}`}>{m.raridade}</span>
                    </div>
                    <p className="mt-2 font-semibold leading-snug">{m.titulo}</p>
                    <p className="mt-1 text-xs text-[#F7F3EC]/55">
                      {OBRAS_GEO[m.id]?.local ?? "sem localização no mapa"} · {formatBRL(m.contrato.valor)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className={n ? "text-[#E2B100]" : "text-[#C8102E]"}>
                        {n ? `● ${n} relato${n > 1 ? "s" : ""}` : "● não explorada"}
                      </span>
                      {feita && <span className="text-[#F7F3EC]/70">🏅 você esteve aqui</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="mt-10 text-xs leading-relaxed text-[#F7F3EC]/45">
          Piloto. As obras vêm dos contratos de cultura publicados no PNCP; a localização vem do
          endereço citado no contrato, conferido no OpenStreetMap. Os relatos são de cidadãos e
          passam por moderação antes de aparecer. Não constituem fiscalização oficial nem acusação.
          A pontuação e as recompensas virão numa próxima fase.
        </p>
      </div>

      {formAberto && missao && (
        <FormVisita missao={missao} onFechar={() => setFormAberto(false)} onEnviado={enviado} />
      )}
    </main>
  );
}
