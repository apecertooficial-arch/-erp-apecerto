# Central de Performance Comercial — Mapa de funções e dados reais

**Objetivo:** inventário de TUDO que a tela de Performance exibe (todas as abas), de onde cada número vem, o que já é real e o que precisa ser criado.

**Arquitetura atual (como o dado chega na tela):**

```
Tela Performance (legacy-runtime.html, seção linha ~9339)
   └── RPC performance_corretores(p_inicio, p_fim)   ← já existe e está correto
         ├── perf_eventos      (eventos por corretor — 14.806 registros hoje)
         ├── vendas + venda_corretores (VGV, comissão, nº vendas)
         ├── leads             (total, sem origem, sem qualificação)
         └── negocios          (abertos, parados 24h/48h/72h)
   └── metas_corretor          (meta de VGV por corretor — 5 metas cadastradas)
```

**Por que o Score está 2/100 hoje:** o score é `resposta×30% + CRM×20% + follow-up×20% + visitas×15% + vendas×10% + tarefas×5%`. Sem eventos de `primeira_resposta`, `followup` e `visita_*`, e sem vendas no mês, sobra só o piso de 15 pontos da conversão em vendas → 15×10% = 1,5 ≈ **2**. O número bate exatamente com a tela. Ou seja: **a conta está certa; faltam os produtores de eventos.**

---

## LEGENDA DE STATUS

- 🟢 **REAL** — já alimentado por dados de produção
- 🟡 **PRONTO SEM PRODUTOR** — o RPC já calcula, mas ninguém emite o evento (hoje = 0)
- 🔴 **SEM FONTE** — nem o RPC calcula; zerado/fixado no front (era "de mentirinha", hoje travado em 0)
- ⚙️ **DERIVADO** — calculado a partir de outras métricas; vira real sozinho quando as fontes existirem

---

## 1. VISÃO GERAL (aba `geral`)

| Função | Fórmula / origem | Status |
|---|---|---|
| Score ApêCerto (anel + faixa Elite/Bom/Atenção/Crítico) | média ponderada dos 6 drivers abaixo | ⚙️ |
| Driver: Tempo de resposta (peso 30%) | `108 − (tempoResp−1)×20` · tempoResp = média de `perf_eventos tipo='primeira_resposta'` (valor em min) | 🟡 |
| Driver: Atualização do CRM (peso 20%) | `100 − parados×3,2 − semTarefa×2,4` · parados = `negocios` abertos sem movimentação +24h | 🟢 parcial (parados real; semTarefa 🔴) |
| Driver: Follow-ups (peso 20%) | `38 + followups/2,6` · eventos `tipo='followup'` | 🟡 |
| Driver: Conversão em visitas (peso 15%) | `vendas/visitasReal` · eventos `visita_realizada` | 🟡 |
| Driver: Conversão em vendas (peso 10%) | `vendas/leads` (piso 15) · vendas reais ÷ leads reais | 🟢 |
| Driver: Cumprimento de tarefas (peso 5%) | **fixado em 0 no front** — dependeria de `crm_tarefas` (tabela existe, 0 registros) | 🔴 |
| KPI VGV vendido | `vendas × venda_corretores` no período (`data_venda`) | 🟢 (0 no mês = não há venda de julho lançada) |
| KPI Ticket médio | VGV ÷ nº vendas | ⚙️ |
| KPI Comissão gerada | `vgv × percentual_comissao × fracao` | 🟢 |
| KPI Conversão Lead→Venda | vendas ÷ leadsTotal (mostra N/D se vendas não vinculadas a leads) | 🟢 parcial |
| KPI Meta atingida | VGV ÷ meta (`metas_corretor`, fallback R$ 3M) | 🟢 |
| Progresso do período (atingido/meta/restante/projeção) | projeção = `vgv × 1,18` (multiplicador fixo) | ⚙️ (projeção simplista) |
| Eficiência do funil (Lead→Visita, Visita→Proposta, Proposta→Venda) | visitas/leads · propostas/visitas · vendas/propostas | 🟡 (depende de visita/proposta) |
| Ranking VGV e Score da equipe | ordenação dos corretores por VGV | 🟢 (mas VGV zerado no mês) |
| "Quem precisa da minha atenção?" (8 cards: risco de meta, fora do SLA, parados +72h, visitas canceladas, baixa conversão, sobrecarga, destaque, capacidade) | derivado das métricas acima + limite de carteira **55 fixo** | ⚙️ (limite 🔴 hardcoded) |
| Saúde da carteira (nota + ranking) | `94 − parados×2,4 − atrasados×2 − semTarefa×1,7 − semQualif×1,3 + followups×0,05 + (sla−80)×0,35` | ⚙️ parcial |
| Capacidade de atendimento (ocupação %) | leads ÷ limite(55) | ⚙️ (limite 🔴) |
| Funil comercial completo (8 etapas + gargalo) | leads → respondidos(86% **estimado**) → qualificados(52% **estimado**) → visitas → propostas → contratos → vendas | 🟡/🔴 (2 etapas estimadas por % fixo) |
| Matriz Esforço × Resultado (bolhas) | idxEsforco × resultadoIdx | ⚙️ |
| Modal "Entenda seu Score" | os 6 drivers com pesos + recomendações fixas | ⚙️ |
| Drawer individual do corretor + histórico de score | histórico é **derivado do score atual** (não guarda série temporal) | 🔴 (sem tabela de snapshot) |

