# Acesso efetivo do tracking — 28/08/2026

Auditoria somente leitura do Supabase de produção. O candidato local descrito
no fim não foi aplicado, publicado nem enviado ao remoto.

## Tabelas private sem RLS

As dez tabelas sinalizadas pelo Advisor pertencem a postgres, mas não estão
alcançáveis pela Data API:

- produção expõe 2 de 11 schemas; private não está selecionado;
- private concede USAGE/CREATE apenas a postgres;
- anon, authenticated e service_role não têm USAGE no schema;
- anon e authenticated não têm SELECT/INSERT/UPDATE/DELETE em nenhuma das dez
  tabelas;
- somente lead_attribution_patch_audit concede SELECT/INSERT/UPDATE a
  service_role, ainda ineficaz para acesso direto sem USAGE no schema;
- motor_dispatcher_estado é mediada por funções SECURITY DEFINER que concedem
  execução somente a service_role; as demais tabelas não têm chamadores
  funcionais ativos encontrados no catálogo.

| Objeto | anon | authenticated | service_role | Acessibilidade real | Impacto |
|---|---|---|---|---|---|
| central_legado_corte_audit | nenhum | nenhum | nenhum | não exposta | sem vulnerabilidade externa |
| crm_funis_legados_leads_backup_20260723 | nenhum | nenhum | nenhum | não exposta | sem vulnerabilidade externa |
| crm_funis_legados_negocios_backup_20260723 | nenhum | nenhum | nenhum | não exposta | sem vulnerabilidade externa |
| crm_funis_legados_stages_backup_20260723 | nenhum | nenhum | nenhum | não exposta | sem vulnerabilidade externa |
| crm_negocios_antes_correcao_prioridade_20260723 | nenhum | nenhum | nenhum | não exposta | sem vulnerabilidade externa |
| crm_negocios_antes_restauracao_exata_20260723 | nenhum | nenhum | nenhum | não exposta | sem vulnerabilidade externa |
| lead_attribution_patch_audit | nenhum | nenhum | grant de S/I/U sem USAGE | não exposta diretamente | usada por remediação controlada |
| motor_dispatcher_estado | nenhum | nenhum | via RPCs restritas | mediada por SECURITY DEFINER | operação preservada |
| produto_publicacao_snapshot_20260821 | nenhum | nenhum | nenhum | não exposta | snapshot de rollback |
| produto_publicacao_snapshot_20260821_controle | nenhum | nenhum | nenhum | não exposta | controle do snapshot |

Ativar RLS nessas dez tabelas continua recomendável como defesa em profundidade,
mas não corrige exposição atual. Fazer isso em bloco adicionaria risco de
regressão sem reduzir uma porta acessível.

## Função pública de qualificação

Estado publicado:

- schema public, exposto pela Data API;
- SECURITY DEFINER, owner postgres, search_path vazio;
- anon: sem EXECUTE;
- authenticated: com EXECUTE;
- service_role: com EXECUTE;
- onze usuários ativos satisfazem is_equipe();
- a função publicada aceita qualquer integrante ativo e lê f2_lead como owner,
  ignorando a carteira protegida por RLS;
- o único chamador no código é a rota canônica do Funil 2.0 após
  f2_atualizar_momento.

Impacto comprovado: um corretor autenticado pode chamar o RPC diretamente para
um lead de outra carteira que já esteja numa etapa elegível e enfileirar
Qualificado. O event_id determinístico limita duplicidade, mas não corrige o
bypass de autorização.

## Candidato local

A migration 20260828220626_tracking_qualified_scope_hardening.sql troca apenas a
autorização ampla is_equipe() por f2_pode_operar_lead(p_f2_lead_id), a mesma
regra usada por f2_atualizar_momento. service_role permanece autorizado, anon
permanece revogado, o contrato e a idempotência permanecem iguais.

Rollback exato:
supabase/rollbacks/20260828220626_tracking_qualified_scope_hardening.down.sql.

## Validação e nota

- 557 testes do repositório: 557 aprovados, 0 falhas;
- teste específico de autorização: anônimo bloqueado, usuário autenticado fora
  da carteira bloqueado, responsável pela carteira autorizado e service_role
  autorizado;
- ESLint do novo teste: aprovado;
- `git diff --check`: aprovado;
- nenhuma migration, DML remoto, publicação, push ou deploy foi executado.

Nota de segurança do estado publicado: **8,2/10**. O alerta das dez tabelas não
representa exposição efetiva hoje, mas o RPC público ainda permite o bypass de
carteira por usuário autenticado.

Nota do candidato local, se publicado após revisão: **8,8/10**. A diferença não
é incorporada à nota operacional enquanto a migration não passar pelo rollout
controlado e por teste de autorização no ambiente publicado.
