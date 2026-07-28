# CRM Nova Era — Runbook de STAGING

Valida a migration aprovada (commit `474775b`) em um Supabase **separado de produção**, com **dados
fictícios**. Produção `diaegvfveqezispcthwk` **nunca** é tocada.

## Estado atual (pré-condição)
Inspeção read-only confirmou que existe **apenas 1 projeto Supabase na conta**: a produção
`diaegvfveqezispcthwk`. **Não há projeto de staging.** Por regra, não crio um projeto que gere
cobrança ou exija escolha de região. **Ação necessária do usuário** (abaixo) e envio do `STAGING_REF`.

### O que você precisa criar
1. No dashboard Supabase, **New project** (a região e o plano são sua escolha — por isso não crio).
   - Nome sugerido: `apecerto-staging` (ou o que preferir).
   - **Confirme que o ref gerado ≠ `diaegvfveqezispcthwk`.**
2. Me envie: **project ref**, **nome**, **host** (`db.<ref>.supabase.co`) — sem senha/keys.
3. Sigo com a aplicação nos passos 1→7. Enquanto isso, todos os arquivos já estão prontos e
   **ensaiados localmente** (ver `RESULTS-rehearsal.txt`).

## Ordem de execução no STAGING real (após receber o ref)
Rodar no **SQL Editor** do staging (ou via CLI apontando para o staging), nesta ordem:

1. `01_estrutura_legado.sql` — estrutura legada mínima (schema-only, sem dados reais).
2. `02_seed_ficticio.sql` — seed fictício (TESTE_, @example.com, telefones reservados; zero vendas).
3. **Registrar ANTES:** contagem de `negocios/leads/vendas` e `list_migrations`.
4. `supabase/migrations/20260728151548_crm_nova_era_persistent_model.sql` — a migration aprovada.
5. **Confirmar DEPOIS:** objetos `ncrm_*` criados; nenhum objeto legado alterado; nenhuma trigger em
   tabela legada; `vendas` inalterada.
6. `03_smoke_tests.sql` — cenários RLS/RPC (S1..S18).
7. `07_advisors.md` — rodar `get_advisors` (security+performance); corrigir só `ncrm_*`.
8. Rollback: `supabase/rollbacks/20260728151548_..._down.sql` → conferir remoção de `ncrm_*` e
   preservação do legado; **reaplicar** a migration; repetir smoke essencial.

> **Nunca** rode o `00_local_bootstrap.sql` no staging real — ele só existe para o ensaio local
> (recria `auth`/roles que o Supabase já fornece).

## Ensaio local (já executado aqui)
`bash staging/run_staging_rehearsal.sh` executa 00→01→02→migration→03→rollback→migration em Postgres
efêmero. Resultado: **47 asserts PASS / 0 falhas**, checksum de `negocios` idêntico antes/depois da
migration, **sem trigger em tabela legada**, `vendas=0` do início ao fim. Log em `RESULTS-rehearsal.txt`.

## Feature flag
`app/features/crm-nova-era/featureFlag.ts` + `.env.staging.example`: `CRM_NOVA_ERA_ENABLED=false` por
padrão (CRM antigo continua padrão). Staging pode ligar (`true`) para usuários da allowlist; **produção
permanece `false`** e **não é conectada** nesta entrega.

## Garantias
Sem deploy de produção. Sem ativar flag em produção. Sem migrar leads reais. Sem conectar WhatsApp real.
Nenhuma migration aplicada a `diaegvfveqezispcthwk`. Inspeção de produção foi somente read-only.
