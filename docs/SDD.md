# Software Design Document — Transparencia10

**Versão:** 1.0.0  
**Data:** 2026-06-05  
**Escopo:** Backend FastAPI + Frontend Next.js + Motor de Alertas

---

## 1. Visão Geral e Propósito

O **Transparencia10** é um painel público de monitoramento de gastos das Secretarias de Cultura do Maranhão. O sistema coleta dados de APIs governamentais abertas, aplica regras automáticas de detecção de anomalias e exibe os resultados em tempo quase real para qualquer cidadão, sem necessidade de cadastro.

**Objetivo primário:** Aumentar a transparência e facilitar o controle social sobre contratos públicos de cultura no Maranhão, sinalizando automaticamente padrões suspeitos que merecem investigação pelos órgãos de controle (TCE-MA, CGU, MPF).

**Entes monitorados:**

| Chave interna | Nome | Código IBGE |
|---|---|---|
| `maranhao_estado` | Secretaria de Cultura — Estado do MA | `21` |
| `sao_luis` | Secretaria de Cultura — São Luís | `2111300` |
| `sao_jose_ribamar` | Secretaria de Cultura — S.J. Ribamar | `2110856` |
| `paco_lumiar` | Secretaria de Cultura — Paço do Lumiar | `2107704` |

**Premissa legal:** Todos os dados consumidos são públicos, disponibilizados por APIs federais oficiais. O sistema não armazena dados pessoais. Os indicadores de anomalia são sinalizações automáticas — não constituem acusação e devem ser investigados pelos órgãos competentes.

---

## 2. Arquitetura em Camadas (Clean Architecture)

O projeto segue os princípios da Clean Architecture, separando as responsabilidades em camadas bem definidas com dependências unidirecionais (de fora para dentro).

```
┌─────────────────────────────────────────────────────────┐
│                   CAMADA DE APRESENTAÇÃO                │
│         Frontend Next.js (React, TypeScript)            │
│         Porta: 3000 | Vercel (produção)                 │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP/JSON (REST)
┌──────────────────────────▼──────────────────────────────┐
│                  CAMADA DE INTERFACE (API)               │
│             FastAPI — main.py                           │
│             Endpoints REST + APScheduler                │
│             Porta: 8000 | Railway (produção)            │
└──────────────────────────┬──────────────────────────────┘
                           │
         ┌─────────────────┼──────────────────┐
         │                 │                  │
┌────────▼────────┐ ┌──────▼──────┐ ┌────────▼────────┐
│  CAMADA DE      │ │  CAMADA DE  │ │  CAMADA DE      │
│  APLICAÇÃO      │ │  DOMÍNIO    │ │  INFRAESTRUTURA │
│                 │ │             │ │                 │
│ job_coleta()    │ │ detector.py │ │ gov_br.py       │
│ analisar_       │ │ Regras de   │ │ Coletores HTTP  │
│ contrato()      │ │ negócio     │ │ APIs externas   │
└─────────────────┘ └─────────────┘ └─────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                  CACHE EM MEMÓRIA                        │
│      _cache dict (Python in-process)                    │
│      (substituir por Redis em produção escalada)        │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Diagrama de Fluxo de Dados

### 3.1 Fluxo de Coleta (job a cada 4 horas)

```
  APScheduler (4h)
       │
       ▼
  job_coleta()
       │
       ├──► coletar_todos_entes()  ──► PNCP API (4 entes em paralelo)
       │           │                       asyncio.gather()
       │           ▼
       │    filtrar_contratos_cultura()
       │    (keywords: cultura, festival, teatro, etc.)
       │           │
       │           ▼
       │    Para cada ente → Para cada CNPJ único
       │           │
       ├──► verificar_fracionamento(lista_contratos_cnpj)
       │
       └──► verificar_duplicidade(todos_contratos_ente)
       │
       ▼
  Para cada contrato individual:
       │
       ├──► fetch_cnpj_info(cnpj)    ──► cnpj.ws API (pública)
       ├──► fetch_empresa_sancionada(cnpj) ──► CEIS + CNEP APIs
       │
       ├──► verificar_empresa_nova(cnpj_info, valor)
       └──► verificar_sancionado(cnpj, esta_sancionado, valor)
       │
       ▼
  calcular_score_final(resultados)
       │
       ▼
  _cache["alertas"] ← lista de alertas com score/nivel
  _cache["contratos"] ← dados brutos por ente
  _cache["stats"] ← resumo por ente
