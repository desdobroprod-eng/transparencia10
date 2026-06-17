"""
Consulta de sanções — CEIS e CNEP — via API do Portal da Transparência Federal (CGU).

Fonte NACIONAL única de empresas sancionadas/punidas (qualquer esfera):
  - CEIS: Cadastro de Empresas Inidôneas e Suspensas
  - CNEP: Cadastro Nacional de Empresas Punidas (Lei Anticorrupção)

Exige chave gratuita (cadastro por e-mail):
  https://api.portaldatransparencia.gov.br/api-de-dados/cadastrar-email
Token vai no header `chave-api-dados`. Defina em PORTAL_TRANSPARENCIA_API_KEY.

Sem a chave, as funções retornam {"disponivel": False} e o pipeline segue
normalmente (não bloqueante).
"""

import os
import json
from pathlib import Path

import httpx

_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados"
_DIR_CACHE = Path(__file__).resolve().parent / ".cache"
_DIR_CACHE.mkdir(exist_ok=True)
_CACHE = _DIR_CACHE / "sancoes.json"

_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
_TOKEN = os.environ.get("PORTAL_TRANSPARENCIA_API_KEY", "").strip()
_SLEEP = 0.18  # CGU recomenda <= ~10 req/s
_MAX_TENT = 3

_cache: dict = {}
if _CACHE.exists():
    try:
        _cache = json.loads(_CACHE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        _cache = {}


def tem_chave() -> bool:
    return bool(_TOKEN)


def persistir_cache() -> None:
    _CACHE.write_text(json.dumps(_cache, ensure_ascii=False), encoding="utf-8")


async def _consulta(client: httpx.AsyncClient, caminho: str, cnpj: str) -> list:
    """Consulta um endpoint (ceis|cnep) por CNPJ. Retorna lista de registros."""
    import asyncio
    url = f"{_BASE}/{caminho}"
    for tent in range(1, _MAX_TENT + 1):
        try:
            r = await client.get(
                url,
                params={"cnpjSancionado": cnpj, "pagina": 1},
                headers={"chave-api-dados": _TOKEN, "User-Agent": _UA, "Accept": "application/json"},
                timeout=30,
            )
            if r.status_code == 429:
                await asyncio.sleep(1.0 * tent)
                continue
            if r.status_code in (401, 403):
                return []  # chave inválida/sem permissão — trata como sem sanção
            if r.status_code == 204 or not r.content:
                return []
            r.raise_for_status()
            dados = r.json()
            return dados if isinstance(dados, list) else []
        except (httpx.HTTPError, ValueError):
            if tent >= _MAX_TENT:
                return []
            await asyncio.sleep(0.6 * tent)
    return []


async def verificar_sancao(client: httpx.AsyncClient, cnpj: str) -> dict:
    """
    Retorna {"sancionada": bool, "fontes": ["CEIS"/"CNEP"], "detalhes": [...]}.
    Sem chave → {"disponivel": False, "sancionada": False}.
    """
    cnpj = "".join(filter(str.isdigit, cnpj or ""))
    if not _TOKEN:
        return {"disponivel": False, "sancionada": False}
    if len(cnpj) != 14:
        return {"disponivel": True, "sancionada": False}
    if cnpj in _cache:
        return _cache[cnpj]

    import asyncio
    ceis = await _consulta(client, "ceis", cnpj)
    await asyncio.sleep(_SLEEP)
    cnep = await _consulta(client, "cnep", cnpj)
    await asyncio.sleep(_SLEEP)

    fontes = []
    if ceis:
        fontes.append("CEIS")
    if cnep:
        fontes.append("CNEP")

    def _resumo(reg: dict, fonte: str) -> dict:
        sanc = reg.get("sancao") or {}
        return {
            "fonte": fonte,
            "tipo": sanc.get("tipoSancao") or sanc.get("descricaoResumida") or "",
            "orgao": (reg.get("orgaoSancionador") or {}).get("nome") or "",
            "data_inicio": sanc.get("dataInicioSancao") or "",
            "data_fim": sanc.get("dataFimSancao") or "",
        }

    detalhes = [_resumo(r, "CEIS") for r in ceis[:3]] + [_resumo(r, "CNEP") for r in cnep[:3]]
    info = {
        "disponivel": True,
        "sancionada": bool(fontes),
        "fontes": fontes,
        "detalhes": detalhes,
    }
    _cache[cnpj] = info
    return info
