"""
Explicador em linguagem simples (opção 2 — pré-gerado).

Gera `frontend/public/data/explicacoes.json` com textos em português claro,
para cidadão comum, explicando entes, indicadores, contratos e empresas.

Estratégia híbrida (sem custo, sem chave de API):
  1. Se houver um Ollama local respondendo rápido, usa o modelo para gerar a
     explicação (IA de verdade, rodando na máquina).
  2. Caso o Ollama não responda no tempo, usa um TEMPLATE determinístico que
     produz texto natural a partir dos números. O portal nunca fica sem
     explicação e o resultado é estático (servível no GitHub Pages).

Tom: simples, factual, SEM acusar ninguém (alinhado ao parecer jurídico).

Uso:
    python collector/explicador.py            # gera tudo
    OLLAMA_MODEL=qwen3.5:2b python collector/explicador.py
"""

import json
import os
from pathlib import Path

import httpx

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "frontend" / "public" / "data"

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3.5:2b")
OLLAMA_TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT", "12"))  # por chamada

NOME_ENTE = {
    "maranhao_estado": "Estado do Maranhão (Secretaria de Cultura)",
    "sao_luis": "Prefeitura de São Luís",
    "raposa": "Prefeitura de Raposa",
    "sao_jose_ribamar": "Prefeitura de São José de Ribamar",
    "paco_lumiar": "Prefeitura de Paço do Lumiar",
}

_ollama_ok = True  # desliga após a 1ª falha para não travar a execução inteira


def _brl(v: float) -> str:
    return "R$ " + f"{float(v or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _ia(prompt: str) -> str | None:
    """Tenta gerar via Ollama; retorna None se indisponível/lento."""
    global _ollama_ok
    if not _ollama_ok:
        return None
    try:
        r = httpx.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 160},
            },
            timeout=OLLAMA_TIMEOUT,
        )
        if r.status_code == 200:
            txt = (r.json().get("response") or "").strip()
            return txt or None
    except (httpx.HTTPError, ValueError):
        _ollama_ok = False  # desiste do Ollama no resto da execução
    return None


def _prompt(base: str) -> str:
    return (
        "Você explica dados públicos para o cidadão comum, em português do Brasil, "
        "linguagem simples, sem jargão e SEM acusar ninguém (use 'merece verificação', "
        "'a apurar'). No máximo 2 frases curtas. Explique: " + base +
        "\nResponda apenas a explicação."
    )


# ── Templates determinísticos (fallback) ─────────────────────────────────────

def _tpl_ente(nome: str, s: dict) -> str:
    g = _brl(s.get("total_gasto", 0))
    nc = s.get("total_contratos", 0)
    na = s.get("total_alertas", 0)
    base = (
        f"{nome} aparece com {g} em gastos de cultura e {nc} contrato(s) nos dados públicos. "
        f"{na} ponto(s) merecem verificação."
        if nc else
        f"{nome} aparece com {g} em execução de cultura nos dados públicos (sem contratos "
        f"individuais publicados no período)."
    )
    return base + " Os números vêm de fontes oficiais e servem para acompanhar o gasto, não são acusação."


def _tpl_contrato(c: dict) -> str:
    v = _brl(c.get("valor", 0))
    forn = c.get("fornecedor") or "a empresa contratada"
    obj = (c.get("objeto") or "").strip()
    obj = (obj[:120] + "…") if len(obj) > 120 else obj
    nalert = len(c.get("alertas", []))
    txt = f"Contrato de {v} com {forn}. Objeto: {obj}"
    if nalert:
        txt += f" Há {nalert} ponto(s) que merecem verificação neste contrato."
    return txt


def _tpl_empresa(e: dict) -> str:
    v = _brl(e.get("total_valor", 0))
    nome = e.get("razao_social") or e.get("nome") or "A empresa"
    nc = e.get("num_contratos", 0)
    cap = e.get("capital_social", 0)
    txt = f"{nome} recebeu {v} em {nc} contrato(s) de cultura."
    if cap and e.get("total_valor", 0) > 50 * cap:
        txt += f" O capital social declarado ({_brl(cap)}) é muito menor que o total contratado — divergência que merece verificação."
    return txt


