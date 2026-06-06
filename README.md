# Transparencia10

Painel público de monitoramento de gastos das Secretarias de Cultura do Maranhão.

**Entes monitorados:**
- Secretaria de Cultura — Estado do Maranhão
- Secretaria de Cultura — São Luís
- Secretaria de Cultura — São José de Ribamar
- Secretaria de Cultura — Paço do Lumiar

**Fontes de dados (100% públicas):**
- PNCP — Portal Nacional de Contratações Públicas
- SICONFI — Tesouro Nacional
- Portal da Transparência Federal
- Receita Federal (CNPJ público)
- CEIS/CNEP — Empresas sancionadas

**Stack:** Python/FastAPI + Next.js + Docker

**Deploy:** Railway (backend) + Vercel (frontend) via GitHub Actions

## Rodando localmente

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:8000/docs

## Aviso legal

Todos os dados são públicos e obtidos de fontes oficiais.  
Os indicadores de anomalia são sinalizações automáticas — **não constituem acusação**.  
Devem ser investigados pelos órgãos competentes (TCE-MA, CGU, MPF).
