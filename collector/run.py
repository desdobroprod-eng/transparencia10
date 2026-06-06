"""
Transparencia10 — Script standalone de coleta e análise.

Uso:
    python collector/run.py
    python collector/run.py --ano 2023
    python collector/run.py --ano 2024 --ente sao_luis
    python collector/run.py --ente maranhao_estado

Geração:
    frontend/public/data/contratos.json
    frontend/public/data/alertas.json
    frontend/public/data/stats.json
    frontend/public/data/meta.json

Exit code 1 se a coleta falhar completamente.
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Ajusta o sys.path para importar os módulos do backend ──────────────────────
# O script é executado a partir da raiz do projeto: python collector/run.py
RAIZ_PROJETO = Path(__file__).resolve().parent.parent
BACKEND_PATH = RAIZ_PROJETO / "backend"
sys.path.insert(0, str(BACKEND_PATH))

# ── Importa coletores e detector ───────────────────────────────────────────────
from collectors.historical import coletar_historico_4_anos
from collectors.siconfi_full import coletar_rreo_todos_entes, coletar_rreo_historico_ente
from domain.rules.detector import (
    verificar_empresa_nova,
    verificar_fracionamento,
    verificar_duplicidade,
    verificar_sancionado,
    verificar_preco_abusivo,
    verificar_contrato_sem_licitacao,
    verificar_fornecedor_monopolio,
    verificar_contrato_vencido_renovado,
    calcular_score_final,
)

# ── Entes monitorados (espelho do gov_br.py) ───────────────────────────────────
ENTES_ALVO = {
    "maranhao_estado": {"codigo": "21", "tipo": "estado", "nome": "Secretaria de Cultura MA"},
    "sao_luis": {"codigo": "2111300", "tipo": "municipio", "nome": "Sec. Cultura São Luís"},
    "sao_jose_ribamar": {"codigo": "2110856", "tipo": "municipio", "nome": "Sec. Cultura S.J. Ribamar"},
    "paco_lumiar": {"codigo": "2107704", "tipo": "municipio", "nome": "Sec. Cultura Paço do Lumiar"},
}

# ── Diretório de saída dos JSONs ───────────────────────────────────────────────
DIR_SAIDA = RAIZ_PROJETO / "frontend" / "public" / "data"


# ──────────────────────────────────────────────────────────────────────────────
# Funções utilitárias
# ──────────────────────────────────────────────────────────────────────────────

def _salvar_json(nome_arquivo: str, dados: object) -> None:
    """Salva objeto como JSON formatado no diretório de saída."""
    caminho = DIR_SAIDA / nome_arquivo
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2, default=str)
    tamanho_kb = caminho.stat().st_size // 1024
    print(f"[SALVO] {caminho} ({tamanho_kb} KB)")


def _timestamp_utc() -> str:
    """Retorna timestamp UTC no formato ISO 8601."""
    return datetime.now(timezone.utc).isoformat()


def _planificar_contratos(dados_historico: dict, chave_ente: str, nome_ente: str) -> list[dict]:
    """
    Converte o dicionário {ano: [contratos]} do histórico em lista plana,
    adicionando os campos 'ente' e 'chave_ente' em cada contrato.
    """
    lista = []
    for ano, contratos in dados_historico.items():
        if isinstance(contratos, list):
            for c in contratos:
                c_enriquecido = dict(c)
                c_enriquecido.setdefault("ente", nome_ente)
                c_enriquecido["chave_ente"] = chave_ente
                c_enriquecido["ano_coleta"] = str(ano)
                lista.append(c_enriquecido)
    return lista


def _aplicar_regras_ente(contratos_ente: list[dict]) -> list[dict]:
    """
    Aplica todas as regras de detecção de anomalia sobre a lista de contratos
    de um ente. Retorna lista de alertas no formato padrão.
    """
    alertas = []

    # Regra: duplicidade de contratos (opera sobre toda a lista)
    dup = verificar_duplicidade(contratos_ente)
    for r in dup:
        alertas.append({
            "regra": r.regra,
            "score": r.score,
            "motivo": r.motivo,
            "dados": r.dados,
            "id_contrato": None,
        })

    # Regra: monopólio de fornecedor (opera sobre toda a lista)
    mono = verificar_fornecedor_monopolio(contratos_ente)
    for r in mono:
        alertas.append({
            "regra": r.regra,
            "score": r.score,
            "motivo": r.motivo,
            "dados": r.dados,
            "id_contrato": None,
        })

    # Regras por contrato individual
    for contrato in contratos_ente:
        id_c = contrato.get("id") or contrato.get("numeroControlePNCP") or ""
        valor = float(contrato.get("valorInicial") or 0)

        # Regra: contrato sem licitação acima do teto legal
        r_sem_lic = verificar_contrato_sem_licitacao(contrato)
        if r_sem_lic:
            alertas.append({
                "regra": r_sem_lic.regra,
                "score": r_sem_lic.score,
                "motivo": r_sem_lic.motivo,
                "dados": r_sem_lic.dados,
                "id_contrato": id_c,
            })

        # Regra: contrato vencido com aditivos ou ainda ativo
        r_venc = verificar_contrato_vencido_renovado(contrato)
        if r_venc:
            alertas.append({
                "regra": r_venc.regra,
                "score": r_venc.score,
                "motivo": r_venc.motivo,
                "dados": r_venc.dados,
                "id_contrato": id_c,
            })

        # Regra: preço abusivo — compara com histórico do mesmo ente
        r_preco = verificar_preco_abusivo(contrato, contratos_ente)
        if r_preco:
            alertas.append({
                "regra": r_preco.regra,
                "score": r_preco.score,
                "motivo": r_preco.motivo,
                "dados": r_preco.dados,
                "id_contrato": id_c,
            })

    # Regra: fracionamento — agrupa por CNPJ do fornecedor
    por_cnpj: dict[str, list] = {}
    for c in contratos_ente:
        cnpj = (c.get("cnpjFornecedor") or "")[:14]
        if cnpj:
            por_cnpj.setdefault(cnpj, []).append(c)

    for cnpj, contratos_cnpj in por_cnpj.items():
        r_frac = verificar_fracionamento(contratos_cnpj)
        if r_frac:
            alertas.append({
                "regra": r_frac.regra,
                "score": r_frac.score,
                "motivo": r_frac.motivo,
                "dados": r_frac.dados,
                "id_contrato": None,
            })

    return alertas


def _calcular_stats_ente(
    chave_ente: str,
    nome_ente: str,
    contratos: list[dict],
    alertas_ente: list[dict],
) -> dict:
    """
    Calcula resumo estatístico de um ente:
    total_contratos, total_gasto, total_alertas, nivel_risco.
    """
    total_contratos = len(contratos)
    total_gasto = sum(float(c.get("valorInicial") or 0) for c in contratos)
    total_alertas = len(alertas_ente)

    # Determina nível de risco pelo score máximo dos alertas do ente
    scores = [a["score"] for a in alertas_ente]
    score_max = max(scores) if scores else 0

    if score_max >= 80:
        nivel_risco = "critico"
    elif score_max >= 60:
        nivel_risco = "atencao"
    elif score_max > 0:
        nivel_risco = "baixo"
    else:
        nivel_risco = "normal"

    return {
        "chave_ente": chave_ente,
        "nome_ente": nome_ente,
        "total_contratos": total_contratos,
        "total_gasto": round(total_gasto, 2),
        "total_alertas": total_alertas,
        "score_max": score_max,
        "nivel_risco": nivel_risco,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Fluxo principal de coleta
# ──────────────────────────────────────────────────────────────────────────────

async def executar_coleta(
    anos: list[int] | None = None,
    filtro_ente: str | None = None,
) -> int:
    """
    Executa o pipeline completo:
      1. Coleta histórica PNCP
      2. Coleta RREO/SICONFI
      3. Aplicação de regras de detecção
      4. Geração dos arquivos JSON estáticos

    Retorna 0 em sucesso, 1 se a coleta falhar completamente.
    """
    inicio = _timestamp_utc()
    print("\n" + "=" * 70)
    print("[TRANSPARENCIA10] Iniciando pipeline de coleta standalone")
    print(f"[TRANSPARENCIA10] Início: {inicio}")
    if filtro_ente:
        print(f"[TRANSPARENCIA10] Filtro ente: {filtro_ente}")
    if anos:
        print(f"[TRANSPARENCIA10] Anos: {anos}")
    print("=" * 70 + "\n")

    # Garante que o diretório de saída existe
    DIR_SAIDA.mkdir(parents=True, exist_ok=True)

    # Determina quais entes processar
    entes_processar = {
        k: v for k, v in ENTES_ALVO.items()
        if filtro_ente is None or k == filtro_ente
    }

    if not entes_processar:
        print(f"[ERRO] Ente '{filtro_ente}' não encontrado. Opções: {list(ENTES_ALVO.keys())}")
        return 1

    # ── FASE 1: Coleta histórica PNCP ─────────────────────────────────────────
    print("\n[FASE 1/3] Coleta histórica PNCP")
    print("-" * 50)

    todos_contratos: list[dict] = []
    sucesso_minimo = False  # ao menos um ente coletado com sucesso

    for chave, ente in entes_processar.items():
        print(f"\n  → {ente['nome']} (IBGE={ente['codigo']})")
        try:
            historico = await coletar_historico_4_anos(
                codigo_ibge=ente["codigo"],
                tipo_ente=ente["tipo"],
            )

            # Filtra apenas os anos solicitados, se especificado
            if anos:
                historico_filtrado = {str(a): historico.get(str(a), []) for a in anos}
            else:
                historico_filtrado = historico

            contratos_ente = _planificar_contratos(historico_filtrado, chave, ente["nome"])
            todos_contratos.extend(contratos_ente)
            sucesso_minimo = True

            total = sum(len(v) for v in historico_filtrado.values() if isinstance(v, list))
            print(f"  [OK] {ente['nome']}: {total} contratos coletados")

        except Exception as e:
            print(f"  [ERRO] Falha no histórico PNCP para {chave}: {e}")

    if not sucesso_minimo:
        print("\n[FATAL] Nenhum ente coletado com sucesso. Abortando.")
        return 1

    print(f"\n[FASE 1] Concluída — {len(todos_contratos)} contratos totais")

    # ── FASE 2: Coleta RREO/SICONFI ───────────────────────────────────────────
    print("\n[FASE 2/3] Coleta RREO/SICONFI — gastos com Cultura")
    print("-" * 50)

    dados_siconfi: dict = {}
    try:
        if filtro_ente:
            # Coleta apenas para o ente filtrado
            dados_siconfi = await coletar_rreo_historico_ente(filtro_ente, anos)
            dados_siconfi = {filtro_ente: dados_siconfi}
        else:
            # Coleta todos os entes
            dados_siconfi = await coletar_rreo_todos_entes(anos)
        print(f"[FASE 2] Concluída — {len(dados_siconfi)} entes SICONFI processados")
    except Exception as e:
        # SICONFI não é bloqueante — continua sem ele
        print(f"[AVISO] Falha na coleta SICONFI (não bloqueante): {e}")
        dados_siconfi = {"erro": str(e)}

    # ── FASE 3: Detecção de anomalias ─────────────────────────────────────────
    print("\n[FASE 3/3] Aplicando regras de detecção de anomalias")
    print("-" * 50)

    todos_alertas: list[dict] = []
    stats_entes: list[dict] = []

    for chave, ente in entes_processar.items():
        contratos_ente = [c for c in todos_contratos if c.get("chave_ente") == chave]
        print(f"\n  → {ente['nome']}: {len(contratos_ente)} contratos para análise")

        alertas_ente = _aplicar_regras_ente(contratos_ente)

        # Adiciona contexto do ente em cada alerta
        for a in alertas_ente:
            a["chave_ente"] = chave
            a["nome_ente"] = ente["nome"]

        todos_alertas.extend(alertas_ente)

        stats = _calcular_stats_ente(chave, ente["nome"], contratos_ente, alertas_ente)
        stats_entes.append(stats)

        print(
            f"  [OK] {ente['nome']}: {len(alertas_ente)} alertas | "
            f"risco={stats['nivel_risco']} | score_max={stats['score_max']}"
        )

    print(f"\n[FASE 3] Concluída — {len(todos_alertas)} alertas detectados")

    # ── Geração dos arquivos JSON ──────────────────────────────────────────────
    fim = _timestamp_utc()
    print("\n[OUTPUT] Gerando arquivos JSON estáticos")
    print("-" * 50)

    # contratos.json — todos os contratos coletados
    _salvar_json("contratos.json", todos_contratos)

    # alertas.json — alertas com score, motivo e regra
    _salvar_json("alertas.json", todos_alertas)

    # stats.json — resumo por ente
    _salvar_json("stats.json", stats_entes)

    # meta.json — metadados da execução
    meta = {
        "timestamp_inicio": inicio,
        "timestamp_fim": fim,
        "total_contratos": len(todos_contratos),
        "total_alertas": len(todos_alertas),
        "entes_processados": list(entes_processar.keys()),
        "anos_coletados": [str(a) for a in anos] if anos else "2021-hoje",
        "fontes_usadas": ["pncp", "siconfi"],
        "siconfi_disponivel": "erro" not in dados_siconfi,
        "versao_coletor": "1.0.0",
    }
    _salvar_json("meta.json", meta)

    print("\n" + "=" * 70)
    print("[TRANSPARENCIA10] Pipeline concluído com sucesso")
    print(f"  Contratos : {len(todos_contratos)}")
    print(f"  Alertas   : {len(todos_alertas)}")
    print(f"  Entes     : {len(entes_processar)}")
    print(f"  Saída     : {DIR_SAIDA}")
    print("=" * 70 + "\n")

    return 0


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    """Define e processa os argumentos de linha de comando."""
    parser = argparse.ArgumentParser(
        description="Transparencia10 — Coletor standalone de dados públicos",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python collector/run.py
  python collector/run.py --ano 2024
  python collector/run.py --ano 2023 --ente sao_luis
  python collector/run.py --ente maranhao_estado

Entes disponíveis:
  maranhao_estado, sao_luis, sao_jose_ribamar, paco_lumiar
        """,
    )
    parser.add_argument(
        "--ano",
        type=int,
        default=None,
        metavar="YYYY",
        help="Coleta apenas o ano especificado (padrão: todos de 2021 até hoje)",
    )
    parser.add_argument(
        "--ente",
        type=str,
        default=None,
        metavar="CHAVE",
        help=(
            "Filtra coleta para um ente específico "
            "(maranhao_estado | sao_luis | sao_jose_ribamar | paco_lumiar)"
        ),
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    # Converte --ano para lista ou None (todos os anos de 2021 ao atual)
    anos_coleta = [args.ano] if args.ano else None

    # Valida ente se fornecido
    if args.ente and args.ente not in ENTES_ALVO:
        print(f"[ERRO] Ente '{args.ente}' inválido. Opções: {list(ENTES_ALVO.keys())}")
        sys.exit(1)

    exit_code = asyncio.run(
        executar_coleta(
            anos=anos_coleta,
            filtro_ente=args.ente,
        )
    )
    sys.exit(exit_code)
