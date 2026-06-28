"""
Emendas parlamentares destinadas à Cultura — Portal da Transparência do Maranhão.

Fonte (export CSV oficial, sem necessidade de chave):
  - Estaduais: https://transparencia.ma.gov.br/app/v2/emendasestaduais/export?formato=csv
  - Federais:  https://transparencia.ma.gov.br/app/v2/emendasfederais/export?ano=YYYY&formato=csv

Gotchas verificados ao vivo (2026-06):
  - O parâmetro `ano` do export ESTADUAL é IGNORADO — sempre retorna o dataset
    corrente (exercício vigente). Buscar uma única vez.
  - O export FEDERAL respeita `ano`. Emendas federais classificadas como Cultura
    para o MA são raríssimas (≈1), mas coletamos por completude.
  - Filtra-se por coluna `Função == "Cultura"` (não por palavra-chave, que
    pegaria "Agricultura"/"Pecuária").
  - Certificado self-signed no portal MA → httpx precisa de verify=False.
  - Valores vêm como "250000" (estadual) ou "R$ 5.000.000,00" (federal).

Esfera estadual traz `Código Favorecido` (CNPJ) e `Entidade Beneficiada` —
permite cruzar a emenda com a empresa contratada (mesmo CNPJ).
"""

import asyncio
import csv
import io
import re
from datetime import datetime, timezone
from typing import Optional

import httpx

_BASE = "https://transparencia.ma.gov.br/app/v2"
_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
_TIMEOUT = 60.0
_MAX_TENT = 3


def _brl_para_float(valor: str) -> float:
    """Converte '250000', 'R$ 5.000.000,00' ou '1.234,56' em float."""
    if not valor:
        return 0.0
    s = re.sub(r"[^\d,.\-]", "", str(valor))
    if not s:
        return 0.0
    # Formato BR: ponto = milhar, vírgula = decimal.
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    # Sem vírgula: pode ter ponto de milhar ("5.000.000") ou ser inteiro puro.
    elif s.count(".") > 1:
        s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _so_digitos(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _cnpj_no_texto(*textos: str) -> str:
    """Extrai o primeiro CNPJ (14 díg.) embutido em texto livre, se houver."""
    for t in textos:
        if not t:
            continue
        m = re.search(r"\b(\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2})\b", t)
        if m:
            d = _so_digitos(m.group(1))
            if len(d) == 14:
                return d
    return ""


def _eh_cultura(funcao: str, nome_ug: str) -> bool:
    f = (funcao or "").strip().lower()
    ug = (nome_ug or "").strip().lower()
    if f == "cultura":
        return True
    # "agricultura" contém "cultura" — exclui explicitamente o falso positivo.
    if "agricultura" in ug:
        return False
    return "cultura" in ug


async def _baixar_csv(client: httpx.AsyncClient, url: str) -> Optional[str]:
    for tent in range(1, _MAX_TENT + 1):
        try:
            r = await client.get(url, headers={"User-Agent": _UA, "Accept": "text/csv"})
            if r.status_code == 200 and "csv" in r.headers.get("content-type", ""):
                return r.text
            print(f"[EMENDAS] {url} → HTTP {r.status_code} (tent {tent})")
        except (httpx.HTTPError, httpx.TimeoutException) as e:
            print(f"[EMENDAS] erro {type(e).__name__} em {url} (tent {tent})")
        await asyncio.sleep(1.0 * tent)
    return None


def _ler_csv(texto: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(texto)))


def _normaliza_estadual(linha: dict) -> dict:
    cnpj_fav = _so_digitos(linha.get("Código Favorecido", ""))
    if len(cnpj_fav) != 14:
        cnpj_fav = _cnpj_no_texto(
            linha.get("Entidade Beneficiada", ""), linha.get("Objeto", "")
        )
    return {
        "esfera": "estadual",
        "id": (linha.get("Número Emenda") or linha.get("Solicitação") or "").strip(),
        "ano": (linha.get("Exercício") or "").strip(),
        "parlamentar": (linha.get("Parlamentar") or "").strip(),
        "tipo": (linha.get("Tipo") or "").strip(),
        "unidade": (linha.get("Nome UG") or "").strip(),
        "objeto": (linha.get("Objeto") or "").strip(),
        "beneficiada": (linha.get("Entidade Beneficiada") or "").strip(),
        "cnpj_favorecido": cnpj_fav,
        "funcao": (linha.get("Função") or "").strip(),
        "subfuncao": (linha.get("Subfunção") or "").strip(),
        "valor_empenhado": _brl_para_float(linha.get("Valor Empenhado", "")),
        "valor_liquidado": _brl_para_float(linha.get("Valor Liquidado", "")),
        "valor_pago": _brl_para_float(linha.get("Valor Pago", "")),
        "fonte": f"{_BASE}/emendasestaduais",
    }