## 2. ATENDIMENTO (aba `atendimento`)

| Função | Origem esperada | Status |
|---|---|---|
| Tempo 1ª resposta (meta <2 min) | `perf_eventos tipo='primeira_resposta'` (valor=minutos) | 🟡 **nunca emitido** |
| Tempo entre mensagens | `tipo='resposta'` (valor=minutos) | 🟡 nunca emitido |
| SLA cumprido (meta ≥85%) | % de `primeira_resposta` com valor ≤2 | 🟡 nunca emitido |
| Leads aguardando resposta | `negocios` status aberto | 🟢 |
| Leads atrasados | = parados +24h | 🟢 |
| Fora do SLA | **fixado em 0 no front** | 🔴 |
| Mensagens enviadas/recebidas | `tipo='mensagem_enviada'/'mensagem_recebida'` | 🟢 **REAL** (3.580 env / 3.617 rec) |
| Áudios enviados | `tipo='audio_enviado'` | 🟢 REAL (1.643) |
| Ligações / atendidas | `tipo='ligacao'/'ligacao_atendida'` | 🟡 nunca emitido |
| Follow-ups | `tipo='followup'` | 🟡 nunca emitido |
| Tempo online | `tipo='online'` (valor=minutos, somado) | 🟡 nunca emitido |
| Reativações | `tipo='reativacao'` | 🟡 nunca emitido |
| Qualidade de atendimento — Avaliador de IA (nota geral + 8 subnotas: clareza, cordialidade, personalização, qualificação, condução, objeções, escrita, follow-up; % conversas avaliadas; críticas; excelentes; evolução) | **não existe fonte** — zerado no front | 🔴 (exige agente de IA avaliando conversas) |

## 3. ATIVIDADE (aba `atividade`)

| Função | Origem esperada | Status |
|---|---|---|
| Visitas marcadas / realizadas / canceladas + % comparecimento | `tipo='visita_marcada'/'visita_realizada'/'visita_cancelada'` — obs.: tabela `visitas` existe com apenas 3 registros e NÃO alimenta perf_eventos | 🟡 |
| Propostas emitidas / aceitas | `tipo='proposta_emitida'/'proposta_aceita'` | 🟡 |
| Contratos enviados / assinados | `tipo='contrato_enviado'/'contrato_assinado'` | 🟡 |
| Vendas + VGV | vendas reais | 🟢 |
| Funil de atividade (marcadas → realizadas → propostas → vendas) | derivado | ⚙️ |

## 4. ORGANIZAÇÃO DO CRM (aba `organizacao`)

| Função | Origem | Status |
|---|---|---|
| Leads parados +24h / +48h / +72h | `negocios.ultima_movimentacao` (880 negócios com movimentação) | 🟢 REAL |
| Sem próxima tarefa | `crm_tarefas` (tabela vazia; front fixa 0) | 🔴 |
| Sem qualificação | `leads.tags` vazio | 🟢 REAL |
| Sem origem definida | `leads.origem` vazio | 🟢 REAL |
| Sem última interação / duplicados / sem responsável | **fixados em 0 no front** — RPC não calcula | 🔴 |
| Tabela de disciplina por corretor (% disciplina) | `100 − problemas×2,2` | ⚙️ |

## 5. PRODUTIVIDADE (aba `produtividade`)

Todos ⚙️ derivados de `onlineH` — hoje **tudo zerado** porque `tipo='online'` nunca é emitido:

Mensagens/hora · Ligações/hora · Atendimentos/hora · Visitas/semana · Propostas/semana · Receita/hora · Conversão/hora — 🟡 via evento `online`.
Tempos médios (até 1ª visita, até proposta, até venda) — 🔴 **zerados no front**, sem cálculo no RPC (dá pra derivar de `negocios`/`vendas` + eventos de visita).

## 6. RANKING (aba `ranking` — só gestor)

12 boards (VGV, Score, Velocidade de resposta, Conversão, Follow-ups, Atualização do CRM, Saúde da carteira, Leads atrasados, Melhor atendimento IA, Qualificação, Escrita, Objeções) + modos Melhor/Pior/Maior evolução/Maior queda + alertas de gestão (mais atrasados, mais lento, CRM desatualizado, menor/maior conversão).

- Boards de VGV/atrasados/CRM: ⚙️ derivados (funcionam quando as fontes encherem)
- Boards de notas de IA (atendimento/qualificação/escrita/objeções): 🔴 sem fonte
- **Maior evolução / Maior queda (`evoScore`, `evoVgvPct`): 🔴 sem série histórica** — exige snapshot periódico do score
- §15: corretor vê ranking anonimizado (colegas viram "Colega N") — já implementado

## 7. INTELIGÊNCIA (aba `ia` — só gestor)

