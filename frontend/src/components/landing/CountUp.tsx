"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number; // segundos
  delay?: number; // segundos
  className?: string;
  /** Locale para formatação dos milhares (pt-BR por padrão). */
  locale?: string;
  /** Casas decimais a exibir. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

/**
 * CountUp — adaptação do componente reactbits (TextAnimations/CountUp).
 * O original depende de framer-motion (motion/react), que NÃO está instalado
 * neste projeto. Esta versão reproduz a mesma ideia (anima de `from` até `to`
 * quando entra na viewport, uma única vez) usando IntersectionObserver +
 * requestAnimationFrame, mantendo compatibilidade com static export.
 */
export default function CountUp({
  to,
  from = 0,
  duration = 2,
  delay = 0,
  className = "",
  locale = "pt-BR",
  decimals = 0,
  prefix = "",
  suffix = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState<number>(from);

  const format = (n: number) =>
    n.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respeita usuários que pedem menos movimento.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Reanima sempre que `to` mudar (ex.: KPI atualizado após fetch dos dados
    // reais) — o cleanup do effect cancela a animação anterior.
    const animate = () => {
      if (prefersReduced) {
        setValue(to);
        return;
      }

      const begin = performance.now() + delay * 1000;
      const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic

      let raf = 0;
      const tick = (now: number) => {
        if (now < begin) {
          raf = requestAnimationFrame(tick);
          return;
        }
        const p = Math.min(1, (now - begin) / (duration * 1000));
        setValue(from + (to - from) * ease(p));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      // Rede de segurança: se o rAF for estrangulado (aba não-visível), crava o
      // valor final por timer — o número nunca fica preso em `from`.
      const garantia = window.setTimeout(
        () => setValue(to),
        (delay + duration) * 1000 + 250
      );
      return () => {
        cancelAnimationFrame(raf);
        window.clearTimeout(garantia);
      };
    };

    // Dispara a contagem ao montar — robusto e independente de scroll/viewport.
    const cleanup = animate();
    return cleanup;
  }, [to, from, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {format(value)}
      {suffix}
    </span>
  );
}
