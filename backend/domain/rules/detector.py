"""
Motor de detecção de anomalias — regras de negócio
Cada regra retorna score parcial (0-100) e motivo.
Score final >= 60 → alerta amarelo | >= 80 → alerta vermelho
"""
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional


@dataclass
class ResultadoRegra:
    regra: str
    score: int          # 0-100
    motivo: str
    dados: dict


def verificar_empresa_nova(cnpj_info: dict, valor_contrato: float) -> Optional[ResultadoRegra]:
    """Empresa com < 180 dias recebendo contrato acima de R$50k."""
    data_abertura_str = cnpj_info.get("data_inicio_atividade") or cnpj_info.get("abertura")
    if not data_abertura_str:
        return None

    try:
        data_abertura = datetime.strptime(data_abertura_str, "%Y-%m-%d")
    except ValueError:
        return None

    dias = (datetime.now() - data_abertura).days

    if dias < 180 and valor_contrato >= 50_000:
        score = 85 if dias < 90 else 70
        return ResultadoRegra(
            regra="EMPRESA_NOVA",
            score=score,
            motivo=f"Empresa aberta há {dias} dias recebeu contrato de R${valor_contrato:,.2f}",
            dados={"dias_abertura": dias, "valor": valor_contrato},
        )
    return None


def verificar_fracionamento(contratos_fornecedor: list[dict], teto_dispensa: float = 17_600) -> Optional[ResultadoRegra]:
    """
    Soma de dispensas ao mesmo CNPJ supera teto legal de dispensa de licitação.
    Teto cultura/MA 2024 ≈ R$17.600 por fornecedor por ano.
    """
    total = sum(float(c.get("valorInicial") or 0) for c in contratos_fornecedor)
    dispensas = [c for c in contratos_fornecedor if "dispensa" in (c.get("modalidadeNome") or "").lower()]

    if len(dispensas) >= 2 and total > teto_dispensa:
        return ResultadoRegra(
            regra="FRACIONAMENTO_LICITACAO",
            score=75,
            motivo=(
                f"{len(dispensas)} dispensas ao mesmo fornecedor totalizam "
                f"R${total:,.2f} (teto legal: R${teto_dispensa:,.2f})"
            ),
            dados={"total": total, "dispensas": len(dispensas)},
        )
    return None


def verificar_duplicidade(contratos: list[dict], janela_dias: int = 30) -> list[ResultadoRegra]:
    """Contratos com objeto similar, mesmo fornecedor, dentro de 30 dias."""
    alertas = []
    visto = {}

    for c in contratos:
        chave = (
            c.get("cnpjFornecedor", "")[:14],
            (c.get("objetoContrato") or "")[:80].lower().strip(),
        )
        data_str = c.get("dataAssinatura") or c.get("dataPublicacao")
        if not data_str:
            continue

        try:
            data = datetime.strptime(data_str[:10], "%Y-%m-%d")
        except ValueError:
            continue

        if chave in visto:
            delta = abs((data - visto[chave]["data"]).days)
            if delta <= janela_dias:
                alertas.append(ResultadoRegra(
                    regra="DUPLICIDADE_CONTRATO",
                    score=80,
                    motivo=(
                        f"Contrato com objeto similar ao mesmo fornecedor "
                        f"em {delta} dias de diferença"
                    ),
                    dados={"delta_dias": delta, "cnpj": chave[0]},
                ))
        else:
            visto[chave] = {"data": data, "contrato": c}

    return alertas


def verificar_sancionado(cnpj: str, esta_sancionado: bool, valor: float) -> Optional[ResultadoRegra]:
    """Fornecedor consta no CEIS ou CNEP."""
    if esta_sancionado:
        return ResultadoRegra(
            regra="EMPRESA_SANCIONADA",
            score=95,
            motivo=f"CNPJ {cnpj} consta em lista de empresas sancionadas (CEIS/CNEP) e recebeu R${valor:,.2f}",
            dados={"cnpj": cnpj, "valor": valor},
        )
    return None