```

### 3.2 Fluxo de Leitura (dashboard frontend)

```
  Browser (usuário)
       │
       ▼  fetch a cada 30s
  Next.js page.tsx
       │
       ├──► GET /stats   ──► _cache["stats"]
       └──► GET /alertas ──► _cache["alertas"]
       │
       ▼
  Renderiza:
  - Cards por ente (contratos + alertas)
  - Feed de alertas ordenados por score DESC
  - Score badge com cor (vermelho ≥80 / amarelo ≥60)
  - Link externo para CNPJ via cnpj.ws
```

---

## 4. Descrição de Cada Módulo

### 4.1 `backend/main.py` — Camada de Interface e Aplicação

Responsável por:
- Inicializar a aplicação FastAPI com CORS aberto (dados públicos, sem autenticação)
- Gerenciar o cache em memória (`_cache`) que serve como fonte de verdade temporária
- Orquestrar o job de coleta via APScheduler (intervalo de 4 horas)
- Expor os endpoints REST para o frontend

**Componentes internos:**

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `_cache` | dict Python | Estado compartilhado em memória |
| `scheduler` | AsyncIOScheduler | Execução periódica do job |
| `job_coleta()` | async function | Orquestra coleta + análise + atualização do cache |
| `analisar_contrato()` | async function | Aplica regras de detecção a um contrato individual |

**Decisão de design:** O cache em memória é intencional para simplicidade de deploy em Railway com instância única. Para escala horizontal, substituir por Redis com TTL de 4 horas.

### 4.2 `backend/collectors/gov_br.py` — Camada de Infraestrutura

Responsável por toda comunicação com APIs externas. Isola o sistema de mudanças nas APIs governamentais.

| Função | API alvo | Propósito |
|---|---|---|
| `fetch_contratos_pncp()` | PNCP | Contratos por código IBGE e ano |
| `fetch_rreo_municipio()` | SICONFI | Execução orçamentária (RREO) |
| `fetch_cnpj_info()` | cnpj.ws | Dados cadastrais do fornecedor |
| `fetch_empresa_sancionada()` | CEIS + CNEP | Verificação de sanções federais |
| `filtrar_contratos_cultura()` | — | Filtro por palavras-chave de cultura |
| `coletar_todos_entes()` | — | Coleta paralela de todos os entes via `asyncio.gather` |

**Paralelismo:** `coletar_todos_entes()` dispara as 4 requisições ao PNCP simultaneamente com `asyncio.gather`, reduzindo o tempo de coleta de ~16s para ~4s em condições normais.

**Tratamento de erros:** Exceções de rede são capturadas pelo `asyncio.gather(return_exceptions=True)` e registradas no campo `"erro"` do ente afetado, sem interromper a coleta dos demais.

### 4.3 `backend/domain/rules/detector.py` — Camada de Domínio

Núcleo das regras de negócio. Completamente desacoplado de infraestrutura e framework — pode ser testado unitariamente sem rede ou banco.

**Estrutura de dados:**

```python
@dataclass
class ResultadoRegra:
    regra: str    # identificador da regra
    score: int    # 0–100
    motivo: str   # descrição legível
    dados: dict   # evidências brutas
```

**Regras implementadas:**

| Regra | ID | Trigger | Score |
|---|---|---|---|
| Empresa Nova | `EMPRESA_NOVA` | Empresa < 180 dias + contrato ≥ R$50k | 85 (< 90 dias) / 70 (90–179 dias) |
| Fracionamento | `FRACIONAMENTO_LICITACAO` | ≥ 2 dispensas ao mesmo CNPJ acima do teto legal | 75 |
| Duplicidade | `DUPLICIDADE_CONTRATO` | Objeto similar + mesmo CNPJ em ≤ 30 dias | 80 |
| Empresa Sancionada | `EMPRESA_SANCIONADA` | CNPJ consta em CEIS ou CNEP | 95 |

**Cálculo do score final:**

```
score = min(100, média_dos_scores + qtd_regras_disparadas × 5)

