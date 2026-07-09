"""
Execução orçamentária real do Estado do Maranhão com a função Cultura,
via API pública do Portal da Transparência do MA (sem chave).

O Estado quase não publica contratos sob o CNPJ da SECMA no PNCP — o gasto
de cultura flui sobretudo pela SECMA (UG 140101) e pelo Fundo de
Desenvolvimento da Cultura Maranhense — FUNDECMA (UG 140901), via empenhos.
Somar os empenhos dessas unidades dá uma medida muito mais fiel do desembolso
estadual em cultura do que a soma de contratos do PNCP.

Endpoint: GET https://transparencia.ma.gov.br/api/consulta-notas?ano=&codigo_ug=
"""

import asyncio
from datetime import datetime
from typing import Optional

import httpx

API_NOTAS = "https://transparencia.ma.gov.br/api/consulta-notas"
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)

# Unidades gestoras da área de Cultura no Estado
UGS_CULTURA = {
    "140101": "Secretaria de Estado da Cultura (SECMA)",
    "140901": "Fundo de Desenvolvimento da Cultura Maranhense (FUNDECMA)",
}


def _valor(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


async def coletar_execucao_cultura_estado(anos: Optional[list] = None) -> dict:
    """
    Retorna {total_empenhado, por_ano:{ano:valor}, por_ug:{ug:valor}, fonte}.
    Soma o valor líquido dos empenhos (tipo_documento 'E') das UGs de cultura.
    """
    ano_atual = datetime.now().year
    anos = anos or list(range(2024, ano_atual + 1))

    total = 0.0
    por_ano: dict[str, float] = {}
    por_ug: dict[str, float] = {}

    # verify=False: o portal MA usa cadeia de certificado self-signed que o
    # httpx rejeita; curl/browsers aceitam. Dado público e somente leitura.
    # timeout curto (15s): o portal responde em <5s no Brasil; em runners do
    # GitHub (IP EUA bloqueado) queremos falhar rápido, não esperar 40s×6.
    _falhas_conexao = 0
    _abortar = False
    async with httpx.AsyncClient(timeout=15, headers={"User-Agent": _UA}, verify=False) as client:
        for ano in anos:
            if _abortar:
                break
            for ug, _nome in UGS_CULTURA.items():
                try:
                    r = await client.get(
                        API_NOTAS, params={"ano": ano, "codigo_ug": ug}
                    )
                    if r.status_code != 200 or not r.content:
                        continue
                    notas = r.json()
                except (httpx.TimeoutException, httpx.ConnectError):
                    # Falha de conexão: portal provavelmente inalcançável (IP
                    # fora do Brasil). Após 2 seguidas, desiste do host.
                    _falhas_conexao += 1
                    if _falhas_conexao >= 2:
                        print("[NOTAS-MA] portal inalcançável — abortando "
                              "execução do Estado (valor anterior preservado)")
                        _abortar = True
                        break
                    continue
                except (httpx.HTTPError, ValueError):
                    continue
                if not isinstance(notas, list):
                    continue
                _falhas_conexao = 0  # sucesso zera o contador
                # Empenhos (tipo 'E') — valor líquido (reforços positivos,
                # anulações negativas) reflete o comprometido no exercício.
                sub = sum(
                    _valor(n.get("valor_documento"))
                    for n in notas
                    if n.get("tipo_documento") == "E"
                )
                if sub:
                    total += sub
                    por_ano[str(ano)] = por_ano.get(str(ano), 0.0) + sub
                    por_ug[ug] = por_ug.get(ug, 0.0) + sub
                await asyncio.sleep(0.2)

    return {
        "total_empenhado": round(total, 2),
        "por_ano": {k: round(v, 2) for k, v in por_ano.items()},
        "por_ug": {k: round(v, 2) for k, v in por_ug.items()},
        "fonte": "Portal da Transparência MA — empenhos (SECMA 140101 + FUNDECMA 140901)",
    }
