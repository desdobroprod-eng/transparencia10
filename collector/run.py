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
COLLECTOR_PATH = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_PATH))
sys.path.insert(0, str(COLLECTOR_PATH))

import httpx

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
    verificar_capital_incompativel,
    verificar_valor_inconsistente,
    verificar_contrato_retificado,
    verificar_conflito_interesse,
    verificar_testa_ferro,
    extrair_sobrenomes,
    calcular_score_final,
)

# ── Enriquecimento (BrasilAPI + servidores MA) ────────────────────────────────
import enrich
import sancoes
import diario_servidores
from notas_ma import coletar_execucao_cultura_estado

# ── Entes monitorados ───────────────────────────────────────────────────────--
# O filtro confiável do PNCP é por CNPJ do órgão (cnpjOrgao). Cada ente é o
# órgão contratante (prefeitura ou secretaria estadual); o recorte "Cultura" é
# aplicado depois sobre a unidade gestora / objeto do contrato.
ENTES_ALVO = {
    "maranhao_estado": {
        "cnpj": "05508362000101", "codigo_ibge": "21", "tipo": "estado",
        "nome": "Secretaria de Estado da Cultura (MA)",
    },
    "sao_luis": {
        "cnpj": "06307102000130", "codigo_ibge": "2111300", "tipo": "municipio",
        "nome": "Prefeitura de São Luís",
    },
    "raposa": {
        "cnpj": "01612325000198", "codigo_ibge": "2110906", "tipo": "municipio",
        "nome": "Prefeitura de Raposa",
    },
    "sao_jose_ribamar": {
        "cnpj": "06351514000178", "codigo_ibge": "2110856", "tipo": "municipio",
        "nome": "Prefeitura de São José de Ribamar",
    },
    "paco_lumiar": {
        "cnpj": "06003636000173", "codigo_ibge": "2107704", "tipo": "municipio",
        "nome": "Prefeitura de Paço do Lumiar",
    },
    "pinheiro": {
        "cnpj": "06200745000180", "codigo_ibge": "2108603", "tipo": "municipio",
        "nome": "Prefeitura de Pinheiro",
    },
}

# ── Recorte temático: Cultura ───────────────────────────────────────────────---
# Prefeituras publicam contratos de todas as secretarias sob o mesmo CNPJ.
# Marcamos como "cultura" o contrato cuja unidade gestora seja a secretaria de
# cultura/patrimônio OU cujo objeto tenha termos culturais. Cidades pequenas
# (ex.: Raposa) publicam tudo numa unidade genérica, por isso o filtro por
# objeto é essencial.
_CULTURA_UNIDADE = ("cultura", "cultural", "patrimonio histor", "patrimônio histór")
_CULTURA_OBJETO = (
    "cultura", "cultural", "artist", "artíst", "evento", "festiv", "festejo",
    "carnaval", "são joão", "sao joao", "junino", "show", "banda", "música",
    "musica", "teatro", "dança", "danca", "folclore", "biblioteca", "museu",
    "artesanat", "audiovisual", "cineteatro", "patrimônio", "patrimonio",
)


def _normalizar(txt: str) -> str:
    return (txt or "").lower()