nivel "critico"  → score ≥ 80
nivel "atencao"  → score ≥ 60
nivel "baixo"    → score < 60
nivel "normal"   → nenhuma regra disparada (score = 0)
```

O multiplicador `× 5` por regra penaliza contratos que disparam múltiplas regras simultaneamente (acumulação de indícios).

### 4.4 `frontend/src/app/page.tsx` — Interface do Usuário

Single Page Application em Next.js com:
- **Polling passivo:** `setInterval` de 30 segundos chama `/stats` e `/alertas`
- **Cards por ente:** exibe total de contratos de cultura e contagem de alertas com indicador colorido
- **Feed de alertas:** lista ordenada por score decrescente com badge colorido (vermelho/amarelo/cinza), motivo textual e link externo ao CNPJ
- **Rodapé legal:** aviso de que os indicadores não constituem acusação

---

## 5. Decisões de Design e Trade-offs

### 5.1 Cache em memória vs. banco de dados

**Decisão:** Cache Python in-process (`_cache` dict).  
**Motivo:** Zero dependência de infraestrutura externa. Deploy em Railway com um único container sem configuração adicional. Dados são recoletados a cada 4h de qualquer forma, tornando persistência desnecessária.  
**Trade-off:** Reinicialização do serviço zera o cache e dispara nova coleta imediata. Sem histórico entre deploys. Sem suporte a múltiplas réplicas horizontais.  
**Migração recomendada:** Redis com `SETEX` de 4 horas para escala horizontal.

### 5.2 CORS aberto (`allow_origins=["*"]`)

**Decisão:** CORS sem restrição de origem.  
**Motivo:** Os dados são 100% públicos. Não há autenticação nem dados sensíveis. Qualquer desenvolvedor ou jornalista pode consumir a API diretamente do browser.  
**Trade-off:** Sem proteção contra scraping intensivo. Mitigar com rate limiting em produção (ex.: `slowapi`).

### 5.3 Polling no frontend vs. WebSocket

**Decisão:** `setInterval` de 30 segundos.  
**Motivo:** Os dados backend são atualizados a cada 4 horas. Polling de 30s é mais que suficiente para exibir novidades e é muito mais simples de implementar e debugar.  
**Trade-off:** 30s de latência máxima na exibição de novos alertas. Aceitável para o caso de uso.

### 5.4 Filtragem por palavras-chave de cultura

**Decisão:** Lista de strings para filtrar contratos relevantes.  
**Motivo:** O PNCP não oferece filtro por unidade orçamentária ou função programática via query params. A filtragem por objeto do contrato e nome da unidade é a abordagem pragmática disponível.  
**Trade-off:** Possível subcobertura (contratos de cultura com objetos genéricos) e sobrecobertura (contratos de outras secretarias com palavras coincidentes). Revisar a lista de keywords periodicamente.

### 5.5 Teto de fracionamento hardcoded (R$17.600)

**Decisão:** Constante `teto_dispensa = 17_600` no código.  
**Motivo:** Valor correspondente ao teto de dispensa de licitação para a área de cultura no MA em 2024, conforme a Lei 14.133/2021.  
**Trade-off:** O teto é atualizado periodicamente por decreto. Deve ser externalizado para variável de ambiente ou tabela de configuração.

---

## 6. Segurança e Conformidade Legal

### 6.1 Base legal para uso dos dados

Todos os dados consumidos pelo sistema são públicos por força de lei:
- **Lei de Acesso à Informação (Lei 12.527/2011):** obriga órgãos públicos a disponibilizar ativamente dados de contratos, despesas e convênios.
- **Lei de Responsabilidade Fiscal (LC 101/2000):** exige publicação do RREO pelos municípios.
- **Lei 14.133/2021 (Nova Lei de Licitações):** determina publicação de contratos no PNCP.
- **Dados cadastrais de CNPJ:** públicos por natureza (Receita Federal).

### 6.2 Ausência de dados pessoais

O sistema não coleta, processa nem armazena dados pessoais (CPF, nome de pessoa física, endereço). Os dados de fornecedores são exclusivamente de pessoas jurídicas (CNPJ). Não há necessidade de adequação à LGPD para os dados processados.

### 6.3 Aviso de não-acusação

Todas as camadas do sistema (backend, frontend, README) incluem o aviso explícito de que os indicadores de anomalia são sinalizações automáticas baseadas em dados públicos e **não constituem acusação**. O propósito é direcionar investigação pelos órgãos competentes (TCE-MA, CGU, MPF).

### 6.4 Ausência de autenticação

Intencional: o sistema é de acesso público, sem dados sensíveis e sem operações de escrita nos sistemas de origem. A única rota de escrita (`POST /coletar`) deve ser protegida por API key em produção para evitar abuso (triggering excessivo de coleta).

### 6.5 Limites de rate nas APIs externas

O sistema realiza chamadas a APIs governamentais. Em produção, implementar:
- Retry com backoff exponencial (ex.: `tenacity`)
- Respeito aos headers `Retry-After` nas respostas 429
- Cache de resultados CNPJ por 24h para reduzir chamadas repetidas ao cnpj.ws
