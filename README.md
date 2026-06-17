# Portal Transparência Cultural do Brasil

Portal público de fiscalização cidadã de gastos públicos com cultura. Reúne dados oficiais (PNCP, Portal da Transparência, SICONFI, Receita Federal) e sinaliza padrões que merecem verificação. Início pelo Maranhão.

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

## Licença

Licenciamento duplo (detalhes em [LICENSING.md](LICENSING.md)):

- **Código** → [GNU AGPL-3.0](LICENSE) (alternativa [GPL-3.0](LICENSE-GPL)) — modificações, inclusive em uso via servidor, devem ser abertas.
- **Dados/conteúdo** → [CC BY-NC 4.0](LICENSE-CC-BY-NC) — citar a fonte e proibido uso comercial.

© 2026 10Dobro Prod.
