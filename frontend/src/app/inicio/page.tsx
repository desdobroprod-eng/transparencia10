"use client";

import { useEffect, useState } from "react";
import { Fraunces, Inter } from "next/font/google";
import CountUp from "@/components/landing/CountUp";
import BlurText from "@/components/landing/BlurText";
import ScrollReveal from "@/components/landing/ScrollReveal";
import SpotlightCard from "@/components/landing/SpotlightCard";
import GaleriaCultural, {
  type FotoCultural,
} from "@/components/landing/GaleriaCultural";
import VideoCultural from "@/components/landing/VideoCultural";
import { LogoIcon } from "@/components/Logo";
import BaseLegal from "@/components/BaseLegal";
import creditosData from "../../../public/cultura/CREDITOS.json";

// Tipografia editorial: serifa de alto contraste (Fraunces) para títulos e
// Inter para corpo. Carregadas via next/font (compatível com static export).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-fraunces",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const BASE = "/transparencia10";
const PAINEL = "/transparencia10/";

// ── Paleta editorial (docs/BRANDING.md) ────────────────────────────────────
const TINTA = "#0B0B0C";
const PAPEL = "#F7F3EC";
const CARMIM = "#C8102E";
const DOURADO = "#E2B100";
const COBALTO = "#1B3A8B";

// ── Créditos das imagens (lidos de public/cultura/CREDITOS.json) ────────────
interface Credito {
  arquivo: string;
  titulo: string;
  autor: string;
  licenca: string;
  fonte: string;
}
const creditos = (creditosData as { creditos: Credito[] }).creditos;
const creditoDe = (arquivo: string) =>
  creditos.find((c) => c.arquivo === arquivo);

// Manifestações culturais destacadas na galeria.
const FOTOS_GALERIA: FotoCultural[] = [
  {
    arquivo: "bumba-1.jpg",
    manifestacao: "Bumba meu boi",
    legenda: "Pandeirões do Bumba meu Boi do Maranhão.",
    autor: creditoDe("bumba-1.jpg")?.autor ?? "",
    licenca: creditoDe("bumba-1.jpg")?.licenca ?? "",
  },
  {
    arquivo: "tambor-1.jpg",
    manifestacao: "Tambor de Crioula",
    legenda: "Roda de Tambor de Crioula do Maranhão.",
    autor: creditoDe("tambor-1.jpg")?.autor ?? "",
    licenca: creditoDe("tambor-1.jpg")?.licenca ?? "",
  },
  {
    arquivo: "cacuria-1.jpg",
    manifestacao: "Cacuriá",
    legenda: "Dança e tambores do Cacuriá.",
    autor: creditoDe("cacuria-1.jpg")?.autor ?? "",
    licenca: creditoDe("cacuria-1.jpg")?.licenca ?? "",
  },
  {
    arquivo: "bumba-2.jpg",
    manifestacao: "Bumba meu boi",
    legenda: "Brincantes e bordados do boi.",
    autor: creditoDe("bumba-2.jpg")?.autor ?? "",
    licenca: creditoDe("bumba-2.jpg")?.licenca ?? "",
  },
  {
    arquivo: "tambor-2.jpg",
    manifestacao: "Tambor de Crioula",
    legenda: "Casa do Tambor de Crioula.",
    autor: creditoDe("tambor-2.jpg")?.autor ?? "",
    licenca: creditoDe("tambor-2.jpg")?.licenca ?? "",
  },
  {
    arquivo: "cacuria-2.jpg",
    manifestacao: "Cacuriá",
    legenda: "Tambor do Cacuriá.",
    autor: creditoDe("cacuria-2.jpg")?.autor ?? "",
    licenca: creditoDe("cacuria-2.jpg")?.licenca ?? "",
  },
];

// ── Faixa de impacto ────────────────────────────────────────────────────────
// Fallback exibido até os JSONs do pipeline carregarem (2 KB); os valores
// reais vêm de meta.json + stats.json para a landing nunca ficar defasada.
const ESTATISTICAS_FALLBACK = [
  {
    valor: 1.5,
    decimals: 1,
    prefixo: "R$ ",
    sufixo: " bi",
    rotulo: "acompanhados em recursos públicos",
  },
  { valor: 1067, decimals: 0, prefixo: "", sufixo: "", rotulo: "contratos reunidos" },
  { valor: 6, decimals: 0, prefixo: "", sufixo: "", rotulo: "entes federativos" },
  {
    valor: 406,
    decimals: 0,
    prefixo: "",
    sufixo: "",
    rotulo: "pontos a verificar",
  },
];

