# Guia de Deploy — Transparencia10

**Stack de produção:**
- Backend: Railway (container Docker, Python/FastAPI)
- Frontend: Vercel (Next.js, SSG/SSR)
- CI/CD: GitHub Actions (`.github/workflows/deploy.yml`)

---

## 1. Variáveis de Ambiente

### Backend (Railway)

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `PYTHONUNBUFFERED` | Sim | `1` | Desativa buffer do stdout — necessário para logs em tempo real no Railway |

> O backend atual não requer variáveis de API key pois consome apenas APIs governamentais públicas. Se as APIs passarem a exigir autenticação no futuro, adicionar `TRANSPARENCIA_API_KEY` aqui.

### Frontend (Vercel)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Sim | URL pública do backend Railway. Exemplo: `https://transparencia10-backend.railway.app` |

> Variáveis prefixadas com `NEXT_PUBLIC_` são injetadas no bundle do cliente (browser). Não incluir segredos com este prefixo.

---

## 2. GitHub Actions Secrets

Configure os secrets no repositório em **Settings → Secrets and variables → Actions**:

| Secret | Descrição | Como obter |
|---|---|---|
| `RAILWAY_TOKEN` | Token de autenticação CLI do Railway | Railway Dashboard → Account Settings → Tokens → Create Token |
| `VERCEL_TOKEN` | Token de autenticação CLI da Vercel | Vercel Dashboard → Settings → Tokens → Create |
| `VERCEL_ORG_ID` | ID da organização/time na Vercel | Executar `vercel whoami` localmente após login |
| `VERCEL_PROJECT_ID` | ID do projeto na Vercel | Executar `vercel link` na pasta `frontend/` e consultar `.vercel/project.json` |
| `BACKEND_URL` | URL pública do backend Railway | Obtida após primeiro deploy do backend no Railway |

---

## 3. Deploy no Railway (Backend)

### 3.1 Primeiro deploy (manual via CLI)

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Autenticar
railway login

# Criar projeto (executar na raiz do repositório)
railway init

# Linkar ao projeto criado
railway link

# Deploy do backend
cd backend
railway up --service backend
```

### 3.2 Configurar variáveis no Railway

```bash
# Pela CLI
railway variables set PYTHONUNBUFFERED=1

# Ou pelo Dashboard: Railway → Projeto → Service backend → Variables
```

### 3.3 Configurar porta

O Railway detecta automaticamente `EXPOSE 8000` no Dockerfile. Caso não detecte, configure `PORT=8000` nas variáveis do serviço.

### 3.4 Obter a URL do backend

```bash
railway domain
# Exemplo de saída: transparencia10-backend.railway.app
```

Salve esta URL como secret `BACKEND_URL` no GitHub.

### 3.5 Deploy automático via GitHub Actions

Após configurar o secret `RAILWAY_TOKEN`, todo push na branch `main` dispara o job `deploy-backend` automaticamente:

```yaml
- name: Deploy backend
  working-directory: ./backend
  run: railway up --service backend --detach
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

O flag `--detach` retorna imediatamente sem aguardar a conclusão do build (comportamento adequado para CI).

---

## 4. Deploy na Vercel (Frontend)

### 4.1 Primeiro deploy (manual via CLI)

```bash
# Instalar Vercel CLI
npm install -g vercel

# Autenticar
vercel login

# Na pasta frontend/
cd frontend
vercel

# Seguir o assistente interativo:
# - Set up and deploy? Yes
# - Which scope? <selecionar sua organização>
# - Link to existing project? No (primeira vez)
# - Project name? transparencia10-frontend
# - Directory? ./  (já está na pasta frontend)
```

Após o link, o arquivo `frontend/.vercel/project.json` conterá `orgId` e `projectId` para configurar os secrets do GitHub.

### 4.2 Configurar variável de ambiente na Vercel

```bash
# Via CLI (dentro da pasta frontend/)
vercel env add NEXT_PUBLIC_API_URL production
# Digitar o valor: https://transparencia10-backend.railway.app

# Ou pelo Dashboard: Vercel → Projeto → Settings → Environment Variables
```

