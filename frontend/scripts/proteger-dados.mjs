// Protege os dados sensíveis do build ANTES de publicar.
//
// O portal é site estático (GitHub Pages, sem servidor). Uma senha só na tela
// não protege nada — os JSON ficariam baixáveis pela URL. Aqui, ao final do
// `next build`, ciframos (AES-256-GCM, chave derivada da senha via PBKDF2) os
// arquivos com nomes de pessoas/empresas e REMOVEMOS o texto puro do build.
// O navegador só decifra com a senha que o cidadão digita no portão.
//
// Público (sem nomes, fica em texto puro para a landing): stats.json, meta.json.
// Protegido: contratos, alertas, servidores (cruzamentos), emendas, explicacoes.
//
// Contrato de bytes (idêntico ao lib/cripto.ts do front): base64( salt[16] |
// iv[12] | tag[16] | ciphertext ), PBKDF2-HMAC-SHA256 150k iterações, AES-256-GCM.
//
// A senha vem de PORTAL_SENHA (secret no CI / env local). Se faltar, o script
// FALHA de propósito — assim um build mal configurado nunca publica texto puro.

import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { pbkdf2Sync, randomBytes, createCipheriv } from "node:crypto";
import { join } from "node:path";

const SENHA = process.env.PORTAL_SENHA;
const DIR = join(process.cwd(), "out", "data");
const SENSIVEIS = ["contratos", "alertas", "servidores", "emendas", "explicacoes"];
const ITER = 150_000;
const SENTINELA_TEXTO = "TRANSPARENCIA10_OK";

// Há dado sensível neste build? (Numa clonagem da comunidade, sem coletar
// dados, não há — então o passo é um no-op e o build de contribuição funciona.)
const temDadoSensivel = SENSIVEIS.some((n) => existsSync(join(DIR, `${n}.json`)));

if (!temDadoSensivel) {
  console.log(
    "[proteger] nenhum dado sensível no build (out/data) — nada a cifrar. " +
    "Rode o coletor para gerar os dados. Pulando."
  );
  process.exit(0);
}

if (!SENHA) {
  // Só falha quando HÁ dado a proteger e falta a senha — nunca publica texto puro.
  console.error(
    "[proteger] ERRO: há dados sensíveis no build mas PORTAL_SENHA não está " +
    "definida. Abortando para NÃO publicar texto puro. Defina o secret/env."
  );
  process.exit(1);
}

function cifrar(texto) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(SENHA, salt, ITER, 32, "sha256");
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([salt, iv, tag, ct]).toString("base64");
}

// Sentinela: o portão decifra este arquivo para validar a senha rapidamente.
writeFileSync(join(DIR, "sentinela.enc"), cifrar(SENTINELA_TEXTO));

let protegidos = 0;
for (const nome of SENSIVEIS) {
  const puro = join(DIR, `${nome}.json`);
  if (!existsSync(puro)) {
    console.warn(`[proteger] aviso: ${nome}.json não encontrado no build`);
    continue;
  }
  const texto = readFileSync(puro, "utf8");
  writeFileSync(join(DIR, `${nome}.json.enc`), cifrar(texto));
  rmSync(puro); // remove o texto puro do artefato publicado
  protegidos += 1;
  console.log(`[proteger] ${nome}.json → ${nome}.json.enc (${texto.length} bytes) · texto puro removido`);
}

console.log(`[proteger] concluído: ${protegidos} arquivo(s) cifrado(s); stats.json e meta.json permanecem públicos.`);
