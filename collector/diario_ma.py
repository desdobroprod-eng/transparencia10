"""
⚠️ STATUS (2026-06-17): NÃO LIGADO ao coletor — não cobre os municípios-alvo.
Testado: (1) a busca `caxPesquisa` do FAMEM é IGNORADA pelo servidor (qualquer
termo retorna a mesma lista genérica recente); (2) São Luís, Raposa, São José de
Ribamar, Paço do Lumiar e Pinheiro NÃO publicam no FAMEM — usam diários próprios
(Grande Ilha). Logo, este módulo retorna 0 nomes para os entes monitorados.
Mantido como cliente reutilizável para municípios-MEMBROS do FAMEM (interior do
MA), caso o portal seja expandido. Para os municípios atuais, o caminho é
per-portal ou Querido Diário (este último com API+OCR, mas protegido por
Cloudflare contra scripts).

Servidores MUNICIPAIS via Diário Oficial dos Municípios do MA (FAMEM/siganet).

Não existe API federal nem estadual de servidores municipais. O FAMEM publica o
diário oficial de TODOS os municípios do Maranhão num único portal (siganet), com
busca de publicações em JSON e categoria própria "Portaria de Nomeação".

Endpoints descobertos (sem chave):
  POST /dom/dom/pesquisaPublicacoes/   (DataTables, JSON)
       params: caxPesquisa, caxDtInicio, caxDtFim (dd/mm/aaaa)
       retorna data[]: {TDC_ID, TDC_TITULO, TDCT_DESCRICAO, PUBLICACAO_DONO(município), TDO_DT_GERACAO,...}
  GET  /dom/dom/publicacoesDetalhes/{TDC_ID}   (HTML com texto completo da matéria)

Estratégia: para cada município, busca portarias de NOMEAÇÃO no período, baixa o
texto e extrai os nomes nomeados (best-effort). Esses nomes alimentam o MESMO
cruzamento condicional sócio×servidor (linguagem "a apurar").

LIMITAÇÃO HONESTA: extração de nome a partir de texto livre é aproximada (NER
simples por regex). Pode ter falsos positivos/negativos — por isso todo match
permanece como "indício a verificar", nunca acusação.
"""

import asyncio
import json
import re
import unicodedata
from pathlib import Path

import httpx

_BASE = "http://diariooficial.famem.org.br/dom/dom"
_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"

_DIR_CACHE = Path(__file__).resolve().parent / ".cache"
_DIR_CACHE.mkdir(exist_ok=True)
_CACHE = _DIR_CACHE / "diario_servidores.json"

# Nome da "Prefeitura Municipal de X" como aparece em PUBLICACAO_DONO (FAMEM).
DONO_POR_ENTE = {
    "sao_luis": "São Luís",
    "raposa": "Raposa",
    "sao_jose_ribamar": "São José de Ribamar",
    "paco_lumiar": "Paço do Lumiar",
    "pinheiro": "Pinheiro",
}

_MAX_MATERIAS = 200       # teto de portarias baixadas por município (bound)
_SLEEP = 0.25

# Verbos/marcadores de nomeação no texto da portaria
_RE_NOME = re.compile(
    r"(?:nomear|nomead[oa]|nomea[çc][aã]o de|fica nomead[oa]|"
    r"sr\.?\(?a?\)?\.?|senhor[a]?)\s+"
    r"([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]+(?:\s+(?:d[aeo]s?|e)\s+|\s+)"
    r"(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]+\s*){1,4})",
    re.IGNORECASE,
)


def _norm(s: str) -> str:
    t = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in t if not unicodedata.combining(c)).upper().strip()