def _eh_cultura(unidade: str, objeto: str) -> bool:
    """True se o contrato pertence ao recorte Cultura (por unidade ou objeto)."""
    u = _normalizar(unidade)
    # 'agricultura' contém 'cultura' — exclui explicitamente.
    if "agricult" in u:
        u_cult = False
    else:
        u_cult = any(k in u for k in _CULTURA_UNIDADE)
    o = _normalizar(objeto)
    o_cult = any(k in o for k in _CULTURA_OBJETO)
    return u_cult or o_cult

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
    Converte o dicionário {ano: [contratos]} do histórico em lista plana e
    NORMALIZA os campos do PNCP para os nomes que o detector e o frontend
    esperam.

    O endpoint /consulta/v1/contratos do PNCP usa:
      - niFornecedor              (CNPJ/CPF do fornecedor)  → cnpjFornecedor
      - nomeRazaoSocialFornecedor (nome do fornecedor)
      - unidadeOrgao.nomeUnidade  (secretaria/unidade)      → unidadeGestora
      - objetoContrato, valorInicial, dataAssinatura, dataVigenciaFim
    """
    lista = []
    for ano, contratos in dados_historico.items():
        if not isinstance(contratos, list):
            continue
        for c in contratos:
            unidade = (c.get("unidadeOrgao") or {}).get("nomeUnidade") or ""
            objeto = c.get("objetoContrato") or ""
            tipo = (c.get("tipoContrato") or {}).get("nome") or ""
            categoria = (c.get("categoriaProcesso") or {}).get("nome") or ""

            e = dict(c)
            # Campos normalizados consumidos pelo detector (domain/rules)
            e["cnpjFornecedor"] = c.get("niFornecedor") or ""
            e["unidadeGestora"] = unidade
            # PNCP não traz modalidade neste endpoint; usa tipo/categoria como rótulo
            e["modalidadeNome"] = tipo or categoria
            e["dataFimVigencia"] = c.get("dataVigenciaFim") or ""
            # Metadados do ente e recorte temático
            e["ente"] = nome_ente
            e["chave_ente"] = chave_ente
            e["ano_coleta"] = str(ano)
            e["area_cultura"] = _eh_cultura(unidade, objeto)
            lista.append(e)
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
            "categoria": "financeiro",
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
            "categoria": "financeiro",
        })

    # Regras por contrato individual
    for contrato in contratos_ente:
        id_c = contrato.get("id") or contrato.get("numeroControlePNCP") or ""
        valor = float(contrato.get("valorInicial") or 0)

        # Regras baseadas no cadastro enriquecido (BrasilAPI) em cnpj_info.
        cnpj_info = contrato.get("cnpj_info") or {}
        for r in (
            verificar_empresa_nova(cnpj_info, valor),
            verificar_capital_incompativel(contrato, cnpj_info),
            verificar_valor_inconsistente(contrato, cnpj_info),
            verificar_contrato_retificado(contrato),
            verificar_sancionado(contrato.get("cnpjFornecedor", ""), bool(cnpj_info.get("sancionada")), valor),
        ):
            if r:
                alertas.append({
                    "regra": r.regra,
                    "score": r.score,
                    "motivo": r.motivo,
                    "dados": r.dados,
                    "id_contrato": id_c,
                    "categoria": "financeiro",
                })

        # Regra: contrato sem licitação acima do teto legal
        r_sem_lic = verificar_contrato_sem_licitacao(contrato)
        if r_sem_lic:
            alertas.append({
                "regra": r_sem_lic.regra,
                "score": r_sem_lic.score,
                "motivo": r_sem_lic.motivo,
                "dados": r_sem_lic.dados,
                "id_contrato": id_c,
                "categoria": "financeiro",
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
                "categoria": "financeiro",
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
                "categoria": "financeiro",
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
                "categoria": "financeiro",
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
        print(f"\n  → {ente['nome']} (CNPJ={ente['cnpj']})")
        try:
            historico = await coletar_historico_4_anos(
                cnpj_orgao=ente["cnpj"],
                tipo_ente=ente["tipo"],
            )

            # Filtra apenas os anos solicitados, se especificado
            if anos:
                historico_filtrado = {str(a): historico.get(str(a), []) for a in anos}
            else:
                historico_filtrado = historico

            contratos_ente = _planificar_contratos(historico_filtrado, chave, ente["nome"])

            # Recorte temático: portal foca em Cultura.
            contratos_cultura = [c for c in contratos_ente if c.get("area_cultura")]
            todos_contratos.extend(contratos_cultura)
            sucesso_minimo = True

            total_bruto = len(contratos_ente)
            print(
                f"  [OK] {ente['nome']}: {total_bruto} contratos no PNCP — "
                f"{len(contratos_cultura)} no recorte Cultura"
            )

        except Exception as e:
            print(f"  [ERRO] Falha no histórico PNCP para {chave}: {e}")

    if not sucesso_minimo:
        print("\n[FATAL] Nenhum ente coletado com sucesso. Abortando.")
        return 1

    # Deduplica por número de controle PNCP — o mesmo contrato pode aparecer em
    # mais de uma janela anual de coleta. Duplicatas inflariam gasto e contagem.
    vistos: set[str] = set()
    unicos: list[dict] = []
    for c in todos_contratos:
        cid = c.get("numeroControlePNCP") or c.get("id") or ""
        chave = f"{c.get('chave_ente')}|{cid}" if cid else None
        if chave and chave in vistos:
            continue
        if chave:
            vistos.add(chave)
        unicos.append(c)
    duplicatas = len(todos_contratos) - len(unicos)
    todos_contratos = unicos

    print(
        f"\n[FASE 1] Concluída — {len(todos_contratos)} contratos únicos "
        f"({duplicatas} duplicatas removidas)"
    )

    # ── FASE 1.5: Enriquecimento de CNPJ (BrasilAPI) ──────────────────────────
    # Para cada fornecedor único, busca razão social, data de abertura, situação
    # cadastral e QSA (sócios). É o que viabiliza EMPRESA_NOVA e o cruzamento
    # sócio × servidor. Resultados são cacheados em disco.
    print("\n[FASE 1.5] Enriquecimento de CNPJ — sócios e cadastro (BrasilAPI)")
    print("-" * 50)

    cnpjs_unicos = sorted({
        (c.get("cnpjFornecedor") or "").strip()
        for c in todos_contratos
        if (c.get("cnpjFornecedor") or "").strip()
    })
    print(f"  {len(cnpjs_unicos)} CNPJs únicos a enriquecer")

    if sancoes.tem_chave():
        print("  [SANÇÕES] chave do Portal da Transparência presente — checando CEIS/CNEP")
    else:
        print("  [SANÇÕES] sem PORTAL_TRANSPARENCIA_API_KEY — CEIS/CNEP desativado (não bloqueante)")

    info_por_cnpj: dict[str, dict] = {}
    n_sancionadas = 0
    async with httpx.AsyncClient(verify=False) as client:
        for i, cnpj in enumerate(cnpjs_unicos, 1):
            info = await enrich.enriquecer_cnpj(client, cnpj)
            # Sanções CEIS/CNEP (fonte federal CGU; só roda se houver chave)
            sanc = await sancoes.verificar_sancao(client, cnpj)
            info["sancionada"] = sanc.get("sancionada", False)
            info["sancoes"] = sanc.get("detalhes", [])
            if info["sancionada"]:
                n_sancionadas += 1
            info_por_cnpj[cnpj] = info
            if i % 25 == 0:
                print(f"  ... {i}/{len(cnpjs_unicos)} CNPJs")
                enrich.persistir_caches()
                sancoes.persistir_cache()
    enrich.persistir_caches()
    sancoes.persistir_cache()
    if sancoes.tem_chave():
        print(f"  [SANÇÕES] {n_sancionadas} empresa(s) em lista de sanção (CEIS/CNEP)")

    com_socios = 0
    for c in todos_contratos:
        info = info_por_cnpj.get((c.get("cnpjFornecedor") or "").strip(), {})
        c["cnpj_info"] = info
        if info.get("socios"):
            com_socios += 1
    print(f"[FASE 1.5] Concluída — {com_socios} contratos com quadro societário")

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

    # ── FASE 4: Cruzamento sócio × servidor público estadual ───────────────────
    # Para cada sócio das empresas contratadas, consulta a base de servidores
    # do Portal da Transparência do MA (por nome) e aplica o detector de
    # testa-de-ferro/nepotismo (match exato de nome ou 3+ sobrenomes em comum).
    print("\n[FASE 4/4] Cruzamento sócio × servidor estadual (Portal Transparência MA)")
    print("-" * 50)

    cruzamento_servidores_ok = False
    matches_servidores: list[dict] = []
    vistos_cruz: dict = {}  # (ente, sócio, servidor) → registro (dedup)

    try:
        async with httpx.AsyncClient(verify=False) as client:
            for chave, ente in entes_processar.items():
                contratos_ente = [c for c in todos_contratos if c.get("chave_ente") == chave]
                achados_ente = 0

                for contrato in contratos_ente:
                    cnpj_info = contrato.get("cnpj_info") or {}
                    nomes_socios = cnpj_info.get("socios") or []
                    # Apenas pessoas físicas (ignora sócio PJ "... LTDA/S.A.")
                    socios_pf = [
                        n for n in nomes_socios
                        if n and not any(t in n.upper() for t in (" LTDA", " S.A", " S/A", "PARTICIPACOES", "INVESTIMENTOS", " EIRELI", " ME"))
                    ]
                    if not socios_pf:
                        continue

                    for nome_socio in socios_pf:
                        # Busca servidores cujo nome contenha o sobrenome mais
                        # distintivo do sócio (reduz ruído e nº de chamadas).
                        sobrenomes = extrair_sobrenomes(nome_socio)
                        if not sobrenomes:
                            continue
                        termo = max(sobrenomes, key=len)
                        servidores_raw = await enrich.buscar_servidores(client, termo)
                        if not servidores_raw:
                            continue
                        servidores = [
                            {
                                "nome": s["nome"],
                                "orgao": "Servidor estadual MA",
                                "cargo": s.get("cargo", ""),
                                "fonte": "Portal da Transparência MA (servidores estaduais)",
                            }
                            for s in servidores_raw
                        ]

                        r_testa = verificar_testa_ferro(
                            [{"nome": nome_socio}], servidores, contrato
                        )
                        for r in r_testa:
                            cid = contrato.get("numeroControlePNCP") or contrato.get("id") or ""
                            soc = r.dados.get("nome_socio", nome_socio)
                            srv = r.dados.get("nome_servidor", "")
                            # Dedup: 1 relação (ente, sócio, servidor) conta uma vez,
                            # não por contrato. Repetições só acumulam nº de contratos.
                            chave_cruz = (chave, soc.upper(), srv.upper())
                            if chave_cruz in vistos_cruz:
                                vistos_cruz[chave_cruz]["num_contratos"] += 1
                                continue
                            # Recupera campos do servidor correspondente (se disponível)
                            srv_info = next(
                                (s for s in servidores if s["nome"] == srv), {}
                            )
                            registro = {
                                "ente": chave,
                                "contrato": cid,
                                "cnpj": contrato.get("cnpjFornecedor", ""),
                                "fornecedor": contrato.get("nomeRazaoSocialFornecedor", ""),
                                "socio": soc,
                                "servidor": srv,
                                "sobrenomes_comuns": r.dados.get("sobrenomes_comuns", []),
                                "match": r.dados.get("match", ""),
                                "score": r.score,
                                "num_contratos": 1,
                                # Campos de proveniência e situação
                                "orgao": r.dados.get("orgao_servidor", srv_info.get("orgao", "Servidor Estadual MA")),
                                "cargo": srv_info.get("cargo", ""),
                                "fonte": srv_info.get("fonte", "Portal da Transparência MA (servidores estaduais)"),
                                "situacao": "ativo",  # atualizado na fase 4b via Querido Diário
                                "situacao_fonte": "",
                            }
                            vistos_cruz[chave_cruz] = registro
                            matches_servidores.append(registro)
                            todos_alertas.append({
                                "regra": r.regra,
                                "score": r.score,
                                "motivo": r.motivo,
                                "dados": r.dados,
                                "id_contrato": cid,
                                "chave_ente": chave,
                                "nome_ente": ente["nome"],
                                "categoria": "nepotismo",
                                "orgao_servidor": r.dados.get("orgao_servidor", ""),
                            })
                            achados_ente += 1
                            print(
                                f"    [ALERTA] TESTA_FERRO/{ente['nome']} — "
                                f"sócio '{soc}' ≈ servidor '{srv}' | score={r.score}"
                            )

                print(f"  → {ente['nome']}: {achados_ente} cruzamentos sócio×servidor")

        enrich.persistir_caches()
        cruzamento_servidores_ok = True
        print(f"\n[FASE 4] Concluída — {len(matches_servidores)} cruzamentos | {len(todos_alertas)} alertas totais")

    except Exception as exc:
        print(f"[AVISO] Fase 4 — cruzamento falhou (não bloqueante): {exc}")
        enrich.persistir_caches()

    # ── FASE 4b: Verificação de exoneração via Diário Oficial (Querido Diário) ──
    # Para cada cruzamento encontrado, verifica se o servidor consta no DOM de
    # São Luís com ato de exoneração mais recente que o de nomeação.
    # Servidores exonerados são mantidos no dataset mas sinalizados ("ex-servidor").
    if matches_servidores:
        print("\n[FASE 4b] Verificando situação via Diário Oficial (Querido Diário)…")
        try:
            cache_qd = diario_servidores.carregar_cache()
            # Recoleta apenas se cache vazio ou muito antigo (>7 dias)
            if not cache_qd:
                print("  → Coletando atos de pessoal do DOM de São Luís…")
                cache_qd = await diario_servidores.coletar_atos_pessoal(anos=2)
                diario_servidores.salvar_cache(cache_qd)
                print(f"  → {len(cache_qd)} servidores indexados no DOM")

            verificados = 0
            exonerados = 0
            for reg in matches_servidores:
                check = diario_servidores.verificar_situacao_servidor(
                    reg["servidor"], cache_qd
                )
                if check["fonte_qd"]:
                    verificados += 1
                    if check["situacao_qd"] == "exonerado":
                        reg["situacao"] = "exonerado"
                        reg["situacao_fonte"] = (
                            f"Diário Oficial São Luís — último ato: {check.get('ultima_data_qd', '')}"
                        )
                        exonerados += 1
                    else:
                        reg["situacao"] = "ativo"
                        reg["situacao_fonte"] = (
                            f"Diário Oficial São Luís — último ato: {check.get('ultima_data_qd', '')}"
                        )
            print(
                f"  → {verificados}/{len(matches_servidores)} verificados no DOM | "
                f"{exonerados} sinalizado(s) como ex-servidor"
            )
        except Exception as exc:
            print(f"[AVISO] Fase 4b falhou (não bloqueante): {exc}")

    # servidores.json — cruzamentos sócio × servidor encontrados
    _salvar_json("servidores.json", {"cruzamentos": matches_servidores})

    # Contadores por categoria para o meta.json
    contadores_categoria = {
        "financeiro": sum(1 for a in todos_alertas if a.get("categoria") == "financeiro"),
        "conflito_interesse": sum(1 for a in todos_alertas if a.get("categoria") == "conflito_interesse"),
        "nepotismo": sum(1 for a in todos_alertas if a.get("categoria") == "nepotismo"),
    }

    # ── Gasto declarado com Cultura (SICONFI) por ente ─────────────────────────
    # Usado para enriquecer o card do ente — especialmente o Estado, que não
    # publica contratos sob o CNPJ da SECMA no PNCP, mas declara execução
    # orçamentária da função Cultura (função 13) no RREO.
    gasto_siconfi_por_ente: dict[str, float] = {}
    if isinstance(dados_siconfi, dict):
        for chave, bloco in dados_siconfi.items():
            if not isinstance(bloco, dict) or "anos" not in bloco:
                continue
            total = 0.0
            for _ano, dados_ano in bloco.get("anos", {}).items():
                if isinstance(dados_ano, dict):
                    total += float(dados_ano.get("total_pago_cultura") or 0)
            gasto_siconfi_por_ente[chave] = round(total, 2)

    # ── Execução orçamentária real do Estado em Cultura (Portal Transparência MA)
    # O Estado quase não publica contratos no PNCP sob o CNPJ da SECMA; o gasto
    # real flui via empenhos da SECMA (140101) e do FUNDECMA (140901).
    execucao_estado = {}
    if filtro_ente is None or filtro_ente == "maranhao_estado":
        try:
            execucao_estado = await coletar_execucao_cultura_estado(anos)
            print(
                f"[ESTADO] Execução Cultura (empenhos SECMA+FUNDECMA): "
                f"R$ {execucao_estado.get('total_empenhado', 0):,.2f}"
            )
        except Exception as e:
            print(f"[AVISO] Falha ao coletar execução do Estado (não bloqueante): {e}")

    # ── Transformação para o schema consumido pelo frontend ────────────────────
    # alertas.json: lista de objetos com id/nivel/detectado_em/cnpj/fornecedor
    fim = _timestamp_utc()

    def _nivel(score: int) -> str:
        if score >= 80:
            return "critico"
        if score >= 60:
            return "atencao"
        return "baixo"

    contratos_por_id = {
        (c.get("numeroControlePNCP") or c.get("id") or ""): c for c in todos_contratos
    }

    alertas_frontend = []
    score_por_contrato: dict[str, int] = {}
    for i, a in enumerate(todos_alertas):
        cid = a.get("id_contrato") or ""
        contrato_ref = contratos_por_id.get(cid, {})
        dados = a.get("dados") or {}
        cnpj = dados.get("cnpj") or contrato_ref.get("cnpjFornecedor") or ""
        fornecedor = (
            dados.get("nome_socio")
            or contrato_ref.get("nomeRazaoSocialFornecedor")
            or contrato_ref.get("ente")
            or ""
        )
        ano = contrato_ref.get("ano_coleta")
        score = int(a.get("score") or 0)
        if cid:
            score_por_contrato[cid] = max(score_por_contrato.get(cid, 0), score)
        alertas_frontend.append({
            "id": f"alerta-{i}",
            "ente": a.get("chave_ente") or "",
            "contrato_id": cid,
            "regra": a.get("regra") or "",
            "motivo": a.get("motivo") or "",
            "score": score,
            "nivel": _nivel(score),
            "detectado_em": fim,
            "ano": int(ano) if ano and str(ano).isdigit() else None,
            "cnpj": cnpj,
            "fornecedor": fornecedor,
            "categoria": a.get("categoria") or "financeiro",
            "orgao_servidor": a.get("orgao_servidor") or "",
        })

    # contratos.json: schema enxuto para a tabela do frontend
    contratos_frontend = []
    for c in todos_contratos:
        cid = c.get("numeroControlePNCP") or c.get("id") or ""
        ano = c.get("ano_coleta")
        info = c.get("cnpj_info") or {}
        try:
            retif = int(c.get("numeroRetificacao") or 0)
        except (TypeError, ValueError):
            retif = 0
        contratos_frontend.append({
            "id": cid,
            "ente": c.get("chave_ente") or "",
            "fornecedor": c.get("nomeRazaoSocialFornecedor") or "",
            "cnpj": c.get("cnpjFornecedor") or "",
            "objeto": c.get("objetoContrato") or "",
            "valor": float(c.get("valorInicial") or 0),
            "modalidade": c.get("modalidadeNome") or "",
            "score_risco": score_por_contrato.get(cid, 0),
            "data_publicacao": c.get("dataPublicacaoPncp") or c.get("dataAssinatura") or "",
            "ano": int(ano) if ano and str(ano).isdigit() else None,
            "unidade": c.get("unidadeGestora") or "",
            # Enriquecimento do fornecedor (BrasilAPI)
            "razao_social": info.get("razao_social") or "",
            "capital_social": float(info.get("capital_social") or 0),
            "porte": info.get("porte") or "",
            "mei": bool(info.get("mei")),
            "abertura": info.get("data_inicio_atividade") or "",
            "situacao": info.get("situacao") or "",
            "retificacoes": retif,
        })
    # Mais recentes primeiro
    contratos_frontend.sort(key=lambda x: x.get("data_publicacao") or "", reverse=True)

    # stats.json: dicionário indexado por chave de ente, no formato {stats:{...}}
    stats_dict = {}
    exec_estado_total = float(execucao_estado.get("total_empenhado") or 0)
    for s in stats_entes:
        chave = s["chave_ente"]
        total_gasto = s["total_gasto"]
        base_gasto = "contratos_pncp"
        # Estado: usa execução real (empenhos SECMA+FUNDECMA), muito mais fiel
        # que a soma de contratos PNCP sob o CNPJ da SECMA.
        if chave == "maranhao_estado" and exec_estado_total > 0:
            total_gasto = exec_estado_total
            base_gasto = "empenhos_estado_ma"
        elif total_gasto <= 0 and gasto_siconfi_por_ente.get(chave):
            total_gasto = gasto_siconfi_por_ente[chave]
            base_gasto = "siconfi_funcao_cultura"
        stats_dict[chave] = {
            "total_gasto": total_gasto,
            "total_contratos": s["total_contratos"],
            "total_alertas": s["total_alertas"],
            "nivel_risco": s["nivel_risco"],
            "base_gasto": base_gasto,
        }

    stats_frontend = {
        "ultima_atualizacao": fim,
        "stats": stats_dict,
    }

    # ── Geração dos arquivos JSON ──────────────────────────────────────────────
    print("\n[OUTPUT] Gerando arquivos JSON estáticos")
    print("-" * 50)

    _salvar_json("contratos.json", contratos_frontend)
    _salvar_json("alertas.json", alertas_frontend)
    _salvar_json("stats.json", stats_frontend)

    # ── Emendas parlamentares de Cultura (estaduais + federais MA) ─────────────
    # Não-bloqueante: se a fonte cair, o pipeline segue sem emendas.
    emendas_stats: dict = {"total": 0}
    try:
        from emendas_ma import coletar_emendas_cultura

        dados_emendas = await coletar_emendas_cultura()
        emendas = dados_emendas["emendas"]
        # Cruza favorecido da emenda × fornecedor contratado (mesmo CNPJ).
        cnpjs_fornecedores = {
            "".join(ch for ch in str(c.get("cnpj") or "") if ch.isdigit())
            for c in contratos_frontend
        }
        cnpjs_fornecedores.discard("")
        for e in emendas:
            e["fornecedor_contratado"] = bool(
                e.get("cnpj_favorecido") and e["cnpj_favorecido"] in cnpjs_fornecedores
            )
        emendas_stats = dados_emendas["stats"]
        emendas_stats["favorecido_tambem_fornecedor"] = sum(
            1 for e in emendas if e.get("fornecedor_contratado")
        )
        _salvar_json("emendas.json", {"emendas": emendas, "stats": emendas_stats})
        print(
            f"[EMENDAS] {len(emendas)} de cultura · "
            f"{emendas_stats['favorecido_tambem_fornecedor']} favorecido(s) também fornecedor"
        )
    except Exception as exc:  # noqa: BLE001 — não-bloqueante por design
        emendas_stats = {"total": 0, "erro": str(exc)}
        _salvar_json("emendas.json", {"emendas": [], "stats": emendas_stats})
        print(f"[EMENDAS] falhou (não bloqueante): {exc}")

    # meta.json — metadados da execução (campos lidos pelo frontend)
    meta = {
        "ultima_coleta": fim,
        "total_registros": len(contratos_frontend),
        "fonte": "PNCP · SICONFI/Tesouro · Portal da Transparência · Receita Federal",
        "timestamp_inicio": inicio,
        "timestamp_fim": fim,
        "total_contratos": len(contratos_frontend),
        "total_alertas": len(alertas_frontend),
        "gasto_cultura_siconfi": gasto_siconfi_por_ente,
        "alertas_por_categoria": contadores_categoria,
        "total_emendas_cultura": emendas_stats.get("total", 0),
        "valor_emendas_cultura": emendas_stats.get("valor_empenhado", 0),
        "entes_processados": list(entes_processar.keys()),
        "anos_coletados": [str(a) for a in anos] if anos else "2024-2026",
        "fontes_usadas": ["pncp", "siconfi", "siape", "tce_ma", "emendas_ma"],
        "siconfi_disponivel": "erro" not in dados_siconfi,
        "cruzamento_servidores": cruzamento_servidores_ok,
        "versao_coletor": "2.0.0",
    }
    _salvar_json("meta.json", meta)
    # Substitui referências internas para o resumo final
    todos_contratos = contratos_frontend
    todos_alertas = alertas_frontend

    print("\n" + "=" * 70)
    print("[TRANSPARENCIA10] Pipeline concluído com sucesso")
    print(f"  Contratos           : {len(todos_contratos)}")
    print(f"  Alertas (total)     : {len(todos_alertas)}")
    print(f"    → Financeiros     : {contadores_categoria['financeiro']}")
    print(f"    → Conflito        : {contadores_categoria['conflito_interesse']}")
    print(f"    → Nepotismo       : {contadores_categoria['nepotismo']}")
    print(f"  Cruzamento serv.    : {'OK' if cruzamento_servidores_ok else 'FALHOU (não bloqueante)'}")
    print(f"  Entes               : {len(entes_processar)}")
    print(f"  Saída               : {DIR_SAIDA}")
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
  maranhao_estado, sao_luis, raposa, paco_lumiar
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
            "(maranhao_estado | sao_luis | raposa | paco_lumiar)"
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
