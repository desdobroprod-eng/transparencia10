# PARECER JURÍDICO — Portal "Transparência 10"
## Revisão de risco de terminologia e conteúdo

> **AVISO METODOLÓGICO.** Análise técnica orientativa para apoio à decisão. **NÃO** constitui
> parecer de advogado(a) habilitado(a) na OAB para o caso concreto, não cria relação
> cliente-advogado e não substitui consulta a profissional inscrito. Mitigação de risco, não
> garantia de imunidade jurídica.

Data da revisão: 2026-06-17

---

## 1. Enquadramento jurídico

Tensão constitucional entre liberdade de informação e direitos da personalidade. O risco está
em *como* o conteúdo é redigido, não na atividade.

### Riscos
- **Dano moral** (CC 186, 187, 927): rótulo desabonador a pessoa física identificada pode gerar
  indenização se houver abuso do direito de informar (187). Via mais provável de ação.
- **Crimes contra a honra** (CP 138 calúnia / 139 difamação / 140 injúria): "testa-de-ferro" e
  "nepotismo" imputam fato desonroso; podem tangenciar calúnia se sugerirem crime (Lei 14.133/21,
  337-E e ss.). Servidor tem proteção reforçada (CP 141, II).
- **Marco Civil (12.965/14, art. 19)**: o portal é provedor de **conteúdo próprio** (gera os
  rótulos) → NÃO se beneficia da irresponsabilidade do art. 19; responde como autor. Canal de
  notificação/remoção ágil reduz dano continuado.
- **LGPD (13.709/18)**: nomes de sócios e servidores são dados pessoais; o cruzamento cria **dado
  novo por inferência** (suposto parentesco/conflito). Exige base legal (7º IX legítimo interesse)
  + teste de proporcionalidade documentado. CNPJ de empresa NÃO é dado pessoal protegido.
- **Direitos da personalidade** (CC 11-21, esp. 17 e 20).

### Defesas
- **LAI 12.527/2011** (3º, 7º, 8º): contratos, valores, CNPJ, razão social e nomes de servidores
  em razão da função são de publicidade obrigatória. Republicar dado público é protegido.
- **Liberdade de informação/expressão** (CF 5º IV, IX, XIV; 220, §2º — vedada censura prévia).
- **Interesse público / animus narrandi**: STJ afasta crime contra honra quando há intenção de
  informar/criticar gestão pública. Agente público tem privacidade reduzida quanto a atos funcionais.

**Conclusão:** defensável EM TESE, mas só se a linguagem permanecer factual/condicional. Termos
atuais empurram para imputação conclusiva, onde a defesa enfraquece.

---

## 2. Análise de risco por termo

| Termo / elemento | Risco | Por quê |
|---|---|---|
| **Testa-de-ferro / Testa-ferro** | **ALTO** | Acusatório; significado de fraude dolosa (interposição). Imputa ilícito a pessoa física. Aplicado por coincidência de sobrenome contra base inteira → falso-positivo altíssimo. |
| **Nepotismo** (badge) | **ALTO** | Imputa prática vedada (SV 13). Como rótulo fixo soa conclusivo. |
| **Provável parente** (PROVAVEL_PARENTE) | **MÉDIO-ALTO** | "Provável" é condicional (bom), mas dispara com 2 sobrenomes; sobrenomes comuns no MA → falso-positivo alto. Incoerência código×doc. |
| **Cruzamento sócio×servidor por coincidência de nome** | **ALTO (mais sensível)** | Inferência nova sobre pessoa física, sem checagem de CPF. Conclusão autoral (afasta defesa "só republiquei o oficial"). Dano moral + LGPD juntos. |
| **Capital incompatível / "empresa de fachada"** | MÉDIO | Motivo exibido é factual/seguro. Mas docstrings com "fachada"/"inidoneidade" são imputação se citados. |
| **Preço abusivo** | MÉDIO | "Abusivo" é juízo de ilicitude; recai sobre PJ (risco menor). Amostra mínima 3 é frágil. |
| **Empresa sancionada** (CEIS/CNEP) | BAIXO | Fato verificável em base oficial, desde que datado e correto. |
| **Risco alto / CRÍTICO** | BAIXO-MÉDIO | Sobre ente/contrato é defensável (índice metodológico). Sobre pessoa, evitar. |
| **Indício** | BAIXO (protetivo) | Linguagem correta. Manter e reforçar. |
| **Empresa nova** | BAIXO | Factual e neutro. |

