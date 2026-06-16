"use client";

// Aviso ético/jurídico obrigatório — fixo e visível no topo da página.
// "Indício, não acusação." Homonímia é possível.
export default function DisclaimerInvestigacao() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-lg leading-none">⚠️</span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-800">
            Indício automático — não é acusação
          </p>
          <p className="text-sm leading-relaxed text-amber-800/90">
            Os cruzamentos abaixo são indícios automáticos por coincidência de
            nome em bases públicas (sócios via Receita Federal × servidores
            estaduais via Portal da Transparência MA).{" "}
            <strong className="font-semibold">
              Não constituem acusação, prova de irregularidade nem afirmação de
              que se trata da mesma pessoa.
            </strong>{" "}
            Homonímia é possível. A verificação cabe aos órgãos competentes
            (TCE-MA, CGU, MPF).
          </p>
        </div>
      </div>
    </div>
  );
}