def verificar_preco_abusivo(
    contrato: dict,
    historico_similares: list[dict],
    fator: float = 2.5,
) -> Optional[ResultadoRegra]:
    """
    Preço abusivo: valor unitário > 2.5x a mediana de contratos com objeto similar.
    A similaridade é determinada por palavras-chave do objetoContrato.
    """
    import statistics

    objeto = (contrato.get("objetoContrato") or "").lower().strip()
    valor = float(contrato.get("valorInicial") or 0)

    if not objeto or valor <= 0:
        return None

    # Extrai palavras-chave significativas (> 4 chars) do objeto do contrato
    palavras_chave = {p for p in objeto.split() if len(p) > 4}
    if not palavras_chave:
        return None

    # Filtra histórico por similaridade: ao menos 1 palavra-chave em comum
    similares = []
    for h in historico_similares:
        obj_hist = (h.get("objetoContrato") or "").lower()
        if any(p in obj_hist for p in palavras_chave):
            v = float(h.get("valorInicial") or 0)
            if v > 0:
                similares.append(v)

    if len(similares) < 3:
        # Amostra insuficiente para comparação confiável
        return None

    mediana = statistics.median(similares)
    if mediana <= 0:
        return None

    razao = valor / mediana
    if razao > fator:
        score = min(95, int(60 + (razao - fator) * 10))
        return ResultadoRegra(
            regra="PRECO_ABUSIVO",
            score=score,
            motivo=(
                f"Valor R${valor:,.2f} é {razao:.1f}x a mediana de "
                f"{len(similares)} contratos similares (R${mediana:,.2f})"
            ),
            dados={
                "valor": valor,
                "mediana_similares": round(mediana, 2),
                "razao": round(razao, 2),
                "amostras": len(similares),
                "palavras_chave": list(palavras_chave)[:5],
            },
        )
    return None


def verificar_contrato_sem_licitacao(
    contrato: dict,
    teto_dispensa_2024: float = 57_200.0,
) -> Optional[ResultadoRegra]:
    """
    Contrato com valor acima do teto legal (R$57.200) firmado por dispensa
    ou inexigibilidade de licitação — exige justificativa excepcional.
    """
    valor = float(contrato.get("valorInicial") or 0)
    modalidade = (contrato.get("modalidadeNome") or "").lower()

    modalidades_irregulares = ("dispensa", "inexigibilidade")
    if not any(m in modalidade for m in modalidades_irregulares):
        return None

    if valor > teto_dispensa_2024:
        razao = valor / teto_dispensa_2024
        score = min(90, int(70 + (razao - 1) * 5))
        return ResultadoRegra(
            regra="CONTRATO_SEM_LICITACAO",
            score=score,
            motivo=(
                f"Contrato de R${valor:,.2f} firmado por '{modalidade}' "
                f"ultrapassa teto legal de R${teto_dispensa_2024:,.2f} "
                f"({razao:.1f}x o limite)"
            ),
            dados={
                "valor": valor,
                "modalidade": modalidade,
                "teto_legal": teto_dispensa_2024,
                "razao": round(razao, 2),
            },
        )
    return None


