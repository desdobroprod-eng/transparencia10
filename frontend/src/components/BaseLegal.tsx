import Link from "next/link";

/**
 * Bloco "Base legal" — sempre visível, em linguagem clara para o cidadão.
 * Explica POR QUE o cruzamento sócio × servidor é fiscalizado, citando a lei,
 * sempre em abstrato e com a ressalva de que não afirma irregularidade.
 *
 * `compacto` reduz o texto para uso em espaços menores.
 */
export default function BaseLegal({ compacto = false }: { compacto?: boolean }) {
  return (
    <section
      aria-label="Base legal do cruzamento sócio e servidor"
      className="overflow-hidden rounded-xl border border-[#1B3A8B]/25 bg-white shadow-sm"
    >
      {/* Cabeçalho destacado */}
      <div className="flex items-center gap-3 border-b border-[#1B3A8B]/15 bg-[#1B3A8B]/[0.06] px-5 py-4">
        <span aria-hidden className="text-2xl leading-none">⚖️</span>
        <div>
          <h2 className="text-base font-bold tracking-tight text-[#1B3A8B]">
            Por que isto é fiscalizado? A lei explica.
          </h2>
          <p className="text-xs text-gray-500">
            Servidor público e contrato com a Administração têm limites legais claros.
          </p>
        </div>
      </div>

      {/* Corpo */}
      <div className="px-5 py-5">
        <p className="text-sm leading-relaxed text-gray-700">
          Um servidor público pode investir e ser sócio de uma empresa. Mas a lei
          impõe dois limites importantes — e é por isso que comparar os nomes de
          sócios com os de servidores ajuda o cidadão a saber o que merece um
          olhar mais atento:
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">
              1. Pode ser sócio, não pode administrar
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              O servidor pode ser acionista, cotista ou sócio investidor, mas{" "}
              <strong>não pode gerenciar ou administrar</strong> a empresa
              (art. 117 da Lei nº 8.112/1990 e estatutos equivalentes). Por isso
              também não pode ser MEI, Empresário Individual (EI) nem Sociedade
              Limitada Unipessoal (SLU).
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">
              2. Não pode contratar com a própria esfera
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              O art. 14 da Lei nº 14.133/2021 (Nova Lei de Licitações){" "}
              <strong>proíbe</strong> que o agente público participe, direta ou
              indiretamente, como licitante ou contratado do próprio órgão.
              Fornecer à Administração da mesma esfera pode gerar{" "}
              <strong>conflito de interesses</strong>.
            </p>
          </div>
        </div>

        {!compacto && (
          <p className="mt-4 text-sm leading-relaxed text-gray-700">
            A saída prevista em lei: o servidor que é sócio deve afastar-se da
            gestão e transferir a administração a outra pessoa antes de a empresa
            contratar com o poder público.
          </p>
        )}

        {/* Ressalva — sempre acompanha a menção à lei */}
        <div className="mt-4 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
          <p className="text-sm leading-relaxed text-amber-900">
            <strong>Importante:</strong> uma coincidência de nome{" "}
            <strong>não prova</strong> que isso aconteceu. O portal não afirma que
            houve irregularidade em nenhum caso — apenas mostra o que, segundo a
            lei, merece ser verificado. Confirmar identidade (CPF) e quem
            administra a empresa cabe aos órgãos de controle (TCE-MA, CGU, MPF).{" "}
            <Link href="/metodologia" className="font-medium text-[#1B3A8B] underline">
              Ver metodologia completa
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
