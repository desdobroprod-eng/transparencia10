"""
Enriquecimento de dados — núcleo do cruzamento do Transparencia10.

Fontes públicas SEM necessidade de chave de API:

  1. BrasilAPI (espelho da Receita Federal)
     GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}
     → razão social, data de abertura, situação cadastral e QSA (sócios).
     Habilita as regras EMPRESA_NOVA e o cruzamento sócio × servidor.

  2. Portal da Transparência do Estado do Maranhão
     GET https://www.transparencia.ma.gov.br/app/v2/servidores/servidoresAjax?nomeServidor=<nome>
     → lista de servidores estaduais {nome, cpf} cujo nome contém os termos.
     É a base para detectar testa-de-ferro / nepotismo (sócio que também é
     servidor público estadual).

Tudo é cacheado em disco (collector/.cache) para que reexecuções não refaçam
as chamadas — essencial dado o volume e os limites de taxa das APIs.
"""

import asyncio
import json
import os
import unicodedata
from pathlib import Path
from typing import Optional

import httpx

_DIR_CACHE = Path(__file__).resolve().parent / ".cache"
_DIR_CACHE.mkdir(exist_ok=True)
_CACHE_CNPJ = _DIR_CACHE / "cnpj.json"
_CACHE_SERV = _DIR_CACHE / "servidores.json"

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)

BRASILAPI = "https://brasilapi.com.br/api/cnpj/v1/{cnpj}"
SERVIDORES_MA = "https://www.transparencia.ma.gov.br/app/v2/servidores/servidoresAjax"

# Throttle (segundos entre chamadas) e tentativas
_SLEEP_CNPJ = 0.7      # BrasilAPI: respeitar limite de taxa
_SLEEP_SERV = 0.3
_MAX_TENT = 3


# ── Cache em disco ─────────────────────────────────────────────────────────---

def _load(path: Path) -> dict:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


_cache_cnpj: dict = _load(_CACHE_CNPJ)
_cache_serv: dict = _load(_CACHE_SERV)


def persistir_caches() -> None:
    _save(_CACHE_CNPJ, _cache_cnpj)
    _save(_CACHE_SERV, _cache_serv)


# ── Normalização de nomes ──────────────────────────────────────────────────---

def normalizar(txt: str) -> str:
    """Maiúsculas, sem acentos, espaços colapsados."""
    if not txt:
        return ""
    t = unicodedata.normalize("NFKD", txt)
    t = "".join(c for c in t if not unicodedata.combining(c))
    return " ".join(t.upper().split())


# ── BrasilAPI: dados cadastrais + sócios ───────────────────────────────────---

async def enriquecer_cnpj(client: httpx.AsyncClient, cnpj: str) -> dict:
    """
    Retorna {razao_social, data_inicio_atividade, situacao, socios:[nome,...]}.
    Usa cache. Em falha, retorna dict vazio com a chave 'erro'.
    """
    cnpj = "".join(filter(str.isdigit, cnpj or ""))
    if len(cnpj) != 14:
        return {}
    if cnpj in _cache_cnpj:
        return _cache_cnpj[cnpj]

    url = BRASILAPI.format(cnpj=cnpj)
    for tent in range(1, _MAX_TENT + 1):
        try:
            r = await client.get(url, headers={"User-Agent": _UA}, timeout=30)
            if r.status_code == 429:
                await asyncio.sleep(2.0 * tent)
                continue
            if r.status_code == 404:
                info = {"erro": "nao_encontrado"}
                break
            r.raise_for_status()
            d = r.json()
            socios = [
                s.get("nome_socio") or s.get("nome")
                for s in (d.get("qsa") or [])
                if (s.get("nome_socio") or s.get("nome"))
            ]
            try:
                capital = float(d.get("capital_social") or 0)
            except (TypeError, ValueError):
                capital = 0.0
            info = {
                "razao_social": d.get("razao_social") or "",
                "data_inicio_atividade": d.get("data_inicio_atividade") or "",
                "situacao": d.get("descricao_situacao_cadastral")
                or d.get("situacao_cadastral") or "",
                "capital_social": capital,
                "porte": d.get("porte") or d.get("descricao_porte") or "",
                "mei": bool(d.get("opcao_pelo_mei")),
                "cnae": d.get("cnae_fiscal_descricao") or "",
                "socios": socios,
            }
            break
        except (httpx.HTTPError, ValueError) as e:
            if tent >= _MAX_TENT:
                info = {"erro": str(e)}
                break
            await asyncio.sleep(1.0 * tent)
    else:
        info = {"erro": "falha"}

    _cache_cnpj[cnpj] = info
    await asyncio.sleep(_SLEEP_CNPJ)
    return info


# ── Servidores MA: busca por nome ──────────────────────────────────────────---

async def buscar_servidores(client: httpx.AsyncClient, termo: str) -> list[dict]:
    """
    Busca servidores estaduais cujo nome contém `termo` (mín. 3 chars).
    Retorna lista de {nome, cpf}. Usa cache por termo normalizado.
    """
    termo_norm = normalizar(termo)
    if len(termo_norm) < 3:
        return []
    if termo_norm in _cache_serv:
        return _cache_serv[termo_norm]

    for tent in range(1, _MAX_TENT + 1):
        try:
            r = await client.get(
                SERVIDORES_MA,
                params={"nomeServidor": termo_norm},
                headers={"User-Agent": _UA, "X-Requested-With": "XMLHttpRequest"},
                timeout=30,
            )
            if r.status_code in (429, 500, 502, 503):
                await asyncio.sleep(1.0 * tent)
                continue
            r.raise_for_status()
            dados = r.json()
            servidores = [
                {"nome": s.get("nome") or "", "cpf": s.get("cpf") or ""}
                for s in (dados if isinstance(dados, list) else [])
                if s.get("nome")
            ]
            break
        except (httpx.HTTPError, ValueError):
            if tent >= _MAX_TENT:
                servidores = []
                break
            await asyncio.sleep(1.0 * tent)
    else:
        servidores = []

    _cache_serv[termo_norm] = servidores
    await asyncio.sleep(_SLEEP_SERV)
    return servidores
