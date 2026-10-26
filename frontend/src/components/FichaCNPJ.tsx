"use client";

// Ficha do fornecedor: só fatos de fontes públicas, cada bloco com link para a
// origem. Sem pontuação nem juízo. A coincidência de nome entre sócio e
// servidor aparece ao lado do sócio apenas para quem tem a senha da seção
// Coincidências de Nomes (dado cifrado, ver hooks/useDados.ts).

import Link from "next/link";
import type { Contrato, Cruzamento, Emenda, FichaEmpresa } from "@/hooks/useDados";
import { useAuth } from "@/lib/auth";
import { NOME_ENTE, formatBRLcheio } from "@/lib/config";

function digitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

export function formatarCNPJ(cnpj: string): string {
  const d = digitos(cnpj);
  if (d.length !== 14) return cnpj || "—";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function dataBR(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}

// Contrato na fonte oficial, a partir do numeroControlePNCP
// ("{cnpjOrgao}-{tipo}-{sequencial}/{ano}").
export function urlPNCP(id: string): string | null {
  const [base, ano] = (id || "").split("/");
  const partes = (base || "").split("-");
  const seq = parseInt(partes[partes.length - 1], 10);
  if (!partes[0] || !ano || Number.isNaN(seq)) return null;
  return `https://pncp.gov.br/app/contratos/${partes[0]}/${ano}/${seq}`;
}

function norm(s: string): string {
  return (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

function Fonte({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
    >
      {children} <span aria-hidden>↗</span>
    </a>
  );
}

function Bloco({ titulo, fonte, children }: { titulo: string; fonte?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</h3>
        {fonte}
      </div>
      {children}
    </section>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{rotulo}</dt>
      <dd className="text-sm text-gray-900">{valor || "—"}</dd>
    </div>
  );
}

export default function FichaCNPJ({
  cnpj,
  nome,
  ficha,
  contratos,
  emendas,
  cruzamentos,
}: {
  cnpj: string;
  nome: string;
  ficha?: FichaEmpresa;
  contratos: Contrato[];
  emendas: Emenda[];
  cruzamentos: Cruzamento[];
}) {
  const { senha } = useAuth();
  const d = digitos(cnpj);
  const urlReceita = `https://www.consultacnpj.com/cnpj/${d}`;
  const totalContratos = contratos.reduce((s, c) => s + (c.valor || 0), 0);

  // Servidores com nome igual a cada sócio (só existe com senha).
  const servidoresPorSocio = new Map<string, Cruzamento[]>();
  for (const cz of cruzamentos) {
    if (digitos(cz.cnpj) !== d) continue;
    const k = norm(cz.socio);
    const lista = servidoresPorSocio.get(k) ?? [];
    // Um cruzamento por contrato: mostra cada servidor uma vez só.
    if (!lista.some((x) => norm(x.servidor) === norm(cz.servidor) && x.orgao === cz.orgao)) {
      servidoresPorSocio.set(k, [...lista, cz]);
    }
  }

  return (
    // sticky + largura da janela: a ficha fica visível mesmo quando a tabela
    // que a contém é mais larga que a tela (rolagem horizontal).
    <div className="sticky left-0 w-full max-w-[calc(100vw-2.5rem)] space-y-3 bg-gray-50 p-4 text-sm text-gray-700 lg:max-w-[70rem]">
      <Bloco titulo="Dados cadastrais" fonte={<Fonte href={urlReceita}>Receita Federal</Fonte>}>
        {ficha ? (
          <dl className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Razão social" valor={ficha.razao_social || nome} />
            <Campo rotulo="CNPJ" valor={formatarCNPJ(cnpj)} />
            <Campo rotulo="Natureza jurídica" valor={ficha.natureza_juridica} />
            <Campo rotulo="Abertura" valor={dataBR(ficha.abertura)} />
            <Campo rotulo="Situação cadastral" valor={ficha.situacao} />
            <Campo rotulo="Porte" valor={[ficha.porte, ficha.mei ? "MEI" : ""].filter(Boolean).join(" · ")} />
            <Campo
              rotulo="Capital social declarado"
              valor={ficha.capital_social > 0 ? formatBRLcheio(ficha.capital_social) : "—"}
            />
            <Campo rotulo="Total em contratos de cultura" valor={formatBRLcheio(totalContratos)} />
            <Campo rotulo="Atividade principal (CNAE)" valor={ficha.cnae} />
          </dl>
        ) : (
          <p className="text-gray-500">
            Cadastro não disponível na consulta. Confira direto na fonte.
          </p>
        )}
      </Bloco>

      <Bloco
        titulo={`Sócios e dirigentes (${ficha?.socios.length ?? 0})`}
        fonte={<Fonte href={urlReceita}>Quadro societário — Receita Federal</Fonte>}
      >
        {ficha && ficha.socios.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {ficha.socios.map((s) => {
              const servidores = servidoresPorSocio.get(norm(s.nome)) ?? [];
              return (
                <li key={s.nome} className="py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-gray-900">{s.nome}</span>
                    <span className="text-xs text-gray-500">
                      {[s.qualificacao, s.desde ? `desde ${dataBR(s.desde)}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  {servidores.map((sv) => (
                    <p key={sv.servidor + sv.orgao} className="mt-1 text-xs text-gray-700">
                      {sv.exato
                        ? "Nome igual ao de servidor público: "
                        : "Mesmos sobrenomes, na mesma ordem, de servidor público: "}
                      <strong>{sv.servidor}</strong>
                      {sv.orgao ? ` — ${sv.orgao}` : ""}
                      {sv.cargo ? `, ${sv.cargo}` : ""}
                      {sv.situacao === "exonerado" ? " (ex-servidor)" : ""}.{" "}
                      {sv.fonte?.includes("Diário Oficial") ? (
                        <Fonte href="https://queridodiario.ok.org.br/">{sv.fonte}</Fonte>
                      ) : (
                        <Fonte href="https://www.transparencia.ma.gov.br/app/v2/servidores">
                          {sv.fonte || "Portal da Transparência do Maranhão"}
                        </Fonte>
                      )}{" "}
                      <span className="text-gray-500">
                        {sv.exato
                          ? "Nome igual não confirma que é a mesma pessoa."
                          : "Sobrenome igual não confirma parentesco."}
                      </span>
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-500">Quadro societário não informado na fonte.</p>
        )}
        {!senha && ficha && ficha.socios.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            A comparação dos nomes com a base de servidores públicos fica em{" "}
            <Link href="/cruzamentos" className="font-medium text-blue-700 hover:underline">
              Coincidências de Nomes
            </Link>{" "}
            (acesso com senha).
          </p>
        )}
      </Bloco>

      {ficha && ficha.sancoes.length > 0 && (
        <Bloco
          titulo="Sanções registradas"
          fonte={
            <Fonte href="https://portaldatransparencia.gov.br/sancoes/consulta">
              CEIS/CNEP — CGU
            </Fonte>
          }
        >
          <ul className="space-y-1">
            {ficha.sancoes.map((s, i) => (
              <li key={i}>
                {[s.fonte, s.tipo, s.orgao].filter(Boolean).join(" · ")}
                {s.data_inicio ? ` — de ${dataBR(s.data_inicio)}` : ""}
                {s.data_fim ? ` até ${dataBR(s.data_fim)}` : ""}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      <Bloco titulo={`Contratos de cultura (${contratos.length})`} fonte={<Fonte href="https://pncp.gov.br/app/contratos">PNCP</Fonte>}>
        <ul className="divide-y divide-gray-100">
          {[...contratos]
            .sort((a, b) => (b.valor || 0) - (a.valor || 0))
            .map((c) => {
              const url = urlPNCP(c.id);
              return (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate" title={c.objeto}>
                    {NOME_ENTE[c.ente] ?? c.ente} · {dataBR(c.data_publicacao)} · {c.objeto}
                  </span>
                  <span className="whitespace-nowrap tabular-nums font-medium text-gray-900">
                    {formatBRLcheio(c.valor)}
                  </span>
                  {url && <Fonte href={url}>ver no PNCP</Fonte>}
                </li>
              );
            })}
        </ul>
      </Bloco>

      {emendas.length > 0 && (
        <Bloco
          titulo={`Emendas parlamentares recebidas (${emendas.length})`}
          fonte={<Fonte href="https://transparencia.ma.gov.br/app/v2/emendasestaduais">Portal da Transparência do MA</Fonte>}
        >
          <ul className="divide-y divide-gray-100">
            {emendas.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                <span className="min-w-0 flex-1">
                  {e.ano} · {e.parlamentar} · {e.objeto || e.subfuncao}
                </span>
                <span className="whitespace-nowrap tabular-nums font-medium text-gray-900">
                  {formatBRLcheio(e.valor_empenhado)} empenhado · {formatBRLcheio(e.valor_pago)} pago
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
      )}
    </div>
  );
}
