"""
#10Dobro_Brain
#Ctx_Transparencia10 #Ctx_ServidoresMA #Ctx_SIAPE #Ctx_TCE_MA
---
Coletor de Servidores Públicos — Maranhão
Fontes: Portal da Transparência (SIAPE/Federal) + TCE-MA (Estadual/Municipal)

Autor: Equipe 10Dobro Prod
Criado: 2026-06-06
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx

# ---------------------------------------------------------------------------
# Configuração de logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("coletor.servidores")

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
BASE_URL_TRANSPARENCIA = "https://api.portaldatransparencia.gov.br/api-de-dados"
BASE_URL_TCE_MA = "https://www.tce.ma.gov.br/portaltransparencia/"

# Código da organização superior do Governo Federal lotados no Maranhão.
# "26000" corresponde ao Ministério da Gestão e da Inovação em Serviços Públicos
# (antigo MPOG), que agrega servidores SIAPE. Deixamos None para não filtrar
# por órgão superior e trazer todos os vínculos ativos com UF=MA.
ORG_SUPERIOR_PADRAO: Optional[str] = None

TAMANHO_PAGINA = 200          # máximo permitido pela API
SLEEP_ENTRE_PAGINAS = 0.3     # segundos — respeita rate limit da API
MAX_RETRIES = 3               # tentativas por requisição
BACKOFF_BASE = 2.0            # fator de espera exponencial (segundos)

# Preposições e artigos a remover na extração de sobrenomes
PREPOSICOES = {"de", "da", "do", "dos", "das", "e", "von", "van", "del"}

# Caminho de saída do JSON final
CAMINHO_SAIDA = Path(__file__).resolve().parents[1] / "frontend" / "public" / "data" / "servidores.json"


# ---------------------------------------------------------------------------
# Utilitários HTTP com retry
# ---------------------------------------------------------------------------

def _headers_portal() -> dict:
    """Monta headers para o Portal da Transparência.
    Usa chave de API do ambiente, se disponível.
    """
    headers = {"Accept": "application/json"}
    api_key = os.getenv("PORTAL_TRANSPARENCIA_API_KEY")
    if api_key:
        headers["chave-api"] = api_key
    return headers


async def _get_com_retry(
    client: httpx.AsyncClient,
    url: str,
    params: dict,
    tentativas: int = MAX_RETRIES,
) -> Optional[httpx.Response]:
    """
    Realiza requisição GET com retry automático em caso de 429 (rate limit)
    ou 5xx (erros de servidor), usando backoff exponencial.

    Retorna a Response em caso de sucesso, ou None após esgotar tentativas.
    """
    for tentativa in range(1, tentativas + 1):
        try:
            resp = await client.get(url, params=params)

            if resp.status_code in (429, 500, 502, 503, 504):
                espera = BACKOFF_BASE ** tentativa
                logger.warning(
                    "HTTP %s em %s — aguardando %.1fs antes de tentar novamente "
                    "(tentativa %d/%d)",
                    resp.status_code, url, espera, tentativa, tentativas,
                )
                await asyncio.sleep(espera)
                continue

            return resp

        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            espera = BACKOFF_BASE ** tentativa
            logger.warning(
                "Erro de conexão em %s: %s — aguardando %.1fs (tentativa %d/%d)",
                url, exc, espera, tentativa, tentativas,
            )
            await asyncio.sleep(espera)

    logger.error("Requisição falhou após %d tentativas: %s", tentativas, url)
    return None


# ---------------------------------------------------------------------------
# 1. fetch_servidores_siape — uma página
# ---------------------------------------------------------------------------

async def fetch_servidores_siape(
    uf: str = "MA",
    pagina: int = 1,
    org_superior: Optional[str] = ORG_SUPERIOR_PADRAO,
) -> list[dict]:
    """
    Busca uma página de servidores federais SIAPE lotados na UF informada.

    Parâmetros
    ----------
    uf          : Sigla do estado (padrão "MA" — Maranhão).
    pagina      : Número da página a buscar (começa em 1).
    org_superior: Código do órgão superior para filtrar (opcional).

    Retorna
    -------
    Lista de dicionários brutos retornados pela API do Portal da Transparência.
    Lista vazia se não houver dados ou em caso de erro irrecuperável.
    """
    url = f"{BASE_URL_TRANSPARENCIA}/servidores"
    params: dict = {
        "uf": uf,
        "pagina": pagina,
        "tamanhoPagina": TAMANHO_PAGINA,
    }
    if org_superior:
        params["orgsuperior"] = org_superior

    async with httpx.AsyncClient(headers=_headers_portal(), timeout=30) as client:
        resp = await _get_com_retry(client, url, params)

    if resp is None:
        return []

    if resp.status_code == 401:
        logger.error(
            "Acesso negado (401) à API de servidores. "
            "Verifique a variável de ambiente PORTAL_TRANSPARENCIA_API_KEY."
        )
        return []

    if resp.status_code != 200:
        logger.error("Resposta inesperada %s ao buscar página %d.", resp.status_code, pagina)
        return []

    dados = resp.json()

    # A API pode retornar uma lista direta ou um objeto com chave "data"
    if isinstance(dados, list):
        return dados
    if isinstance(dados, dict):
        return dados.get("data", dados.get("servidores", []))

    return []


# ---------------------------------------------------------------------------
# 2. fetch_servidores_siape_todos — paginação completa
# ---------------------------------------------------------------------------

async def fetch_servidores_siape_todos(uf: str = "MA") -> list[dict]:
    """
    Coleta TODAS as páginas de servidores federais SIAPE lotados na UF.

    Itera incrementando o número de página até receber resposta vazia,
    respeitando o rate limit com sleep entre páginas.

    Retorna
    -------
    Lista unificada de servidores com campos normalizados:
        {
            "nome"         : str,
            "cpf_mascarado": str,
            "orgao"        : str,
            "cargo"        : str,
            "uf"           : str,
            "fonte"        : "SIAPE",
        }
    """
    todos: list[dict] = []
    pagina = 1

    logger.info("[SIAPE] Iniciando coleta de servidores federais — UF=%s", uf)

    while True:
        logger.info("[SIAPE] Buscando página %d...", pagina)
        registros = await fetch_servidores_siape(uf=uf, pagina=pagina)

        if not registros:
            logger.info("[SIAPE] Página %d vazia — coleta encerrada.", pagina)
            break

        # Normaliza campos para esquema comum
        for r in registros:
            todos.append(_normalizar_siape(r, uf))

        logger.info("[SIAPE] Página %d: %d registros (total acumulado: %d)", pagina, len(registros), len(todos))

        # Se a página retornou menos registros que o tamanho máximo, é a última
        if len(registros) < TAMANHO_PAGINA:
            logger.info("[SIAPE] Última página detectada (registros < %d).", TAMANHO_PAGINA)
            break

        pagina += 1
        await asyncio.sleep(SLEEP_ENTRE_PAGINAS)  # respeita rate limit

    logger.info("[SIAPE] Coleta concluída — %d servidores federais coletados.", len(todos))
    return todos


def _normalizar_siape(registro: dict, uf: str) -> dict:
    """
    Normaliza um registro bruto da API SIAPE para o esquema interno.

    A API do Portal da Transparência usa variações de nomes de campo
    dependendo da versão; tentamos os mais comuns.
    """
    return {
        "nome": (
            registro.get("nome")
            or registro.get("nomeServidor")
            or registro.get("servidor", {}).get("nome", "")
        ).strip().upper(),
        "cpf_mascarado": (
            registro.get("cpf")
            or registro.get("cpfMascarado")
            or registro.get("servidor", {}).get("cpf", "***.***.***-**")
        ),
        "orgao": (
            registro.get("descricaoOrgao")
            or registro.get("orgaoLotacao")
            or registro.get("orgaoExercicio", {}).get("nome", "")
            or registro.get("orgaoLotacaoNome", "")
        ).strip(),
        "cargo": (
            registro.get("descricaoCargo")
            or registro.get("cargo", {}).get("nome", "")
            or registro.get("funcao", "")
        ).strip(),
        "uf": uf.upper(),
        "fonte": "SIAPE",
    }


# ---------------------------------------------------------------------------
# 3. fetch_servidores_tce_ma — scraping TCE-MA
# ---------------------------------------------------------------------------

async def fetch_servidores_tce_ma() -> list[dict]:
    """
    Tenta coletar servidores estaduais/municipais do Portal de Transparência
    do TCE-MA.

    O TCE-MA não expõe uma API REST padronizada para servidores; o endpoint
    pode variar ou estar indisponível. Por isso esta função é tolerante a
    falhas: em caso de endpoint não encontrado ou erro de conexão, retorna
    lista vazia com log de aviso — NÃO interrompe o pipeline.

    Retorna
    -------
    Lista de servidores normalizados com fonte "TCE-MA", ou lista vazia.
    """
    # Endpoints candidatos conhecidos do portal TCE-MA
    endpoints_candidatos = [
        "api/servidores",
        "servidores/lista",
        "transparencia/servidores",
        "servidores",
    ]

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        for endpoint in endpoints_candidatos:
            url = f"{BASE_URL_TCE_MA}{endpoint}"
            logger.info("[TCE-MA] Tentando endpoint: %s", url)

            try:
                resp = await client.get(url, headers={"Accept": "application/json"})

                if resp.status_code == 200:
                    content_type = resp.headers.get("content-type", "")
                    if "json" in content_type:
                        dados = resp.json()
                        registros = dados if isinstance(dados, list) else dados.get("data", [])
                        normalizados = [_normalizar_tce_ma(r) for r in registros if isinstance(r, dict)]
                        logger.info(
                            "[TCE-MA] Endpoint %s retornou %d registros.",
                            endpoint, len(normalizados),
                        )
                        return normalizados
                    else:
                        # Resposta HTML — endpoint não é API REST
                        logger.debug("[TCE-MA] Endpoint %s retornou HTML, não JSON.", endpoint)
                        continue

                elif resp.status_code in (404, 403, 405):
                    logger.debug("[TCE-MA] Endpoint %s retornou %s.", endpoint, resp.status_code)
                    continue

            except (httpx.ConnectError, httpx.TimeoutException) as exc:
                logger.debug("[TCE-MA] Falha de conexão em %s: %s", url, exc)
                continue

    # Nenhum endpoint funcionou
    logger.warning(
        "[TCE-MA] Nenhum endpoint de servidores localizado no Portal TCE-MA (%s). "
        "Retornando lista vazia — pipeline não interrompido.",
        BASE_URL_TCE_MA,
    )
    return []


def _normalizar_tce_ma(registro: dict) -> dict:
    """Normaliza registro bruto do TCE-MA para o esquema interno."""
    return {
        "nome": (
            registro.get("nome")
            or registro.get("nomeServidor")
            or ""
        ).strip().upper(),
        "cpf_mascarado": registro.get("cpf") or registro.get("cpfMascarado") or "***.***.***-**",
        "orgao": (
            registro.get("orgao")
            or registro.get("secretaria")
            or registro.get("unidade", "")
        ).strip(),
        "cargo": (
            registro.get("cargo")
            or registro.get("funcao")
            or ""
        ).strip(),
        "uf": "MA",
        "fonte": "TCE-MA",
    }


# ---------------------------------------------------------------------------
# 4. extrair_sobrenomes
# ---------------------------------------------------------------------------

def extrair_sobrenomes(nome_completo: str) -> list[str]:
    """
    Extrai sobrenomes de um nome completo, removendo o primeiro nome
    e preposições/artigos comuns.

    Parâmetros
    ----------
    nome_completo : Nome completo em qualquer capitalização.

    Retorna
    -------
    Lista de sobrenomes em maiúsculo, sem preposições e sem o primeiro nome.

    Exemplos
    --------
    >>> extrair_sobrenomes("João Silva Marques")
    ['SILVA', 'MARQUES']

    >>> extrair_sobrenomes("Maria de Fátima dos Santos")
    ['FÁTIMA', 'SANTOS']

    >>> extrair_sobrenomes("Pedro")
    []
    """
    if not nome_completo or not nome_completo.strip():
        return []

    partes = nome_completo.strip().split()

    # Remove o primeiro nome (índice 0)
    sobrenomes_brutos = partes[1:]

    # Filtra preposições e artigos (comparação case-insensitive)
    sobrenomes = [
        parte.upper()
        for parte in sobrenomes_brutos
        if parte.lower() not in PREPOSICOES
    ]

    return sobrenomes


# ---------------------------------------------------------------------------
# 5. coletar_servidores_ma — orquestra tudo e salva JSON
# ---------------------------------------------------------------------------

async def coletar_servidores_ma() -> dict:
    """
    Orquestra a coleta completa de servidores públicos do Maranhão:
        1. Coleta servidores federais via SIAPE (Portal da Transparência)
        2. Coleta servidores estaduais/municipais via TCE-MA
        3. Combina as listas, elimina duplicatas óbvias por nome+CPF
        4. Salva resultado em frontend/public/data/servidores.json

    Retorna
    -------
    Dicionário com:
        {
            "servidores"     : lista normalizada,
            "total"          : int,
            "total_siape"    : int,
            "total_tce_ma"   : int,
            "timestamp"      : ISO 8601 UTC,
            "status"         : "ok" | "parcial" | "erro",
        }
    """
    logger.info("=" * 60)
    logger.info("[COLETA] Iniciando coleta de servidores públicos — MA")
    logger.info("=" * 60)

    inicio = datetime.now(timezone.utc)
    erros: list[str] = []

    # --- Fase 1: SIAPE (federal) ---
    logger.info("\n[FASE 1] Coletando servidores federais via SIAPE...")
    try:
        servidores_siape = await fetch_servidores_siape_todos(uf="MA")
    except Exception as exc:
        logger.error("[SIAPE] Falha inesperada: %s", exc)
        servidores_siape = []
        erros.append(f"SIAPE: {exc}")

    # --- Fase 2: TCE-MA (estadual/municipal) ---
    logger.info("\n[FASE 2] Coletando servidores estaduais/municipais via TCE-MA...")
    try:
        servidores_tce = await fetch_servidores_tce_ma()
    except Exception as exc:
        logger.warning("[TCE-MA] Falha inesperada: %s — continuando sem dados TCE-MA.", exc)
        servidores_tce = []
        erros.append(f"TCE-MA: {exc}")

    # --- Fase 3: Combina e deduplica ---
    logger.info("\n[FASE 3] Combinando e deduplicando registros...")
    todos = servidores_siape + servidores_tce

    vistos: set[tuple] = set()
    servidores_unicos: list[dict] = []
    for s in todos:
        chave = (s.get("nome", ""), s.get("cpf_mascarado", ""))
        if chave not in vistos:
            vistos.add(chave)
            servidores_unicos.append(s)

    duplicatas = len(todos) - len(servidores_unicos)
    if duplicatas:
        logger.info("[DEDUPLICA] %d duplicatas removidas.", duplicatas)

    # --- Fase 4: Salva JSON ---
    logger.info("\n[FASE 4] Salvando em %s...", CAMINHO_SAIDA)
    CAMINHO_SAIDA.parent.mkdir(parents=True, exist_ok=True)

    timestamp_iso = inicio.isoformat().replace("+00:00", "Z")

    payload = {
        "servidores": servidores_unicos,
        "total": len(servidores_unicos),
        "total_siape": len(servidores_siape),
        "total_tce_ma": len(servidores_tce),
        "timestamp": timestamp_iso,
        "status": "ok" if not erros else ("parcial" if servidores_unicos else "erro"),
        "erros": erros,
    }

    try:
        with open(CAMINHO_SAIDA, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        logger.info("[SALVO] %d servidores gravados em %s", len(servidores_unicos), CAMINHO_SAIDA)
    except OSError as exc:
        logger.error("[ERRO] Não foi possível salvar o arquivo: %s", exc)
        payload["status"] = "erro"
        payload["erros"].append(f"IO: {exc}")

    # --- Resumo final ---
    logger.info("\n" + "=" * 60)
    logger.info("[RESUMO] SIAPE: %d | TCE-MA: %d | Total único: %d | Status: %s",
                len(servidores_siape), len(servidores_tce),
                len(servidores_unicos), payload["status"])
    logger.info("=" * 60)

    return payload


# ---------------------------------------------------------------------------
# Entrada direta (execução standalone)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    resultado = asyncio.run(coletar_servidores_ma())
    print(f"\nColeta finalizada — {resultado['total']} servidores | status: {resultado['status']}")
