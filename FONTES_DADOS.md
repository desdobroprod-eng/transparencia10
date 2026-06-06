# Documentação das Fontes de Dados — Transparencia10

Todas as fontes utilizadas são APIs públicas de órgãos oficiais do governo federal brasileiro. Nenhuma autenticação é exigida atualmente. Os dados são obtidos exclusivamente para fins de controle social, conforme previsto na Lei de Acesso à Informação (Lei 12.527/2011).

---

## Sumário das Fontes

| Fonte | Órgão responsável | Dado obtido | Autenticação | Uso no sistema |
|---|---|---|---|---|
| PNCP | Ministério da Gestão | Contratos públicos | Não | Coleta principal de contratos |
| SICONFI | Tesouro Nacional | Execução orçamentária (RREO) | Não | Dados fiscais dos entes |
| cnpj.ws | (espelho público Receita Federal) | Dados cadastrais de CNPJ | Não | Verificação de fornecedores |
| CEIS | CGU / Portal Transparência | Empresas sancionadas | Não | Verificação de sanções |
| CNEP | CGU / Portal Transparência | Empresas punidas | Não | Verificação de sanções |

---

## 1. PNCP — Portal Nacional de Contratações Públicas

**Órgão:** Ministério da Gestão e da Inovação em Serviços Públicos  
**URL base:** `https://pncp.gov.br/api/pncp/v1`  
**Documentação oficial:** `https://pncp.gov.br/app/editais`  
**Swagger:** `https://pncp.gov.br/api/pncp/swagger-ui.html`

### Autenticação

Nenhuma. API pública sem necessidade de token ou cadastro.

### Endpoint utilizado

```
GET /contratos
```

**Parâmetros enviados pelo sistema:**

| Parâmetro | Tipo | Exemplo | Descrição |
|---|---|---|---|
| `codigoMunicipioIbge` | string | `2111300` | Código IBGE do município (7 dígitos) ou do estado (2 dígitos) |
| `dataInicial` | string | `20260101` | Data de início no formato `YYYYMMDD` |
| `dataFinal` | string | `20261231` | Data de fim no formato `YYYYMMDD` |
| `pagina` | int | `1` | Página para paginação |
| `tamanhoPagina` | int | `500` | Resultados por página (máximo aceito pela API) |

**Resposta esperada:**
```json
{
  "data": [
    {
      "cnpjFornecedor": "12345678000190",
      "objetoContrato": "Contratação de empresa para festival cultural",
      "valorInicial": 85000.00,
      "modalidadeNome": "Pregão Eletrônico",
      "dataAssinatura": "2026-03-15",
      "dataPublicacao": "2026-03-18",
      "nomeUnidadeOrgao": "Secretaria de Cultura"
    }
  ]
}
```

### Limites de rate

A API do PNCP não publica limites oficiais de taxa de requisição. O sistema faz no máximo 4 chamadas por ciclo de coleta (uma por ente monitorado), totalizando ~24 chamadas por dia. Não há risco de bloqueio neste volume.

### Como interpretar os dados

- **`valorInicial`:** Valor original do contrato na assinatura. Pode diferir do valor final executado se houver aditivos.
- **`modalidadeNome`:** Modalidade de licitação. Valores comuns: `"Pregão Eletrônico"`, `"Dispensa de Licitação"`, `"Inexigibilidade"`, `"Concorrência"`. O sistema usa "dispensa" como critério de fracionamento.
- **`objetoContrato`:** Descrição textual do objeto — usado para filtro por palavras-chave de cultura e para detecção de duplicidade.
- **`codigoMunicipioIbge`:** Para estados, usar apenas os 2 primeiros dígitos (MA = `21`). Para municípios, usar os 7 dígitos.

### Palavras-chave usadas para filtro de cultura

O sistema filtra contratos cujo `objetoContrato` ou `nomeUnidadeOrgao` contenha ao menos uma das palavras:

```
cultura, cultural, arte, artístico, festival, teatro,
música, dança, patrimônio, museu, biblioteca, show,
evento cultural, secretaria de cultura
```

---

## 2. SICONFI — Sistema de Informações Contábeis e Fiscais

**Órgão:** Secretaria do Tesouro Nacional (STN)  
**URL base:** `https://apidatalake.tesouro.gov.br/ords/siconfi/tt`  
**Documentação oficial:** `https://apidatalake.tesouro.gov.br/docs/siconfi/`

### Autenticação

Nenhuma. API pública do Tesouro Nacional.

### Endpoint utilizado

```
GET /rreo
```

**Parâmetros enviados pelo sistema:**

| Parâmetro | Tipo | Exemplo | Descrição |
|---|---|---|---|
| `an_exercicio` | int | `2026` | Ano do exercício fiscal |
| `nr_periodo` | int | `1` | Número do bimestre (1 a 6) |
| `co_tipo_demonstrativo` | string | `"RREO"` | Tipo de demonstrativo |
| `no_anexo` | string | `"RREO-Anexo 02"` | Anexo específico (despesas por função) |
| `co_uf` | string | `"MA"` | Sigla da UF |
| `id_ente` | string | `"2111300"` | Código IBGE do ente |

