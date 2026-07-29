# 05 — Auditoria do modelo atual (FASE 2.0)

> Branch: `feat/crm-nova-era-fase-2-schema-draft` · base `103e7739c8f84e374100d6c392ab93535e9cb14b`.
> Fontes cruzadas: `app/lib/supabase/database.types.ts` (8273 linhas), rotas `app/api/**`,
> `app/lib/{esteira,permissions}.ts`, `app/lib/supabase/authz.ts`, features, e a auditoria P0
> lida via `git show chore/fase-0-5-contencao-p0:docs/auditoria-crm-nova-era/...` (sem trocar de
> branch). **Nenhum SQL foi executado em banco algum.** Volumes citados vêm exclusivamente do
> `docs/mapa-performance.md` da auditoria anterior — marcados como "evidência P0".

## 0. Achados estruturais (lidos primeiro)

1. **O schema não é versionado**: não existe nenhuma migration nem `.sql` em HEAD
   (`git ls-tree -r HEAD | grep -i migra` → vazio). `database.types.ts` é o único retrato do
   schema, gerado do banco. A única migration versionada do projeto é a Migration A do P0
   (`_perf_baseline`/`_view_backup`), em outra branch, **não aplicada**.
2. **Escrita passa por**: PostgREST direto com JWT do usuário (RLS) OU RPC `SECURITY DEFINER`.
   O app Next não usa service_role (`app/lib/supabase/server.ts`).
3. **127 RPCs SECURITY DEFINER com grant a PUBLIC** (herdado por `anon`) — matriz P0
   (`11-matriz-rpc-publica.md`). 124/127 têm `search_path` fixo; exceções: `instancia_saudavel`,
   `motor_roleta`, `motor_roleta_transferir_contagem`.
4. **Identidade dupla**: tabelas operacionais referenciam `corretores.id` (**number**);
   tabelas de auditoria referenciam `usuarios.id` (**uuid** = `auth.users.id`). O elo é
   `corretores.usuario_id`. Toda FK nova precisa escolher lado conscientemente.
5. O `GET /api/crm` agrega 15 fontes com `fetchAll` paginado (teto 30k linhas/fonte) e todos os
   consumidores refazem o payload inteiro a cada evento de realtime — limite arquitetural já
   documentado no próprio código (`app/api/crm/route.ts:36-48`).

## 1. Tabelas núcleo do CRM

