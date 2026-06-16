"""
Coletor histórico — coleta contratos dos últimos 4 anos via PNCP.
Suporta paginação completa, rate limiting e retry com backoff exponencial.
"""
import asyncio
import json
import os
import time
from datetime import datetime
from typing import Optional
import httpx

# Caminho base para cache local
CACHE_DIR = "/tmp"

# Configurações de retry — o PNCP aplica rate limit (HTTP 429) agressivo,
# então usamos backoff longo, mais tentativas e pausa generosa entre chamadas.
MAX_TENTATIVAS = 6
BACKOFF_BASE = 3.0  # segundos
SLEEP_ENTRE_REQUESTS = 1.5  # segundos entre requisições
TAMANHO_PAGINA = 500


def _cache_path(ente: str, ano: int) -> str:
    """Retorna o caminho do arquivo de cache para um ente/ano."""
    chave = ente.replace("/", "_").replace(" ", "_")
    return os.path.join(CACHE_DIR, f"transparencia10_cache_{chave}_{ano}.json")


def _carregar_cache(ente: str, ano: int) -> Optional[list]:
    """Carrega dados do cache local se existir. Retorna None se não houver cache."""
    caminho = _cache_path(ente, ano)
    if os.path.exists(caminho):
        try:
            with open(caminho, "r", encoding="utf-8") as f:
                dados = json.load(f)
            print(f"[CACHE] Carregado cache para {ente}/{ano}: {len(dados)} contratos")
            return dados
        except (json.JSONDecodeError, IOError) as e:
            print(f"[CACHE] Erro ao carregar cache {caminho}: {e}")
    return None