### Como interpretar o RREO

O **Relatório Resumido de Execução Orçamentária (RREO)** é publicado bimestralmente pelos entes públicos (municípios e estados) conforme exigência da LRF. O Anexo 02 traz as despesas por **Função**, permitindo isolar os gastos com **Função 13 — Cultura**.

Campos relevantes do Anexo 02:

| Campo | Significado |
|---|---|
| `cd_funcao` | Código da função (13 = Cultura) |
| `vl_dotacao_atualizada` | Dotação orçamentária aprovada para a função no período |
| `vl_despesas_liquidadas` | Valor efetivamente liquidado (pago ou a pagar) |
| `vl_despesas_pagas` | Valor efetivamente pago ao fornecedor |

**Nota:** O sistema coleta o RREO mas o campo não está atualmente exposto nos endpoints principais da API. Está disponível para análises futuras (ex.: comparar dotação × contratos detectados).

---

## 3. cnpj.ws — Dados Públicos de CNPJ

**Operador:** Serviço espelho público dos dados da Receita Federal  
**URL base:** `https://publica.cnpj.ws/cnpj`  
**Documentação:** `https://cnpj.ws/docs`

### Autenticação

Nenhuma para o endpoint público. Versão paga disponível com maior rate limit.

### Endpoint utilizado

```
GET /{cnpj}
```

**Exemplo:**
```
GET https://publica.cnpj.ws/cnpj/12345678000190
```

**Resposta esperada (campos relevantes para o sistema):**
```json
{
  "cnpj": "12345678000190",
  "razao_social": "EMPRESA EXEMPLO LTDA",
  "data_inicio_atividade": "2026-01-10",
  "situacao_cadastral": "Ativa",
  "porte": "ME"
}
```

### Limites de rate

A API pública do cnpj.ws aplica rate limiting não documentado. O sistema realiza uma consulta por CNPJ único por ciclo de 4 horas. **Recomendação:** implementar cache de 24h dos resultados por CNPJ para evitar chamadas repetidas.

### Como interpretar os dados

- **`data_inicio_atividade`:** Data de abertura da empresa. Usada pela regra `EMPRESA_NOVA` para calcular a idade da empresa em dias. Formato: `YYYY-MM-DD`.
- **`situacao_cadastral`:** Situação perante a Receita Federal. `"Ativa"` é o status normal. Empresas `"Baixada"`, `"Suspensa"` ou `"Inapta"` recebendo contratos merecem atenção adicional (regra não implementada ainda).
- **`porte`:** Porte da empresa: `ME` (Microempresa), `EPP` (Empresa de Pequeno Porte), `Demais`.

### Base legal

Os dados de CNPJ são públicos por natureza — o Cadastro Nacional de Pessoas Jurídicas é registro público obrigatório. A Receita Federal disponibiliza os dados em bulk via `https://dados.gov.br/dados/conjuntos-dados/cnpj`.

---

## 4. CEIS — Cadastro de Empresas Inidôneas e Suspensas

**Órgão:** Controladoria-Geral da União (CGU)  
**URL base:** `https://api.portaldatransparencia.gov.br/api-de-dados/ceis`  
**Portal:** `https://portaldatransparencia.gov.br/sancoes/ceis`  
**Documentação API:** `https://api.portaldatransparencia.gov.br/swagger-ui.html`

### Autenticação

A API do Portal da Transparência exige registro de e-mail para obter um token (`chave-api`). O cadastro é gratuito e imediato em: `https://api.portaldatransparencia.gov.br/api-de-dados/swagger-ui.html`

**Atenção:** O código atual não passa o header de autenticação, o que pode causar erros 401 em produção. Adicionar o header `chave-api: <TOKEN>` às chamadas CEIS e CNEP.

### Endpoint utilizado

```
GET /ceis
```

**Parâmetros enviados pelo sistema:**

| Parâmetro | Tipo | Exemplo | Descrição |
|---|---|---|---|
| `cnpjSancionado` | string | `12345678000190` | CNPJ sem formatação |
| `pagina` | int | `1` | Página da paginação |

**Resposta quando o CNPJ está sancionado:**
```json
{
  "data": [
    {
      "cnpjSancionado": "12345678000190",
      "nomeSancionado": "EMPRESA EXEMPLO LTDA",
      "tipoSancao": "Suspensão",
      "dataInicioSancao": "2025-01-01",
      "dataFimSancao": "2027-01-01",
      "orgaoSancionador": "Ministério da Saúde",
      "fundamentacaoLegal": "Art. 87 da Lei 8.666/93"
    }
  ]
}
```

**Resposta quando o CNPJ não está sancionado:**
```json
{
  "data": []
}
```

### Como interpretar os dados