function useEstatisticas() {
  const [stats, setStats] = useState(ESTATISTICAS_FALLBACK);
  useEffect(() => {
    const BASE = "/transparencia10/data";
    Promise.all([
      fetch(`${BASE}/meta.json`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${BASE}/stats.json`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([meta, st]) => {
        if (!meta || !st) return;
        const entes = Object.keys(st.stats ?? {});
        const gasto = entes.reduce(
          (soma, k) => soma + (Number(st.stats[k]?.total_gasto) || 0),
          0,
        );
        setStats([
          {
            valor: Math.round((gasto / 1e9) * 10) / 10,
            decimals: 1,
            prefixo: "R$ ",
            sufixo: " bi",
            rotulo: "acompanhados em recursos públicos",
          },
          {
            valor: Number(meta.total_contratos) || ESTATISTICAS_FALLBACK[1].valor,
            decimals: 0,
            prefixo: "",
            sufixo: "",
            rotulo: "contratos reunidos",
          },
          {
            valor: entes.length || 6,
            decimals: 0,
            prefixo: "",
            sufixo: "",
            rotulo: "entes federativos",
          },
          {
            valor: Number(meta.total_alertas) || ESTATISTICAS_FALLBACK[3].valor,
            decimals: 0,
            prefixo: "",
            sufixo: "",
            rotulo: "pontos a verificar",
          },
        ]);
      })
      .catch(() => {});
  }, []);
  return stats;
}

// ── O que fazemos ───────────────────────────────────────────────────────────
const O_QUE_FAZEMOS = [
  {
    titulo: "Reúne dados oficiais",
    texto:
      "Coletamos contratos, empenhos e fornecedores diretamente dos portais de transparência e diários oficiais dos entes públicos.",
  },
  {
    titulo: "Sinaliza pontos a verificar",
    texto:
      "Marcamos situações que merecem conferência — como preço acima da mediana ou capital social inferior ao contrato. São indícios a apurar, nunca conclusões.",
  },
  {
    titulo: "Cruza informações públicas",
    texto:
      "Conectamos sócios, empresas e servidores a partir de bases abertas, evidenciando coincidências que pedem checagem documental.",
  },
  {
    titulo: "Publica para o cidadão",
    texto:
      "Tudo fica disponível em painéis navegáveis, com a fonte de cada dado registrada para consulta e reuso.",
  },
];

// ── Como funciona ───────────────────────────────────────────────────────────
const PASSOS = [
  {
    n: "01",
    titulo: "Coleta de fontes oficiais",
    texto:
      "Buscamos dados em portais de transparência, diários oficiais e bases públicas de cada ente monitorado.",
  },
  {
    n: "02",
    titulo: "Análise e cruzamento",
    texto:
      "Padronizamos os registros e aplicamos regras objetivas que destacam pontos a verificar, sempre com linguagem condicional.",
  },
  {
    n: "03",
    titulo: "Publicação para o cidadão",
    texto:
      "Organizamos os resultados em painéis abertos, com fonte linkada, para que qualquer pessoa possa conferir.",
  },
];

export default function LandingInicio() {
  const ESTATISTICAS = useEstatisticas();
  return (
    <div
      className={`${fraunces.variable} ${inter.variable} min-h-screen scroll-smooth bg-[#F7F3EC] text-[#0B0B0C] antialiased`}
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      {/* ╔══ HEADER PRÓPRIO ══╗ */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <a
            href="#topo"
            className="flex items-center gap-2 text-[#F7F3EC]"
            aria-label="Transparência Cultural — início"
          >
            <LogoIcon size={30} />
            <span
              className="text-lg font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
            >
              Transparência Cultural
            </span>
          </a>
          <a
            href={PAINEL}
            className="rounded-full border border-[#F7F3EC]/40 px-4 py-2 text-sm font-medium text-[#F7F3EC] transition hover:bg-[#F7F3EC] hover:text-[#0B0B0C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F7F3EC]"
          >
            Ver o painel
          </a>
        </div>
      </header>

      {/* ╔══ HERO ══╗ */}
      <section
        id="topo"
        className="relative flex min-h-screen items-center overflow-hidden"
      >
        <img
          src={`${BASE}/cultura/bumba-1.jpg`}
          alt="Pandeirões do Bumba meu Boi do Maranhão durante apresentação."
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        {/* Overlay tinta para contraste do texto */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,11,12,0.78) 0%, rgba(11,11,12,0.55) 40%, rgba(11,11,12,0.82) 100%)",
          }}
        />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 py-32 sm:px-8">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#0B0B0C]/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#F7F3EC] ring-1 ring-[#F7F3EC]/20">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: DOURADO }}
            />
            Portal Transparência Cultural do Brasil
          </p>

          <h1
            className="max-w-4xl text-[clamp(2.4rem,7vw,5.5rem)] font-semibold leading-[1.02] tracking-tight text-[#F7F3EC]"
            style={{ fontFamily: "var(--font-fraunces), serif" }}
          >
            <BlurText text="A cultura do Maranhão é pública." />
            <span className="mt-1 block" style={{ color: CARMIM }}>
              <BlurText text="A fiscalização também." delay={520} />
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#F7F3EC]/85 sm:text-xl">
            Reunimos contratos, empresas e indicadores dos gastos públicos com
            cultura e organizamos tudo num painel aberto. Começando pelo
            Maranhão — para que o cidadão acompanhe, confira e cobre.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href={PAINEL}
              className="rounded-full px-6 py-3 text-base font-semibold text-[#F7F3EC] shadow-lg transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:ring-[#F7F3EC]"
              style={{ background: CARMIM }}
            >
              Explorar o painel
            </a>
            <a
              href="#como-funciona"
              className="rounded-full border border-[#F7F3EC]/50 px-6 py-3 text-base font-semibold text-[#F7F3EC] transition hover:bg-[#F7F3EC]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F7F3EC]"
            >
              Como funciona
            </a>
          </div>
        </div>

        {/* Scroll cue */}
        <a
          href="#numeros"
          aria-label="Rolar para os números"
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[#F7F3EC]/80 transition hover:text-[#F7F3EC]"
        >
          <span className="flex flex-col items-center gap-1">
            <span className="text-[0.7rem] uppercase tracking-[0.2em]">
              Role
            </span>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="animate-bounce"
            >
              <path
                d="M12 5v14M6 13l6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </a>
      </section>

      {/* ╔══ FAIXA DE IMPACTO (CountUp) ══╗ */}
      <section id="numeros" className="bg-[#0B0B0C] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <ScrollReveal>
            <p className="mb-10 max-w-2xl text-sm uppercase tracking-[0.18em] text-[#F7F3EC]/60">
              O que já está sob acompanhamento
            </p>
          </ScrollReveal>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
            {ESTATISTICAS.map((e, i) => (
              <ScrollReveal key={e.rotulo} delay={i * 90}>
                <div className="border-t-2 border-[#F7F3EC]/15 pt-4">
                  <dt
                    className="text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-none tracking-tight"
                    style={{
                      fontFamily: "var(--font-fraunces), serif",
                      color: DOURADO,
                    }}
                  >
                    <CountUp
                      to={e.valor}
                      decimals={e.decimals}
                      prefix={e.prefixo}
                      suffix={e.sufixo}
                      duration={2}
                    />
                  </dt>
                  <dd className="mt-3 text-sm leading-snug text-[#F7F3EC]/75">
                    {e.rotulo}
                  </dd>
                </div>
              </ScrollReveal>
            ))}
          </dl>
        </div>
      </section>

      {/* ╔══ O QUE FAZEMOS (SpotlightCard) ══╗ */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <ScrollReveal>
            <h2
              className="max-w-3xl text-[clamp(1.9rem,4.5vw,3.2rem)] font-semibold leading-tight tracking-tight"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
            >
              O que fazemos
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-[#6B7280]">
              Trabalhamos só com dado público e fonte linkada. Nada aqui é
              acusação — são indícios a apurar, oferecidos para a checagem de
              quem fiscaliza.
            </p>
          </ScrollReveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {O_QUE_FAZEMOS.map((c, i) => (
              <ScrollReveal key={c.titulo} delay={i * 80}>
                <SpotlightCard className="h-full rounded-md border border-[#0B0B0C]/10 bg-white p-7 shadow-sm">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: CARMIM }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3
                    className="mt-2 text-xl font-semibold"
                    style={{ fontFamily: "var(--font-fraunces), serif" }}
                  >
                    {c.titulo}
                  </h3>
                  <p className="mt-2 text-[#6B7280]">{c.texto}</p>
                </SpotlightCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ╔══ FAIXA DE VÍDEO (TAMBOR DE CRIOULA) ══╗ */}
      <VideoCultural />

      {/* ╔══ GALERIA CULTURAL ══╗ */}
      <section className="bg-[#0B0B0C] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <ScrollReveal>
            <p
              className="text-sm uppercase tracking-[0.18em]"
              style={{ color: DOURADO }}
            >
              Patrimônio vivo
            </p>
            <h2
              className="mt-3 max-w-3xl text-[clamp(1.9rem,4.5vw,3.2rem)] font-semibold leading-tight tracking-tight text-[#F7F3EC]"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
            >
              A cultura que esses recursos sustentam
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-[#F7F3EC]/70">
              Bumba meu boi, Tambor de Crioula e Cacuriá: manifestações que
              fazem do Maranhão um dos centros mais ricos da cultura popular
              brasileira. Fiscalizar é, antes de tudo, cuidar delas.
            </p>
          </ScrollReveal>

          <div className="mt-10">
            <GaleriaCultural fotos={FOTOS_GALERIA} />
          </div>
        </div>
      </section>

      {/* ╔══ COMO FUNCIONA ══╗ */}
      <section id="como-funciona" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <ScrollReveal>
            <h2
              className="max-w-3xl text-[clamp(1.9rem,4.5vw,3.2rem)] font-semibold leading-tight tracking-tight"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
            >
              Como funciona
            </h2>
          </ScrollReveal>

          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {PASSOS.map((p, i) => (
              <ScrollReveal key={p.n} delay={i * 100} as="li">
                <div className="border-t-2 pt-5" style={{ borderColor: COBALTO }}>
                  <span
                    className="block text-[clamp(2.4rem,5vw,3.6rem)] font-semibold leading-none"
                    style={{
                      fontFamily: "var(--font-fraunces), serif",
                      color: COBALTO,
                    }}
                  >
                    {p.n}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold">{p.titulo}</h3>
                  <p className="mt-2 text-[#6B7280]">{p.texto}</p>
                </div>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ╔══ BASE LEGAL (explicada para o público) ══╗ */}
      <section className="bg-[#F7F3EC] pb-20 sm:pb-28">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <ScrollReveal>
            <BaseLegal compacto />
          </ScrollReveal>
        </div>
      </section>

      {/* ╔══ CTA FINAL ══╗ */}
      <section className="bg-[#C8102E] py-20 text-[#F7F3EC] sm:py-24">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <ScrollReveal>
            <h2
              className="text-[clamp(1.9rem,5vw,3.4rem)] font-semibold leading-tight tracking-tight"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
            >
              Os dados são públicos. Agora estão organizados.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-[#F7F3EC]/90">
              Explore os contratos, as empresas e os cruzamentos por conta
              própria. Cada número leva à sua fonte oficial.
            </p>
            <a
              href={PAINEL}
              className="mt-8 inline-block rounded-full bg-[#F7F3EC] px-7 py-3 text-base font-semibold text-[#0B0B0C] transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#C8102E] focus-visible:ring-[#F7F3EC]"
            >
              Explorar o painel
            </a>
          </ScrollReveal>
        </div>
      </section>

      {/* ╔══ DISCLAIMER + CRÉDITOS + RODAPÉ ══╗ */}
      <footer className="bg-[#0B0B0C] py-14 text-[#F7F3EC]">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          {/* Disclaimer */}
          <div className="rounded-md border border-[#F7F3EC]/15 bg-[#F7F3EC]/[0.04] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#F7F3EC]/70">
              Indício, não acusação
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#F7F3EC]/75">
              Os pontos sinalizados neste portal são <strong>indícios a
              apurar</strong>, gerados por regras objetivas sobre dados
              públicos. Não constituem acusação, prova de irregularidade ou
              juízo sobre pessoas e empresas. Toda conclusão depende de
              verificação documental pelos órgãos competentes.
            </p>
          </div>

          {/* Créditos das imagens */}
          <div className="mt-10">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#F7F3EC]/60">
              Créditos das imagens
            </h3>
            <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm text-[#F7F3EC]/65 sm:grid-cols-2">
              {creditos.map((c) => (
                <li key={c.arquivo}>
                  <a
                    href={c.fonte}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:text-[#F7F3EC] hover:underline"
                  >
                    Imagem: {c.autor} — {c.licenca}, via Wikimedia Commons
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Linha final */}
          <div className="mt-10 flex flex-col gap-3 border-t border-[#F7F3EC]/15 pt-6 text-sm text-[#F7F3EC]/60 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © 2026 10Dobro Prod · Portal Transparência Cultural do Brasil
            </p>
            <p>
              Código sob licença AGPL-3.0 · Imagens sob licenças Creative
              Commons (CC BY / CC BY-SA)
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
