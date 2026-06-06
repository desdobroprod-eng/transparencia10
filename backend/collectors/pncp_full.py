"""
Coletor completo PNCP — contratos, atas de registro de preço e editais.
Normaliza todos os campos para modelo padrão do Transparencia10.
"""
import asyncio
from datetime import datetime
from typing import Optional
import httpx

BASE_URL = "https://pncp.gov.br/api/pncp/v1"
TAMANHO_PAGINA = 500
SLEEP_ENTRE_REQUESTS = 0.3
MAX_TENTATIVAS = 3
BACKOFF_BASE = 1.0


def _normalizar_contrato(raw: dict, ente: str, fonte: str = "pncp") -> dict:
    """
    Normaliza um contrato bruto do PNCP para o modelo padrão do Transparencia10.

    Modelo padrão:
        id, cnpjFornecedor, nomeFornecedor, objetoContrato, valorInicial,
        dataAssinatura, modalidadeNome, unidadeOrgao, ente, fonte, coletado_em
    """
    # Tenta extrair CNPJ de diferentes campos possíveis
    cnpj_fornecedor = (
        raw.get("cpfCnpjFornecedor")
        or raw.get("cnpjFornecedor")
        or raw.get("fornecedorCpfCnpj")
        or ""
    )

    # Nome do fornecedor — campos alternativos
    nome_fornecedor = (
        raw.get("nomeFornecedor")
        or raw.get("razaoSocialFornecedor")
        or raw.get("fornecedorNome")
        or ""
    )

    # Valor do contrato — campos alternativos
    valor_inicial = (
        raw.get("valorInicial")
        or raw.get("valorGlobal")
        or raw.get("valorEstimado")
        or 0.0
    )

    # Data de assinatura — tenta vários campos
    data_assinatura = (
        raw.get("dataAssinatura")
        or raw.get("dataPublicacaoPncp")
        or raw.get("dataVigenciaInicio")
        or ""
    )

    # Modalidade
    modalidade_nome = (
        raw.get("modalidadeNome")
        or raw.get("modalidade", {}).get("nome", "")
        if isinstance(raw.get("modalidade"), dict)
        else raw.get("modalidadeNome", "")
    )

    # Unidade do órgão
    unidade_orgao = (
        raw.get("nomeUnidadeOrgao")
        or raw.get("unidadeOrgao", {}).get("nome", "")
        if isinstance(raw.get("unidadeOrgao"), dict)
        else raw.get("nomeUnidadeOrgao", "")
    )

    # ID único: usa número de controle PNCP se disponível
    id_contrato = (
        raw.get("numeroControlePNCP")
        or raw.get("numeroContratolEstabelecido")
        or raw.get("id")
        or ""
    )

    return {
        "id": str(id_contrato),
        "cnpjFornecedor": cnpj_fornecedor,
        "nomeFornecedor": nome_fornecedor,
        "objetoContrato": raw.get("objetoContrato") or raw.get("objeto") or "",
        "valorInicial": float(valor_inicial) if valor_inicial else 0.0,
        "dataAssinatura": data_assinatura,
        "modalidadeNome": modalidade_nome,
        "unidadeOrgao": unidade_orgao,
        "ente": ente,
        "fonte": fonte,
        "coletado_em": datetime.utcnow().isoformat(),
        "_raw": raw,  # Preserva original para auditoria
    }


async def _fetch_com_retry(
    client: httpx.AsyncClient,
    url: str,
    params: dict,
    tentativa: int = 1,
) -> Optional[dict]:
    """Executa request com retry e backoff exponencial."""
    try:
        resp = await client.get(url, params=params)

        if resp.status_code in (429, 500, 502, 503, 504):
            if tentativa <= MAX_TENTATIVAS:
                espera = BACKOFF_BASE * (2 ** (tentativa - 1))
                print(f"[RETRY] {resp.status_code} em {url} — aguardando {espera:.1f}s")
                await asyncio.sleep(espera)
                return await _fetch_com_retry(client, url, params, tentativa + 1)
            print(f"[ERRO] Falha definitiva em {url}: status {resp.status_code}")
            return None

        resp.raise_for_status()
        return resp.json()

    except httpx.TimeoutException:
        if tentativa <= MAX_TENTATIVAS:
            espera = BACKOFF_BASE * (2 ** (tentativa - 1))
            print(f"[RETRY] Timeout em {url} — aguardando {espera:.1f}s")
            await asyncio.sleep(espera)
            return await _fetch_com_retry(client, url, params, tentativa + 1)
        print(f"[ERRO] Timeout definitivo em {url}")
        return None

    except httpx.HTTPError as e:
        print(f"[ERRO] HTTP error em {url}: {e}")
        return None