_cache: dict = {}
if _CACHE.exists():
    try:
        _cache = json.loads(_CACHE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        _cache = {}


def persistir_cache() -> None:
    _CACHE.write_text(json.dumps(_cache, ensure_ascii=False), encoding="utf-8")


def _limpar_nome(n: str) -> str:
    n = re.sub(r"\s+", " ", n).strip(" ,.;:-")
    # corta em palavras de parada comuns
    for stop in (" PARA", " NO CARGO", " PORTADOR", " CPF", " INSCRIT", " BRASILEIR", " OCUPAR", " RG"):
        i = _norm(n).find(stop)
        if i > 0:
            n = n[:i]
    return n.strip(" ,.;:-")


def _extrair_nomes(texto: str) -> list[str]:
    nomes = set()
    for m in _RE_NOME.finditer(texto):
        cand = _limpar_nome(m.group(1))
        toks = cand.split()
        # nome plausível: 3 a 6 tokens, todos alfabéticos
        if 3 <= len(toks) <= 6 and all(re.match(r"^[A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]+$", t) for t in toks):
            nomes.add(cand.upper())
    return sorted(nomes)


async def _buscar(client: httpx.AsyncClient, termo: str, dt_ini: str, dt_fim: str) -> list[dict]:
    try:
        r = await client.post(
            f"{_BASE}/pesquisaPublicacoes/",
            data={"caxPesquisa": termo, "caxDtInicio": dt_ini, "caxDtFim": dt_fim},
            headers={"X-Requested-With": "XMLHttpRequest", "User-Agent": _UA},
            timeout=40,
        )
        if r.status_code != 200 or not r.content:
            return []
        return (r.json() or {}).get("data", [])
    except (httpx.HTTPError, ValueError):
        return []


async def _detalhe_texto(client: httpx.AsyncClient, tdc_id: str) -> str:
    try:
        r = await client.get(f"{_BASE}/publicacoesDetalhes/{tdc_id}", headers={"User-Agent": _UA}, timeout=30)
        if r.status_code != 200:
            return ""
        t = re.sub(r"<script.*?</script>", " ", r.text, flags=re.S)
        t = re.sub(r"<[^>]+>", " ", t)
        return re.sub(r"\s+", " ", t)
    except httpx.HTTPError:
        return ""


async def coletar_servidores_municipais(entes: list[str], anos: list[int]) -> dict:
    """
    Retorna {chave_ente: [nomes...]} de servidores nomeados, extraídos das
    portarias de nomeação do diário (FAMEM), por município.
    """
    dt_ini = f"01/01/{min(anos)}"
    dt_fim = f"31/12/{max(anos)}"
    resultado: dict[str, list] = {}

    async with httpx.AsyncClient() as client:
        for chave in entes:
            dono = DONO_POR_ENTE.get(chave)
            if not dono:
                continue
            ckey = f"{chave}|{dt_ini}|{dt_fim}"
            if ckey in _cache:
                resultado[chave] = _cache[ckey]
                print(f"  [DIÁRIO/cache] {dono}: {len(_cache[ckey])} nomes")
                continue

            # Busca portarias de nomeação do município
            materias = await _buscar(client, f"nomeação {dono}", dt_ini, dt_fim)
            await asyncio.sleep(_SLEEP)
            dono_norm = _norm(dono)
            alvo = [
                m for m in materias
                if dono_norm in _norm(m.get("PUBLICACAO_DONO", ""))
                and "NOMEA" in _norm(m.get("TDC_TITULO", "") + " " + m.get("TDCT_DESCRICAO", ""))
            ]
            capou = len(alvo) > _MAX_MATERIAS
            alvo = alvo[:_MAX_MATERIAS]
            print(f"  [DIÁRIO] {dono}: {len(alvo)} portarias de nomeação"
                  + (f" (TETO {_MAX_MATERIAS} — há mais, truncado)" if capou else ""))

            nomes = set()
            for i, m in enumerate(alvo, 1):
                txt = await _detalhe_texto(client, m.get("TDC_ID"))
                for n in _extrair_nomes(txt):
                    nomes.add(n)
                await asyncio.sleep(_SLEEP)
                if i % 25 == 0:
                    print(f"    ... {i}/{len(alvo)} | {len(nomes)} nomes")

            resultado[chave] = sorted(nomes)
            _cache[ckey] = resultado[chave]
            persistir_cache()
            print(f"  [DIÁRIO] {dono}: {len(nomes)} nomes de servidores extraídos")

    return resultado
