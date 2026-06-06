"""
Coletor de servidores públicos do Maranhão.

Fontes:
  - SIAPE (Portal da Transparência Federal) — servidores civis do estado/municípios
  - TCE-MA (Portal da Transparência Estadual) — servidores estaduais

Expõe:
  - coletar_servidores_ma()         → dict com listas de servidores
  - verificar_conflito_interesse()  → ResultadoRegra | None
  - verificar_testa_ferro()         → ResultadoRegra | None
"""

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ── URLs das fontes públicas ───────────────────────────────────────────────────
BASE_TRANSPARENCIA = "https://api.portaldatransparencia.gov.br/api-de-dados"
BASE_TCE_MA = "https://portaldatransparencia.tce.ma.gov.br/api"

# UF e código de referência do MA para filtragem SIAPE
UF_MA = "MA"
COD_ORGAO_PREFIX_MA = "230"  # órgãos do governo MA que começam com esse código


# ── Estrutura de dados de um servidor ─────────────────────────────────────────
@dataclass
class Servidor:
    nome: str
    cpf_parcial: str       # últimos 4 dígitos — dado público suficiente para cruzamento
    orgao: str
    cargo: str
    situacao: str
    fonte: str             # "siape" | "tce_ma"

    def nome_normalizado(self) -> str:
        """Retorna nome em caixa alta sem acentos para comparação fuzzy."""
        import unicodedata
        nome = unicodedata.normalize("NFD", self.nome.upper())
        return "".join(c for c in nome if unicodedata.category(c) != "Mn")


# ── ResultadoRegra local (re-exportado para uso em run.py) ────────────────────
# Importa do detector para manter compatibilidade de tipo
from domain.rules.detector import ResultadoRegra


# ──────────────────────────────────────────────────────────────────────────────
# Coleta SIAPE via Portal da Transparência
# ──────────────────────────────────────────────────────────────────────────────

async def _coletar_siape_ma(cliente: httpx.AsyncClient) -> list[Servidor]:
    """
    Coleta servidores civis do MA cadastrados no SIAPE.
    Endpoint público: /servidores com filtro por uf_exercicio=MA
    """
    headers: dict[str, str] = {}
    api_key = os.getenv("PORTAL_TRANSPARENCIA_API_KEY")
    if api_key:
        headers["chave-api"] = api_key

    servidores: list[Servidor] = []
    pagina = 1
    max_paginas = 50  # limite de segurança — ~5.000 registros

    while pagina <= max_paginas:
        try:
            resp = await cliente.get(
                f"{BASE_TRANSPARENCIA}/servidores",
                params={
                    "ufExercicio": UF_MA,
                    "pagina": pagina,
                    "tamanhoPagina": 100,
                },
                headers=headers,
            )

            if resp.status_code == 401:
                # Sem chave API — retorna lista vazia sem quebrar o pipeline
                logger.warning(
                    "[SIAPE] Chave de API não configurada. "
                    "Defina PORTAL_TRANSPARENCIA_API_KEY para ativar coleta SIAPE."
                )
                return []

            if resp.status_code == 404 or resp.status_code == 204:
                break  # sem mais páginas

            resp.raise_for_status()
            dados = resp.json()
            registros = dados if isinstance(dados, list) else dados.get("data", [])

            if not registros:
                break

            for reg in registros:
                servidores.append(
                    Servidor(
                        nome=reg.get("nome") or reg.get("nomeServidor") or "",
                        cpf_parcial=str(reg.get("cpf") or "")[-4:],
                        orgao=reg.get("orgaoExercicio") or reg.get("descricaoOrgao") or "",
                        cargo=reg.get("descricaoCargo") or reg.get("cargo") or "",
                        situacao=reg.get("situacaoVinculo") or "ATIVO",
                        fonte="siape",
                    )
                )

            pagina += 1

        except httpx.HTTPStatusError as exc:
            logger.warning("[SIAPE] Erro HTTP %s na página %d: %s", exc.response.status_code, pagina, exc)
            break
        except Exception as exc:
            logger.warning("[SIAPE] Erro inesperado na página %d: %s", pagina, exc)
            break

    logger.info("[SIAPE] %d servidores coletados", len(servidores))
    return servidores


# ──────────────────────────────────────────────────────────────────────────────
# Coleta TCE-MA (Transparência Estadual)
# ──────────────────────────────────────────────────────────────────────────────