async def _paginar_endpoint(
    client: httpx.AsyncClient,
    url: str,
    params_base: dict,
    ente: str,
    tipo: str,
) -> list[dict]:
    """
    Itera por todas as páginas de um endpoint PNCP e normaliza os resultados.
    """
    todos = []
    pagina = 1

    while True:
        params = {**params_base, "pagina": pagina, "tamanhoPagina": TAMANHO_PAGINA}
        dados = await _fetch_com_retry(client, url, params)

        if dados is None:
            print(f"[AVISO] Falha na página {pagina} de {tipo} para {ente}")
            break

        itens = dados.get("data", [])
        total_paginas = dados.get("totalPaginas", 1)
        total_registros = dados.get("totalRegistros", 0)

        normalizados = [_normalizar_contrato(item, ente, fonte=f"pncp_{tipo}") for item in itens]
        todos.extend(normalizados)

        print(
            f"[PNCP {tipo.upper()}] {ente} — "
            f"pág {pagina}/{total_paginas} — "
            f"{len(todos)}/{total_registros}"
        )

        if pagina >= total_paginas or len(itens) == 0:
            break

        pagina += 1
        await asyncio.sleep(SLEEP_ENTRE_REQUESTS)

    return todos


async def coletar_contratos_cnpj(
    cnpj: str,
    ente: str,
    ano: int = None,
) -> list[dict]:
    """
    Coleta contratos de um órgão pelo CNPJ via endpoint PNCP dedicado.
    Endpoint: GET /orgaos/{cnpj}/contratos
    """
    ano = ano or datetime.now().year
    cnpj_limpo = "".join(filter(str.isdigit, cnpj))
    url = f"{BASE_URL}/orgaos/{cnpj_limpo}/contratos"

    params_base = {
        "dataInicial": f"{ano}0101",
        "dataFinal": f"{ano}1231",
    }

    print(f"\n[PNCP] Coletando contratos CNPJ={cnpj_limpo} ente={ente} ano={ano}")

    async with httpx.AsyncClient(timeout=30) as client:
        return await _paginar_endpoint(client, url, params_base, ente, "contratos")


async def coletar_atas_cnpj(
    cnpj: str,
    ente: str,
    ano: int = None,
) -> list[dict]:
    """
    Coleta atas de registro de preço de um órgão pelo CNPJ.
    Endpoint: GET /orgaos/{cnpj}/atas
    """
    ano = ano or datetime.now().year
    cnpj_limpo = "".join(filter(str.isdigit, cnpj))
    url = f"{BASE_URL}/orgaos/{cnpj_limpo}/atas"

    params_base = {
        "dataInicial": f"{ano}0101",
        "dataFinal": f"{ano}1231",
    }

    print(f"\n[PNCP] Coletando atas CNPJ={cnpj_limpo} ente={ente} ano={ano}")

    async with httpx.AsyncClient(timeout=30) as client:
        return await _paginar_endpoint(client, url, params_base, ente, "atas")


async def coletar_editais_cnpj(
    cnpj: str,
    ente: str,
    ano: int = None,
) -> list[dict]:
    """
    Coleta editais (compras/licitações) de um órgão pelo CNPJ.
    Endpoint: GET /orgaos/{cnpj}/compras
    """
    ano = ano or datetime.now().year
    cnpj_limpo = "".join(filter(str.isdigit, cnpj))
    url = f"{BASE_URL}/orgaos/{cnpj_limpo}/compras"

    params_base = {
        "dataInicial": f"{ano}0101",
        "dataFinal": f"{ano}1231",
    }

    print(f"\n[PNCP] Coletando editais CNPJ={cnpj_limpo} ente={ente} ano={ano}")

    async with httpx.AsyncClient(timeout=30) as client:
        return await _paginar_endpoint(client, url, params_base, ente, "editais")


async def coletar_tudo_cnpj(
    cnpj: str,
    ente: str,
    ano: int = None,
) -> dict:
    """
    Coleta completa: contratos + atas + editais para um CNPJ de órgão.
    Retorna dicionário com os três tipos.
    """
    ano = ano or datetime.now().year

    print(f"\n{'='*60}")
    print(f"[PNCP FULL] Coleta completa CNPJ={cnpj} ente={ente} ano={ano}")
    print(f"{'='*60}")

    # Coleta sequencial para respeitar rate limiting
    contratos = await coletar_contratos_cnpj(cnpj, ente, ano)
    await asyncio.sleep(SLEEP_ENTRE_REQUESTS)

    atas = await coletar_atas_cnpj(cnpj, ente, ano)
    await asyncio.sleep(SLEEP_ENTRE_REQUESTS)

    editais = await coletar_editais_cnpj(cnpj, ente, ano)

    total = len(contratos) + len(atas) + len(editais)
    print(f"\n[PNCP FULL] Concluído — contratos={len(contratos)}, atas={len(atas)}, editais={len(editais)}, total={total}")

    return {
        "contratos": contratos,
        "atas": atas,
        "editais": editais,
        "meta": {
            "cnpj": cnpj,
            "ente": ente,
            "ano": ano,
            "total": total,
            "coletado_em": datetime.utcnow().isoformat(),
        },
    }
