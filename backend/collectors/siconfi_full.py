"""
Coletor SICONFI — RREO (Relatório Resumido Execução Orçamentária).
Foco em gastos com Cultura (função COFOG 13) dos últimos 4 anos.
Entes: MA estado + São Luís + S.J. Ribamar + Paço do Lumiar.
"""
import asyncio
from datetime import datetime
from typing import Optional
import httpx

BASE_URL = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt"
SLEEP_ENTRE_REQUESTS = 0.3
MAX_TENTATIVAS = 3
BACKOFF_BASE = 1.0

# Entes monitorados com seus identificadores SICONFI
ENTES_SICONFI = {
    "maranhao_estado": {
        "id_ente": "21",
        "co_uf": "MA",
        "nome": "Governo do Estado do Maranhão",
        "tipo": "estado",
    },
    "sao_luis": {
        "id_ente": "2111300",
        "co_uf": "MA",
        "nome": "Prefeitura de São Luís",
        "tipo": "municipio",
    },
    "raposa": {
        "id_ente": "2110906",
        "co_uf": "MA",
        "nome": "Prefeitura de Raposa",
        "tipo": "municipio",
    },
    "sao_jose_ribamar": {
        "id_ente": "2110856",
        "co_uf": "MA",
        "nome": "Prefeitura de São José de Ribamar",
        "tipo": "municipio",
    },
    "paco_lumiar": {
        "id_ente": "2107704",
        "co_uf": "MA",
        "nome": "Prefeitura de Paço do Lumiar",
        "tipo": "municipio",
    },
    "pinheiro": {
        "id_ente": "2108603",
        "co_uf": "MA",
        "nome": "Prefeitura de Pinheiro",
        "tipo": "municipio",
    },
}

# Períodos bimestrais do RREO (1 a 6)
PERIODOS_RREO = [1, 2, 3, 4, 5, 6]

# Código da função Cultura no COFOG / classificação funcional
FUNCAO_CULTURA = "13"
FUNCAO_CULTURA_NOME = "Cultura"


async def _fetch_com_retry(
    client: httpx.AsyncClient,
    url: str,
    params: dict,
    tentativa: int = 1,
) -> Optional[dict]:
    """Request com retry e backoff exponencial."""
    try:
        resp = await client.get(url, params=params)

        if resp.status_code in (429, 500, 502, 503, 504):
            if tentativa <= MAX_TENTATIVAS:
                espera = BACKOFF_BASE * (2 ** (tentativa - 1))
                print(f"[RETRY] {resp.status_code} — aguardando {espera:.1f}s (tentativa {tentativa})")
                await asyncio.sleep(espera)
                return await _fetch_com_retry(client, url, params, tentativa + 1)
            print(f"[ERRO] Falha definitiva: status {resp.status_code}")
            return None

        if resp.status_code == 404:
            # RREO pode não existir para todos os períodos — não é erro fatal
            return None

        resp.raise_for_status()
        return resp.json()

    except httpx.TimeoutException:
        if tentativa <= MAX_TENTATIVAS:
            espera = BACKOFF_BASE * (2 ** (tentativa - 1))
            print(f"[RETRY] Timeout — aguardando {espera:.1f}s")
            await asyncio.sleep(espera)
            return await _fetch_com_retry(client, url, params, tentativa + 1)
        print("[ERRO] Timeout definitivo")
        return None

    except httpx.HTTPError as e:
        print(f"[ERRO] HTTP error: {e}")
        return None


def _extrair_gastos_cultura(dados_rreo: dict) -> list[dict]:
    """
    Extrai o gasto com a função Cultura (função 13) do RREO-Anexo 02
    (Demonstrativo da Despesa por Função/Subfunção).

    Estrutura real do SICONFI (apidatalake): cada item em `items` tem
    `conta` (nome da função, ex.: "Cultura"), `coluna` (estágio da despesa,
    ex.: "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)") e `valor`. Os valores
    "ATÉ O BIMESTRE" são acumulados no exercício — o período 6 traz o total
    do ano.

    Considera apenas a função `Cultura` (exata) — ignora a subfunção
    "Difusão Cultural" (evita dupla contagem) e "Agricultura" (contém
    "cultura" por acaso).
    """
    itens = dados_rreo.get("items", dados_rreo.get("data", []))

    dotacao = empenhado = liquidado = pago = 0.0
    encontrou = False

    for item in itens:
        conta = (item.get("conta") or "").strip()
        if conta.lower() != "cultura":  # função 13 — linha-total
            continue
        # O RREO traz duas linhas "Cultura": a consolidada ("Exceto
        # Intra-Orçamentárias", o valor cheio) e a intra-orçamentária (resíduo).
        # Considera apenas a consolidada.
        rotulo = (item.get("rotulo") or "").lower()
        if "intra" in rotulo and "exceto" not in rotulo:
            continue
        coluna = (item.get("coluna") or "").upper()
        try:
            valor = float(item.get("valor") or 0)
        except (TypeError, ValueError):
            continue

        encontrou = True
        if "DOTAÇÃO ATUALIZADA" in coluna or "DOTACAO ATUALIZADA" in coluna:
            dotacao = valor
        elif "EMPENHADAS ATÉ O BIMESTRE" in coluna or "EMPENHADAS ATE O BIMESTRE" in coluna:
            empenhado = valor
        elif "LIQUIDADAS ATÉ O BIMESTRE" in coluna or "LIQUIDADAS ATE O BIMESTRE" in coluna:
            liquidado = valor
        elif "PAGAS ATÉ O BIMESTRE" in coluna or "PAGAS ATE O BIMESTRE" in coluna:
            pago = valor

    if not encontrou:
        return []

    # Sem coluna "pagas", usa liquidado como melhor proxy de execução.
    if pago <= 0:
        pago = liquidado

    return [{
        "co_funcao": FUNCAO_CULTURA,
        "ds_funcao": FUNCAO_CULTURA_NOME,
        "vl_dotacao_atualizada": dotacao,
        "vl_empenhado": empenhado,
        "vl_liquidado": liquidado,
        "vl_pago": pago,
    }]