- O CEIS lista empresas suspensas ou inidôneas para contratar com a **Administração Pública Federal**. Uma empresa no CEIS **não pode legalmente receber contratos federais**, mas a restrição pode não se aplicar automaticamente a contratos estaduais/municipais.
- A presença no CEIS com contrato ativo com secretaria estadual ou municipal é um forte indicador de irregularidade.
- Verificar se a sanção está **vigente** (`dataFimSancao` maior que a data atual).

---

## 5. CNEP — Cadastro Nacional de Empresas Punidas

**Órgão:** Controladoria-Geral da União (CGU)  
**URL base:** `https://api.portaldatransparencia.gov.br/api-de-dados/cnep`  
**Portal:** `https://portaldatransparencia.gov.br/sancoes/cnep`

### Autenticação

Igual ao CEIS — requer header `chave-api` obtido em cadastro gratuito no portal.

### Endpoint utilizado

```
GET /cnep
```

**Parâmetros:** Idênticos ao CEIS (`cnpjSancionado`, `pagina`).

### Como interpretar os dados

O CNEP registra sanções aplicadas com base na **Lei Anticorrupção (Lei 12.846/2013)**. As penalidades são mais severas que o CEIS e incluem:
- Multa
- Publicação extraordinária da decisão condenatória
- Proibição de receber incentivos, subsídios e financiamentos públicos

Empresas no CNEP foram condenadas por atos de **corrupção** — fraturação, suborno, fraude em licitação. A presença no CNEP com contrato público ativo é indicador de alto risco (score 95 no sistema).

### Diferença entre CEIS e CNEP

| | CEIS | CNEP |
|---|---|---|
| Base legal | Lei 8.666/93, 8.112/90 | Lei 12.846/2013 (Anticorrupção) |
| Aplicação | Suspensão/inidoneidade para contratar | Punição por ato de corrupção |
| Gravidade | Alta | Muito alta |

---

## 6. Portal da Transparência Federal

**Órgão:** Controladoria-Geral da União (CGU)  
**URL base:** `https://api.portaldatransparencia.gov.br/api-de-dados`  
**Documentação:** `https://api.portaldatransparencia.gov.br/swagger-ui.html`

### Uso atual no sistema

O Portal da Transparência serve como **hub** para CEIS e CNEP (mesma base URL). Dados adicionais disponíveis para implementações futuras:

| Endpoint | Dado disponível |
|---|---|
| `/convenios` | Convênios celebrados com municípios |
| `/despesas` | Despesas por favorecido/CNPJ |
| `/emendas` | Emendas parlamentares |
| `/servidores` | Servidores públicos (não utilizado — dados de pessoas) |

### Autenticação

Requer header `chave-api` obtido em cadastro gratuito:  
1. Acessar `https://api.portaldatransparencia.gov.br/api-de-dados/swagger-ui.html`  
2. Clicar em "Cadastre-se"  
3. Informar e-mail institucional ou pessoal  
4. Receber token por e-mail  
5. Usar em todas as requisições: `chave-api: SEU_TOKEN`

### Limites de rate

A CGU não publica limites oficiais. Prática recomendada: máximo 10 requisições por segundo, com retry em 429.

---

## 7. Códigos IBGE dos Entes Monitorados

| Ente | Código IBGE | Tipo |
|---|---|---|
| Estado do Maranhão | `21` | Estado |
| São Luís | `2111300` | Município |
| São José de Ribamar | `2110856` | Município |
| Paço do Lumiar | `2107704` | Município |

Os códigos IBGE municipais têm 7 dígitos. O código estadual tem 2 dígitos (UF). A API do PNCP aceita ambos os formatos no parâmetro `codigoMunicipioIbge`.

**Fonte oficial para consulta de códigos:** `https://servicodados.ibge.gov.br/api/docs/localidades`

---

## 8. Considerações sobre Qualidade dos Dados

### Inconsistências conhecidas

- **PNCP:** Nem todos os municípios publicam contratos no PNCP pontualmente. Municípios menores podem ter atraso de semanas na publicação.
- **Valores:** O campo `valorInicial` reflete o valor na assinatura. Aditivos contratuais não são capturados na coleta atual.
- **Objetos genéricos:** Alguns contratos têm `objetoContrato` genérico ("Prestação de serviços") sem mencionar "cultura", passando pelo filtro de palavras-chave sem ser capturados.
- **CNPJ inválido:** Alguns registros no PNCP têm campos `cnpjFornecedor` nulos ou malformados. O sistema trata silenciosamente com `if cnpj else {}`.

### Recomendações para evolução

1. Implementar paginação completa no PNCP (atualmente coleta apenas a primeira página de 500 registros por ente).
2. Adicionar endpoint SICONFI ao output da API para cruzamento com dotação orçamentária.
3. Implementar cache de CNPJ com TTL de 24h para reduzir chamadas ao cnpj.ws.
4. Adicionar o header `chave-api` nas chamadas CEIS/CNEP para evitar bloqueios 401.
5. Expandir o período de coleta para anos anteriores (análise histórica).