def _salvar_cache(ente: str, ano: int, dados: list) -> None:
    """Salva dados no cache local para evitar reprocessamento."""
    caminho = _cache_path(ente, ano)
    try:
        with open(caminho, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        print(f"[CACHE] Salvo cache para {ente}/{ano}: {len(dados)} contratos em {caminho}")
    except IOError as e:
        print(f"[CACHE] Erro ao salvar cache {caminho}: {e}")


async def _fetch_pagina_com_retry(
    client: httpx.AsyncClient,
    url: str,
    params: dict,
    tentativa: int = 1,
) -> Optional[dict]:
    """
    Faz request com retry e backoff exponencial.
    Retorna o JSON ou None em caso de falha definitiva.
    """
    try:
        resp = await client.get(url, params=params)

        if resp.status_code in (429, 500, 502, 503, 504):
            if tentativa <= MAX_TENTATIVAS:
                espera = BACKOFF_BASE * (2 ** (tentativa - 1))
                # Honra o header Retry-After quando presente (429)
                retry_after = resp.headers.get("Retry-After")
                if retry_after and retry_after.isdigit():
                    espera = max(espera, float(retry_after))
                print(
                    f"[RETRY] Status {resp.status_code} — aguardando {espera:.1f}s "
                    f"(tentativa {tentativa}/{MAX_TENTATIVAS})"
                )
                await asyncio.sleep(espera)
                return await _fetch_pagina_com_retry(client, url, params, tentativa + 1)
            else:
                print(f"[ERRO] Falha definitiva após {MAX_TENTATIVAS} tentativas: {resp.status_code}")
                return None

        # 204 = sem contratos para o filtro/ano (resposta sem corpo)
        if resp.status_code == 204:
            return {"data": [], "totalPaginas": 0, "totalRegistros": 0}

        resp.raise_for_status()
        if not resp.content:
            return {"data": [], "totalPaginas": 0, "totalRegistros": 0}
        return resp.json()

    except httpx.TimeoutException as e:
        if tentativa <= MAX_TENTATIVAS:
            espera = BACKOFF_BASE * (2 ** (tentativa - 1))
            print(f"[RETRY] Timeout — aguardando {espera:.1f}s (tentativa {tentativa}/{MAX_TENTATIVAS})")
            await asyncio.sleep(espera)
            return await _fetch_pagina_com_retry(client, url, params, tentativa + 1)
        print(f"[ERRO] Timeout definitivo após {MAX_TENTATIVAS} tentativas: {e}")
        return None

    except httpx.HTTPError as e:
        print(f"[ERRO] HTTP error: {e}")
        return None


async def _coletar_contratos_ano(
    cnpj_orgao: str,
    tipo_ente: str,
    ano: int,
) -> list[dict]:
    """
    Coleta todos os contratos de um órgão (por CNPJ) para um ano específico,
    iterando por todas as páginas disponíveis.

    IMPORTANTE: o endpoint /consulta/v1/contratos do PNCP NÃO filtra por
    `codigoMunicipioIbge` nem por `codigoUnidadeFederacao` quando usado com
    intervalo de datas — esses parâmetros são ignorados e a API devolve
    contratos do Brasil inteiro. O único filtro confiável é `cnpjOrgao`
    (CNPJ do órgão/ente contratante). Por isso a coleta é feita por CNPJ.
    """
    chave_ente = f"{tipo_ente}_{cnpj_orgao}"

    # Verifica cache antes de fazer requests
    cache = _carregar_cache(chave_ente, ano)
    if cache is not None:
        return cache

    url = "https://pncp.gov.br/api/consulta/v1/contratos"
    todos_contratos = []
    pagina = 1

    print(f"[COLETA] Iniciando {tipo_ente} CNPJ={cnpj_orgao} ano={ano}")

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            params = {
                "dataInicial": f"{ano}0101",
                "dataFinal": f"{ano}1231",
                "cnpjOrgao": cnpj_orgao,
                "pagina": pagina,
                "tamanhoPagina": TAMANHO_PAGINA,
            }

            dados = await _fetch_pagina_com_retry(client, url, params)

            if dados is None:
                print(f"[AVISO] Falha na página {pagina} para {chave_ente}/{ano} — abortando coleta do ano")
                break

            itens = dados.get("data", [])
            total_paginas = dados.get("totalPaginas", 1)
            total_registros = dados.get("totalRegistros", 0)

            todos_contratos.extend(itens)

            print(
                f"[PROGRESSO] {chave_ente}/{ano} — "
                f"pág {pagina}/{total_paginas} — "
                f"{len(todos_contratos)}/{total_registros} contratos"
            )

            # Verifica se há mais páginas
            if pagina >= total_paginas or len(itens) == 0:
                break

            pagina += 1

            # Rate limiting entre páginas
            await asyncio.sleep(SLEEP_ENTRE_REQUESTS)

    print(f"[CONCLUÍDO] {chave_ente}/{ano}: {len(todos_contratos)} contratos coletados")

    # Salva no cache local para não reprocessar
    if todos_contratos:
        _salvar_cache(chave_ente, ano, todos_contratos)

    return todos_contratos


async def coletar_historico_4_anos(
    cnpj_orgao: str,
    tipo_ente: str,
) -> dict[str, list[dict]]:
    """
    Coleta contratos do PNCP de 2021 até o ano atual para um órgão (por CNPJ).

    Parâmetros:
        cnpj_orgao: CNPJ do órgão contratante (ex: "06307102000130" São Luís)
        tipo_ente: "municipio" ou "estado"

    Retorna dicionário {ano: [contratos]}
    """
    ano_atual = datetime.now().year
    anos = list(range(2024, ano_atual + 1))

    print(f"\n{'='*60}")
    print(f"[HISTÓRICO] Iniciando coleta para {tipo_ente} CNPJ={cnpj_orgao}")
    print(f"[HISTÓRICO] Anos: {anos}")
    print(f"{'='*60}\n")

    resultado = {}

    for ano in anos:
        try:
            contratos = await _coletar_contratos_ano(cnpj_orgao, tipo_ente, ano)
            resultado[str(ano)] = contratos
            # Pausa entre anos para não sobrecarregar a API
            await asyncio.sleep(SLEEP_ENTRE_REQUESTS)
        except Exception as e:
            print(f"[ERRO] Falha ao coletar {cnpj_orgao}/{ano}: {e}")
            resultado[str(ano)] = []

    total_geral = sum(len(v) for v in resultado.values())
    print(f"\n[HISTÓRICO] Coleta concluída — Total geral: {total_geral} contratos")

    return resultado
