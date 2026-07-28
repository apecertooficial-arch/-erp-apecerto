# 08 — Matriz RLS e permissões (FASE 2.0 — PROPOSTA, nada aplicado)

> ⚠️ **SUPERSEDIDO EM PARTE PELA FASE 2.2.** Onde este documento divergir dos docs 14–20, prevalecem os 14–20. Em especial: `ncrm_estado` **não** guarda `corretor_id` nem `lead_id`; **não** há trigger de sincronização em `negocios`; a RLS lê a **posse atual** em `negocios` (doc 17); invariantes bidirecionais no doc 16; ordem transacional no doc 15; ciclo da proposta no doc 18; draft autoritativo `sql-drafts/DRAFT-FASE-2.2-modelo-persistente.sql`.

Premissas herdadas do modelo real (doc 05): helpers `current_broker_id()`, `manages_broker(id)`,
`can_manage_all()`, `has_perm(modulo, acao)` já existem e são usados por policies atuais;
`corretores.usuario_id` liga uuid→number. Lições P0 aplicadas: nenhuma RPC nova com grant a
PUBLIC; todas com `search_path` fixo e guarda interna; `REVOKE ... FROM PUBLIC` explícito.

Papéis considerados: `anon` · `authenticated` como **corretor** · como **gestor/gerente** · como
**admin** · `service_role` (Edge Functions/webhook — nunca no navegador) · **Sara** (agente IA:
JWT próprio `authenticated` com claim `app_role='sara'`, sem linha em `corretores`).

## Matriz (tabela × operação × papel)

| Tabela | Op | Papel | Condição | Política sugerida (nome) | Risco se ausente |
|---|---|---|---|---|---|
| `ncrm_estado` | SELECT | corretor | `corretor_id = current_broker_id()` | `ncrm_estado_sel_corretor` | corretor vê carteira alheia |
| `ncrm_estado` | SELECT | gestor | `manages_broker(corretor_id)` OR `can_manage_all()` | `ncrm_estado_sel_gestao` | gestor sem visão de equipe |
| `ncrm_estado` | SELECT | admin | `can_manage_all()` | (coberta acima) | — |
| `ncrm_estado` | INSERT/UPDATE/DELETE | todos os papéis de navegador | **NEGADO** (sem policy de escrita; grants revogados) | — escrita SÓ via RPC | bypass do motor de eventos/versão |
| `ncrm_estado` | tudo | anon | **NEGADO** (RLS on, sem policy, sem grant) | — | vazamento de pipeline comercial |
| `ncrm_evento` | SELECT | corretor | evento de negócio da sua carteira (`EXISTS ncrm_estado e WHERE e.negocio_id = ncrm_evento.negocio_id AND e.corretor_id = current_broker_id()`) | `ncrm_evento_sel_corretor` | histórico alheio exposto |
| `ncrm_evento` | SELECT | gestor/admin | idem com `manages_broker/can_manage_all` | `ncrm_evento_sel_gestao` | — |
| `ncrm_evento` | INSERT | navegador | **NEGADO** — só RPC | — | evento forjado sem transação |
| `ncrm_evento` | UPDATE/DELETE | TODOS (incl. service_role via trigger) | **NEGADO** + trigger `ncrm_private.evento_imutavel` | — | histórico reescrito |
| `ncrm_proposta` | SELECT | corretor | `corretor_id = current_broker_id()` | `ncrm_proposta_sel_corretor` | proposta de carteira alheia |
| `ncrm_proposta` | SELECT | gestor/admin | `manages_broker(corretor_id) OR can_manage_all()` | `ncrm_proposta_sel_gestao` | — |
| `ncrm_proposta` | INSERT/UPDATE | navegador | **NEGADO** — só RPC (registrar/converter) | — | proposta forjada; venda inflada |
| `ncrm_proposta` | anon | tudo | **NEGADO** | — | vazamento de VGV/pipeline |
| `ncrm_workflow_config`/`_passo` | SELECT | authenticated | `true` (config não é sensível) | `ncrm_config_sel_auth` | — |
| `ncrm_workflow_config`/`_passo` | INSERT/UPDATE | admin | via RPC `ncrm_config_publicar` com `has_perm('crm','gerenciar')` | — | cadência alterada por corretor |
| RPCs `ncrm_*` (escrita operacional) | EXECUTE | authenticated | guarda interna: `auth.uid()` obrigatório + dono/gestor do negócio + `has_perm('crm'/'leads', ...)` | GRANT a `authenticated`; `REVOKE FROM PUBLIC, anon` | repetir o cenário das 127 RPCs anon |
| RPC `ncrm_registrar_msg_automatica` | EXECUTE | service_role apenas | chamada por Edge Function/motor com secret interno (padrão P0 `_shared/auth.ts`) | GRANT só a service_role | automação falsificada por usuário |
| RPCs de sugestão da Sara (`ncrm_sara_classificar`) | EXECUTE | claim `app_role='sara'` verificada DENTRO da função | aplica precedência humana (doc 06 §7); nunca toca tabela direto | GRANT a authenticated + verificação de claim; REVOKE PUBLIC | Sara com acesso irrestrito |
| `leads`/`negocios`/`visitas`/`vendas` | — | — | **políticas atuais permanecem intocadas** nesta fase | — | mexer nelas = risco no CRM em produção |

