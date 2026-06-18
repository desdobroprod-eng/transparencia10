"use client";

import { useEffect, useRef, useState } from "react";

interface BlurTextProps {
  text: string;
  /** Anima por palavra (padrão) ou por caractere. */
  by?: "word" | "char";
  /** Atraso entre cada elemento, em ms. */
  stagger?: number;
  /** Atraso inicial antes de iniciar, em ms. */
  delay?: number;
  className?: string;
  /** Renderiza cada item — útil para destacar palavras (ex.: cor de acento). */
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * BlurText — adaptação do componente reactbits (TextAnimations/BlurText).
 * O original usa framer-motion; aqui reproduzimos o mesmo efeito (cada palavra
 * entra com blur + leve deslocamento, em cascata) com CSS puro + transição,
 * disparado por IntersectionObserver. Compatível com static export.
 */
export default function BlurText({
  text,
  by = "word",
  stagger = 90,
  delay = 0,
  className = "",
  as = "span",
}: BlurTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);

  const parts = by === "word" ? text.split(" ") : Array.from(text);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const Tag = as as "span";

  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {parts.map((part, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="inline-block will-change-[filter,transform,opacity]"
          style={{
            transition:
              "filter 700ms cubic-bezier(.2,.65,.3,1), opacity 700ms ease, transform 700ms cubic-bezier(.2,.65,.3,1)",
            transitionDelay: `${delay + i * stagger}ms`,
            filter: shown ? "blur(0px)" : "blur(12px)",
            opacity: shown ? 1 : 0,
            transform: shown ? "translateY(0)" : "translateY(0.35em)",
          }}
        >
          {part}
          {by === "word" && i < parts.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}
