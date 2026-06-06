"""
Coletores de dados públicos — APIs Gov.br
Fontes: Portal Transparência, SICONFI, PNCP, CNPJ Federal

Inclui integração com coletores históricos (4 anos) e coleta completa PNCP.
"""
import httpx
import asyncio
from datetime import datetime
from typing import Optional

# Importa coletores históricos e especializados
from collectors.historical import coletar_historico_4_anos
from collectors.pncp_full import coletar_tudo_cnpj
from collectors.siconfi_full import coletar_rreo_todos_entes

BASE_URLS = {
    "transparencia": "https://api.portaldatransparencia.gov.br/api-de-dados",
    "pncp": "https://pncp.gov.br/api/pncp/v1",
    "cnpj": "https://publica.cnpj.ws/cnpj",
    "siconfi": "https://apidatalake.tesouro.gov.br/ords/siconfi/tt",
    "ceis": "https://api.portaldatransparencia.gov.br/api-de-dados/ceis",
    "cnep": "https://api.portaldatransparencia.gov.br/api-de-dados/cnep",
}

# Códigos IBGE dos entes monitorados
ENTES_ALVO = {
    "maranhao_estado": {"codigo": "21", "tipo": "estado", "nome": "Secretaria de Cultura MA"},
    "sao_luis": {"codigo": "2111300", "tipo": "municipio", "nome": "Sec. Cultura São Luís"},
    "sao_jose_ribamar": {"codigo": "2110856", "tipo": "municipio", "nome": "Sec. Cultura S.J. Ribamar"},
    "paco_lumiar": {"codigo": "2107704", "tipo": "municipio", "nome": "Sec. Cultura Paço do Lumiar"},
}

# Palavras-chave para filtrar contratos de cultura
KEYWORDS_CULTURA = [
    "cultura", "cultural", "arte", "artístico", "festival", "teatro",
    "música", "dança", "patrimônio", "museu", "biblioteca", "show",
    "evento cultural", "secretaria de cultura"
]


