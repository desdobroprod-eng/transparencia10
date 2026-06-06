"""
Transparencia10 — API Backend
FastAPI + coleta assíncrona + motor de alertas
"""
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
import asyncio
import json
import os

from collectors.gov_br import coletar_todos_entes, fetch_cnpj_info, fetch_empresa_sancionada
from domain.rules.detector import (
    verificar_empresa_nova,
    verificar_fracionamento,
    verificar_duplicidade,
    verificar_sancionado,
    calcular_score_final,
)

app = FastAPI(
    title="Transparencia10 API",
    description="Monitoramento de gastos públicos — Secretarias de Cultura MA",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache em memória (substituir por Redis em produção)
_cache = {
    "contratos": {},
    "alertas": [],
    "ultima_atualizacao": None,
    "stats": {},
}

scheduler = AsyncIOScheduler()


async def analisar_contrato(contrato: dict, ente_chave: str) -> dict:
    """Aplica todas as regras de detecção a um contrato."""
    cnpj = contrato.get("cnpjFornecedor", "")
    valor = float(contrato.get("valorInicial") or 0)

    resultados = []

    # Busca dados do fornecedor
    cnpj_info = await fetch_cnpj_info(cnpj) if cnpj else {}
    sancionado = await fetch_empresa_sancionada(cnpj) if cnpj else False

    r1 = verificar_empresa_nova(cnpj_info, valor)
    if r1:
        resultados.append(r1)

    r2 = verificar_sancionado(cnpj, sancionado, valor)
    if r2:
        resultados.append(r2)

    analise = calcular_score_final(resultados)

    return {
        **contrato,
        "ente": ente_chave,
        "analise": analise,
        "analisado_em": datetime.utcnow().isoformat(),
    }


async def job_coleta():
    """Job executado a cada 4 horas — coleta e analisa todos os entes."""
    print(f"[{datetime.now()}] Iniciando coleta...")

    dados = await coletar_todos_entes()

    alertas = []
    for ente_chave, ente_dados in dados.items():
        contratos = ente_dados.get("contratos", [])

        # Verifica fracionamento por fornecedor
        por_fornecedor: dict[str, list] = {}
        for c in contratos:
            cnpj = c.get("cnpjFornecedor", "desconhecido")
            por_fornecedor.setdefault(cnpj, []).append(c)

        for cnpj, lista in por_fornecedor.items():
            r = verificar_fracionamento(lista)
            if r:
                alertas.append({
                    "ente": ente_chave,
                    "cnpj": cnpj,
                    "regra": r.regra,
                    "score": r.score,
                    "motivo": r.motivo,
                    "dados": r.dados,
                    "detectado_em": datetime.utcnow().isoformat(),
                })

        # Verifica duplicidades
        dups = verificar_duplicidade(contratos)
        for d in dups:
            alertas.append({
                "ente": ente_chave,
                **d.__dict__,
                "detectado_em": datetime.utcnow().isoformat(),
            })

    _cache["contratos"] = dados
    _cache["alertas"] = alertas
    _cache["ultima_atualizacao"] = datetime.utcnow().isoformat()
    _cache["stats"] = {
        ente: {
            "total_contratos": v.get("total_cultura", 0),
            "total_alertas": sum(1 for a in alertas if a.get("ente") == ente),
        }
        for ente, v in dados.items()
    }

    print(f"[{datetime.now()}] Coleta concluída. {len(alertas)} alertas detectados.")


@app.on_event("startup")
async def startup():
    scheduler.add_job(job_coleta, "interval", hours=4, id="coleta_principal")
    scheduler.start()
    # Primeira coleta ao iniciar
    asyncio.create_task(job_coleta())


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "app": "Transparencia10",
        "status": "online",
        "ultima_atualizacao": _cache["ultima_atualizacao"],
        "docs": "/docs",
    }


@app.get("/contratos")
def get_contratos(ente: str = None):
    """Retorna contratos coletados, opcionalmente filtrados por ente."""
    if ente:
        return _cache["contratos"].get(ente, {})
    return _cache["contratos"]


@app.get("/alertas")
def get_alertas(nivel_minimo: int = 0):
    """Retorna alertas detectados. nivel_minimo filtra por score."""
    alertas = _cache["alertas"]
    if nivel_minimo:
        alertas = [a for a in alertas if a.get("score", 0) >= nivel_minimo]
    return {
        "total": len(alertas),
        "alertas": sorted(alertas, key=lambda x: x.get("score", 0), reverse=True),
    }


@app.get("/stats")
def get_stats():
    """Resumo por ente — usado pelos cards do dashboard."""
    return {
        "stats": _cache["stats"],
        "total_alertas": len(_cache["alertas"]),
        "ultima_atualizacao": _cache["ultima_atualizacao"],
    }


@app.post("/coletar")
async def forcar_coleta(background_tasks: BackgroundTasks):
    """Força nova coleta imediatamente (admin)."""
    background_tasks.add_task(job_coleta)
    return {"status": "coleta iniciada"}