REGRAS_TXT = {
    "NOME_IDENTICO_SERVIDOR": "O nome de um sócio da empresa é igual ao de um servidor público. Coincidência de nome não confirma que é a mesma pessoa — é apenas um ponto a verificar.",
    "SOBRENOMES_COINCIDENTES": "Um sócio da empresa e um servidor público têm os mesmos sobrenomes, na mesma ordem. Não comprova parentesco — é apenas um ponto a apurar.",
    "CAPITAL_INCOMPATIVEL": "O capital social declarado da empresa é muito menor que o valor do contrato. É uma divergência cadastral que merece verificação.",
    "VALOR_INCONSISTENTE": "O valor do contrato parece incompatível com o porte da empresa. Pode ser erro de digitação na fonte oficial ou algo a verificar.",
    "PRECO_ABUSIVO": "O valor está acima da média observada para serviços parecidos. É uma comparação estatística, não um julgamento de legalidade.",
    "EMPRESA_NOVA": "A empresa foi aberta pouco antes de assinar o contrato. Quando o valor é alto, merece um olhar atento.",
    "EMPRESA_SANCIONADA": "A empresa consta em uma lista oficial de sanção (CEIS/CNEP). Vale checar se a sanção estava vigente.",
    "DUPLICIDADE_CONTRATO": "Contratos muito parecidos, com o mesmo fornecedor, em pouco tempo. Pode indicar repetição que merece verificação.",
    "FORNECEDOR_MONOPOLIO": "Um único fornecedor concentra boa parte dos contratos do órgão, sinal de pouca concorrência.",
    "CONTRATO_RETIFICADO": "O contrato teve alterações registradas depois de publicado (valor, prazo, etc.).",
    "CONTRATO_SEM_LICITACAO": "Contrato por dispensa/inexigibilidade acima do teto — situação que exige justificativa.",
}


def main() -> None:
    def carregar(nome, default):
        p = DATA / nome
        if not p.exists():
            return default
        return json.loads(p.read_text(encoding="utf-8"))

    stats = carregar("stats.json", {}).get("stats", {})
    contratos = carregar("contratos.json", [])
    cruz = carregar("servidores.json", {}).get("cruzamentos", [])

    # Agrega empresas por CNPJ (espelho do hook do frontend)
    porc = {}
    for c in contratos:
        k = c.get("cnpj") or c.get("fornecedor")
        if not k:
            continue
        e = porc.setdefault(k, {
            "cnpj": c.get("cnpj", ""), "nome": c.get("fornecedor", ""),
            "razao_social": c.get("razao_social", ""), "total_valor": 0.0,
            "num_contratos": 0, "capital_social": c.get("capital_social", 0),
        })
        e["total_valor"] += c.get("valor", 0) or 0
        e["num_contratos"] += 1
    empresas = sorted(porc.values(), key=lambda x: x["total_valor"], reverse=True)

    # liga alertas aos contratos
    por_contrato = {}
    for c in contratos:
        por_contrato[c["id"]] = c.setdefault("alertas", [])
    # (alertas.json não traz alertas embutidos; contagem via score_risco como proxy)

    out = {"entes": {}, "regras": dict(REGRAS_TXT), "contratos": {}, "empresas": {}, "fonte_ia": OLLAMA_MODEL}

    print(f"[EXPLICADOR] Ollama modelo={OLLAMA_MODEL} timeout={OLLAMA_TIMEOUT}s (cai p/ template se lento)")

    # Entes (tenta IA; cai p/ template)
    for chave, s in stats.items():
        nome = NOME_ENTE.get(chave, chave)
        ia = _ia(_prompt(
            f"{nome} aparece com {_brl(s.get('total_gasto',0))} em cultura, "
            f"{s.get('total_contratos',0)} contratos e {s.get('total_alertas',0)} pontos a verificar."
        ))
        out["entes"][chave] = ia or _tpl_ente(nome, s)
    print(f"[EXPLICADOR] {len(out['entes'])} entes")

    # Contratos (template — instantâneo; IA seria lenta para centenas)
    for c in contratos:
        out["contratos"][c["id"]] = _tpl_contrato(c)
    print(f"[EXPLICADOR] {len(out['contratos'])} contratos")

    # Empresas top 50
    for e in empresas[:50]:
        out["empresas"][e["cnpj"] or e["nome"]] = _tpl_empresa(e)
    print(f"[EXPLICADOR] {len(out['empresas'])} empresas")

    destino = DATA / "explicacoes.json"
    destino.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[EXPLICADOR] salvo: {destino} (IA ativa: {_ollama_ok})")


if __name__ == "__main__":
    main()