async def fetch_contratos_pncp(codigo_ibge: str, ano: int = None) -> list[dict]:
    """Busca contratos no PNCP por ente federativo."""
    ano = ano or datetime.now().year
    url = f"{BASE_URLS['pncp']}/contratos"
    params = {
        "codigoMunicipioIbge": codigo_ibge,
        "dataInicial": f"{ano}0101",
        "dataFinal": f"{ano}1231",
        "pagina": 1,
        "tamanhoPagina": 500,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", [])


async def fetch_rreo_municipio(codigo_ibge: str, ano: int = None, periodo: int = 1) -> dict:
    """Busca Relatório Resumido de Execução Orçamentária via SICONFI."""
    ano = ano or datetime.now().year
    url = f"{BASE_URLS['siconfi']}/rreo"
    params = {
        "an_exercicio": ano,
        "nr_periodo": periodo,
        "co_tipo_demonstrativo": "RREO",
        "no_anexo": "RREO-Anexo 02",
        "co_uf": "MA",
        "id_ente": codigo_ibge,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params)
        if resp.status_code == 200:
            return resp.json()
        return {}


async def fetch_cnpj_info(cnpj: str) -> dict:
    """Consulta dados de fornecedor por CNPJ (dado público)."""
    cnpj_limpo = "".join(filter(str.isdigit, cnpj))
    url = f"{BASE_URLS['cnpj']}/{cnpj_limpo}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        if resp.status_code == 200:
            return resp.json()
        return {}


async def fetch_empresa_sancionada(cnpj: str) -> bool:
    """Verifica se CNPJ consta no CEIS ou CNEP (lista negra federal)."""
    import os
    cnpj_limpo = "".join(filter(str.isdigit, cnpj))
    # Header obrigatório para Portal da Transparência (CGU)
    headers = {}
    api_key = os.getenv("PORTAL_TRANSPARENCIA_API_KEY")
    if api_key:
        headers["chave-api"] = api_key
    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        for lista in ["ceis", "cnep"]:
            url = BASE_URLS[lista]
            resp = await client.get(url, params={"cnpjSancionado": cnpj_limpo, "pagina": 1})
            if resp.status_code == 401:
                # Sem chave API — pulando verificação de sanção
                return False
            if resp.status_code == 200:
                data = resp.json()
                if data.get("data") and len(data["data"]) > 0:
                    return True
    return False


def filtrar_contratos_cultura(contratos: list[dict]) -> list[dict]:
    """Filtra contratos relacionados à área de cultura pelo objeto."""
    resultado = []
    for c in contratos:
        objeto = (c.get("objetoContrato") or "").lower()
        unidade = (c.get("nomeUnidadeOrgao") or "").lower()
        if any(kw in objeto or kw in unidade for kw in KEYWORDS_CULTURA):
            resultado.append(c)
    return resultado


async def coletar_completo_todos_entes() -> dict:
    """
    Coleta histórica completa (4 anos) + tempo real para todos os entes.
    Combina:
        - Histórico PNCP (2021 até hoje) via historical.py
        - RREO/SICONFI (função Cultura) via siconfi_full.py
        - Coleta tempo real (ano corrente) via fetch_contratos_pncp

    Retorna dicionário unificado com dados históricos e em tempo real.
    """
    print("\n" + "=" * 70)
    print("[COLETA COMPLETA] Iniciando coleta histórica 4 anos + tempo real")
    print("=" * 70 + "\n")

    resultado = {
        "historico_pncp": {},
        "rreo_cultura": {},
        "tempo_real": {},
        "meta": {
            "iniciado_em": datetime.utcnow().isoformat(),
            "entes": list(ENTES_ALVO.keys()),
        },
    }

    # 1. Coleta histórica PNCP por ente (2021 até hoje)
    print("\n[FASE 1] Coleta histórica PNCP (2021 → hoje)")
    for chave, ente in ENTES_ALVO.items():
        print(f"\n  → {ente['nome']} (IBGE={ente['codigo']})")
        try:
            historico = await coletar_historico_4_anos(
                codigo_ibge=ente["codigo"],
                tipo_ente=ente["tipo"],
            )
            total = sum(len(v) for v in historico.values())
            resultado["historico_pncp"][chave] = {
                "ente": ente["nome"],
                "dados_por_ano": historico,
                "total_contratos": total,
            }
        except Exception as e:
            print(f"[ERRO] Falha no histórico PNCP para {chave}: {e}")
            resultado["historico_pncp"][chave] = {"erro": str(e)}

    # 2. Coleta RREO/SICONFI — gastos com cultura
    print("\n[FASE 2] Coleta RREO/SICONFI — função Cultura (2021 → hoje)")
    try:
        rreo = await coletar_rreo_todos_entes()
        resultado["rreo_cultura"] = rreo
    except Exception as e:
        print(f"[ERRO] Falha na coleta RREO: {e}")
        resultado["rreo_cultura"] = {"erro": str(e)}

    # 3. Coleta em tempo real (ano corrente — igual ao coletar_todos_entes)
    print("\n[FASE 3] Coleta tempo real (ano corrente)")
    tempo_real = await coletar_todos_entes()
    resultado["tempo_real"] = tempo_real

    resultado["meta"]["concluido_em"] = datetime.utcnow().isoformat()

    total_historico = sum(
        v.get("total_contratos", 0)
        for v in resultado["historico_pncp"].values()
        if isinstance(v, dict)
    )
    print(f"\n[COLETA COMPLETA] Concluída — {total_historico} contratos históricos coletados")

    return resultado


async def coletar_todos_entes() -> dict:
    """Coleta contratos de todos os entes alvo em paralelo."""
    tasks = {}
    for chave, ente in ENTES_ALVO.items():
        tasks[chave] = fetch_contratos_pncp(ente["codigo"])

    resultados = await asyncio.gather(*tasks.values(), return_exceptions=True)
    saida = {}
    for chave, resultado in zip(tasks.keys(), resultados):
        if isinstance(resultado, Exception):
            saida[chave] = {"erro": str(resultado), "contratos": []}
        else:
            contratos_cultura = filtrar_contratos_cultura(resultado)
            saida[chave] = {
                "total_coletado": len(resultado),
                "total_cultura": len(contratos_cultura),
                "contratos": contratos_cultura,
                "coletado_em": datetime.utcnow().isoformat(),
            }
    return saida