---

## 3. Pessoa Jurídica vs Pessoa Física

- **Empresa/CNPJ (baixo risco)**: dados de contrato público (LAI); PJ tem só honra objetiva.
  Indicadores EMPRESA_NOVA, CAPITAL_INCOMPATIVEL, PRECO_ABUSIVO, FRACIONAMENTO, MONOPOLIO,
  EMPRESA_SANCIONADA recaem sobre PJ → zona relativamente segura com linguagem factual.
- **Pessoa física (sócio/servidor) — ALTO risco**: honra subjetiva (dano moral presumido em
  imputação grave) + LGPD (dado novo por inferência).
- **O cruzamento sócio×servidor por coincidência de nome é o ponto mais sensível**: não é dado
  público, é conclusão autoral; baseia-se em homonímia sem verificar CPF; pode afirmar sobre a
  pessoa errada; atinge servidor sem relação com o contrato. Disclaimers mitigam mas não
  neutralizam enquanto o rótulo conclusivo conviver com o aviso de "indício".

---

## 4. Recomendações

### 4.1 Substituições (de → para)
- Testa-de-ferro → **"Coincidência nominal a verificar"**
- Nepotismo → **"Possível vínculo familiar — a apurar"**
- Provável parente → **"Sobrenomes coincidentes"**
- Preço abusivo → **"Preço acima da mediana" / "Valor atípico"**
- Capital incompatível → manter no motivo (factual); remover "fachada/inidoneidade" dos docstrings
- Risco alto/CRÍTICO sobre pessoa → **"Requer apuração" / "Prioridade de verificação alta"** (manter "Risco alto" só para ente/contrato)
- Conflito de interesse direto → **"Nome idêntico a servidor — a verificar identidade"**

**Princípio-mestre:** trocar rótulo-conclusão (o que a pessoa É/FEZ) por descrição-do-dado + verbo
condicional (o que foi observado + "a apurar/possível/verificar").

### 4.2 Disclaimer reforçado do cruzamento (texto sugerido)
> **Atenção — sinalização automática por coincidência de nome. Não é acusação, não identifica
> pessoas.** Cruzamos *nomes* de bases públicas (QSA da Receita × folha de servidores estaduais MA).
> O sistema **não confirma que se trata da mesma pessoa** — não há checagem de CPF. Coincidência ou
> semelhança de nome é comum e não significa parentesco, sociedade oculta, fraude ou irregularidade.
> Nenhuma pessoa citada é acusada de conduta ilícita. A verificação compete aos órgãos de controle
> (TCE-MA, CGU, MPF). Para esclarecer/corrigir, use o canal de retificação — resposta em até [X] dias.

### 4.3 Canal de retificação
Formulário/e-mail visível, linkado no rodapé e em cada card; SLA público (ex. 7 dias úteis);
compromisso de correção/remoção; log de pedidos (prova de boa-fé).

### 4.4 Pessoa física
- Servidores: não exibir nome completo em match fraco (só sobrenomes/iniciais+órgão); nome completo
  só em nome idêntico + disclaimer reforçado.
- Sócios: nominável (dado público) sem rótulo conclusivo anexado.
- Elevar threshold de PROVAVEL_PARENTE para 3+ (alinhar código à doc); não publicar nominalmente
  matches de 2 sobrenomes.
- Restringir cruzamento ao órgão contratante; evitar variante contra base estadual inteira.

### 4.5 Transversais
Citar+linkar fonte oficial com data em cada apontamento; linguagem condicional obrigatória em
pessoa física; nunca afirmar conduta criminosa; limpar docstrings acusatórios; metodologia pública
versionada.

---

## 5. Veredito

**NÃO publicar na forma atual.** Base de defesa sólida (LAI + liberdade de informação), mas
terminologia conclusiva sobre pessoa física cria exposição evitável. Ajustes são majoritariamente
de REDAÇÃO, não de arquitetura.

