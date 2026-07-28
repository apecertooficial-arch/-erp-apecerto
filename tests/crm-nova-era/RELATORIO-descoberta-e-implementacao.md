# CRM Nova Era — Implementação: relatório de descoberta e testes

## Ambiente e bloqueio de execução

- **Único projeto Supabase existente:** `diaegvfveqezispcthwk` (ref), host `db.diaegvfveqezispcthwk.supabase.co`,
  Postgres 17.6, região us-east-1, nome "apecerto.oficial@gmail.com's Project".
- **Evidência de que é PRODUÇÃO:** é o único projeto da conta e é o banco do ERP em uso (877 leads /
  880 negócios / 21 vendas por auditoria anterior; RLS e policies reais de produção — ver abaixo).
- **Não existe projeto de staging/homologação separado.** Portanto, conforme a regra: **a migration
  NÃO foi aplicada** a nenhum projeto Supabase. Toda a inspeção foi **read-only**. Os testes rodaram
  num **Postgres 16 local efêmero** (`initdb` em `/tmp`, destruído no fim) que emula a superfície do
  Supabase (roles `anon/authenticated/service_role`, `auth.uid()/auth.jwt()`, e os **corpos reais**
  dos 4 helpers capturados na descoberta).

## Etapa 1 — Descoberta (read-only; apenas SELECT/catálogo; sem segredos)

Consultas via MCP Supabase (`execute_sql`, somente leitura):