| Função | Status |
|---|---|
| Índice de Esforço (msgs, ligações, visitas, propostas, follow-ups) | ⚙️ (parcial: hoje só msgs reais) |
| Índice de Qualidade (resposta, CRM, conversão, SLA) | ⚙️ |
| Índice de Eficiência (resultado ÷ esforço) | ⚙️ |
| Aproveitamento da base (trabalhados ÷ recebidos) | ⚙️ |
| Índice de Persistência (tentativas até resposta) · Índice de Follow-up (follow-ups/lead) | 🔴 zerados no front |
| 5 cards de perguntas com resposta automática (risco de meta, quanto falta pro VGV, sobrecarga, quem evoluiu, ações de maior impacto) | ⚙️ regras fixas sobre os dados |
| Ações recomendadas (4 cards) | ⚙️ regras fixas |

---

## O QUE JÁ É 100% REAL HOJE

1. Mensagens enviadas/recebidas, áudios (via instâncias WhatsApp → `perf_eventos`, origens: `instancia`, `trigger`, `motor`, `sessao`, `atendimento`)
2. Leads (total, sem origem, sem qualificação) — 877 leads
3. Negócios abertos e parados 24/48/72h — 880 negócios
4. Vendas/VGV/comissão do período (21 vendas, todas vinculadas a corretor — **0 em julho**, por isso R$ 0,00M no mês)
5. Metas (`metas_corretor`, 5 cadastradas — R$ 17M da equipe aparece certo)

## O QUE FALTA CRIAR — PRIORIZADO

### FASE 1 — Produtores de eventos que destravam o Score (maior impacto, RPC já pronto)
| # | Evento a emitir em `perf_eventos` | Onde gerar | Destrava |
|---|---|---|---|
| 1 | `primeira_resposta` (valor=min) | trigger em `wa_eventos`/mensagens: 1ª msg do corretor após 1ª msg do lead na conversa | Tempo 1ª resposta, SLA, 30% do score |
| 2 | `resposta` (valor=min) | mesmo trigger, para respostas seguintes | Tempo entre mensagens |
| 3 | `online` (valor=min) | **regra de presença já existente** (presença/heartbeat) — somar janelas online | Toda a aba Produtividade |
| 4 | `followup` | mensagem ativa do corretor após X horas sem resposta do lead (detectável no mesmo trigger) | 20% do score |
| 5 | `visita_marcada/realizada/cancelada` | trigger na tabela `visitas` (existe, não alimenta) + agenda/calendário | 15% do score + aba Atividade |

### FASE 2 — Pipeline comercial
| # | Evento | Onde gerar |
|---|---|---|
| 6 | `proposta_emitida/aceita/recusada` | etapa do funil no CRM (mover negócio p/ "Proposta") ou botão explícito |
| 7 | `contrato_enviado/assinado` | esteira de vendas/documentos |
| 8 | `reativacao` | lead sem interação +7d que volta a responder após ação do corretor |
| 9 | `ligacao/ligacao_atendida` | registro manual no card do lead (não há telefonia integrada) |

### FASE 3 — Estruturas novas (sem isso, ficam 0 pra sempre)
| # | O quê | Para quê |
|---|---|---|
| 10 | Popular/usar `crm_tarefas` + emitir conclusão | "Sem próxima tarefa", 5% do score (tarefaScore) |
| 11 | Tabela `perf_snapshots` (score/vgv por corretor/semana, via pg_cron) | Evolução/queda no Ranking, histórico do drawer, evoNota |
| 12 | Campo `limite_carteira` em `corretores` (hoje 55 fixo) | Capacidade/ocupação reais |
| 13 | RPC: calcular `foraSla`, `semInter`, `duplicados` (telefone repetido), `semResponsavel`, tempos até visita/proposta/venda | Organização do CRM completa + Produtividade |
| 14 | Avaliador de IA de conversas (agente já previsto em Agentes de IA) gravando notas por conversa | Qualidade de atendimento (8 subnotas), boards de IA do Ranking |
| 15 | Etapas "respondidos" e "qualificados" do funil completo calculadas de verdade (hoje 86%/52% fixos) | Funil de 8 etapas honesto |

---

## RISCOS / PONTOS DE ATENÇÃO

- **Conversão Lead→Venda mistura períodos**: usa leads TOTAIS (877, todo o histórico) contra vendas DO PERÍODO — em mês sem venda dá 0%. Decidir: conversão por coorte (leads do período) ou por vínculo venda↔lead.
- **VGV do mês zerado é dado real**: as 21 vendas são de meses anteriores. Assim que uma venda de julho for lançada no Financeiro com corretor vinculado, VGV/meta/comissão acendem sozinhos.
- **Projeção da meta** usa multiplicador fixo 1,18 — trocar por projeção pró-rata (dias corridos ÷ dias do mês).
- **`perf_tipos`** existe como tabela de domínio; conferir se todos os tipos novos da Fase 1/2 estão cadastrados nela antes de emitir.
- Score hoje pune sem dados: com `parados` alto e o resto zerado, todo mundo fica "Crítico". Ao ligar a Fase 1, o score se recalibra sozinho — não mexer nos pesos antes de ter os eventos fluindo.
