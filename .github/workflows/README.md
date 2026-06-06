# GitHub Actions — Transparencia10

Este diretório contém os workflows de CI/CD do projeto.

---

## Workflows

### `collect.yml` — Coleta Automática de Dados

| Propriedade | Valor |
|---|---|
| **Frequência** | A cada 4 horas (`0 */4 * * *`) |
| **Disparo manual** | Sim (`workflow_dispatch`) |
| **Runner** | `ubuntu-latest` |

**O que faz:**

1. Faz checkout completo do repositório.
2. Instala Python 3.12 e as dependências em `collector/requirements.txt`.
3. Executa `collector/run.py`, que busca os dados do Portal da Transparência e salva os JSONs em `frontend/public/data/`.
4. Se algum arquivo de dados foi alterado, commita e faz push com a mensagem `data: atualização automática YYYY-MM-DD HH:MM UTC`.
5. Ao concluir com sucesso, dispara automaticamente o workflow de deploy.

---

### `deploy.yml` — Deploy para GitHub Pages

| Propriedade | Valor |
|---|---|
| **Triggers** | Push em `main` (paths: `frontend/**`) · Conclusão bem-sucedida do workflow `collect.yml` |
| **Runner** | `ubuntu-latest` |
| **Concorrência** | Grupo `pages` — cancela deploy pendente se um novo chegar |

**Jobs:**

| Job | O que faz |
|---|---|
| `build` | Instala Node 20, roda `npm ci` e `npm run build` no diretório `frontend`, sobe o artefato `frontend/out` |
| `deploy` | Publica o artefato no GitHub Pages via `actions/deploy-pages@v4` |

---

## Secrets necessários

| Secret | Obrigatório | Descrição |
|---|---|---|
| `PORTAL_TRANSPARENCIA_API_KEY` | **Opcional** | Chave de API do Portal da Transparência do Governo Federal. Se não definida, o coletor usa o endpoint público sem autenticação (sujeito a rate-limit mais restrito). |

> Os secrets `RAILWAY_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` do workflow anterior **não são mais utilizados** e podem ser removidos nas configurações do repositório.

---

## Como ativar o GitHub Pages

1. Acesse o repositório no GitHub.
2. Vá em **Settings → Pages**.
3. Em **Source**, selecione **GitHub Actions**.
4. Salve. A URL de publicação ficará no formato `https://<org>.github.io/transparencia10/`.

> **Atenção:** certifique-se de que o `next.config.js` do frontend está configurado com `output: 'export'` e `basePath: '/transparencia10'` (ou o nome correto do repositório) para que o build estático funcione corretamente no GitHub Pages.

---

## Fluxo completo

```
Cron (4/4h) ──┐
               ├─→ collect.yml ──→ push de dados ──→ deploy.yml ──→ GitHub Pages
Push de código─┘                                  ↗
               └──────────────────────────────────
```