### BLOQUEADORES (corrigir antes de publicar)
1. Remover "testa-de-ferro" e "nepotismo" como rótulos sobre pessoa física → descrição condicional.
2. Tratar exibição nominal de servidores no cruzamento (não expor nome completo em match fraco).
3. Alinhar threshold × afirmação (PROVAVEL_PARENTE 2 vs 3+); não publicar nominalmente baixa confiança.
4. Canal de retificação funcional + SLA antes do lançamento.
5. Limpar docstrings acusatórios ("fachada", "inidoneidade").
6. Restringir/rebaixar cruzamento contra base estadual inteira.

### MELHORIAS
Preço abusivo → acima da mediana; "crítico" sobre pessoa → requer apuração; fonte+data em cada
card; amostra mínima maior em PRECO_ABUSIVO; documentar proporcionalidade LGPD; suavizar "CRÍTICO".

**Síntese:** manter intacta a camada sobre empresa/CNPJ/contrato e fatos verificáveis; reescrever
toda a camada que conclui sobre pessoa física para registro descritivo-condicional. Feito isso, o
portal passa de "exposto" para "razoavelmente defensável".

---

## 6. Fundamento legal do recorte sócio × servidor (reforço de defesa)

O cruzamento sócio×servidor não é curiosidade: ele observa exatamente as hipóteses que a
lei manda observar. Isso **reforça a defesa de interesse público** — o portal aponta para um
parâmetro legal objetivo, não para um juízo próprio.

- **Servidor pode ser sócio, não administrador.** Art. 117 da Lei nº 8.112/1990 (federais) e
  estatutos análogos: servidor pode ser acionista, cotista ou sócio investidor, mas não pode
  exercer gerência/administração de sociedade privada. Logo, está impedido de ser administrador
  no contrato social e de ser MEI, EI ou SLU (que exigem o titular na gestão).
- **Vedação de contratar com a própria esfera.** Art. 14 da Lei nº 14.133/2021 veda a
  participação, direta ou indireta, de agente público do órgão como licitante ou contratado.
  Contrato da Administração com empresa de servidor da mesma esfera pode configurar conflito de
  interesses (Lei nº 12.813/2013) e, conforme o caso, improbidade (Lei nº 8.429/1992, com a
  redação da Lei nº 14.230/2021, que exige dolo).
- **Saída legal:** o servidor sócio deve afastar-se da gestão e transferir a administração a
  terceiro antes de a empresa contratar com o poder público.

**Blindagem de redação (obrigatória ao citar a lei):** apresentar a norma sempre **em abstrato**
("a lei veda…") e jamais afirmar que um caso concreto a violou. A frase-padrão do portal —
*"coincidência de nome não confirma identidade; a apuração compete aos órgãos de controle"* —
deve acompanhar toda menção legal. A citação da lei explica **por que** o dado é sinalizado, não
**que** alguém infringiu.

---

## 7. Status dos bloqueadores (revisão de 2026-06-18)

| # | Bloqueador | Status |
|---|---|---|
| 1 | "testa-de-ferro"/"nepotismo" como rótulo | ✅ Resolvido — rótulos condicionais ("Coincidência nominal — a apurar"). |
| 2 | Exposição nominal em match fraco | ⚠️ Mitigado — filtro "somente nome idêntico"; disclaimer + base legal. Avaliar ocultar nome em match fraco antes de deploy. |
| 3 | Threshold × afirmação (sobrenome 2 vs 3+) | ✅ Resolvido — exige sobrenomes idênticos e em mesma ordem (≥3) ou nome completo. |
| 4 | Canal de retificação + SLA | ✅ Resolvido — contato@10dobroprod.com.br, SLA 7 dias úteis, nota LGPD no rodapé. |
| 5 | Docstrings/strings acusatórios ("fachada") | ✅ Resolvido — UI "empresa de fachada" trocada por "divergência cadastral que merece verificação"; "real desviado"→"mal aplicado"; "fracionamento"→"dispensas em sequência — a verificar". |
| 6 | Cruzamento contra base estadual inteira | ⚠️ Mitigado — escopo limitado a servidores estaduais (declarado); coincidência tratada como indício. |

**Observação:** o termo interno `PRECO_ABUSIVO` (chave de regra) **não é exibido** — a UI mostra
"Preço acima da mediana". Mantido por ser interno; renomear apenas se exposto futuramente.