| Tabela | Finalidade atual | Volume (evidência P0) | Quem LÊ (código) | Quem ESCREVE (código) | Veredicto p/ Nova Era | Risco de acoplamento |
|---|---|---|---|---|---|---|
| `leads` (types 3326) | Pessoa/contato; inclui bloco legado de "momento" duplicado (2 conjuntos de colunas) e `proxima_acao(_em)` | **877** | crm:68, sales:131, live-chat:61/75/78/92, finance:29, campaigns:49/88, product:61, projects:42, financiamento:71, copiloto:42 | crm:144 (update), crm:228 (insert); RPCs aquario_*, transferir_*, registrar_momento_lead, wa_ingerir, motor_roleta | **REUTILIZAR por FK. NÃO estender** (já sofre de colunas de estado sobrepostas) | ALTO — 10+ leitores; realtime escuta `leads` |
| `negocios` (3914) | Oportunidade por pipeline/stage; já tem `tentativa`, `max_tentativas`, `descarte_*`, `venda_id` | **880** | crm:69, sales:130/401/444, live-chat:93/292, finance:30, campaigns:50/83, financiamento:49 | crm:232/301/349, sales:413/433/454, live-chat:282, finance:262; RPCs mover_negocio etc. | **REUTILIZAR por FK. NÃO sobrecarregar** (a Fase 2 propõe estado paralelo, não colunas novas) | ALTO — trigger `trg_negocio_estagio_hist` popula histórico; realtime escuta |
| `pipelines` (4567) | Funis; grupo `crm_inteligente` muda comportamento | pequeno | crm:65/219/389 (⚠️ `ilike "%visita ape%"` — acoplamento por NOME), sales:146 | só RPCs crm_funil_* | REUTILIZAR como referência; **não tocar** | MÉDIO — acoplamento por nome de funil |
| `pipeline_stages` (4505) | Colunas do kanban; vocabulário `tipo/chave/grupo/alarme/sla_situacao/visivel_operacao` | pequeno | crm:67/230/347/391 (⚠️ `ilike "%agendada%"`), sales, live-chat, campaigns | só RPCs crm_etapa_* | REUTILIZAR como referência p/ shadow-mapping; **as 4 etapas Nova Era NÃO viram stages** (decisão 12.2) | MÉDIO |
| `crm_atividades` (1467) | Log livre (`observacao`/`descarte`/`proposta` em texto) | ≤500 no payload (teto) | crm:71 (LIMIT 500 GLOBAL, sem filtro), live-chat:97 | crm:268/351, live-chat:258/286; RPCs transferir_negocios_massa, ia_registrar_feedback | **NÃO usar como fonte de eventos** (texto livre, sem tipo forte, teto global) — motivação direta do `ncrm_evento` | MÉDIO |
| `crm_tarefas` (1694) | Tarefas | **0 registros** (P0 §4) | crm:73 (limit 500) | crm:281/290, live-chat:267; RPCs registrar_acao, ia_criar_tarefa | Reutilizável no futuro p/ tarefas manuais; **não é** a "próxima ação" do Nova Era | BAIXO |
| `crm_lead_alertas` (1585) | Alertas pendentes por negócio | n/d | crm:78 (só não reconhecidos) | crm:319 (baixa); **INSERT vem do banco** (trigger/RPC — produtor não confirmado; realtime escuta INSERT) | NÃO tocar; Nova Era terá urgência derivada do próprio estado | MÉDIO — produtor desconhecido |
| `crm_lead_leituras` (1677) | Lido/não-lido por usuário (PK composta `negocio_id,usuario_id` inferida do onConflict crm:326) | cresce por usuário | crm:79 | crm:326 upsert; `wa_ingerir` também toca (matriz P0; mecânica não confirmada) | NÃO tocar | BAIXO |
| `lead_momento_catalogo` (3061) | Catálogo de momentos com `prazo_dias` (semente da urgência configurável) | pequeno | crm:66, MomentosConfig:24 | **browser escreve direto** (MomentosConfig:34/45/57 — sem passar por API) | Referência conceitual; Nova Era usa config própria versionada | BAIXO |
| `lead_momentos` (3092) | Histórico rico: `momento, resultado, temperatura, proxima_acao(_em), etapa_anterior/nova` — **a tabela existente mais próxima da cadência Nova Era** | n/d | nenhum `.from()` no app; lida por `performance_extra` | só RPCs `registrar_momento_lead`, `motor_momento_lead` | NÃO estender (semântica de "momento", não de cadência); inspira o desenho do evento | MÉDIO — corpo das RPCs fora do repo |
| `visitas` (6224) | Visitas agendadas; uuid PK | **3 registros** (P0 §3; conflita com trigger `perf_visita_evento` — não confirmado) | crm:75 (**sem limite/período**), crm:403 | crm:378/432/456; efeito colateral crm:389-392 (move negócio por `ilike`) | **REUTILIZAR por FK** (contrato da saída Visitas) | MÉDIO — mover por nome de funil |
| `atendimento_acoes` (726) | Ações de atendimento (`tipo, canal, texto, resultado`) | ≤500 no payload | crm:72 (limit 500) | RPC `registrar_acao` (crm:333 — canal/resultado fixos "whatsapp/respondido") | Não estender; sobreposta com crm_atividades/lead_momentos — consolidação tratada na decisão 12.5 | MÉDIO |

## 2. Pessoas e permissões

