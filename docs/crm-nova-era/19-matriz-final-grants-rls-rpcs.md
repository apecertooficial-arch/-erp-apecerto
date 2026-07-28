# 19 — Matriz final: GRANT × RLS × RPC (FASE 2.2)

Consolidação (correção 8). Legenda: `authn` = authenticated; `svc` = service_role; `—` = nenhum.

## 1. Tabelas — GRANT e RLS

| Objeto | GRANT (papel) | RLS | Policy(s) | Escrita |
|---|---|---|---|---|
| `public.ncrm_workflow_config` | SELECT: authn | ON | `ncrm_config_sel` USING(true) | só RPC admin (`ncrm_config_publicar`) |
| `public.ncrm_workflow_passo` | SELECT: authn | ON | `ncrm_passo_sel` USING(true) | só RPC admin |
| `public.ncrm_proposta` | SELECT: authn | ON | `ncrm_proposta_sel` USING(`pode_ver_negocio`) | só RPC |
| `public.ncrm_estado` | SELECT: authn | ON | `ncrm_estado_sel` USING(`pode_ver_negocio`) | só RPC |
| `public.ncrm_evento` | SELECT: authn | ON | `ncrm_evento_sel` USING(`pode_ver_negocio`) | só RPC + trigger imutabilidade (bloqueia U/D) |
| `anon` (todos) | — | ON | nenhuma | negado |
| tabelas legadas (`negocios`, `vendas`, …) | **inalteradas** | inalterada | inalteradas | não tocadas nesta fase |

`REVOKE ALL FROM PUBLIC, anon, authenticated` precede os GRANTs. Nenhum INSERT/UPDATE/DELETE a papel
de navegador em qualquer tabela `ncrm_*`.

## 2. Funções — schema, security, search_path, EXECUTE

| Função | Schema | Security | search_path | EXECUTE | Papel de chamada |
|---|---|---|---|---|---|
| `negocio_corretor(bigint)` | `ncrm_private` | DEFINER, STABLE | `''` | — (interna) | helpers |
| `pode_ver_negocio(bigint)` | `ncrm_private` | DEFINER, STABLE | `''` | authn | policies (SELECT) |
| `pode_operar_negocio(bigint)` | `ncrm_private` | DEFINER, STABLE | `''` | — (interna) | RPCs |
| `evento_imutavel()` | `ncrm_private` | (trigger) | `''` | REVOKE de todos | trigger |
| `config_imutavel()` | `ncrm_private` | (trigger) | `''` | REVOKE de todos | trigger |
| `aplicar_*` (tentativa/acao/saida/reativar) | `ncrm_private` | DEFINER | `''` | — (interna) | wrappers |
| `ncrm_registrar_tentativa(...)` | `public` | DEFINER | `''` | authn | navegador (corretor/gestor) |
| `ncrm_concluir_acao(...)` | `public` | DEFINER | `''` | authn | navegador |
| `ncrm_saida_visita(...)` | `public` | DEFINER | `''` | authn | navegador |
| `ncrm_saida_proposta(...)` | `public` | DEFINER | `''` | authn | navegador |
| `ncrm_proposta_transicao(...)` | `public` | DEFINER | `''` | authn | navegador |
| `ncrm_converter_proposta(...)` | `public` | DEFINER | `''` | authn (papel gestor via has_perm) | navegador |
| `ncrm_saida_descarte(...)` / `ncrm_nutricao(...)` | `public` | DEFINER | `''` | authn | navegador |
| `ncrm_reativar(...)` | `public` | DEFINER | `''` | authn | navegador |
| `ncrm_registrar_msg_automatica(...)` | `public` | DEFINER | `''` | **svc** | automação/Edge |
| `ncrm_registrar_resposta_cliente(...)` | `public` | DEFINER | `''` | **svc** | ingestão WA/webhook |
| `ncrm_sara_classificar(...)` | `public` | DEFINER | `''` | authn + claim `app_metadata.app_role='sara'` | Sara |
| `ncrm_config_publicar(...)` | `public` | DEFINER | `''` | authn + `has_perm('crm','gerenciar')` | admin |

Todas as funções públicas: `REVOKE ALL FROM PUBLIC, anon` + `GRANT EXECUTE` só ao papel da tabela
acima. Todas derivam origem/ids/permissão do banco; nenhuma confia em parâmetro de identidade do
cliente (doc 15 §3).

## 3. RPC × operação × autorização derivada

| RPC | Autorização (derivada no banco) | Idempotência | Muda estado? |
|---|---|---|---|
| registrar_tentativa / concluir_acao | `pode_operar_negocio` (posse atual + `has_perm('crm','operar')`) | `ui:<uuid>` | sim (versao+1) |
| saida_visita / saida_proposta / saida_descarte / nutricao | idem | `ui:<uuid>` | sim |
| proposta_transicao / converter_proposta | idem (+ `has_perm` gestor p/ converter) | `ui:<uuid>` | proposta (+ estado na reativação) |
| reativar | idem | `ui:<uuid>` | sim |
| registrar_msg_automatica | svc + secret interno | `auto:<execucao_id>` | sim (cria/atualiza) |
| registrar_resposta_cliente | svc + secret interno | `wa:<wa_message_id>` | sim |
| sara_classificar | claim `app_metadata`; precedência humana | `sara:<hash>` | só se base ≥ última decisão humana |
| config_publicar | `has_perm('crm','gerenciar')` | versão | config |

## 4. Superfície de ataque — verificação

- **anon**: nenhum grant de tabela, nenhuma policy, nenhum EXECUTE → zero acesso a `ncrm_*`.
- **authenticated**: SELECT sob RLS (posse atual) + EXECUTE nas RPCs operacionais. Não pode
  escrever tabela direto (sem policy de escrita, sem grant de escrita).
- **service_role**: EXECUTE só nas RPCs de automação/ingestão; **nunca usada pelo navegador**
  (padrão atual do app: server.ts usa o token do usuário).
- **Sara**: nenhum grant de tabela; só a RPC de sugestão, com claim de `app_metadata` e precedência
  humana.
- **PostgREST/Data API**: só expõe `public`; `ncrm_private` **nunca** entra em exposed schemas.
  Criar tabela não a expõe automaticamente — confirmar exposed schemas na aplicação (doc 09).

## 5. Dependências externas que a matriz assume (BLOQUEIOS — doc 20)

`current_broker_id()`, `manages_broker()`, `can_manage_all()`, `has_perm()` existem (evidência P0)
mas seu schema/security/search_path/custo/recursão **não estão confirmados no repo**. `auth.uid()`
e `auth.jwt()` pressupõem o GoTrue do Supabase. Índice `negocios(corretor_id)` pode não existir.
Todos verificados antes de aplicar (doc 20).
