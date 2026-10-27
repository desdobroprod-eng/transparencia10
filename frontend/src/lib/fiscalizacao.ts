// Piloto de fiscalização cidadã — acesso ao Supabase do portal.
// A chave publicável é pública por desenho: as regras de acesso (RLS) no banco
// só deixam o visitante ENVIAR visitas pendentes e LER as aprovadas.
// Ver supabase/migrations/20261027_piloto_fiscalizacao_cidada.sql.

import type { Contrato } from "@/hooks/useDados";

export const SUPABASE_URL = "https://lnjtrjrfnhpdfempfxjy.supabase.co";
export const SUPABASE_CHAVE = "sb_publishable_vBOcu7A1Id6y-wr0qTmMCQ_DKYigqgy";

const H = { apikey: SUPABASE_CHAVE, Authorization: `Bearer ${SUPABASE_CHAVE}` };

export type Situacao = "em_andamento" | "concluida" | "parada" | "nao_encontrada" | "outro";

export const SITUACOES: { valor: Situacao; rotulo: string; icone: string }[] = [
  { valor: "em_andamento", rotulo: "Obra em andamento", icone: "🏗️" },
  { valor: "concluida", rotulo: "Obra concluída", icone: "✅" },
  { valor: "parada", rotulo: "Obra parada", icone: "⏸️" },
  { valor: "nao_encontrada", rotulo: "Não encontrei a obra", icone: "❓" },
  { valor: "outro", rotulo: "Outra situação", icone: "📝" },
];

export interface VisitaAprovada {
  id: string;
  criado_em: string;
  local_id: string;
  local_nome: string;
  situacao: Situacao;
  comentario: string;
  autor: string;
  foto_publica: string | null;
}

export interface Missao {
  id: string;            // id do contrato no PNCP
  numero: number;
  titulo: string;
  contrato: Contrato;
  raridade: "Lendária" | "Épica" | "Rara" | "Comum";
}

// Obra física de patrimônio, que dá para visitar. Fica de fora o que não
// tem lugar para conferir (elaboração de projeto, shows, compras, locação).
const OBRA = /\b(obras?|reforma|restaura\w*|requalifica\w*|revitaliza\w*|constru[çc][ãa]o|amplia[çc][ãa]o|recupera[çc][ãa]o|manuten[çc][ãa]o predial)\b/i;
const NAO_VISITAVEL = /\b(elabora[çc][ãa]o de projetos?|show|apresenta[çc][ãa]o art|atra[çc][ãa]o|loca[çc][ãa]o de ve|combust)/i;

function raridade(valor: number): Missao["raridade"] {
  if (valor >= 10_000_000) return "Lendária";
  if (valor >= 1_000_000) return "Épica";
  if (valor >= 100_000) return "Rara";
  return "Comum";
}

// Nome curto da obra a partir do objeto do contrato.
function tituloCurto(objeto: string): string {
  const t = objeto.replace(/\s+/g, " ").trim();
  const m = t.match(/(mercado central|museu[^,.;]{0,40}|pr[ée]dio hist[óo]rico[^,.;]{0,50}|fachadas?[^,.;]{0,50}|centro hist[óo]rico[^,.;]{0,30}|im[óo]vel[^,.;]{0,50}|bens m[óo]veis[^,.;]{0,40}|logradouros[^,.;]{0,40}|casar[ãa]o[^,.;]{0,40}|edifica[çc][õo]es?[^,.;]{0,40})/i);
  const base = m ? m[0] : t.slice(0, 60);
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function selecionarMissoes(contratos: Contrato[]): Missao[] {
  return contratos
    .filter((c) => OBRA.test(c.objeto || "") && !NAO_VISITAVEL.test(c.objeto || ""))
    .sort((a, b) => (b.valor || 0) - (a.valor || 0))
    .map((c, i) => ({
      id: c.id,
      numero: i + 1,
      titulo: tituloCurto(c.objeto || ""),
      contrato: c,
      raridade: raridade(c.valor || 0),
    }));
}

export async function buscarAprovadas(): Promise<VisitaAprovada[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/visitas_aprovadas`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    return r.ok ? r.json() : [];
  } catch {
    return [];
  }
}

export function urlFotoPublica(nome: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/publicadas/${nome}`;
}

// Reduz a foto no navegador (celular gera arquivos de 5–15 MB) para JPEG
// com no máximo 1600 px — fica abaixo do limite de 5 MB do armazenamento.
export async function reduzirFoto(arquivo: File): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = erro;
      i.src = url;
    });
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, erro) =>
      canvas.toBlob((b) => (b ? ok(b) : erro(new Error("foto"))), "image/jpeg", 0.82),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface NovaVisita {
  missao: Missao;
  situacao: Situacao;
  comentario: string;
  nome: string;
  email: string;
  foto: Blob | null;
  latitude: number | null;
  longitude: number | null;
}

export async function enviarVisita(v: NovaVisita): Promise<void> {
  let foto_envio: string | null = null;
  if (v.foto) {
    foto_envio = `${crypto.randomUUID()}.jpg`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/envios/${foto_envio}`, {
      method: "POST",
      headers: { ...H, "Content-Type": "image/jpeg" },
      body: v.foto,
    });
    if (!up.ok) throw new Error("Não foi possível enviar a foto.");
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/visitas`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      local_id: v.missao.id,
      local_nome: v.missao.titulo,
      situacao: v.situacao,
      comentario: v.comentario.trim(),
      nome: v.nome.trim(),
      email: v.email.trim(),
      foto_envio,
      latitude: v.latitude,
      longitude: v.longitude,
      consentimento: true,
    }),
  });
  if (!r.ok) throw new Error("Não foi possível registrar a visita. Confira os campos e tente de novo.");
}

// ── Moderação ────────────────────────────────────────────────────────────────
export interface Pendente {
  id: string;
  criado_em: string;
  local_id: string;
  local_nome: string;
  situacao: Situacao;
  comentario: string;
  nome: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  foto_url: string | null;
}

export async function moderar(
  senha: string,
  acao: "listar" | "aprovar" | "recusar",
  id?: string,
  motivo?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/moderacao`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senha, acao, id, motivo }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error("senha");
  if (!r.ok) throw new Error(corpo.erro || "erro");
  return corpo;
}
