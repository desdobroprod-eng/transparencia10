"""
Atos de pessoal (nomeação / exoneração) do Diário Oficial de São Luís
via API pública do Querido Diário (api.queridodiario.ok.org.br).

Padrões encontrados nos diários reais:
  "NOMEAÇÃO DE FULANO DE TAL"       ← título do ato
  "EXONERAÇÃO DE FULANO DE TAL"     ← título do ato
  "Nomear FULANO DE TAL,"           ← corpo do decreto
  "Exonerar FULANO DE TAL,"         ← corpo do decreto

Retorna dict:
  {nome_normalizado: {
      "situacao":    "ativo" | "exonerado",
      "ultima_data": "YYYY-MM-DD",
      "atos":        [{"tipo", "data", "trecho"}],   # até 3 mais recentes
      "fonte":       "Diário Oficial São Luís (Querido Diário)",
  }}
"""

import asyncio
import json
import re
import unicodedata
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import httpx

QD_API     = "https://api.queridodiario.ok.org.br/gazettes"
SAO_LUIS_ID = "2111300"

_CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "diario_servidores.json"

# Padrão 1: "NOMEAÇÃO DE NOME" ou "EXONERAÇÃO DE NOME" (título em maiúsculas)
_RE_TITULO = re.compile(
    r'\b(NOMEAÇÃO|EXONERAÇÃO)\s+DE\s+'
    r'([A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ]{2,}(?:\s+(?:DE|DA|DO|DOS|DAS|E)\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ]{2,})?'
    r'(?:\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ]{2,}){0,5})'
)

# Padrão 2: "Nomear/Exonerar NOME," (corpo do decreto, misto)
_RE_CORPO = re.compile(
    r'\b(Nomear|Exonerar|Nomeia|Exonera)\s+'
    r'([A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ]{2,}(?:\s+(?:de|da|do|dos|das|e|DE|DA|DO|DOS|DAS|E)\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ]{2,})?'
    r'(?:\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ]{2,}){0,5})'
    r'[\s,;]'
)

_TIPO = {
    "NOMEAÇÃO": "nomeacao",   "Nomear": "nomeacao",  "Nomeia": "nomeacao",
    "EXONERAÇÃO": "exoneracao", "Exonerar": "exoneracao", "Exonera": "exoneracao",
}


def _norm(txt: str) -> str:
    if not txt:
        return ""
    t = unicodedata.normalize("NFKD", txt)
    t = "".join(c for c in t if not unicodedata.combining(c))
    return " ".join(t.upper().split())


def _extrair_atos(trecho: str) -> list[tuple[str, str]]:
    """Retorna lista de (tipo, nome_normalizado) encontrados no trecho."""
    atos = []
    for m in _RE_TITULO.finditer(trecho):
        tipo = _TIPO.get(m.group(1), "nomeacao")
        nome = _norm(m.group(2).strip())
        if nome and len(nome.split()) >= 2:
            atos.append((tipo, nome))
    for m in _RE_CORPO.finditer(trecho):
        tipo = _TIPO.get(m.group(1), "nomeacao")
        nome = _norm(m.group(2).strip())
        if nome and len(nome.split()) >= 2:
            atos.append((tipo, nome))
    return atos


async def coletar_atos_pessoal(anos: int = 2) -> dict:
    """
    Coleta atos de pessoal dos últimos `anos` anos no DOM de São Luís.
    Retorna dict {nome_norm: {...}}.
    """
    desde = (date.today() - timedelta(days=anos * 365)).strftime("%Y-%m-%d")

    queries = [
        "nomeação cargo comissionado",
        "exoneração cargo comissionado",
        "nomear servidor",
        "exonerar servidor",
    ]

    atos_por_nome: dict[str, list[dict]] = {}

    async with httpx.AsyncClient(verify=False, timeout=30) as client:
        for query in queries:
            offset = 0
            for _ in range(10):          # máx 200 diários por query
                params = {
                    "territory_ids":    SAO_LUIS_ID,
                    "querystring":      query,
                    "published_since":  desde,
                    "sort_by":          "descending_date",
                    "number_of_excerpts": 5,
                    "excerpt_size":     800,
                    "size":             20,
                    "offset":           offset,
                }
                try:
                    r = await client.get(QD_API, params=params, timeout=30)
                    if r.status_code != 200:
                        break
                    payload  = r.json()
                    gazettes = payload.get("gazettes", [])
                    if not gazettes:
                        break

                    for gazette in gazettes:
                        data_pub = gazette.get("date", "")
                        for excerpt in gazette.get("excerpts", []):
                            for tipo, nome in _extrair_atos(excerpt):
                                if nome not in atos_por_nome:
                                    atos_por_nome[nome] = []
                                atos_por_nome[nome].append({
                                    "tipo":  tipo,
                                    "data":  data_pub,
                                    "trecho": excerpt[:200].strip(),
                                })

                    total  = payload.get("total_gazettes", 0)
                    offset += 20
                    if offset >= min(total, 200):
                        break
                    await asyncio.sleep(0.4)

                except (httpx.HTTPError, ValueError, KeyError):
                    break

    # Situação = ato mais recente por nome
    resultado: dict = {}
    for nome, atos in atos_por_nome.items():
        atos_ord = sorted(atos, key=lambda x: x.get("data", ""), reverse=True)
        ultimo   = atos_ord[0]
        situacao = "exonerado" if ultimo["tipo"] == "exoneracao" else "ativo"
        resultado[nome] = {
            "situacao":    situacao,
            "ultima_data": ultimo["data"],
            "atos":        atos_ord[:3],
            "fonte":       "Diário Oficial São Luís (Querido Diário)",
        }

    return resultado


def verificar_situacao_servidor(nome: str, base_qd: dict) -> dict:
    """
    Verifica situação de um servidor na base QD.
    Retorna {"situacao_qd", "fonte_qd": bool, "ultima_data_qd"}.
    """
    nome_n = _norm(nome)
    if nome_n in base_qd:
        dado = base_qd[nome_n]
        return {
            "situacao_qd":    dado["situacao"],
            "fonte_qd":       True,
            "ultima_data_qd": dado.get("ultima_data", ""),
        }
    return {"situacao_qd": None, "fonte_qd": False, "ultima_data_qd": ""}


def carregar_cache() -> dict:
    if _CACHE_PATH.exists():
        try:
            data = json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) and data else {}
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def salvar_cache(dados: dict) -> None:
    _CACHE_PATH.parent.mkdir(exist_ok=True)
    _CACHE_PATH.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
