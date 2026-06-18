"use client";

const BASE = "/transparencia10";

/**
 * Faixa cinematográfica com vídeo de fundo (Tambor de Crioula do Maranhão).
 * Vídeo mudo, em loop, autoplay — a brincante girando a saia ao fundo enquanto
 * o usuário passa pela seção. Overlay escuro garante leitura do texto.
 * Fonte CC BY 3.0 (TVNBR) — crédito exibido.
 */
export default function VideoCultural() {
  return (
    <section className="relative isolate overflow-hidden bg-[#0B0B0C]">
      {/* Vídeo de fundo */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={`${BASE}/cultura/video/tambor-poster.jpg`}
        aria-hidden="true"
      >
        <source src={`${BASE}/cultura/video/tambor.webm`} type="video/webm" />
        <source src={`${BASE}/cultura/video/tambor.mp4`} type="video/mp4" />
      </video>

      {/* Overlay para contraste */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0C] via-[#0B0B0C]/55 to-[#0B0B0C]/80" />

      {/* Conteúdo */}
      <div className="relative mx-auto flex min-h-[78vh] max-w-5xl flex-col justify-center px-6 py-24 text-[#F7F3EC]">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#E2B100]">
          Tambor de Crioula · Maranhão
        </p>
        <h2 className="font-serif text-3xl font-black leading-tight sm:text-5xl">
          Cada real desviado é uma saia que deixa de rodar,
          <br className="hidden sm:block" /> um tambor que deixa de soar.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#F7F3EC]/80 sm:text-lg">
          O dinheiro público da cultura sustenta a festa, o ofício e a memória do
          povo. Fiscalizar é proteger o que faz o Maranhão ser o Maranhão.
        </p>
        <p className="mt-8 text-[11px] text-[#F7F3EC]/45">
          Imagens: Tambor de Crioula do Maranhão — TVNBR, CC BY 3.0, via Wikimedia Commons.
        </p>
      </div>
    </section>
  );
}
