"use client";

import { Fragment, useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import Fuse from "fuse.js";

import { useDados, type Contrato } from "@/hooks/useDados";
import { NOME_ENTE, ENTES, formatBRLcheio } from "@/lib/config";
import RiscoBadge from "@/components/contratos/RiscoBadge";
import DetalheContrato from "@/components/contratos/DetalheContrato";

function truncar(texto: string, max = 80): string {
  if (!texto) return "—";
  return texto.length > max ? texto.slice(0, max).trimEnd() + "…" : texto;
}

function formatarData(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export default function ContratosPage() {
  const { loading, erro, contratos, anosDisponiveis } = useDados();

  // Filtros
  const [busca, setBusca] = useState("");
  const [ente, setEnte] = useState("");
  const [ano, setAno] = useState("");
  const [somenteIndicios, setSomenteIndicios] = useState(false);

  // Estado da tabela
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Índice fuzzy (recriado quando a lista de contratos muda)
  const fuse = useMemo(
    () =>
      new Fuse(contratos, {
        keys: ["fornecedor", "objeto"],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [contratos]
  );

  // Aplica todos os filtros
  const filtrados = useMemo(() => {
    let base = contratos;

    const termo = busca.trim();
    if (termo) {
      base = fuse.search(termo).map((r) => r.item);
    }
    if (ente) base = base.filter((c) => c.ente === ente);
    if (ano) base = base.filter((c) => String(c.ano) === ano);
    if (somenteIndicios) {
      base = base.filter((c) => c.alertas.length > 0 || c.score_risco > 0);
    }
    return base;
  }, [contratos, fuse, busca, ente, ano, somenteIndicios]);

  const colunas = useMemo<ColumnDef<Contrato>[]>(
    () => [
      {
        id: "expand",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => row.toggleExpanded()}
            aria-label={row.getIsExpanded() ? "Recolher" : "Expandir"}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200"
          >
            {row.getIsExpanded() ? "▾" : "▸"}
          </button>
        ),
      },
      {
        accessorFn: (c) => NOME_ENTE[c.ente] ?? c.ente,
        id: "ente",
        header: "Ente",
        cell: (info) => <span className="whitespace-nowrap">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: "fornecedor",
        header: "Fornecedor",
        cell: (info) => (
          <span className="block max-w-[16rem] truncate" title={info.getValue<string>()}>
            {info.getValue<string>() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "objeto",
        header: "Objeto",
        enableSorting: false,
        cell: (info) => (
          <span className="block max-w-[22rem]" title={info.getValue<string>()}>
            {truncar(info.getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: "valor",
        header: "Valor",
        cell: (info) => (
          <span className="block whitespace-nowrap text-right tabular-nums">
            {formatBRLcheio(info.getValue<number>())}
          </span>
        ),
        sortingFn: "basic",
      },
      {
        accessorKey: "modalidade",
        header: "Modalidade",
        cell: (info) => (
          <span className="whitespace-nowrap">{info.getValue<string>() || "—"}</span>
        ),
      },
      {
        accessorKey: "data_publicacao",
        header: "Data",
        cell: (info) => (
          <span className="whitespace-nowrap">{formatarData(info.getValue<string>())}</span>
        ),
        sortingFn: "datetime",
      },
      {
        accessorKey: "score_risco",
        header: "Risco",
        cell: (info) => <RiscoBadge score={info.getValue<number>()} />,
        sortingFn: "basic",
      },
    ],
    []
  );

  const table = useReactTable({
    data: filtrados,
    columns: colunas,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  // --- Estados de carregamento / erro ---
  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-gray-500">Carregando contratos…</p>
      </main>
    );
  }
  if (erro) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-700">
          Não foi possível carregar os contratos: {erro}
        </div>
      </main>
    );
  }

  const totalFiltrado = filtrados.length;
  const totalGeral = contratos.length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contratos de Cultura</h1>
        <p className="mt-1 text-sm text-gray-600">
          {totalFiltrado === totalGeral
            ? `${totalGeral.toLocaleString("pt-BR")} contratos.`
            : `${totalFiltrado.toLocaleString("pt-BR")} de ${totalGeral.toLocaleString("pt-BR")} contratos.`}
        </p>
      </header>

      {/* Filtros */}
      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="mb-1 block text-xs font-medium text-gray-600">Busca</label>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Fornecedor ou objeto…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Ente</label>
          <select
            value={ente}
            onChange={(e) => setEnte(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            <option value="">Todos os entes</option>
            {ENTES.map((e) => (
              <option key={e.chave} value={e.chave}>
                {NOME_ENTE[e.chave]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Ano</label>
          <select
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            <option value="">Todos os anos</option>
            {anosDisponiveis.map((a) => (
              <option key={a} value={String(a)}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={somenteIndicios}
              onChange={(e) => setSomenteIndicios(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Somente com indícios
          </label>
        </div>
      </section>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const podeOrdenar = header.column.getCanSort();
                  const dir = header.column.getIsSorted();
                  const alinharDir = header.column.id === "valor";
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 font-semibold text-gray-600 ${
                        alinharDir ? "text-right" : "text-left"
                      }`}
                    >
                      {header.isPlaceholder ? null : podeOrdenar ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-gray-900"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="text-gray-400">
                            {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={colunas.length} className="px-3 py-8 text-center text-gray-500">
                  Nenhum contrato encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 align-top text-gray-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && (
                    <tr>
                      <td colSpan={row.getVisibleCells().length} className="p-0">
                        <DetalheContrato contrato={row.original} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-gray-600">
          Página {table.getState().pagination.pageIndex + 1} de{" "}
          {table.getPageCount() || 1}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 disabled:opacity-40"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 disabled:opacity-40"
          >
            Próxima
          </button>
          <button
            type="button"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 disabled:opacity-40"
          >
            »
          </button>
        </div>
      </div>
    </main>
  );
}