### 4.3 Verificar configuração do Next.js para output standalone

O `frontend/Dockerfile` usa o modo `standalone` do Next.js. Confirme que `next.config.ts` contém:

```typescript
const nextConfig = {
  output: "standalone",
};
export default nextConfig;
```

Sem isso, o build Docker falhará ao tentar copiar `.next/standalone`.

### 4.4 Deploy automático via GitHub Actions

O job `deploy-frontend` executa após o `deploy-backend`:

```yaml
deploy-frontend:
  needs: deploy-backend
  steps:
    - run: vercel --prod --yes --token ${{ secrets.VERCEL_TOKEN }}
      env:
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        NEXT_PUBLIC_API_URL: ${{ secrets.BACKEND_URL }}
```

---

## 5. Docker Compose — Ambiente Local

### 5.1 Pré-requisitos

- Docker Desktop instalado e rodando
- Portas 3000 e 8000 livres

### 5.2 Subir o ambiente completo

```bash
# Na raiz do projeto
docker-compose up --build
```

**Serviços disponíveis:**

| Serviço | URL local | Descrição |
|---|---|---|
| Frontend | http://localhost:3000 | Painel Next.js |
| Backend API | http://localhost:8000 | FastAPI REST |
| Swagger UI | http://localhost:8000/docs | Documentação interativa |
| ReDoc | http://localhost:8000/redoc | Documentação alternativa |

### 5.3 Subir apenas o backend

```bash
docker-compose up backend
```

### 5.4 Ver logs em tempo real

```bash
# Todos os serviços
docker-compose logs -f

# Apenas backend
docker-compose logs -f backend
```

### 5.5 Parar e remover containers

```bash
docker-compose down
```

### 5.6 Reconstruir após mudança de código

```bash
docker-compose up --build
```

### 5.7 Testar coleta manual

```bash
# Forçar coleta imediata
curl -X POST http://localhost:8000/coletar

# Aguardar ~10 segundos e consultar resultados
curl http://localhost:8000/stats | python3 -m json.tool
curl http://localhost:8000/alertas | python3 -m json.tool
```

---

## 6. Checklist de Deploy em Produção

- [ ] Secret `RAILWAY_TOKEN` configurado no GitHub
- [ ] Secret `VERCEL_TOKEN` configurado no GitHub
- [ ] Secret `VERCEL_ORG_ID` configurado no GitHub
- [ ] Secret `VERCEL_PROJECT_ID` configurado no GitHub
- [ ] Backend deployado no Railway e URL obtida
- [ ] Secret `BACKEND_URL` configurado no GitHub com a URL do Railway
- [ ] Variável `NEXT_PUBLIC_API_URL` configurada na Vercel (mesma URL)
- [ ] Variável `PYTHONUNBUFFERED=1` configurada no Railway
- [ ] Verificar logs do Railway após deploy (primeiro `job_coleta` executa na startup)
- [ ] Acessar `https://<frontend>.vercel.app` e confirmar que os cards carregam
- [ ] Verificar que `ultima_atualizacao` aparece no header do frontend

---

## 7. Troubleshooting

### Backend não coleta dados (todos os entes retornam erro)

1. Verificar conectividade do Railway com as APIs externas:
   ```bash
   railway run curl https://pncp.gov.br/api/pncp/v1/contratos
   ```
2. As APIs governamentais têm instabilidades periódicas. O sistema tenta novamente no próximo ciclo de 4 horas.
3. Verificar logs: `railway logs --tail 100`

### Frontend mostra "Aguardando coleta..."

O cache é vazio até a primeira coleta completar. Após o deploy do backend, aguardar 30–60 segundos para a primeira coleta terminar e o frontend refletir os dados.

### Erro de CORS no browser

Verificar se `NEXT_PUBLIC_API_URL` aponta para a URL correta do Railway (com `https://`, sem barra final).

### Build Docker do frontend falha (`ENOENT: .next/standalone`)

Garantir `output: "standalone"` no `next.config.ts` (ver seção 4.3).
