# CRM Nova Era — Implementação funcional no frontend (fase de aplicação)

Reaproveita a infraestrutura existente do ERP (cliente Supabase, sessão, design, Sara/IA,
visitas, Esteira) e liga a experiência ao backend real `ncrm_*`. **Nada de segundo ERP.**
Feature flag **desligada por padrão**. Sem `service_role` no frontend.

## Arquivos adicionados/alterados

Novos:
- `app/api/ncrm/route.ts` — leitura de `ncrm_estado/evento/proposta` (JWT do usuário, RLS) e
  **ações somente por RPC ncrm_*** (mapa ação→RPC; erros traduzidos p/ linguagem simples).
- `app/api/ncrm/sara/route.ts` — Sara **suggestion-only**: reaproveita a edge function `ia-router`
  (chave server-side); rejeição registra feedback (`perf_log_sessao`). Não altera etapa/estado.
- `app/features/crm-nova-era/live/adapter.ts` — mapeia linhas ncrm → `LeadNova` (puro; testado).
- `app/features/crm-nova-era/CrmNovaEraLiveWorkspace.tsx` — quadro (4 colunas), painel do lead,
  Central de atenção (fila), visão gerencial, ações (RPC) e Sara. Reusa `LeadCard`, `WorkQueue`,
  `montarTimeline` e as regras (`rules.ts`).
- `tests/crm-nova-era/ncrm-adapter.test.mjs`, `tests/crm-nova-era/ncrm-flag.test.mjs`.

Alterados:
- `app/features/crm-nova-era/featureFlag.ts` — gate: flag do ambiente **E** (admin **ou** allowlist).
- `app/features/crm-nova-era/CrmNovaEraGate.tsx` — só exibe "CRM Nova Era" se liberado; bloqueia
  `?crm=nova-era` de quem não pode; persiste a escolha **por usuário** (localStorage); default = CRM antigo.
- `app/features/products/ProductCatalog.tsx` — passa `accessToken` + `profile` ao Gate (1 linha).
- `app/features/crm-nova-era/styles.ts` — classes CSS isoladas (`nova-crm-*`) para a experiência live.
- `supabase/migrations/20260728151548_*.sql` + `supabase/rollbacks/*_down.sql` — dobradas as
  correções de hardening já aplicadas em produção (grants service_role-only + índices de FK).

## Regras de negócio honradas
- 4 colunas apenas (`novo/tentando_contato/em_atendimento/em_acompanhamento`). Cadência, visita e
  proposta **não** são colunas.
- Movimentação **exclusivamente** por RPC ncrm_* (sem UPDATE direto); recarrega do banco após a
  confirmação (sem otimismo permanente). `versao_conflito` → recarrega e avisa.
- Automação inicial não conta como tentativa humana; resposta encerra a prospecção; cadência é
  calculada pelo banco. Proposta **não** é venda. Visita/proposta encaminham para os pipes existentes.
- Sara sugere; humano confirma/rejeita; Sara não muda etapa, não envia WhatsApp, não cria visita/proposta.

## Resultados de qualidade (ambiente local)
- **Lint:** 0 erros / 0 warnings nos arquivos novos (`eslint app/api/ncrm app/features/crm-nova-era`).
- **Typecheck:** 0 erros nos arquivos novos (`tsc --noEmit`). Os 54 erros restantes do repositório são
  **pré-existentes** (outros módulos) e fora do escopo.
- **Build:** `pnpm run build` (vinext) **OK** — rotas `/api/ncrm` e `/api/ncrm/sara` registradas.
- **Testes unitários:** 40/40 (33 rules + 4 adapter + 3 flag).
- **Render/source-guard (`tests/rendered-html.test.mjs`):** 3 testes já estavam **vermelhos antes**
  desta fase (asseguram strings em `CrmWorkspace.tsx`/`HomeWorkspace.tsx`, arquivos não tocados aqui).

## Integrações que dependem de configuração externa (não ativar nesta rodada)
1. **Feature flag:** `NEXT_PUBLIC_CRM_NOVA_ERA_ENABLED` (default `false`) e
   `NEXT_PUBLIC_CRM_NOVA_ERA_ALLOWLIST` (ids de `usuarios`). Ver `staging/.env.staging.example`.
2. **Automação de entrada (msg automática) e resposta inbound:** dependem de um backend
   **service_role** (edge function) chamando `ncrm_registrar_msg_automatica` / `ncrm_registrar_resposta_cliente`.
   Não existe no frontend (correto). Sem isso, os estados só nascem quando esse serviço rodar.
3. **Sara estruturada:** requer a edge function `ia-router` com chave de IA no ambiente. Persistir a
   sugestão como evento `classificacao_sara` exige uma edge function com papel `sara` (app_metadata),
   fora desta rota (que roda com o JWT do corretor).
4. **Visita/Proposta:** o vínculo usa o **ID real** da visita (módulo Agenda) / da proposta.

## Roteiro de ativação canário (administrador)
1. Confirmar migration + hardening aplicados (já em produção): objetos `ncrm_*`, RLS on, grants ok.
2. Definir no ambiente de deploy: `NEXT_PUBLIC_CRM_NOVA_ERA_ENABLED=true` e
   `NEXT_PUBLIC_CRM_NOVA_ERA_ALLOWLIST=<id_do_admin>` (só o admin no piloto).
3. Publicar o frontend. Só o admin verá a aba "CRM Nova Era (Piloto)"; os demais seguem no CRM antigo.
4. Como o quadro nasce vazio (sem automação), validar o fluxo criando estado por um serviço
   service_role de teste **em staging** — nunca semear em produção.
5. Expandir a allowlist gradualmente (1–2 corretores) observando erros e Advisors.

## Roteiro de rollback da aplicação (sem tocar no banco)
1. **Imediato:** remover a allowlist / setar `NEXT_PUBLIC_CRM_NOVA_ERA_ENABLED=false` e republicar.
   O Gate volta a esconder a Nova Era para todos (CRM antigo é o default) — reversível em 1 deploy.
2. **Código:** reverter o commit desta fase (revert do merge) — as tabelas `ncrm_*` permanecem
   (dormentes, sem uso). Nenhuma migração é desfeita por este rollback de app.
3. **Banco (se exigido, fora desta fase):** o rollback aprovado `supabase/rollbacks/20260728151548_*_down.sql`
   remove só objetos `ncrm_*` (não executar sem autorização).
