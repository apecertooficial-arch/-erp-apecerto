# 20 — Riscos residuais e GO / NO-GO (FASE 2.2)

Correção 9. Veredicto objetivo sobre aplicar a persistência, com evidência verificável.

## Veredicto

**NO-GO para aplicar migration agora.** **GO condicional** para (a) fechar os bloqueios abaixo com
leitura do banco e decisão operacional e (b) então construir a migration real num arquivo separado e
validá-la em staging antes de qualquer aplicação. O desenho está fechado; o que falta é evidência de
ambiente e uma decisão de negócio — nada disso é resolvível dentro das proibições desta fase (sem SQL,
sem tocar o banco).

## Bloqueios (precisam de verificação/decisão antes de GO)

| # | Bloqueio | Por que bloqueia | Evidência objetiva que libera | Fonte |
|---|---|---|---|---|
| B1 | Helpers RLS (`current_broker_id`, `manages_broker`, `can_manage_all`, `has_perm`) | As policies e RPCs dependem deles; se forem `SECURITY INVOKER`, custosos ou recursivos, a RLS quebra ou fica lenta | Para cada: schema, assinatura, security, `search_path`, volatilidade, ausência de recursão RLS, custo por linha (`EXPLAIN`) | doc 08/19; corpos fora do repo |
| B2 | `negocios` com `FORCE ROW LEVEL SECURITY`? | Se sim, o owner dos helpers precisa de `BYPASSRLS`, senão `pode_ver_negocio` reentra na RLS de negocios | `SELECT relforcerowsecurity FROM pg_class WHERE relname='negocios'` + config do owner | doc 17 |
| B3 | Índice em `public.negocios(corretor_id)` | Escopo por corretor recai sobre negocios; sem índice, varredura em escala | `\d negocios` / `pg_indexes` mostrando índice em `corretor_id`. Se ausente: agendar criação na migration real (altera negocios — fora desta fase) | doc 17/09 |
| B4 | Texto das policies atuais das tabelas legadas | Precisamos garantir que o padrão de posse do Nova Era é coerente com o legado | Dump das policies de `negocios`/`leads`/`visitas`/`vendas` | doc 05 §6 |
| B5 | Momento exato da conversão proposta → venda | Decisão de NEGÓCIO; muda quando VGV/ganho é reconhecido | Definição da operação (aceite? aprovação? sinal?). **Aberto por autorização explícita** — não bloqueia o resto do modelo, só a RPC `converter_proposta` | doc 18/12 |
| B6 | Exposed schemas do PostgREST | Confirmar que `ncrm_private` não é exposto e que as tabelas `public.ncrm_*` só aparecem com grants desejados | Config da Data API do projeto | doc 09/19 |
| B7 | Extensão `btree_gist` p/ EXCLUDE de vigência | Sem ela, sobreposição de vigência não é imposta por constraint | `SELECT * FROM pg_extension WHERE extname='btree_gist'` ou plano de habilitar | draft §B.2 |

## Riscos residuais aceitos (com mitigação)

| Risco | Severidade | Mitigação |
|---|---|---|
| Custo de RLS por linha (helper por linha) | Média | Escopo por corretor (poucas linhas); helpers `STABLE`; medir com `EXPLAIN` na homologação (B1) |
| Varredura por falta de índice em `negocios(corretor_id)` | Média | B3 agendado; nos volumes do shadow o driver são os índices parciais de `ncrm_estado` |
| Conversão adiada (B5) | Baixa | Registro de proposta é completo e auditável sem a conversão; VGV não é afetado até converter |
| Divergência snapshot × replay de eventos | Baixa | Job de paridade no shadow (doc 11) recalcula o snapshot por replay e compara |
| `pg_column_size(payload) ≤ 8KiB` apertado p/ algum payload | Baixa | Payload só carrega contexto; se algum caso exigir mais, é sinal de que dado pertence a outra tabela |
| Sara (token/claim) mal configurada | Média | Claim em `app_metadata` (nunca `user_metadata`), TTL curto, rotação documentada, precedência humana (doc 08/19) |

## Checklist objetivo de GO (todas verdadeiras para liberar a migration)

1. B1 documentado e sem recursão/custo proibitivo. ☐
2. B2 resolvido (owner com bypass adequado ou negocios sem FORCE RLS). ☐
3. B3 confirmado ou índice agendado na migration real. ☐
4. B4 obtido e coerente. ☐
5. B6 confirmado (Data API não expõe `ncrm_private`). ☐
6. B7 decidido (habilitar extensão ou aceitar imposição por RPC). ☐
7. Draft 2.2 transformado em migration real (arquivo separado, revisado) e aplicado em **staging**
   com os 33 casos da Fase 1.2 reproduzidos via RPC + teste de transferência/RLS (doc 17 §4). ☐
8. B5 (conversão) permanece aberto **por decisão** — não bloqueia itens 1-7 nem o registro de proposta. ☑ (aberto autorizado)

Enquanto 1-7 tiverem ☐, o veredicto é **NO-GO**. Nenhum desses passos é executável dentro das
proibições desta fase (SQL, migration, alteração de banco/Supabase/negocios/Esteira/vendas) — por
isso a entrega para aqui, como especificação pronta para essa verificação.
