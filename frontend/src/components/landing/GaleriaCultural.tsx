"use client";

import { useState } from "react";

const BASE = "/transparencia10";

export interface FotoCultural {
  arquivo: string;
  manifestacao: string;
  legenda: string;
  autor: string;
  licenca: string;
}

/**
 * Galeria cultural — grade editorial com destaque. No mobile vira carrossel
 * horizontal com snap; no desktop, mosaico. Sem dependências externas.
 */
export default function GaleriaCultural({ fotos }: { fotos: FotoCultural[] }) {
  const [ativa, setAtiva] = useState(0);

  return (
    <div>
      {/* Destaque grande */}
      <figure className="relative overflow-hidden rounded-sm border border-[#0B0B0C]/10 bg-[#0B0B0C]">
        <img
          src={`${BASE}/cultura/${fotos[ativa].arquivo}`}
          alt={`${fotos[ativa].manifestacao} — ${fotos[ativa].legenda}`}
          className="h-[clamp(18rem,52vw,34rem)] w-full object-cover"
          loading="lazy"
        />
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B0B0C]/85 to-transparent p-5 sm:p-7">
          <p className="font-serif text-2xl font-semibold text-[#F7F3EC] sm:text-3xl">
            {fotos[ativa].manifestacao}
          </p>
          <p className="mt-1 max-w-2xl text-sm text-[#F7F3EC]/80">
            {fotos[ativa].legenda}
          </p>
          <p className="mt-2 text-xs text-[#F7F3EC]/60">
            Imagem: {fotos[ativa].autor} — {fotos[ativa].licenca}, via Wikimedia
            Commons
          </p>
        </figcaption>
      </figure>

      {/* Miniaturas / seletor */}
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {fotos.map((f, i) => {
          const selecionada = i === ativa;
          return (
            <li key={f.arquivo}>
              <button
                type="button"
                onClick={() => setAtiva(i)}
                aria-pressed={selecionada}
                aria-label={`Ver ${f.manifestacao}: ${f.legenda}`}
                className={`group block w-full overflow-hidden rounded-sm border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] ${
                  selecionada
                    ? "border-[#C8102E]"
                    : "border-transparent hover:border-[#0B0B0C]/30"
                }`}
              >
                <img
                  src={`${BASE}/cultura/${f.arquivo}`}
                  alt=""
                  aria-hidden="true"
                  className={`h-20 w-full object-cover transition duration-300 sm:h-24 ${
                    selecionada
                      ? ""
                      : "opacity-80 grayscale-[35%] group-hover:opacity-100 group-hover:grayscale-0"
                  }`}
                  loading="lazy"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
