"""
Atos de pessoal (nomeação / exoneração) do Diário Oficial de São Luís
via API pública do Querido Diário (api.queridodiario.ok.org.br).

Retorna dict:
  {nome_normalizado: {
      "situacao":   "ativo" | "exonerado",
      "ultima_data": "YYYY-MM-DD",
      "atos":       [{"tipo", "data", "trecho", "fonte"}],  # até 3 mais recentes
      "fonte":      "Diário Oficial São Luís (Querido Diário)",
      "municipio":  "São Luís — MA",
  }}

Integração no pipeline:
  1. coletar_atos_pessoal() → base de atos
  2. verificar_situacao_servidor(nome, atos) → "ativo" | "exonerado" | "desconhecido"
"""

import asyncio
import json
import re
import unicodedata
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import httpx

QD_API = "https://api.queridodiario.ok.org.br/gazettes"
SAO_LUIS_ID = "2111300"

_CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "diario_servidores.json"

# ── Palavras-chave por tipo de ato ────────────────────────────────────────────
_EXONERACAO = {"EXONERAR", "EXONERA", "EXONERADO", "EXONERADA", "EXONERAÇÃO",
               "DISPENSAR", "DISPENSA", "DISPENSADO", "DISPENSADA",
               "DEMITI", "DEMISSÃO", "VACÂNCIA", "VACANCIA"}
_NOMEACAO   = {"NOMEAR", "NOMEIA", "NOMEADO", "NOMEADA", "NOMEAÇÃO",
               "DESIGNAR", "DESIGNA", "DESIGNADO", "DESIGNADA",
               "POSSE", "EMPOSSAR", "EMPOSSADO"}

# Regex: sequência de 2-6 palavras em maiúsculas (aceita preposições curtas no meio)
_RE_NOME = re.compile(
    r'\b([A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ]{2,}'
    r'(?:\s+(?:DE|DA|DO|DOS|DAS|E)\s+)?'
    r'[A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ]{2,}'
    r'(?:\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ]{2,}){0,3})\b'
)

# Palavras de início que indicam que o match NÃO é um nome próprio
_RUIDO = {
    "PORTARIA", "DECRETO", "RESOLUÇÃO", "RESOLUCAO", "SECRETARIA",
    "PREFEITURA", "ARTIGO", "PROCESSO", "MUNICIPIO", "SERVIÇO",
    "CARGO", "FUNÇÃO", "FUNCAO", "EFETIVO", "COMISSIONADO",
}


def _norm(txt: str) -> str:
    if not txt:
        return ""
    t = unicodedata.normalize("NFKD", txt)
    t = "".join(c for c in t if not unicodedata.combining(c))
    return " ".join(t.upper().split())


def _tipo_ato(texto: str) -> Optional[str]:
    upper = texto.upper()
    if any(p in upper for p in _EXONERACAO):
        return "exoneracao"
    if any(p in upper for p in _NOMEACAO):
        return "nomeacao"
    return None


def _extrair_nomes(trecho: str) -> list[str]:
    nomes = []
    for m in _RE_NOME.finditer(trecho):
        nome = m.group(1).strip()
        partes = nome.split()
        if len(partes) < 2:
            continue
        if partes[0] in _RUIDO:
            continue
        nomes.append(nome)
    return nomes


async def coletar_atos_pessoal(anos: int = 2) -> dict:
    """
    Coleta atos de pessoal dos últimos `anos` anos no DOM de São Luís.
    Retorna dict {nome_norm: {...}}.
    """
    desde = (date.today() - timedelta(days=anos * 365)).strftime("%Y-%m-%d")

    # Buscas cobrindo os dois sentidos do ato
    queries = [
        "nomeação cargo comissionado",
        "exoneração cargo comissionado",
        "nomear servidor público",
        "exonerar servidor público",
        "nomeado portaria",
        "exonerado portaria",
    ]

    atos_por_nome: dict[str, list[dict]] = {}

    async with httpx.AsyncClient(verify=False, timeout=30) as client:
        for query in queries:
            offset = 0
            max_iter = 5  # máx 100 diários por query
            for _ in range(max_iter):
                params = {
                    "territory_ids": SAO_LUIS_ID,
                    "querystring": query,
                    "published_since": desde,
                    "sort_by": "descending_date",
                    "number_of_excerpts": 5,
                    "excerpt_size": 800,
                    "size": 20,
                    "offset": offset,
                }
                try:
                    r = await client.get(QD_API, params=params, timeout=30)
                    if r.status_code != 200:
                        break
                    payload = r.json()
                    gazettes = payload.get("gazettes", [])
                    if not gazettes:
                        break

                    for gazette in gazettes:
                        data_pub = gazette.get("date", "")
                        for excerpt in gazette.get("excerpts", []):
                            tipo = _tipo_ato(excerpt)
                            if not tipo:
                                continue
                            nomes = _extrair_nomes(excerpt)
                            for nome in nomes:
                                nome_n = _norm(nome)
                                if nome_n not in atos_por_nome:
                                    atos_por_nome[nome_n] = []
                                atos_por_nome[nome_n].append({
                                    "tipo": tipo,
                                    "data": data_pub,
                                    "trecho": excerpt[:200].strip(),
                                    "fonte": f"Diário Oficial São Luís — {data_pub}",
                                })

                    total = payload.get("total_gazettes", 0)
                    offset += 20
                    if offset >= min(total, 100):
                        break

                    await asyncio.sleep(0.4)

                except (httpx.HTTPError, ValueError, KeyError):
                    break

    # Determina situação atual: ato mais recente decide
    resultado: dict = {}
    for nome_n, atos in atos_por_nome.items():
        atos_ord = sorted(atos, key=lambda x: x.get("data", ""), reverse=True)
        ultimo = atos_ord[0]
        situacao = "exonerado" if ultimo["tipo"] == "exoneracao" else "ativo"
        resultado[nome_n] = {
            "situacao": situacao,
            "ultima_data": ultimo["data"],
            "atos": atos_ord[:3],
            "fonte": "Diário Oficial São Luís (Querido Diário)",
            "municipio": "São Luís — MA",
        }

    return resultado


def verificar_situacao_servidor(nome: str, base_qd: dict) -> dict:
    """
    Verifica a situação de um servidor na base coletada do QD.
    Retorna {"situacao": ..., "fonte_qd": bool, "ultima_data": ..., "municipio": ...}.
    """
    nome_n = _norm(nome)
    if nome_n in base_qd:
        dado = base_qd[nome_n]
        return {
            "situacao_qd": dado["situacao"],
            "fonte_qd": True,
            "ultima_data_qd": dado.get("ultima_data", ""),
            "municipio_qd": dado.get("municipio", "São Luís — MA"),
        }
    return {"situacao_qd": None, "fonte_qd": False}


def carregar_cache() -> dict:
    if _CACHE_PATH.exists():
        try:
            return json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def salvar_cache(dados: dict) -> None:
    _CACHE_PATH.parent.mkdir(exist_ok=True)
    _CACHE_PATH.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