## Regras transversais

1. **Navegador nunca usa service_role** — padrão atual do app (server.ts usa token do usuário)
   é mantido; Edge Functions continuam sendo o único lugar de service_role.
2. **anon**: zero acesso a qualquer objeto `ncrm_*` (RLS habilitada + nenhum grant). As tabelas
   nascem com `REVOKE ALL FROM PUBLIC, anon, authenticated` e grants mínimos de SELECT.
3. **Sara**: sem grant de tabela; só EXECUTE nas RPCs de sugestão, que (a) validam claim,
   (b) aplicam precedência humana, (c) registram tudo como evento auditável.
4. **Escrita centralizada**: nenhuma policy de INSERT/UPDATE nas tabelas de dados para papéis de
   navegador — impossível escapar do par evento+versão.
5. **Fail-open do código não se repete**: `permissions.ts` libera quando não há mapa; as policies
   propostas negam por default (RLS sem policy = negado).
6. Texto completo das policies (comentado, não aplicável) no DRAFT SQL §5.

## Sara — identidade e precedência (bloqueio 4)

- A autorização da Sara **NUNCA** vem de `user_metadata` (editável pelo próprio token/fluxo de
  signup). Deve vir de `app_metadata` (setado só pelo backend/service_role) OU de uma identidade
  técnica dedicada controlada pela operação. A função de sugestão verifica a claim DENTRO do corpo
  (`auth.jwt() -> 'app_metadata' ->> 'app_role' = 'sara'`), nunca confia em parâmetro do cliente.
- **Expiração e rotação**: o token da Sara deve ter TTL curto (recomendação: ≤1h) e ser rotacionado
  por processo do backend; o segredo de emissão fica no cofre do ambiente (padrão das Edge Functions,
  como o `_shared/auth.ts` do P0). Documentar o responsável pela rotação antes da integração real.
- **Precedência humana** (doc 06 §7): `ncrm_sara_classificar` sempre registra evento; só aplica ao
  estado se `ultima_decisao_humana_em <= p_base_estado_em`; senão `precedencia_humana` (aplicado=false).

## Helpers RLS — evidência e status (bloqueio 9)

| Helper | Evidência de existência | O que falta confirmar antes de aplicar |
|---|---|---|
| `current_broker_id()` | usado em policies atuais; lê `corretores` (matriz P0, classe RLS_HELPER) | schema, `SECURITY`, `search_path`, custo por linha, STABLE? |
| `manages_broker(id)` | matriz P0 (RLS_HELPER) | idem + risco de recursão RLS (não deve reconsultar tabela protegida) |
| `can_manage_all()` | matriz P0 (RLS_HELPER); lê `usuarios` | idem |
| `has_perm(modulo, acao)` | matriz P0; lê `perfis, usuarios` | idem; custo se chamado por linha |

**Status: BLOQUEIO da migration real.** Para CADA helper é preciso, na fase de aplicação (com leitura
do banco), documentar: schema · assinatura · `SECURITY DEFINER/INVOKER` · `search_path` · grants ·
custo quando avaliado por linha (marcar `STABLE`/`LEAKPROOF` se aplicável) · ausência de recursão RLS
(o helper não pode SELECIONAR a própria tabela protegida dentro da policy). Sem essa confirmação, as
policies não devem ser aplicadas. O texto das policies atuais das tabelas legadas **não está no repo**
(doc 05 §6) — não presumir comportamento.

## Teste de transferência × RLS (bloqueio 7)

Cenário obrigatório antes de aplicar: negócio do corretor A com `ncrm_estado`; transferir para
corretor B (via caminho legado `transferir_negocio`/UPDATE em `negocios.corretor_id`). Assert:
(1) o trigger `ncrm_private.sync_corretor` atualizou `ncrm_estado.corretor_id` para B na MESMA
transação; (2) A **não** enxerga mais o estado/eventos/proposta (policy nega); (3) B passa a
enxergar; (4) evento `transferencia` registrado com `de=A, para=B`. Enquanto esse teste não passar
em staging, a sincronização não pode ser considerada idempotente/segura.

## Riscos residuais documentados

- Policies atuais das tabelas legadas não estão no repo (doc 05 §6): validação final das condições
  de gestor precisa de leitura do banco na fase de aplicação.
- Exposição à Data API não é automática (doc 09 §RLS×Data API): confirmar exposed schemas.