| Tabela | Papel | Veredicto | Observações |
|---|---|---|---|
| `usuarios` (5395) | Identidade (uuid = auth.users), `role`, `permissoes Json`, `superior_id` | REUTILIZAR (FK de auditoria `executado_por`) | Lida por authz.ts:16 e 15+ rotas |
| `corretores` (1342) | Entidade comercial (**id number**), presença/peso/carteira, `usuario_id` → usuarios | REUTILIZAR (FK operacional `corretor_id`) | `forcar_distribuicao` alterado direto por distribuicao/route.ts:39 |
| `perfis` (4482) | Perfil→permissões (`permissoes Json`) | REUTILIZAR via mesmas chaves `crm/leads/pipeline` | authz.ts:26; fail-open sem mapa (permissions.ts:125-129, admin sempre) |
| `gerentes` (2732) | Gerentes p/ visitas com gerente | REUTILIZAR por FK quando necessário | Sem escrita no app |

## 3. WhatsApp

| Tabela | Finalidade | Acesso no app | Veredicto |
|---|---|---|---|
| `wa_contatos` (6512) | Contato tel/jid ↔ `lead_id` | live-chat:72/89 (leitura) | Fonte candidata da "primeira resposta" (decisão 12.3) |
| `wa_conversas` (6561) | Conversa por contato+instância, `ultima_msg_em` | live-chat:70/88 | idem |
| `wa_mensagens` (6703) | Mensagens; `wa_message_id`, `direcao`, `status_*`, `raw` | live-chat:82-84/91 (limites 600/2500); realtime INSERT em 4 telas | **`wa_message_id` = chave de idempotência natural do webhook** |
| `wa_instancias`/`instancias`/`corretor_instancias` | Instâncias por corretor (N:N) | team/campaigns/live-chat | REUTILIZAR por FK p/ registrar instância do disparo automático |
| `wa_eventos` (6612) | Fila de webhook (`payload`, `processado`, `trace_id`) | ai-center:26 | Padrão existente de ingestão idempotente a reaproveitar |
| Escrita | — | **Nenhuma escrita direta do app** — RPCs `wa_ingerir`/`wa_registrar_saida` (corpos fora do repo) e Edge Functions (`lead-chat`, `dapi-enviar` — crm/chat/route.ts:28-31/66) | Integração futura passa por aqui; nesta fase, só contrato |

Volume (P0): 3.580 enviadas / 3.617 recebidas / 1.643 áudios; `perf_eventos` 14.806.

## 4. Distribuição

Não existe tabela "aquário": é um **stage** + origem textual `"Aquário"` (crm:59-62 + filtros :68-69).
Tabelas reais: `distribuicao_config` (janela, `modo_fora_janela`, `modo_rodizio`, failover),
`distribuicao_estado` (cursor da fila circular), `motor_roleta_contadores`, `motor_fila`,
`motor_flags`, `motor_execucoes`, `corretor_presencas`, `presenca_*`. Acesso do app **só por RPC**
(`distribuicao_config_ler/salvar`, `distribuicao_saude`) exceto `motor_flags`/`motor_execucoes`
no ai-center. **Veredicto: NÃO tocar.** A automação de entrada (mensagem automática) é disparada
por esse motor — o Nova Era só REGISTRARÁ o evento, nunca comandará o disparo nesta arquitetura.

## 5. Esteira de Vendas

Núcleo: `vendas` (**21 registros**, P0) → `venda_processos` (`etapa` = `esteira_etapas.slug`;
`aprovacao_status`; trigger `log_venda_processo_etapa` grava `venda_processo_historico`) →
blocos `venda_condicoes`/`venda_comissao`/`venda_partes` (PKs compostas inferidas dos onConflict
em sales:577/594/636) → docs `esteira_doc_modelo`/`esteira_etapa_docs`/`esteira_anexos` (com
triagem por IA) → `esteira_etapa_verificacoes`. Regras compartilhadas em `app/lib/esteira.ts`
(blocos `libera`, `restrito_a`, `docExigido` por forma de pagamento).
Entrada atual: `sales:437-458` cria `vendas` + marca `negocios.status="ganho"` + `venda_processos`
etapa inicial; corretor entra `aprovacao_status:"pendente"` (ou RPC `solicitar_venda`).
**Veredicto: REUTILIZAR integralmente por FK; a saída "proposta registrada" precisa de um contrato
que NÃO implique `status="ganho"` imediato — decisão aberta 12.11.**

## 6. RPCs, views, triggers, RLS, índices, grants