async def _coletar_tce_ma(cliente: httpx.AsyncClient) -> list[Servidor]:
    """
    Coleta servidores do TCE-MA via portal de transparência estadual.
    Fonte: dados abertos TCE-MA (dados públicos de remuneração).
    """
    servidores: list[Servidor] = []

    try:
        resp = await cliente.get(
            f"{BASE_TCE_MA}/servidores",
            params={"uf": UF_MA, "pagina": 1, "registros": 500},
        )

        if resp.status_code not in (200, 206):
            logger.warning("[TCE-MA] Endpoint retornou %s. Tentando fallback.", resp.status_code)
            return await _coletar_tce_ma_fallback(cliente)

        dados = resp.json()
        registros = dados if isinstance(dados, list) else dados.get("servidores", dados.get("data", []))

        for reg in registros:
            servidores.append(
                Servidor(
                    nome=reg.get("nome") or reg.get("nomeServidor") or "",
                    cpf_parcial=str(reg.get("cpf") or "")[-4:],
                    orgao=reg.get("orgao") or reg.get("secretaria") or "TCE-MA",
                    cargo=reg.get("cargo") or reg.get("funcao") or "",
                    situacao=reg.get("situacao") or "ATIVO",
                    fonte="tce_ma",
                )
            )

    except Exception as exc:
        logger.warning("[TCE-MA] Erro na coleta: %s. Usando fallback.", exc)
        return await _coletar_tce_ma_fallback(cliente)

    logger.info("[TCE-MA] %d servidores coletados", len(servidores))
    return servidores


async def _coletar_tce_ma_fallback(cliente: httpx.AsyncClient) -> list[Servidor]:
    """
    Fallback: busca dados de servidores via endpoint alternativo do TCE-MA
    (dados de remuneração pública — CSV/JSON de carga mensal).
    """
    try:
        resp = await cliente.get(
            "https://portaldatransparencia.tce.ma.gov.br/api/v1/remuneracao",
            params={"formato": "json", "pagina": 1},
        )
        if resp.status_code != 200:
            logger.warning("[TCE-MA Fallback] Status %s — retornando lista vazia.", resp.status_code)
            return []

        registros = resp.json()
        if not isinstance(registros, list):
            registros = registros.get("data", [])

        return [
            Servidor(
                nome=reg.get("nome") or "",
                cpf_parcial=str(reg.get("cpf") or "")[-4:],
                orgao=reg.get("orgao") or "Estado MA",
                cargo=reg.get("cargo") or "",
                situacao="ATIVO",
                fonte="tce_ma",
            )
            for reg in registros
        ]

    except Exception as exc:
        logger.warning("[TCE-MA Fallback] Falha total: %s", exc)
        return []


# ──────────────────────────────────────────────────────────────────────────────
# Função principal de coleta
# ──────────────────────────────────────────────────────────────────────────────

