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

const indicadores = [
  {
    nome: "Duplicidade",
    desc: "Contratos muito parecidos — mesmo fornecedor, valor e objeto em datas próximas — que podem indicar fracionamento ou pagamento repetido.",
  },
  {
    nome: "Monopólio de fornecedor",
    desc: "Um único fornecedor concentra uma fatia desproporcional dos contratos de um órgão, sinalizando baixa concorrência.",
  },
  {
    nome: "Preço acima da mediana",
    desc: "Valor acima do padrão observado para objetos semelhantes, considerando o conjunto dos contratos analisados. É uma comparação estatística, não um juízo sobre legalidade.",
  },
  {
    nome: "Empresa recém-aberta",
    desc: "Fornecedor com CNPJ aberto há pouco tempo antes da contratação, o que merece verificação quando associado a valores altos.",
  },
  {
    nome: "Capital social inferior ao contrato",
    desc: "O capital social declarado da empresa é muito menor que o valor contratado — divergência cadastral que merece verificação.",
  },
  {
    nome: "Coincidência de nomes (sócio × servidor)",
    desc: "Comparação entre nomes de sócios das empresas contratadas e a base de servidores estaduais. Sinaliza apenas COINCIDÊNCIA DE NOME — não confirma identidade, parentesco ou irregularidade (homonímia é comum). Serve para orientar apuração pelos órgãos de controle.",
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
          Como o Transparência 10 reúne, organiza e analisa os dados públicos de
          gastos com cultura no Maranhão.
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
                Alertas
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {meta.total_alertas?.toLocaleString("pt-BR") ?? "—"}
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
            O Transparência 10 acompanha os gastos com cultura das secretarias do
            Maranhão — Estado (SECMA), São Luís, Raposa, São José de Ribamar e Paço
            do Lumiar. A plataforma reúne dados públicos de diferentes fontes
            oficiais e sinaliza padrões que merecem atenção, tornando mais simples
            para o cidadão acompanhar para onde vai o dinheiro da cultura.
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
            Nem todo contrato de um município é cultural. Para isolar o que de fato
            diz respeito à cultura, um contrato entra na análise quando:
          </p>
          <ul>
            <li>
              a unidade gestora é a secretaria de cultura ou de patrimônio; <strong>ou</strong>
            </li>
            <li>
              o objeto do contrato contém termos culturais — como festival, show,
              banda, teatro, carnaval, entre outros.
            </li>
          </ul>
          <p>
            Esse recorte amplo procura capturar o máximo de gastos culturais, mesmo
            quando estão registrados em outras unidades.
          </p>
        </section>

        <section>
          <h2>Indicadores e cálculo do score</h2>
          <p>
            Cada contrato pode acionar um ou mais indicadores. São regras objetivas
            aplicadas sobre os dados públicos:
          </p>
          <div className="not-prose mt-4 space-y-3">
            {indicadores.map((ind) => (
              <div
                key={ind.nome}
                className="rounded-lg border border-gray-200 p-4"
              >
                <h3 className="text-sm font-semibold text-gray-900">
                  {ind.nome}
                </h3>
                <p className="mt-1 text-sm text-gray-700">{ind.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-6">
            Cada indicador contribui para uma <strong>pontuação de 0 a 100</strong>,
            em que valores mais altos representam maior necessidade de verificação.
            A pontuação NÃO é um julgamento — apenas ordena o que merece olhar
            primeiro:
          </p>
          <ul>
            <li>
              <strong>≥ 80:</strong> vários pontos a verificar — convém apurar primeiro.
            </li>
            <li>
              <strong>≥ 60:</strong> alguns pontos que merecem acompanhamento.
            </li>
            <li>
              <strong>Abaixo de 60:</strong> poucos ou nenhum ponto a verificar no momento.
            </li>
          </ul>
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
              O cruzamento por nome pode gerar coincidências (homonímia). Um{" "}
              <strong>nome completo idêntico</strong> é um indício mais forte;{" "}
              <strong>sobrenomes em comum</strong> é um indício bem mais fraco.
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
              Os indicadores apresentados são <strong>sinalizações automáticas</strong>{" "}
              geradas sobre dados públicos. Eles <strong>não constituem acusação</strong>{" "}
              nem comprovação de irregularidade. Cada apontamento deve ser apurado
              pelos órgãos competentes — como o TCE-MA, a CGU e o MPF — que detêm os
              meios e a autoridade para apuração.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-amber-900">
              Encontrou uma informação incorreta ou deseja contestar um apontamento?
              Entre em contato conosco para solicitar correção. Avaliaremos todos os
              pedidos e atualizaremos os dados quando cabível.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