- **RPCs que movem negócio/lead chamadas pelo app** (arquivo:linha no §16 do relatório bruto):
  `mover_negocio` (crm:183, crm:392), `transferir_negocio` (crm:310, live-chat:273),
  `transferir_negocios_massa` (crm:196), `registrar_momento_lead` (crm:159),
  `registrar_acao` (crm:333), `aquario_pescar/importar/status`, `solicitar_venda` (sales:464),
  `crm_etapa_*`/`crm_funil_*` (CrmWorkspace). Existem no schema mas SEM chamada no app:
  `redistribuir_lead`, `migrar_negocios_funil`, `aceitar_transferencia`, `transferir_com_aceite`,
  `atualizar_momento_lead*`, `wa_*`, `motor_roleta`, `distribuir_leads_orfaos` etc.
- **Views**: 25 declaradas; o app usa 4 — `vw_sla_leads` (crm:77 — fonte do semáforo SLA; 31
  colunas incl. `min_sem_interacao`, `cliente_ultima`, `tentativa`), `vw_ranking_vgv`,
  `v_vendas_detalhe`, `v_ganhos_executivo`. `vw_sla_leads` depende de `sla_regras` +
  `sla_msg_cache` (refresh por RPC interna).
- **Triggers (evidência da matriz P0, classe TRIGGER_ONLY)**: `trg_negocio_estagio_hist`
  (popula `negocio_estagio_historico` a cada movimento — histórico de etapa JÁ existe),
  `_mark_lead_atendido`, `trg_wa_msg_respondeu` (marca resposta a partir de wa_mensagens),
  `perf_visita_evento`, `log_venda_processo_etapa`, `sync_venda_conclusao`, `sync_vgv_condicoes`,
  `vincula_corretor_venda`, `fn_auditoria_trigger`, `fn_resp_antecipar`, `trg_perf_*`.
- **RLS**: helpers confirmados (`has_perm`, `current_broker_id`, `can_manage_all`,
  `manages_broker`, `pode_ver_processo`, `projeto_visivel`) provam RLS ativa nas tabelas do CRM,
  mas **o texto das policies não está no repo — sem evidência local**.
- **Índices/CHECKs/PKs**: sem evidência local além de nullability, identities e FKs do types +
  PKs compostas inferidas de `onConflict`. Assumir que índices além de PK/FK **não existem** até
  prova em contrário (impacta o doc 09).
- **Grants**: matriz P0 — 127 RPCs com EXECUTE a PUBLIC; `_perf_baseline`/`_view_backup` com
  grants diretos a anon/authenticated e RLS OFF (objeto da Migration A, não aplicada).
- **Migrations históricas**: inexistentes no repo (ver §0.1).

## 7. Conclusões que fundamentam a arquitetura (doc 06)

1. **Estado do lead está espalhado** por `leads` (2 blocos de momento + proxima_acao),
   `negocios` (tentativa/max_tentativas/descarte), `vw_sla_leads` (derivado), `crm_lead_alertas`
   e 3 tabelas de log sobrepostas (`crm_atividades`, `atendimento_acoes`, `lead_momentos`).
   Estender qualquer uma delas aumentaria a sobreposição — daí snapshot próprio + eventos.
2. **Histórico forte já existe só para etapa de negócio** (`negocio_estagio_historico`, por
   trigger) e para esteira (`venda_processo_historico`). Não existe evento tipado para
   tentativa/ação comercial/automação — o `ncrm_evento` preenche exatamente esse vazio.
3. **Idempotência natural disponível**: `wa_mensagens.wa_message_id` (webhook) e `wa_eventos`
   (fila com `processado`) — o desenho reaproveita o padrão com `idempotency_key` própria.
4. **Concorrência real**: corretor (PATCH crm), webhook (`wa_ingerir`), automação (`motor_*`),
   Sara (`ia_*`), calendário (createVisit move negócio), gestor (transferências em massa) — todos
   escrevem hoje sem versão/lock além do last-write-wins.
5. **Performance**: payload monolítico com teto de 30k linhas/fonte e refetch total — o Nova Era
   precisa de consultas por escopo (corretor/etapa/dia) com índices próprios (doc 09).