def verificar_fornecedor_monopolio(
    contratos_ente: list[dict],
    percentual_minimo: float = 0.40,
    area_keyword: str = "cultura",
) -> list[ResultadoRegra]:
    """
    Monopólio de fornecedor: mesmo CNPJ concentra > 40% do total gasto
    em contratos relacionados à área de cultura no ente.
    """
    # Filtra contratos da área (objeto contém keyword)
    contratos_area = [
        c for c in contratos_ente
        if area_keyword in (c.get("objetoContrato") or "").lower()
        or area_keyword in (c.get("unidadeGestora") or "").lower()
    ]

    if not contratos_area:
        return []

    total_geral = sum(float(c.get("valorInicial") or 0) for c in contratos_area)
    if total_geral <= 0:
        return []

    # Agrupa por CNPJ
    por_cnpj: dict[str, float] = {}
    for c in contratos_area:
        cnpj = (c.get("cnpjFornecedor") or "desconhecido")[:14]
        por_cnpj[cnpj] = por_cnpj.get(cnpj, 0.0) + float(c.get("valorInicial") or 0)

    alertas = []
    for cnpj, total_cnpj in por_cnpj.items():
        participacao = total_cnpj / total_geral
        if participacao > percentual_minimo:
            score = min(85, int(60 + participacao * 30))
            alertas.append(ResultadoRegra(
                regra="FORNECEDOR_MONOPOLIO",
                score=score,
                motivo=(
                    f"CNPJ {cnpj} concentra {participacao:.1%} do total gasto "
                    f"em {area_keyword} (R${total_cnpj:,.2f} de R${total_geral:,.2f})"
                ),
                dados={
                    "cnpj": cnpj,
                    "total_cnpj": round(total_cnpj, 2),
                    "total_geral": round(total_geral, 2),
                    "participacao_pct": round(participacao * 100, 1),
                    "area": area_keyword,
                },
            ))
    return alertas


def verificar_contrato_vencido_renovado(
    contrato: dict,
    dias_tolerancia: int = 90,
) -> Optional[ResultadoRegra]:
    """
    Contrato com vigência expirada há mais de 90 dias que ainda recebeu
    aditivos — indício de irregularidade na prorrogação.
    """
    # Data de término da vigência
    data_fim_str = (
        contrato.get("dataFimVigencia")
        or contrato.get("dataTermino")
        or contrato.get("vigenciaFim")
    )
    if not data_fim_str:
        return None

    try:
        data_fim = datetime.strptime(data_fim_str[:10], "%Y-%m-%d")
    except ValueError:
        return None

    hoje = datetime.now()
    dias_vencido = (hoje - data_fim).days

    if dias_vencido <= dias_tolerancia:
        return None

    # Verifica se há aditivos registrados após o vencimento
    aditivos = contrato.get("aditivos") or contrato.get("totalAditivos") or 0
    tem_aditivo = int(aditivos) > 0 if not isinstance(aditivos, list) else len(aditivos) > 0

    # Também dispara se o contrato ainda aparece como "ativo" na API
    status = (contrato.get("situacao") or contrato.get("status") or "").lower()
    ainda_ativo = any(s in status for s in ("ativo", "vigente", "em execução"))

    if tem_aditivo or ainda_ativo:
        score = min(80, int(60 + min(dias_vencido / 30, 8) * 2.5))
        motivo_partes = [
            f"Contrato vencido há {dias_vencido} dias (término: {data_fim.strftime('%d/%m/%Y')})"
        ]
        if tem_aditivo:
            motivo_partes.append(f"com {aditivos} aditivo(s) registrado(s)")
        if ainda_ativo:
            motivo_partes.append(f"ainda consta como '{status}'")

        return ResultadoRegra(
            regra="CONTRATO_VENCIDO_RENOVADO",
            score=score,
            motivo=" — ".join(motivo_partes),
            dados={
                "data_fim_vigencia": data_fim_str[:10],
                "dias_vencido": dias_vencido,
                "aditivos": aditivos,
                "status_contrato": status or "não informado",
            },
        )
    return None


def calcular_score_final(resultados: list[ResultadoRegra]) -> dict:
    """Agrega scores e define nível de risco."""
    if not resultados:
        return {"score": 0, "nivel": "normal", "alertas": []}

    score = min(100, sum(r.score for r in resultados) // len(resultados) + len(resultados) * 5)

    if score >= 80:
        nivel = "critico"
    elif score >= 60:
        nivel = "atencao"
    else:
        nivel = "baixo"

    return {
        "score": score,
        "nivel": nivel,
        "alertas": [
            {
                "regra": r.regra,
                "score": r.score,
                "motivo": r.motivo,
                "dados": r.dados,
            }
            for r in resultados
        ],
    }
