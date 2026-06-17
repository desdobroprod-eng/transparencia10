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
            Sinalização automática por coincidência de nome — não é acusação, não identifica pessoas
          </p>
          <p className="text-sm leading-relaxed text-amber-800/90">
            Este painel cruza <strong>nomes</strong> que aparecem em bases públicas
            (quadro societário da Receita Federal × folha de servidores estaduais do
            Maranhão). O sistema{" "}
            <strong className="font-semibold">
              não confirma que se trata da mesma pessoa — não há checagem de CPF.
              Coincidência ou semelhança de nome é comum e não significa parentesco,
              sociedade oculta, fraude ou qualquer irregularidade.
            </strong>{" "}
            Nenhuma das pessoas citadas é acusada de conduta ilícita. A verificação de
            identidade e de eventual irregularidade compete exclusivamente aos órgãos de
            controle (TCE-MA, CGU, MPF). Se você é uma das pessoas citadas e deseja
            esclarecer ou corrigir, use o canal de retificação no rodapé.
          </p>
        </div>
      </div>
    </div>
  );
}
