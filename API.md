# Documentação da API — Transparencia10

**Base URL (produção):** `https://<seu-subdominio>.railway.app`  
**Base URL (local):** `http://localhost:8000`  
**Documentação interativa:** `{BASE_URL}/docs` (Swagger UI automático do FastAPI)  
**Autenticação:** Nenhuma (API pública)  
**Formato:** JSON  
**Versão:** 1.0.0

---

## Sumário de Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Status da aplicação |
| GET | `/contratos` | Lista contratos coletados por ente |
| GET | `/alertas` | Lista alertas de anomalia detectados |
| GET | `/stats` | Resumo estatístico por ente |
| POST | `/coletar` | Força nova coleta imediatamente |

---

## GET `/`

Verifica se a API está online e retorna metadados básicos.

### Parâmetros
Nenhum.

### Resposta 200

```json
{
  "app": "Transparencia10",
  "status": "online",
  "ultima_atualizacao": "2026-06-05T14:00:00.123456",
  "docs": "/docs"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `app` | string | Nome da aplicação |
| `status` | string | Sempre `"online"` se a API responder |
| `ultima_atualizacao` | string (ISO 8601 UTC) | Timestamp da última coleta concluída. `null` se ainda não houve coleta. |
| `docs` | string | Caminho para o Swagger UI |

### Exemplo curl

```bash
curl https://<host>/
```

---

## GET `/contratos`

Retorna os contratos coletados das APIs governamentais, filtrados por palavras-chave de cultura. Cada coleta cobre o ano corrente.

### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `ente` | string | Não | Chave do ente para filtrar. Se omitido, retorna todos os entes. |

**Valores válidos para `ente`:**

| Valor | Ente |
|---|---|
| `maranhao_estado` | Secretaria de Cultura — Estado do MA |
| `sao_luis` | Secretaria de Cultura — São Luís |
| `sao_jose_ribamar` | Secretaria de Cultura — S.J. Ribamar |
| `paco_lumiar` | Secretaria de Cultura — Paço do Lumiar |

### Resposta 200 — Sem filtro (todos os entes)

```json
{
  "maranhao_estado": {
    "total_coletado": 312,
    "total_cultura": 47,
    "coletado_em": "2026-06-05T14:00:01.000000",
    "contratos": [
      {
        "cnpjFornecedor": "12345678000190",
        "objetoContrato": "Contratação de empresa para realização de festival cultural",
        "valorInicial": 85000.00,
        "modalidadeNome": "Pregão Eletrônico",
        "dataAssinatura": "2026-03-15",
        "nomeUnidadeOrgao": "Secretaria de Cultura"
      }
    ]
  },
  "sao_luis": {
    "total_coletado": 215,
    "total_cultura": 31,
    "coletado_em": "2026-06-05T14:00:01.000000",
    "contratos": [ ... ]
  }
}
```

### Resposta 200 — Com filtro por ente

```bash
curl "https://<host>/contratos?ente=sao_luis"
```

```json
{
  "total_coletado": 215,
  "total_cultura": 31,
  "coletado_em": "2026-06-05T14:00:01.000000",
  "contratos": [ ... ]
}
```

### Resposta em caso de erro na coleta do ente

```json
{
  "maranhao_estado": {
    "erro": "Connection timeout",
    "contratos": []
  }
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `total_coletado` | int | Total de contratos retornados pelo PNCP antes do filtro de cultura |
| `total_cultura` | int | Total após filtro por palavras-chave de cultura |
| `coletado_em` | string (ISO 8601 UTC) | Timestamp da coleta |
| `contratos` | array | Lista de objetos de contrato conforme schema do PNCP |
| `erro` | string | Presente apenas se a coleta do ente falhou |

---

## GET `/alertas`

Retorna os alertas de anomalia detectados pelo motor de regras, ordenados por score decrescente.

### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|---|---|---|---|---|
| `nivel_minimo` | int | Não | `0` | Score mínimo para incluir o alerta. Use `60` para apenas alertas de atenção ou críticos, `80` para apenas críticos. |

### Resposta 200

```json
{
  "total": 3,
  "alertas": [
    {
      "ente": "sao_luis",
      "cnpj": "98765432000100",
      "regra": "EMPRESA_SANCIONADA",
      "score": 95,
      "motivo": "CNPJ 98765432000100 consta em lista de empresas sancionadas (CEIS/CNEP) e recebeu R$120.000,00",
      "dados": {
        "cnpj": "98765432000100",
        "valor": 120000.00
      },
      "detectado_em": "2026-06-05T14:00:05.000000"
    },
    {
      "ente": "maranhao_estado",
      "cnpj": "11111111000111",
      "regra": "DUPLICIDADE_CONTRATO",
      "score": 80,
      "motivo": "Contrato com objeto similar ao mesmo fornecedor em 12 dias de diferença",
      "dados": {
        "delta_dias": 12,
        "cnpj": "11111111000111"
      },
      "detectado_em": "2026-06-05T14:00:05.000000"
    },
    {
      "ente": "paco_lumiar",
      "cnpj": "22222222000122",
      "regra": "FRACIONAMENTO_LICITACAO",
      "score": 75,
      "motivo": "3 dispensas ao mesmo fornecedor totalizam R$45.000,00 (teto legal: R$17.600,00)",
      "dados": {
        "total": 45000.00,
        "dispensas": 3
      },
      "detectado_em": "2026-06-05T14:00:05.000000"
    }
  ]
}
```

**Regras possíveis no campo `regra`:**

| Valor | Descrição | Score típico |
|---|---|---|
| `EMPRESA_NOVA` | Empresa com < 180 dias recebendo contrato ≥ R$50k | 70–85 |
| `FRACIONAMENTO_LICITACAO` | Soma de dispensas ao mesmo CNPJ supera o teto legal | 75 |
| `DUPLICIDADE_CONTRATO` | Objeto similar ao mesmo CNPJ em ≤ 30 dias | 80 |
| `EMPRESA_SANCIONADA` | CNPJ consta no CEIS ou CNEP | 95 |

**Níveis de risco:**

| Score | Nível |
|---|---|
| ≥ 80 | `critico` |
| 60–79 | `atencao` |
| < 60 | `baixo` |

### Exemplo curl — apenas alertas críticos

```bash
curl "https://<host>/alertas?nivel_minimo=80"
```

---

## GET `/stats`

Retorna um resumo por ente, utilizado pelo dashboard nos cards de status.

### Parâmetros
Nenhum.

### Resposta 200

```json
{
  "stats": {
    "maranhao_estado": {
      "total_contratos": 47,
      "total_alertas": 2
    },
    "sao_luis": {
      "total_contratos": 31,
      "total_alertas": 1
    },
    "sao_jose_ribamar": {
      "total_contratos": 8,
      "total_alertas": 0
    },
    "paco_lumiar": {
      "total_contratos": 12,
      "total_alertas": 1
    }
  },
  "total_alertas": 4,
  "ultima_atualizacao": "2026-06-05T14:00:05.000000"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `stats` | object | Mapa de chave do ente → métricas |
| `stats[ente].total_contratos` | int | Total de contratos de cultura coletados |
| `stats[ente].total_alertas` | int | Quantidade de alertas associados ao ente |
| `total_alertas` | int | Total global de alertas de todos os entes |
| `ultima_atualizacao` | string (ISO 8601 UTC) | Timestamp da última coleta bem-sucedida |

### Exemplo curl

```bash
curl https://<host>/stats
```

---

## POST `/coletar`

Força o início de uma nova coleta imediatamente, sem aguardar o próximo ciclo de 4 horas. A coleta é executada em background — a resposta é retornada imediatamente.

**Aviso:** Este endpoint deve ser protegido por autenticação em produção (API key) para evitar triggering excessivo das APIs governamentais externas.

### Parâmetros
Nenhum.

### Resposta 200

```json
{
  "status": "coleta iniciada"
}
```

A coleta ocorre em background. Consulte `/stats` após alguns segundos para verificar a atualização do campo `ultima_atualizacao`.

### Exemplo curl

```bash
curl -X POST https://<host>/coletar
```

---

## Códigos de Status HTTP

| Código | Significado |
|---|---|
| `200` | Sucesso |
| `422` | Parâmetro inválido (FastAPI retorna detalhe automático) |
| `500` | Erro interno (raro — verificar logs do Railway) |

---

## Notas de Uso

- O cache é atualizado a cada **4 horas** automaticamente via APScheduler.
- O frontend consulta `/stats` e `/alertas` a cada **30 segundos**.
- Os dados dos campos `contratos` seguem o schema da API do PNCP — consulte a documentação em `https://pncp.gov.br/api/pncp/swagger-ui.html` para o detalhamento completo dos campos.
- Todos os timestamps estão em **UTC (ISO 8601)**.
