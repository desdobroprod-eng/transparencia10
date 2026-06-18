// Logomarca — "C de fita abraçando o T" (monograma T+C).
// O C (carmim) vira fita; o T (cobalto + barra dourada) no centro.
// Versão `mono` usa currentColor (uma cor só).

export function LogoIcon({
  size = 32,
  mono = false,
  className = "",
}: {
  size?: number;
  mono?: boolean;
  className?: string;
}) {
  if (mono) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="currentColor"
        className={className}
        role="img"
        aria-label="Transparência Cultural"
      >
        <path
          d="M88 33 A36 36 0 1 0 88 87"
          fill="none"
          stroke="currentColor"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <rect x="44" y="40" width="44" height="11" rx="5.5" fill="currentColor" />
        <rect x="60.5" y="44" width="11" height="40" rx="5.5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Transparência Cultural"
    >
      <path d="M88 33 A36 36 0 1 0 88 87" fill="none" stroke="#C8102E" strokeWidth="13" strokeLinecap="round" />
      <path d="M88 33 q 7 -5 13 2" fill="none" stroke="#C8102E" strokeWidth="9" strokeLinecap="round" />
      <rect x="44" y="40" width="44" height="11" rx="5.5" fill="#E2B100" />
      <rect x="60.5" y="44" width="11" height="40" rx="5.5" fill="#1B3A8B" />
      <circle cx="66" cy="46" r="4" fill="#F7F3EC" />
    </svg>
  );
}
