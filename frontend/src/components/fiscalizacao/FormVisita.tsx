"use client";

import { useState } from "react";
import { SITUACOES, enviarVisita, reduzirFoto, type Missao, type Situacao } from "@/lib/fiscalizacao";

export default function FormVisita({
  missao,
  onFechar,
  onEnviado,
}: {
  missao: Missao;
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [comentario, setComentario] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const valido = situacao && nome.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && consentimento;

  function escolherFoto(f: File | null) {
    setFoto(f);
    if (previa) URL.revokeObjectURL(previa);
    setPrevia(f ? URL.createObjectURL(f) : null);
  }

  function pegarLocalizacao() {
    if (!navigator.geolocation) return setGeoMsg("Seu navegador não informa localização.");
    setGeoMsg("Obtendo localização…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoMsg("Localização registrada.");
      },
      () => setGeoMsg("Não foi possível obter a localização (permissão negada?)."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || enviando || !situacao) return;
    setEnviando(true);
    setErro("");
    try {
      await enviarVisita({
        missao,
        situacao,
        comentario,
        nome,
        email,
        foto: foto ? await reduzirFoto(foto) : null,
        latitude: geo?.lat ?? null,
        longitude: geo?.lng ?? null,
      });
      onEnviado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-form-visita"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
    >
      <form
        onSubmit={enviar}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[#11131a] p-5 text-[#F7F3EC] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E2B100]">
              Missão {String(missao.numero).padStart(2, "0")} · registrar visita
            </p>
            <h2 id="titulo-form-visita" className="mt-1 text-lg font-semibold leading-snug">
              {missao.titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-md px-2 py-1 text-xl leading-none text-[#F7F3EC]/60 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">O que você encontrou?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SITUACOES.map((s) => (
              <button
                key={s.valor}
                type="button"
                aria-pressed={situacao === s.valor}
                onClick={() => setSituacao(s.valor)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E2B100] ${
                  situacao === s.valor
                    ? "border-[#E2B100] bg-[#E2B100]/15 text-white"
                    : "border-white/15 bg-white/5 text-[#F7F3EC]/85 hover:border-white/40"
                }`}
              >
                <span aria-hidden className="text-lg">{s.icone}</span>
                {s.rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-5 block text-sm font-semibold">
          Foto da obra <span className="font-normal text-[#F7F3EC]/50">(recomendada)</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => escolherFoto(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-[#F7F3EC]/80 file:mr-3 file:rounded-lg file:border-0 file:bg-[#C8102E] file:px-3 file:py-2 file:font-semibold file:text-white"
          />
        </label>
        {previa && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previa} alt="Prévia da foto escolhida" className="mt-2 max-h-48 rounded-lg object-cover" />
        )}
        <p className="mt-1 text-xs text-[#F7F3EC]/55">
          Fotografe a obra, não as pessoas. Evite rostos e placas de veículos.
        </p>

        <label className="mt-5 block text-sm font-semibold">
          Comentário
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value.slice(0, 1500))}
            rows={3}
            placeholder="Ex.: obra com tapume, sem trabalhadores no local."
            className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/35 focus:border-[#E2B100] focus:outline-none"
          />
        </label>

        <div className="mt-4">
          <button
            type="button"
            onClick={pegarLocalizacao}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:border-white/50"
          >
            📍 Registrar minha localização (opcional)
          </button>
          {geoMsg && <p className="mt-1 text-xs text-[#F7F3EC]/60" role="status">{geoMsg}</p>}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Seu nome
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value.slice(0, 120))}
              autoComplete="name"
              className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#E2B100] focus:outline-none"
            />
          </label>
          <label className="block text-sm font-semibold">
            Seu e-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 200))}
              autoComplete="email"
              className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#E2B100] focus:outline-none"
            />
          </label>
        </div>

        <label className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-[#F7F3EC]/75">
          <input
            type="checkbox"
            checked={consentimento}
            onChange={(e) => setConsentimento(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#E2B100]"
          />
          <span>
            Autorizo o uso destes dados para a verificação cidadã desta obra. Guardamos nome,
            e-mail, foto, comentário e, se eu permitir, a localização. Nada é publicado antes da
            moderação; quando publicado, aparecem só a foto, a situação, o comentário e o meu
            primeiro nome — o e-mail nunca é exibido e serve apenas para contato sobre este
            relato. Posso pedir a exclusão a qualquer momento em contato@10dobroprod.com.br.
          </span>
        </label>

        {erro && <p className="mt-3 text-sm text-[#ff8a8a]" role="alert">{erro}</p>}

        <button
          type="submit"
          disabled={!valido || enviando}
          className="mt-5 w-full rounded-xl bg-[#C8102E] py-3 font-semibold text-white transition hover:bg-[#a60d26] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando ? "Enviando…" : "Enviar relato da missão"}
        </button>
      </form>
    </div>
  );
}
