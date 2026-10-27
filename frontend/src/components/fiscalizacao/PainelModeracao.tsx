"use client";

// Fila de moderação do piloto. A senha é conferida na Edge Function `moderacao`
// (Supabase); aqui ela só fica na memória da aba enquanto a página está aberta.

import { useState } from "react";
import { SITUACOES, moderar, type Pendente } from "@/lib/fiscalizacao";

export default function PainelModeracao() {
  const [senha, setSenha] = useState("");
  const [logado, setLogado] = useState(false);
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function carregar(s = senha) {
    setMsg("");
    try {
      const r = await moderar(s, "listar");
      setPendentes(r.pendentes ?? []);
      setLogado(true);
    } catch (e) {
      setLogado(false);
      setMsg(e instanceof Error && e.message === "senha" ? "Senha incorreta." : "Erro ao carregar a fila.");
    }
  }

  async function decidir(id: string, acao: "aprovar" | "recusar") {
    let motivo: string | undefined;
    if (acao === "recusar") {
      motivo = window.prompt("Motivo da recusa (fica registrado, não é publicado):") ?? undefined;
      if (motivo === undefined) return;
    }
    setOcupado(id);
    try {
      await moderar(senha, acao, id, motivo);
      setPendentes((p) => p.filter((x) => x.id !== id));
      setMsg(acao === "aprovar" ? "Relato aprovado e publicado." : "Relato recusado; a foto foi apagada.");
    } catch {
      setMsg("Não foi possível concluir. Recarregue a fila.");
    } finally {
      setOcupado(null);
    }
  }

  if (!logado) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-xl font-semibold text-gray-900">Moderação — Missão Patrimônio</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            carregar();
          }}
          className="mt-6 space-y-3"
        >
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha de moderação"
            aria-label="Senha de moderação"
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <button type="submit" disabled={!senha} className="w-full rounded-lg bg-[#C8102E] py-2 font-semibold text-white disabled:opacity-50">
            Entrar
          </button>
          {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Fila de moderação ({pendentes.length})</h1>
        <button type="button" onClick={() => carregar()} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
          Recarregar
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Recuse foto com rosto identificável, placa de veículo, conteúdo ofensivo ou que não mostre a obra.
      </p>
      {msg && <p role="status" className="mt-3 rounded-lg bg-gray-100 p-3 text-sm">{msg}</p>}

      {pendentes.length === 0 ? (
        <p className="mt-8 text-gray-500">Nenhum relato pendente.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {pendentes.map((v) => {
            const s = SITUACOES.find((x) => x.valor === v.situacao);
            return (
              <li key={v.id} className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-[220px_1fr]">
                {v.foto_url ? (
                  <a href={v.foto_url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.foto_url} alt="Foto enviada" className="h-44 w-full rounded-lg object-cover" />
                  </a>
                ) : (
                  <div className="flex h-44 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">sem foto</div>
                )}
                <div className="text-sm text-gray-800">
                  <p className="text-xs text-gray-500">{new Date(v.criado_em).toLocaleString("pt-BR")}</p>
                  <p className="mt-1 font-semibold">{v.local_nome}</p>
                  <p className="mt-1">{s?.icone} {s?.rotulo}</p>
                  {v.comentario && <p className="mt-1 whitespace-pre-line">{v.comentario}</p>}
                  <p className="mt-2 text-xs text-gray-600">
                    {v.nome} · {v.email}
                    {v.latitude != null && v.longitude != null && (
                      <>
                        {" · "}
                        <a
                          className="text-blue-700 hover:underline"
                          href={`https://www.openstreetmap.org/?mlat=${v.latitude}&mlon=${v.longitude}#map=18/${v.latitude}/${v.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ver onde a pessoa estava ↗
                        </a>
                      </>
                    )}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={ocupado === v.id}
                      onClick={() => decidir(v.id, "aprovar")}
                      className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                    >
                      Aprovar e publicar
                    </button>
                    <button
                      type="button"
                      disabled={ocupado === v.id}
                      onClick={() => decidir(v.id, "recusar")}
                      className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 disabled:opacity-50"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