def _normaliza_federal(linha: dict) -> dict:
    return {
        "esfera": "federal",
        "id": (linha.get("Código da Emenda") or "").strip(),
        "ano": (linha.get("Ano") or "").strip(),
        "parlamentar": (linha.get("Autor") or "").strip(),
        "tipo": (linha.get("Tipo de Emenda") or "").strip(),
        "unidade": (linha.get("Localidade") or "").strip(),
        "objeto": "",
        "beneficiada": "",
        "cnpj_favorecido": "",
        "funcao": (linha.get("Função") or "").strip(),
        "subfuncao": (linha.get("Subfunção") or "").strip(),
        "valor_empenhado": _brl_para_float(linha.get("Valor Empenhado", "")),
        "valor_liquidado": _brl_para_float(linha.get("Valor Liquidado", "")),
        "valor_pago": _brl_para_float(linha.get("Valor Pago", "")),
        "detalhe_url": (linha.get("Detalhamento") or "").strip(),
        "fonte": f"{_BASE}/emendasfederais",
    }


async def coletar_emendas_cultura(
    anos_federais: tuple[int, ...] = (2024, 2025, 2026),
) -> dict:
    """Coleta emendas de Cultura (estaduais + federais MA). Não-bloqueante."""
    emendas: list[dict] = []
    async with httpx.AsyncClient(verify=False, timeout=_TIMEOUT, follow_redirects=True) as client:
        # ── Estaduais (dataset único; ano ignorado pelo portal) ────────────
        url_est = f"{_BASE}/emendasestaduais/export?limite=99999&formato=csv"
        txt = await _baixar_csv(client, url_est)
        if txt:
            linhas = _ler_csv(txt)
            cult = [_normaliza_estadual(x) for x in linhas if _eh_cultura(x.get("Função"), x.get("Nome UG"))]
            emendas.extend(cult)
            print(f"[EMENDAS] estaduais: {len(cult)} de cultura (de {len(linhas)})")

        # ── Federais (respeita ano; cultura é rara mas coletamos) ──────────
        vistos: set[str] = set()
        for ano in anos_federais:
            url_fed = f"{_BASE}/emendasfederais/export?ano={ano}&limite=99999&formato=csv"
            txt = await _baixar_csv(client, url_fed)
            if not txt:
                continue
            linhas = _ler_csv(txt)
            n = 0
            for x in linhas:
                if (x.get("Função") or "").strip().lower() != "cultura":
                    continue
                rec = _normaliza_federal(x)
                chave = rec["id"] or f"{rec['parlamentar']}-{rec['ano']}-{rec['valor_empenhado']}"
                if chave in vistos:
                    continue
                vistos.add(chave)
                emendas.append(rec)
                n += 1
            print(f"[EMENDAS] federais {ano}: {n} de cultura (de {len(linhas)})")

    total_emp = sum(e["valor_empenhado"] for e in emendas)
    total_pago = sum(e["valor_pago"] for e in emendas)
    com_cnpj = sum(1 for e in emendas if e["cnpj_favorecido"])
    stats = {
        "total": len(emendas),
        "estaduais": sum(1 for e in emendas if e["esfera"] == "estadual"),
        "federais": sum(1 for e in emendas if e["esfera"] == "federal"),
        "com_cnpj_favorecido": com_cnpj,
        "valor_empenhado": round(total_emp, 2),
        "valor_pago": round(total_pago, 2),
        "atualizado_em": datetime.now(timezone.utc).isoformat(),
    }
    return {"emendas": emendas, "stats": stats}


if __name__ == "__main__":
    import json

    dados = asyncio.run(coletar_emendas_cultura())
    print(json.dumps(dados["stats"], ensure_ascii=False, indent=2))
    if dados["emendas"]:
        print("amostra:", json.dumps(dados["emendas"][0], ensure_ascii=False, indent=2))
