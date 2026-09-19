# Baseline de segurança e desempenho do Supabase

Leitura somente leitura em 2026-09-19 no projeto `diaegvfveqezispcthwk`.
Nenhum grant, policy, configuração Auth ou objeto foi alterado.

## Resumo dos advisors oficiais

| Advisor | Nível | Contagem | Interpretação inicial |
|---|---:|---:|---|
| `anon_security_definer_function_executable` | WARN | 47 | P0: RPCs executam como owner `postgres` e estão alcançáveis sem login |
| `authenticated_security_definer_function_executable` | WARN | 276 | exige matriz função → papel → escopo; não revogar em massa sem provar chamadores |
| `function_search_path_mutable` | WARN | 1 | `public.hoje_operacao` precisa de `search_path` fixo |
| `extension_in_public` | WARN | 2 | `pg_net` e `unaccent` exigem plano de realocação compatível |
| `auth_leaked_password_protection` | WARN | 1 | proteção de senhas vazadas não está habilitada; mudança de Auth exige gate próprio |
| `rls_enabled_no_policy` | INFO | 92 | muitas tabelas são fail-closed de propósito; cada uma precisa ser classificada por owner/caller |
| `auth_rls_initplan` | WARN | 37 | policies repetem funções Auth por linha e precisam otimização após prova funcional |
| `multiple_permissive_policies` | WARN | 71 | risco de políticas redundantes/mais amplas; revisar sem quebrar acesso legítimo |
| `unindexed_foreign_keys` | INFO | 4 | índices candidatos em integrações, Sara, proprietários e quarentena |
| `no_primary_key` | INFO | 17 | predominam tabelas de arquivo/backup; classificar retenção antes de alterar |
| `unused_index` | INFO | 234 | não remover por estatística pontual; requer janela representativa e plano de rollback |

Referências oficiais:

- [Advisor 0028 — anon executando SECURITY DEFINER](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable)
- [Advisor 0029 — authenticated executando SECURITY DEFINER](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable)

## P0 — superfície anônima privilegiada

As 47 funções são `SECURITY DEFINER`, pertencem a `postgres` e podem atravessar
RLS. O catálogo foi dividido em:

- 42 operações destinadas a usuário autenticado, ainda dependentes de revisão
  individual da autorização server-side;
- 2 operações service-only: webhook DataCrazy e função de trigger;
- 3 exceções públicas legadas: agenda pública e leitura/escrita da ficha de
  financiamento.

A Edge Function DataCrazy implantada usa `SUPABASE_SERVICE_ROLE_KEY`; portanto
a RPC de ingestão não precisa de `anon` nem `authenticated`.

As três exceções públicas não estão aprovadas como contrato final:

- tokens são comparados com valores armazenados em texto;
- não há expiração/revogação por link comprovada;
- não há rate limit persistente no contrato atual;
- a ficha contém dados pessoais e financeiros;
- a agenda compartilhada expõe dados operacionais enquanto o token permanecer
  válido.

O draft `P0_ANON_SECURITY_DEFINER_DRAFT.sql` fecha a superfície anônima não
intencional e mantém temporariamente as três exceções para não quebrar links já
distribuídos. Ele não foi aplicado e não torna as exceções “seguras”; a próxima
fatia precisa substituir token em texto por hash, expiração, revogação, rate
limit, auditoria sanitizada e respostas minimizadas.

### Perfil sanitizado dos links públicos

Leitura agregada, sem conteúdo de linhas:

- `agenda_share`: 1 registro, 1 token presente com 64 caracteres, última
  rotação em 2026-07-22;
- `financiamento_fichas`: 3 registros, 1 token presente com 48 caracteres; 1
  ficha enviada e 2 rascunhos;
- agenda não possui validade/revogação no schema atual;
- ficha possui token em texto e o GET legado devolve nome, telefone e e-mail;
- o POST legado pode sobrescrever a ficha repetidas vezes usando o mesmo link.

O draft `P0_PUBLIC_LINKS_HARDENING_DRAFT.sql` prepara uma Fase A aditiva:

- hash SHA-256 de tokens aleatórios de alta entropia, validade e revogação;
- RPCs V2 executáveis apenas por `service_role`, invocadas pelo runtime servidor;
- limite persistente e concorrente por cliente sanitizado e por token;
- auditoria sem IP, token ou PII em texto;
- ficha de uso único, com bloqueio de sobrescrita e sem devolução de PII;
- agenda com cliente/local ocultos por padrão;
- canário desligado por `PUBLIC_LINK_HARDENING_ENABLED=false`;
- Fase B separada para revogar as três RPCs legadas e limpar texto somente após
  canário e rollback comprovados.

O código local já deixa de repetir o token em query/body entre navegador e API,
remove detalhes SQL das respostas e marca as respostas como `no-store`. O modo
V2 permanece desligado; ativá-lo exige aplicar a Fase A em ambiente isolado e
configurar `PUBLIC_LINK_RATE_LIMIT_PEPPER` sem expor o valor.

Também foi removido do `SaraWidget` o JWT público legado gravado diretamente no
fonte. O widget agora usa o cliente Supabase canônico e a configuração de
ambiente, evitando uma segunda autoridade de URL/chave e permitindo rotação sem
alterar código. Nenhuma chave privilegiada foi introduzida no navegador.

## P1 — `hoje_operacao` com namespace mutável

A única função apontada é `public.hoje_operacao()`: SQL, `STABLE`, `SECURITY
INVOKER`, sem leitura de tabelas e com grants intencionais para os três papéis.
O draft `P1_HOJE_OPERACAO_SEARCH_PATH_DRAFT.sql` altera somente a configuração
para `search_path=pg_catalog`, inclui assert e rollback específico. Não foi
aplicado porque não existe branch Supabase isolada disponível.

## Decisões

1. não revogar todas as 276 funções de `authenticated` em massa;
2. provar chamadores e autorização de cada RPC por domínio;
3. remover grants de `PUBLIC`, porque revogar apenas `anon` não neutraliza o
   grant implícito do Postgres;
4. testar positivo e negativo por papel em ambiente isolado;
5. somente depois aplicar uma migration nova, sem reescrever histórico.

## Evidência local

- draft: `docs/erp-reestruturacao/P0_ANON_SECURITY_DEFINER_DRAFT.sql`;
- teste: `tests/p0-anon-security-definer-draft.test.mjs`;
- hardening público: `docs/erp-reestruturacao/P0_PUBLIC_LINKS_HARDENING_DRAFT.sql`;
- teste: `tests/p0-public-links-hardening.test.mjs`;
- o gate está importado por `tests/supabase-seguranca.test.mjs`;
- 27/27 testes direcionados passaram (a execução combinada registra os testes
  dos drafts uma vez pelo arquivo direto e outra pela importação);
- gate frontend 494/494, typecheck e build aprovados; lint sem erros e com um
  aviso preexistente de otimização da imagem da agenda.