async def coletar_rreo_ente(
    id_ente: str,
    co_uf: str,
    nome_ente: str,
    ano: int,
) -> dict:
    """
    Coleta RREO de todos os períodos bimestrais de um ente para um ano.
    Extrai apenas os gastos com Cultura (função 13).

    Retorna dicionário com gastos por período.
    """
    resultado = {
        "ente": nome_ente,
        "id_ente": id_ente,
        "ano": ano,
        "periodos": {},
        "total_pago_cultura": 0.0,
        "total_liquidado_cultura": 0.0,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        for periodo in PERIODOS_RREO:
            params = {
                "an_exercicio": ano,
                "nr_periodo": periodo,
                "co_tipo_demonstrativo": "RREO",
                "no_anexo": "RREO-Anexo 02",
                "co_uf": co_uf,
                "id_ente": id_ente,
            }

            print(f"[SICONFI] {nome_ente} | {ano} | período {periodo}/6")

            dados = await _fetch_com_retry(client, f"{BASE_URL}/rreo", params)

            if dados is None:
                print(f"[SICONFI] Sem dados para {nome_ente}/{ano}/período {periodo}")
                resultado["periodos"][periodo] = {"gastos_cultura": [], "disponivel": False}
            else:
                gastos = _extrair_gastos_cultura(dados)
                resultado["periodos"][periodo] = {
                    "gastos_cultura": gastos,
                    "disponivel": True,
                    "total_itens": len(dados.get("items", dados.get("data", []))),
                }

                # Valores "ATÉ O BIMESTRE" são acumulados no exercício — o total
                # anual é o MAIOR valor observado entre os períodos (não a soma).
                for g in gastos:
                    resultado["total_pago_cultura"] = max(
                        resultado["total_pago_cultura"], g["vl_pago"]
                    )
                    resultado["total_liquidado_cultura"] = max(
                        resultado["total_liquidado_cultura"], g["vl_liquidado"]
                    )

                print(
                    f"[SICONFI] {nome_ente}/{ano}/p{periodo} — "
                    f"{len(gastos)} linhas cultura, "
                    f"pago={resultado['total_pago_cultura']:.2f}"
                )

            await asyncio.sleep(SLEEP_ENTRE_REQUESTS)

    return resultado


async def coletar_rreo_historico_ente(
    chave_ente: str,
    anos: list[int] = None,
) -> dict:
    """
    Coleta RREO dos últimos 4 anos para um ente específico.

    Parâmetros:
        chave_ente: Chave no dicionário ENTES_SICONFI
        anos: Lista de anos (padrão: 2021 até ano atual)
    """
    if chave_ente not in ENTES_SICONFI:
        raise ValueError(f"Ente desconhecido: {chave_ente}. Opções: {list(ENTES_SICONFI.keys())}")

    ente = ENTES_SICONFI[chave_ente]
    ano_atual = datetime.now().year
    anos = anos or list(range(2024, ano_atual + 1))

    print(f"\n{'='*60}")
    print(f"[SICONFI] Histórico {ente['nome']} — anos: {anos}")
    print(f"{'='*60}\n")

    resultado = {
        "ente": ente["nome"],
        "id_ente": ente["id_ente"],
        "anos": {},
        "coletado_em": datetime.utcnow().isoformat(),
    }

    for ano in anos:
        dados_ano = await coletar_rreo_ente(
            id_ente=ente["id_ente"],
            co_uf=ente["co_uf"],
            nome_ente=ente["nome"],
            ano=ano,
        )
        resultado["anos"][str(ano)] = dados_ano
        await asyncio.sleep(SLEEP_ENTRE_REQUESTS)

    return resultado


async def coletar_rreo_todos_entes(anos: list[int] = None) -> dict:
    """
    Coleta RREO histórico de todos os entes monitorados.
    MA estado + São Luís + S.J. Ribamar + Paço do Lumiar.

    Retorna dicionário indexado por chave do ente.
    """
    ano_atual = datetime.now().year
    anos = anos or list(range(2024, ano_atual + 1))

    print(f"\n{'='*60}")
    print(f"[SICONFI] Coleta completa todos os entes — anos: {anos}")
    print(f"{'='*60}\n")

    resultado = {}

    # Coleta sequencial para respeitar rate limiting
    for chave in ENTES_SICONFI:
        try:
            dados = await coletar_rreo_historico_ente(chave, anos)
            resultado[chave] = dados
        except Exception as e:
            print(f"[ERRO] Falha ao coletar RREO para {chave}: {e}")
            resultado[chave] = {"erro": str(e)}

        await asyncio.sleep(SLEEP_ENTRE_REQUESTS)

    return resultado