async def coletar_servidores_ma() -> dict[str, list[Servidor]]:
    """
    Coleta e consolida servidores públicos do Maranhão de todas as fontes.

    Retorna:
        {
            "siape": [...],      # servidores federais/estaduais via SIAPE
            "tce_ma": [...],     # servidores via TCE-MA
            "todos": [...],      # lista unificada para cruzamento
        }
    """
    async with httpx.AsyncClient(timeout=30) as cliente:
        # Coleta em paralelo — ambas as fontes são independentes
        siape, tce = await asyncio.gather(
            _coletar_siape_ma(cliente),
            _coletar_tce_ma(cliente),
            return_exceptions=False,
        )

    todos = siape + tce
    logger.info(
        "[SERVIDORES] Total consolidado: %d (SIAPE=%d, TCE-MA=%d)",
        len(todos), len(siape), len(tce),
    )

    return {
        "siape": siape,
        "tce_ma": tce,
        "todos": todos,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Funções de cruzamento
# ──────────────────────────────────────────────────────────────────────────────

def _normalizar_nome(nome: str) -> str:
    """Normaliza nome para comparação: caixa alta, sem acentos, sem espaços duplos."""
    import unicodedata
    nome = unicodedata.normalize("NFD", nome.upper().strip())
    nome = "".join(c for c in nome if unicodedata.category(c) != "Mn")
    return " ".join(nome.split())


def _nomes_se_sobrepoem(nome_a: str, nome_b: str, limiar_tokens: int = 2) -> bool:
    """
    Verifica se dois nomes compartilham ao menos `limiar_tokens` tokens
    (excluindo partículas como DE, DA, DO, DOS, DAS).
    Estratégia conservadora para evitar falsos positivos em nomes comuns.
    """
    particulas = {"DE", "DA", "DO", "DOS", "DAS", "E", "A", "O"}
    tokens_a = {t for t in _normalizar_nome(nome_a).split() if t not in particulas and len(t) > 2}
    tokens_b = {t for t in _normalizar_nome(nome_b).split() if t not in particulas and len(t) > 2}
    return len(tokens_a & tokens_b) >= limiar_tokens


def verificar_conflito_interesse(
    contrato: dict,
    socios: list[dict],
    servidores_orgao: list[Servidor],
) -> Optional[ResultadoRegra]:
    """
    Detecta sócio de empresa contratada que também é servidor público
    do órgão contratante (conflito de interesse direto).

    Args:
        contrato:         dicionário do contrato (campos PNCP)
        socios:           lista de sócios do CNPJ (campo "qsa" da Receita Federal)
        servidores_orgao: servidores do órgão contratante filtrados previamente

    Retorna ResultadoRegra com categoria "conflito_interesse" ou None.
    """
    if not socios or not servidores_orgao:
        return None

    conflitos_encontrados: list[dict] = []

    for socio in socios:
        nome_socio = socio.get("nome_socio") or socio.get("nome") or ""
        if not nome_socio or len(nome_socio) < 5:
            continue

        for servidor in servidores_orgao:
            if not servidor.nome or len(servidor.nome) < 5:
                continue

            if _nomes_se_sobrepoem(nome_socio, servidor.nome):
                conflitos_encontrados.append({
                    "nome_socio": nome_socio,
                    "nome_servidor": servidor.nome,
                    "orgao_servidor": servidor.orgao,
                    "cargo_servidor": servidor.cargo,
                    "fonte_servidor": servidor.fonte,
                })

    if not conflitos_encontrados:
        return None

    id_contrato = contrato.get("numeroControlePNCP") or contrato.get("id") or ""
    valor = float(contrato.get("valorInicial") or 0)
    orgao = contrato.get("nomeUnidadeOrgao") or contrato.get("ente") or ""

    # Score mais alto quando há múltiplos conflitos ou valor elevado
    score = 85 if len(conflitos_encontrados) > 1 or valor >= 100_000 else 75

    return ResultadoRegra(
        regra="CONFLITO_INTERESSE",
        score=score,
        motivo=(
            f"Sócio da empresa contratada possui vínculo como servidor do órgão contratante. "
            f"{len(conflitos_encontrados)} correspondência(s) identificada(s). "
            f"Órgão: {orgao}. Valor: R${valor:,.2f}."
        ),
        dados={
            "id_contrato": id_contrato,
            "valor_contrato": valor,
            "orgao_contratante": orgao,
            "conflitos": conflitos_encontrados,
            "categoria": "conflito_interesse",
            # Campo exibido na UI
            "orgao_servidor": conflitos_encontrados[0].get("orgao_servidor", "") if conflitos_encontrados else "",
        },
    )


def verificar_testa_ferro(
    socios: list[dict],
    servidores_todos: list[Servidor],
    contrato: dict,
) -> Optional[ResultadoRegra]:
    """
    Detecta possível "testa-de-ferro": sócio da empresa contratada é servidor público
    de *qualquer* órgão (não necessariamente o contratante), sugerindo que um
    funcionário público usa interposta pessoa jurídica para contratar com o Estado.

    Critério mais conservador: exige sobreposição de ≥3 tokens no nome.

    Args:
        socios:          lista de sócios do CNPJ
        servidores_todos: todos os servidores coletados (SIAPE + TCE-MA)
        contrato:        dicionário do contrato

    Retorna ResultadoRegra com categoria "nepotismo" ou None.
    """
    if not socios or not servidores_todos:
        return None

    suspeitos: list[dict] = []

    for socio in socios:
        nome_socio = socio.get("nome_socio") or socio.get("nome") or ""
        if not nome_socio or len(nome_socio) < 5:
            continue

        for servidor in servidores_todos:
            if not servidor.nome or len(servidor.nome) < 5:
                continue

            # Critério mais restritivo para evitar falsos positivos nessa regra
            if _nomes_se_sobrepoem(nome_socio, servidor.nome, limiar_tokens=3):
                suspeitos.append({
                    "nome_socio": nome_socio,
                    "nome_servidor": servidor.nome,
                    "orgao_servidor": servidor.orgao,
                    "cargo_servidor": servidor.cargo,
                    "fonte_servidor": servidor.fonte,
                })

    if not suspeitos:
        return None

    id_contrato = contrato.get("numeroControlePNCP") or contrato.get("id") or ""
    valor = float(contrato.get("valorInicial") or 0)
    orgao = contrato.get("nomeUnidadeOrgao") or contrato.get("ente") or ""

    score = 80 if len(suspeitos) > 1 else 70

    return ResultadoRegra(
        regra="TESTA_FERRO",
        score=score,
        motivo=(
            f"Sócio da empresa contratada é servidor público ativo em outro órgão. "
            f"Possível uso de interposta pessoa jurídica. "
            f"{len(suspeitos)} vínculo(s) identificado(s). Valor: R${valor:,.2f}."
        ),
        dados={
            "id_contrato": id_contrato,
            "valor_contrato": valor,
            "orgao_contratante": orgao,
            "suspeitos": suspeitos,
            "categoria": "nepotismo",
            "orgao_servidor": suspeitos[0].get("orgao_servidor", "") if suspeitos else "",
        },
    )
