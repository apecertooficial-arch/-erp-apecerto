# Rollout — CRM Nova Era (integração final) · 4 migrations PENDENTES em produção

Projeto: `diaegvfveqezispcthwk`. Nenhuma das migrations abaixo foi aplicada (confirmado por `list_migrations`).
**Não aplicar sem janela/aprovação.** Ordem de aplicação (cronológica):

1. `20260728190000_ncrm_sara_decisao.sql` — evento auditável `classificacao_sara` (decisão humana da Sara).
2. `20260728200000_ncrm_ingest_checkpoint.sql` — reconciliação aditiva + **kill-switch** (`ncrm_ingest_config`, `ncrm_ingest_audit`, `ncrm_ativar_ingest`/`ncrm_desativar_ingest`) + checkpoint. Cria o cron `ncrm_reconciliar` **mas nasce `ativo=false`**: o job roda e retorna sem processar nada até ativação explícita.
3. `20260728200100_ncrm_proposta_esteira.sql` — `ncrm_proposta.venda_solicitacao_id` + `ncrm_registrar_proposta_esteira` (proposta atômica na Esteira; proposta ≠ venda).
4. `20260728200200_ncrm_visita_atomica.sql` — `ncrm_agendar_visita_e_encaminhar` (visita real + `mover_negocio` para o pipe **Visita ApeCerto / Visita Agendada**, atômico).

Rollbacks correspondentes em `supabase/rollbacks/` (aplicar na ordem INVERSA: visita → proposta → ingest → sara).

## Ativação — SOMENTE pelo controle autenticado do ERP

A ativação/desativação **não** deve ser feita pelo SQL Editor: as RPCs exigem `auth.uid()` e o SQL Editor executa **sem JWT** do administrador (a chamada retornaria `nao_autenticado`). O SQL Editor serve apenas para **inspeção read-only**.

O caminho operacional é o controle administrativo do CRM Nova Era (visível só para admin/executivo), que usa o JWT real do usuário e chama o endpoint autenticado `/api/ncrm/ingest`:

- `GET /api/ncrm/ingest` → status (`ncrm_status_ingest`): ativo, ativo_desde, atualizado_em/por, última auditoria.
- `POST /api/ncrm/ingest {action:"ativar"}` → `ncrm_ativar_ingest(true)` (corte = agora; `ativo_desde` **não** é arbitrário pelo frontend).
- `POST /api/ncrm/ingest {action:"desativar"}` → `ncrm_desativar_ingest(true)`.

O botão "Ativar a partir de agora" exige confirmação humana explícita; há botão emergencial "Desativar ingest". O controle **nunca** ativa sozinho — não ativa no deploy nem ao ligar a feature flag. Após ativar, só mensagens com `wa_mensagens.criado_em >= ativo_desde` **e** elegíveis (`raw.origem='motor'` ou inbound) são reconciliadas; histórico anterior ao corte e mensagens humanas enviadas ficam de fora, sem checkpoint. Auditoria em `public.ncrm_ingest_audit` + estado corrente em `public.ncrm_ingest_config`.

## Ordem correta do rollout

1. Aplicar as **migrations dormentes** (ordem acima) — ingest nasce `ativo=false`.
2. **Deploy com a feature flag do CRM Nova Era desligada** (nada ativa o ingest).
3. **Validar os endpoints** autenticados (`/api/ncrm/*`, incluindo `GET /api/ncrm/ingest`) com o admin.
4. **Ativar o ingest pelo controle admin autenticado** (não pelo SQL Editor).
5. **Smoke test controlado:** 1 disparo motor → `ncrm_estado` criado; 1 inbound → `respondeu=true`; 1 proposta → `venda_solicitacoes` pendente sem tocar `vendas`; 1 visita → linha em `public.visitas` **e** negócio na etapa "Visita Agendada" do pipe "Visita ApeCerto".
6. **Habilitar o CRM Nova Era gradualmente.**

## Não realizado por instrução

Sem deploy · sem push · migrations **não aplicadas** · Render inalterado.
