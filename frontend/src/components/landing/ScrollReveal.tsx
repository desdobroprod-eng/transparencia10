"use client";

interface ScrollRevealProps {
  children: React.ReactNode;
  direction?: "up" | "down" | "left" | "right" | "none";
  delay?: number;
  distance?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * ScrollReveal — entrada suave via CSS puro (classe `reveal-rise` definida em
 * globals.css). O conteúdo é SEMPRE renderizado visível; a animação é apenas
 * aditiva (keyframe que termina em opacity 1). Se a animação não rodar, o texto
 * permanece visível — nada nunca fica oculto. Sem JS, sem timers, sem rAF.
 */
export default function ScrollReveal({
  children,
  delay = 0,
  className = "",
  as = "div",
}: ScrollRevealProps) {
  const Tag = as as "div";
  return (
    <Tag
      className={`reveal-rise ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
