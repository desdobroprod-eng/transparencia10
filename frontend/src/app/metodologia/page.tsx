"use client";

import { useDados } from "@/hooks/useDados";

function formatarData(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const fontes = [
  {
    nome: "PNCP — Portal Nacional de Contratações Públicas",
    uso: "Contratos públicos, filtrados pelo CNPJ de cada órgão.",
  },
  {
    nome: "Portal da Transparência do Maranhão",
    uso: "Empenhos da execução da SECMA e do FUNDECMA, além da base de servidores estaduais.",
  },
  {
    nome: "SICONFI / Tesouro Nacional",
    uso: "Execução orçamentária da função Cultura (função 13).",
  },
  {
    nome: "Receita Federal (via BrasilAPI)",
    uso: "Quadro societário (sócios), data de abertura e situação cadastral de CNPJ.",
  },
];

const ficha = [
  {
    nome: "Dados cadastrais",
    fonte: "Receita Federal (via BrasilAPI)",
    desc: "Razão social, natureza jurídica, data de abertura, situação cadastral, porte, capital social declarado e atividade principal (CNAE).",
  },
  {
    nome: "Sócios e dirigentes",
    fonte: "Quadro societário (QSA) — Receita Federal",
    desc: "Nome, qualificação (sócio-administrador, presidente, diretor etc.) e data de entrada de cada pessoa no quadro da empresa ou entidade.",
  },
  {
    nome: "Contratos de cultura",
    fonte: "PNCP",
    desc: "Cada contrato do fornecedor com os entes monitorados, com valor, data, número de retificações e link para o registro no PNCP.",
  },
  {
    nome: "Emendas parlamentares recebidas",
    fonte: "Portal da Transparência do Maranhão",
    desc: "Emendas de cultura em que o fornecedor aparece como favorecido, com parlamentar, objeto e valores empenhado e pago.",
  },
  {
    nome: "Sanções",
    fonte: "CEIS/CNEP — Controladoria-Geral da União",
    desc: "Registro do fornecedor em cadastros de empresas sancionadas, quando houver, com órgão e período.",
  },
  {
    nome: "Nome igual ao de servidor público (acesso com senha)",
    fonte: "Portal da Transparência do Maranhão e Diário Oficial de São Luís",
    desc: "Ao lado de cada sócio, indica servidor com nome completo idêntico ou com os mesmos sobrenomes na mesma ordem. Nome igual não confirma que é a mesma pessoa.",
  },
];

export default function MetodologiaPage() {
  const { meta, loading } = useDados();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Metodologia &amp; Sobre
        </h1>
        <p className="mt-3 text-base text-gray-600">
          Como o Portal Transparência Cultural do Brasil reúne, organiza e
          analisa os dados públicos de gastos com cultura no Maranhão.
        </p>
        {!loading && meta && (
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">
                Última coleta
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {formatarData(meta.ultima_coleta)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">
                Contratos
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {meta.total_contratos?.toLocaleString("pt-BR") ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">
                Fornecedores
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {meta.total_fornecedores?.toLocaleString("pt-BR") ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">
                Fonte
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {meta.fonte ?? "Dados públicos"}
              </dd>
            </div>
          </dl>
        )}
      </header>

      <article className="prose prose-gray max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:text-gray-900 prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3 prose-p:text-gray-700 prose-li:text-gray-700">
        <section>
          <h2>O que é</h2>
          <p>
            O Portal Transparência Cultural do Brasil acompanha os gastos com
            cultura das secretarias do Maranhão — Estado (SECMA), São Luís,
            Raposa, São José de Ribamar, Paço do Lumiar e Pinheiro. A plataforma
            reúne dados públicos de diferentes fontes oficiais, cruza essas
            informações e organiza tudo com link para a fonte de cada registro,
            para que o cidadão acompanhe para onde vai o dinheiro da cultura.
          </p>
        </section>

        <section>
          <h2>Fontes de dados</h2>
          <p>
            Todos os dados utilizados são públicos e obtidos de fontes oficiais. As
            principais são:
          </p>
          <div className="not-prose mt-4 overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">
                    Fonte
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">
                    O que fornece
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fontes.map((f) => (
                  <tr key={f.nome} className="align-top">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {f.nome}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{f.uso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>Como funciona o recorte de Cultura</h2>
          <p>
            Nem todo contrato de um município é cultural. O recorte prioriza
            precisão: é melhor deixar de fora um caso duvidoso do que publicar
            obra ou serviço de outra área como gasto com cultura. A decisão segue
            esta ordem:
          </p>
          <ol>
            <li>
              Objeto de obra urbana ou esporte (asfalto, pavimentação, iluminação
              pública, drenagem, quadra ou espaço esportivo) fica <strong>fora</strong>,
              qualquer que seja a secretaria.
            </li>
            <li>
              Contrato de secretaria exclusivamente de cultura ou de patrimônio
              histórico <strong>entra</strong>, inclusive o custeio da própria pasta.
            </li>
            <li>
              Secretaria mista (por exemplo, &quot;Cultura, Esportes e Lazer&quot;)
              só entra quando o objeto do contrato é cultural.
            </li>
            <li>
              Secretaria de outro setor (Saúde, Educação, Obras, Urbanismo,
              Desporto…) fica <strong>fora</strong>.
            </li>
            <li>
              Unidade genérica (Prefeitura, Gabinete, Administração) entra quando o
              objeto cita termo cultural inequívoco — show, apresentação artística,
              festejo junino, carnaval, teatro, entre outros. As palavras são
              comparadas inteiras, para que &quot;cultura&quot; não case com
              &quot;puericultura&quot; nem &quot;teatro&quot; com o nome de uma rua.
            </li>
          </ol>
        </section>

        {meta?.contratos_excluidos && meta.contratos_excluidos.length > 0 && (
          <section>
            <h2>Contratos excluídos manualmente</h2>
            <p>
              Registros publicados no PNCP com erro comprovado são retirados do
              painel para não distorcer os totais. Cada exclusão fica
              listada aqui, com o motivo:
            </p>
            <ul>
              {meta.contratos_excluidos.map((x) => (
                <li key={x.id}>
                  <code>{x.id}</code> — {x.motivo}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2>O que aparece na ficha do fornecedor</h2>
          <p>
            Cada fornecedor tem uma ficha, aberta pelo botão &quot;Ficha&quot; em
            Empresas ou pelo detalhe de um contrato. A ficha mostra apenas fatos
            dos registros oficiais, sem pontuação nem classificação, e cada
            bloco aponta para a fonte:
          </p>
          <div className="not-prose mt-4 space-y-3">
            {ficha.map((f) => (
              <div key={f.nome} className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">{f.nome}</h3>
                <p className="mt-0.5 text-xs text-gray-500">Fonte: {f.fonte}</p>
                <p className="mt-1 text-sm text-gray-700">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Fundamento legal do cruzamento sócio × servidor</h2>
          <p>
            Por que comparar sócios de empresas contratadas com servidores
            públicos? Porque a lei estabelece limites objetivos para a relação
            entre o agente público e contratos com a Administração. Em resumo:
          </p>
          <ul>
            <li>
              <strong>Servidor pode ser sócio, não administrador.</strong> Pela
              legislação (por exemplo, o art. 117 da Lei nº 8.112/1990, para
              federais), o servidor pode ser acionista, cotista ou sócio
              investidor, mas <strong>não pode exercer a gerência ou a
              administração</strong> de sociedade privada. Por isso fica
              impedido de figurar como administrador no contrato social e de ser
              MEI, Empresário Individual (EI) ou Sociedade Limitada Unipessoal
              (SLU).
            </li>
            <li>
              <strong>Vedação de contratar com a própria esfera.</strong> O
              art. 14 da Lei nº 14.133/2021 (Nova Lei de Licitações) veda
              expressamente a participação, direta ou indireta, de agente
              público do órgão contratante como licitante ou contratado. A
              contratação da Administração com empresa de servidor da mesma
              esfera pode configurar <strong>conflito de interesses</strong>.
            </li>
            <li>
              Para participar de licitações, o servidor sócio deve afastar-se da
              gestão da empresa e transferir a administração a terceiro,
              evitando contratos com o setor público para não incorrer em
              vedações previstas no estatuto de carreira.
            </li>
          </ul>
          <p>
            <strong>Como isso se aplica aqui:</strong> quando o nome de um sócio
            coincide com o de um servidor, esse é exatamente o cenário que a lei
            manda observar — e por isso o nome igual é <strong>mostrado ao lado
            do sócio, com a fonte</strong>. O portal <strong>não afirma</strong> que houve
            vedação, conflito de interesses ou irregularidade em nenhum caso
            concreto: a coincidência de nome não confirma identidade, e a
            verificação (inclusive de quem administra a empresa e de CPF)
            compete aos órgãos de controle.
          </p>
        </section>

        <section>
          <h2>Limitações e ressalvas</h2>
          <p>
            A transparência também exige honestidade sobre os limites da análise.
            Considere os seguintes pontos ao interpretar os resultados:
          </p>
          <ul>
            <li>
              A base de servidores cobre servidores <strong>estaduais</strong> do
              Maranhão e, quando disponível, servidores <strong>municipais</strong> dos
              municípios monitorados.
            </li>
            <li>
              A comparação por nome pode juntar pessoas diferentes (homonímia).
              Um <strong>nome completo idêntico</strong> é uma coincidência mais
              estreita; <strong>sobrenomes em comum</strong>, bem mais ampla.
            </li>
            <li>
              Os valores de contrato refletem o momento da{" "}
              <strong>assinatura</strong> e podem diferir do que foi efetivamente
              executado. O gasto do Estado é medido pelos empenhos.
            </li>
            <li>
              Alguns contratos têm objeto genérico e podem acabar escapando do
              recorte de cultura.
            </li>
          </ul>
        </section>

        <section>
          <div className="not-prose mt-8 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold text-amber-900">Aviso legal</h2>
            <p className="mt-2 text-sm leading-relaxed text-amber-900">
              O portal reúne <strong>registros públicos</strong> e mostra cada um
              com a fonte. As informações <strong>não constituem acusação</strong>{" "}
              nem comprovação de irregularidade. Qualquer conclusão depende de
              verificação documental pelos órgãos competentes — como o TCE-MA, a
              CGU e o MPF.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-amber-900">
              Encontrou uma informação incorreta ou deseja contestar um registro?
              Entre em contato conosco para solicitar correção. Avaliaremos todos os
              pedidos e atualizaremos os dados quando cabível.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