1. **Helpers de RLS** — todos em `public`, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`:
   - `current_broker_id() → bigint` = `corretores.id WHERE usuario_id = auth.uid()`.
   - `can_manage_all() → boolean` = `usuarios.role IN ('admin','executivo')`.
   - `manages_broker(p_corretor_id bigint) → boolean` = role `gerente/diretor` sobre árvore recursiva de subordinados (`usuarios.superior_id`).
   - `has_perm(p_modulo text, p_acao text) → boolean` = admin/executivo→true; senão `usuarios.permissoes` (override) → `perfis.permissoes`; ausência = nega.
   - **ACL:** todos com EXECUTE a `PUBLIC` (anon herda) — contexto herdado; as funções NOVAS do Nova Era não repetem isso.
2. **RLS/FORCE** de `negocios/leads/visitas/vendas` (+ `corretores/usuarios/empreendimentos/unidades`): **RLS habilitada, `FORCE ROW LEVEL SECURITY` = OFF, owner `postgres`** em todas.
   → B2 resolvido: helper `SECURITY DEFINER` owned by `postgres` lê `negocios` **sem reentrar na RLS** (owner isento quando FORCE off) → sem recursão.
3. **Policies reais** (fonte da coerência):
   - `negocios_select_scoped` = `can_manage_all() OR corretor_id = (SELECT current_broker_id())`.
   - `leads_*_scoped` idem. `vendas_select_own` via `venda_corretores`. `visitas_select_team` usa `manages_broker(corretor_id)` (visão de equipe existe no legado).
4. **Tipos reais das chaves:** `negocios.id/lead_id/corretor_id = bigint`; `leads.id/corretores.id = bigint`;
   `visitas.id/vendas.id/usuarios.id/empreendimentos.id/unidades.id = uuid`; `negocios.status = text`.
5. **Índices em `negocios`:** `negocios_pkey(id)`, **`idx_negocios_corretor(corretor_id)` EXISTE**, `idx_negocios_lead(lead_id)`, `idx_negocios_stage`. → B3 resolvido (o escopo por corretor tem índice; nenhuma alteração em `negocios` necessária).
6. **Extensões:** `pgcrypto`+`uuid-ossp` instaladas; `gen_random_uuid()` disponível (core); `btree_gist`/`pgtap` **available mas não instaladas** → a migration **não depende** delas (imutabilidade/unicidade por trigger e índice único).
7. **Exposed schemas da Data API:** `current_setting('pgrst.db_schemas')` = NULL via SQL (config de plataforma). Default Supabase = `public, graphql_public`. **`ncrm_private` NÃO é adicionado a exposed schemas** (decisão de plataforma — confirmar no dashboard).

Decisão de modelagem coerente com o legado: `ncrm_private.pode_ver_negocio` = `can_manage_all() OR
dono_atual OR manages_broker(dono_atual)`. Isso adota a visão-de-equipe (como `visitas_select_team`)
e satisfaz os testes de gestor; é levemente mais amplo que `negocios_select_scoped` (que não usa
`manages_broker`) — escolha deliberada, registrada aqui para validação humana.

## Etapa 2 — Correções obrigatórias implementadas

- **2.1 Schema privado/policies:** `ncrm_private` com `REVOKE ALL ... FROM PUBLIC`; `GRANT USAGE`
  **apenas** a `authenticated` (estritamente p/ a policy chamar `pode_ver_negocio`); `REVOKE` de
  EXECUTE nas demais funções internas; `GRANT EXECUTE` só em `pode_ver_negocio`. Validado na prática:
  `authenticated` executa a policy; `anon` sem acesso (testes #3, #10).
- **2.2 Reativação de proposta:** `ncrm_proposta_transicao` **não** reativa (mantém `saida='esteira_vendas'`);
  reativação é ação humana **separada** `ncrm_reativar_apos_proposta` (exige próxima ação completa,
  valida proposta terminal, limpa saída, incrementa versão, evento `reativacao`) — testes #22, #23, #24.
- **2.3 Idempotência:** `idempotency_key` obrigatória (rejeita NULL/vazio/espaços — `assert_idem`);
  pré-check + `UNIQUE`; captura de `unique_violation` no bloco `EXCEPTION` **reverte o UPDATE anterior**
  na mesma transação — provado pelo teste de concorrência #15 (perdedor volta a `versao=1`).

## Etapa 3/4 — Migration e rollback

- Migration gerada com o comando oficial: `supabase migration new crm_nova_era_persistent_model`
  → `supabase/migrations/20260728151548_crm_nova_era_persistent_model.sql`. Usa os **tipos reais** (sem placeholders).
  Cria só objetos `ncrm_*` + schema `ncrm_private`; triggers só em objetos `ncrm_*`; **não** cria
  `ncrm_converter_proposta`; **não** toca `vendas`/`venda_processos` (a coluna `ncrm_proposta.venda_id`
  fica **sem FK** nesta entrega — a FK entra junto da conversão).
- Rollback: `supabase/rollbacks/20260728151548_..._down.sql` — remove **somente** objetos `ncrm_*`
  (ordem inversa, `IF EXISTS`, **sem CASCADE**); preserva o legado (teste #29).

## Etapa 5 — Testes (Postgres 16 local efêmero)

Driver: `tests/crm-nova-era/run_local.sh` (harness → migration → 28 testes SQL → concorrência #15 →
rollback #29 → reaplica #30). **Resultado: 30/30 requisitos cobertos, 0 falhas** (log em `RESULTS.txt`).

Cobertura ↔ requisito: #1 migration sobe · #2 RLS on · #3 anon negado · #4/#5 corretor A/B isolados ·
#6 gestor só equipe · #7 admin tudo · #8 transferência muda visibilidade na hora · #9 nenhuma linha
`ncrm_*` alterada na transferência (sem trigger) · #10 escrita direta negada · #11 RPC autorizada ·
#12 RPC não autorizada falha · #13 idem ausente rejeitada · #14 retry não duplica · #15 concorrência
não duplica (+`unique_violation` reverte o UPDATE) · #16 versão desatualizada rejeitada · #17 estado+
evento atômicos · #18 evento imutável (U/D bloqueados) · #19 proposta não cria venda (contagem de
vendas idêntica: 2→2) · #20 não marca ganho · #21 recusada permanece histórica · #22 encerramento não
reativa · #23 reativação exige próxima ação · #24 nova proposta após terminal · #25 visita exige
visita_id · #26 esteira exige proposta_id · #27 estado ativo exige próxima ação · #28 Sara não
sobrescreve decisão humana posterior · #29 rollback só ncrm_* · #30 reaplica após rollback.

**Contagem de vendas antes/depois dos testes de proposta: 2 → 2 (idêntica).**

## Advisors de segurança/performance

A migration **não foi aplicada** a nenhum projeto Supabase (não há staging; produção é proibida),
então os advisors do Supabase **não podem refletir** os objetos novos. O Postgres local não tem o
serviço de advisors. Portanto, advisors da migration ficam **pendentes** para a fase de aplicação em
staging (item do GO/NO-GO, doc 20). Nenhuma alteração foi feita em produção para obter advisors.

## Declarações de conformidade

- Banco de produção consultado **apenas em modo read-only** (somente SELECT/catálogo).
- Testes executados em **Postgres 16 local efêmero** (`/tmp`), destruído ao fim.
- **Nenhum objeto de produção alterado. Nenhum dado real alterado. Nenhuma venda criada. Nenhum
  objeto legado modificado.** Sem migration aplicada, sem deploy, sem push.

---

## Correções (commit d501715, sobre 8950ccc) — sem nova fase documental

1. **Autorização fail-closed:** `pode_ver_negocio`/`pode_operar_negocio` usam `COALESCE(...,false)`;
   todas as RPCs validam `pode_operar_negocio(...) IS NOT TRUE`. Testado com `has_perm`/`manages_broker`
   retornando NULL, `current_broker_id` NULL, usuário inexistente e token sem `sub` — todos negados.
2. **Imutabilidade da config:** trigger de passo `BEFORE INSERT OR UPDATE OR DELETE`; transições
   fechadas (rascunho→publicada seta `publicado_em`; publicada→encerrada exige `vigencia_fim`;
   publicada→rascunho e encerrada→qualquer proibidas; regras/passos imutáveis após publicar).
3. **Sara suggestion-only:** nunca altera `ncrm_estado`, nunca incrementa versão, sempre
   `aplicado=false` com motivo (`aguardando_aprovacao_humana`/`precedencia_humana`).
4. **message_id da automação:** rejeita NULL/vazio/espaços antes de montar `auto:<id>`/`wa:<id>`.
5. **RPCs mínimas adicionadas:** `ncrm_registrar_resposta_cliente` (service_role), `ncrm_concluir_acao`,
   `ncrm_saida_descarte`, `ncrm_saida_nutricao`, `ncrm_reativar` — todas com auth+authz fail-closed+
   idempotência+FOR UPDATE+versão+UPDATE+evento+rollback atômico.
6. **Cadência:** consulta `max_tentativas` da config; bloqueia acima do limite; `mensagem_automatica`
   não conta como tentativa; prospecção após resposta é negada; valida próxima ação por fluxo.
7. **unique_violation:** só vira `ja_processado` se existir evento com a mesma `idempotency_key`;
   caso contrário, o erro é **relançado** (testado com colisão de outra constraint).

Resultado dos testes: **95 PASS / 0 FALHAS** (`RESULTS.txt`), incluindo migration→testes→rollback→migration.
Contagem de vendas inalterada (2). Nenhuma execução em produção.
