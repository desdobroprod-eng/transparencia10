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
