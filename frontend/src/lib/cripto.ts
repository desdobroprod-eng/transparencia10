// Decifra, no navegador, os dados protegidos pelo build (scripts/proteger-dados.mjs).
// Usa Web Crypto (SubtleCrypto) — nativo, sem dependência externa.
//
// Contrato de bytes (idêntico ao script de build):
//   base64( salt[16] | iv[12] | tag[16] | ciphertext )
//   PBKDF2-HMAC-SHA256, 150k iterações → chave AES-256-GCM.

const ITER = 150_000;

function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function derivarChave(senha: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(senha) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITER, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

/**
 * Decifra um blob base64 produzido pelo build. Lança se a senha estiver errada
 * (a verificação de integridade do GCM falha) ou o conteúdo estiver corrompido.
 */
export async function decifrar(b64: string, senha: string): Promise<string> {
  const raw = base64ParaBytes(b64);
  const salt = raw.slice(0, 16);
  const iv = raw.slice(16, 28);
  const tag = raw.slice(28, 44);
  const ct = raw.slice(44);
  const chave = await derivarChave(senha, salt);
  // Web Crypto espera ciphertext COM o tag anexado ao final.
  const ctComTag = new Uint8Array(ct.length + tag.length);
  ctComTag.set(ct);
  ctComTag.set(tag, ct.length);
  const puro = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    chave,
    ctComTag as BufferSource,
  );
  return new TextDecoder().decode(puro);
}

/**
 * Testa se a senha está correta decifrando a sentinela. Não lança — retorna bool.
 */
export async function senhaConfere(senha: string, base: string): Promise<boolean> {
  try {
    const r = await fetch(`${base}/sentinela.enc`, { cache: "no-store" });
    if (!r.ok) return false;
    const texto = await decifrar(await r.text(), senha);
    return texto === "TRANSPARENCIA10_OK";
  } catch {
    return false;
  }
}
