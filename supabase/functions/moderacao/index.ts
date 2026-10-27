// Moderação do piloto de fiscalização cidadã.
// O cidadão só consegue INSERIR visitas pendentes (RLS); ler, aprovar e recusar
// passa por aqui, com a service role, depois de conferir a senha de moderação
// contra o hash em public.moderacao_config.
//
// POST { senha, acao: "listar" | "aprovar" | "recusar", id?, motivo? }

import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGENS = [
  "https://desdobroprod-eng.github.io",
  "http://localhost:3000",
  "http://localhost:3031",
];

function cors(origem: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origem && ORIGENS.includes(origem) ? origem : ORIGENS[0],
    "Access-Control-Allow-Headers": "content-type, apikey, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response('{"erro":"metodo"}', { status: 405, headers });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let corpo: { senha?: string; acao?: string; id?: string; motivo?: string };
  try {
    corpo = await req.json();
  } catch {
    return new Response('{"erro":"json"}', { status: 400, headers });
  }

  const { data: cfg } = await db.from("moderacao_config").select("senha_hash").eq("id", 1).single();
  const hash = await sha256(corpo.senha ?? "");
  if (!cfg || !iguais(hash, cfg.senha_hash)) {
    await new Promise((r) => setTimeout(r, 800)); // freia tentativa por força bruta
    return new Response('{"erro":"senha"}', { status: 401, headers });
  }

  if (corpo.acao === "listar") {
    const { data, error } = await db
      .from("visitas")
      .select("id, criado_em, local_id, local_nome, situacao, comentario, nome, email, foto_envio, latitude, longitude")
      .eq("status", "pendente")
      .order("criado_em", { ascending: true })
      .limit(200);
    if (error) return new Response(JSON.stringify({ erro: error.message }), { status: 500, headers });
    const itens = await Promise.all(
      (data ?? []).map(async (v) => {
        let foto_url: string | null = null;
        if (v.foto_envio) {
          const { data: s } = await db.storage.from("envios").createSignedUrl(v.foto_envio, 900);
          foto_url = s?.signedUrl ?? null;
        }
        return { ...v, foto_url };
      }),
    );
    return new Response(JSON.stringify({ pendentes: itens }), { headers });
  }

  if ((corpo.acao === "aprovar" || corpo.acao === "recusar") && corpo.id) {
    const { data: v, error } = await db
      .from("visitas")
      .select("id, foto_envio, status")
      .eq("id", corpo.id)
      .single();
    if (error || !v) return new Response('{"erro":"nao_encontrada"}', { status: 404, headers });
    if (v.status !== "pendente") return new Response('{"erro":"ja_moderada"}', { status: 409, headers });

    if (corpo.acao === "aprovar") {
      let foto_publica: string | null = null;
      if (v.foto_envio) {
        const { data: arq, error: e1 } = await db.storage.from("envios").download(v.foto_envio);
        if (e1 || !arq) return new Response('{"erro":"foto"}', { status: 500, headers });
        const { error: e2 } = await db.storage
          .from("publicadas")
          .upload(v.foto_envio, arq, { contentType: arq.type || "image/jpeg", upsert: true });
        if (e2) return new Response(JSON.stringify({ erro: e2.message }), { status: 500, headers });
        await db.storage.from("envios").remove([v.foto_envio]);
        foto_publica = v.foto_envio;
      }
      await db
        .from("visitas")
        .update({ status: "aprovado", foto_publica, foto_envio: null, moderado_em: new Date().toISOString() })
        .eq("id", v.id);
      return new Response('{"ok":true}', { headers });
    }

    // Recusa: a foto é apagada (pode conter rosto, placa etc.).
    if (v.foto_envio) await db.storage.from("envios").remove([v.foto_envio]);
    await db
      .from("visitas")
      .update({
        status: "recusado",
        foto_envio: null,
        motivo_recusa: (corpo.motivo ?? "").slice(0, 300),
        moderado_em: new Date().toISOString(),
      })
      .eq("id", v.id);
    return new Response('{"ok":true}', { headers });
  }

  return new Response('{"erro":"acao"}', { status: 400, headers });
});
