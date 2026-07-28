# Rollout — CRM Nova Era (integração final) · 4 migrations PENDENTES em produção

Projeto: `diaegvfveqezispcthwk`. Nenhuma das migrations abaixo foi aplicada (confirmado por `list_migrations`).
**Não aplicar sem janela/aprovação.** Ordem de aplicação (cronológica):

1. `20260728190000_ncrm_sara_decisao.sql` — evento auditável `classificacao_sara` (decisão humana da Sara).
2. `20260728200000_ncrm_ingest_checkpoint.sql` — reconciliação aditiva + **kill-switch** (`ncrm_ingest_config`, `ncrm_ingest_audit`, `ncrm_ativar_ingest`/`ncrm_desativar_ingest`) + checkpoint. Cria o cron `ncrm_reconciliar` **mas nasce `ativo=false`**: o job roda e retorna sem processar nada até ativação explícita.
3. `20260728200100_ncrm_proposta_esteira.sql` — `ncrm_proposta.venda_solicitacao_id` + `ncrm_registrar_proposta_esteira` (proposta atômica na Esteira; proposta ≠ venda).
4. `20260728200200_ncrm_visita_atomica.sql` — `ncrm_agendar_visita_e_encaminhar` (visita real + `mover_negocio` para o pipe **Visita ApeCerto / Visita Agendada**, atômico).

Rollbacks correspondentes em `supabase/rollbacks/` (aplicar na ordem INVERSA: visita → proposta → ingest → sara).

## Pós-aplicação (ingest permanece DESLIGADO)

A reconciliação **não varre histórico**. Para ligar, um admin chama (idealmente logo após validar em produção):

```sql
-- confirmação explícita obrigatória; corte padrão = agora; retroação acidental é bloqueada
select public.ncrm_ativar_ingest(true);            -- ativo_desde = now()
-- (opcional) cortar a partir de um instante específico não-retroativo:
-- select public.ncrm_ativar_ingest(true, '2026-07-28T21:00:00Z');
```

A partir daí, só mensagens com `wa_mensagens.criado_em >= ativo_desde` **e** elegíveis (`raw.origem='motor'` ou inbound) são reconciliadas. Mensagens humanas enviadas e todo o histórico anterior ao corte são ignorados sem criar checkpoint. Para desligar:

```sql
select public.ncrm_desativar_ingest(true);
```

Auditoria em `public.ncrm_ingest_audit` (ativar/desativar, ativo_desde, quem, quando) e no estado corrente de `public.ncrm_ingest_config`.

## Verificação de fumaça (produção, após ativar)

1 disparo motor → `ncrm_estado` criado; 1 inbound → `respondeu=true`; 1 proposta → `venda_solicitacoes` pendente sem tocar `vendas`; 1 visita → linha em `public.visitas` **e** negócio na etapa "Visita Agendada" do pipe "Visita ApeCerto" (`mover_negocio` ok).

## Não realizado por instrução

Sem deploy · sem push · migrations **não aplicadas** · Render inalterado.
