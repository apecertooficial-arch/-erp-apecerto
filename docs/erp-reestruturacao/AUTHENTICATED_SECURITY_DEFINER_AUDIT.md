# Auditoria — RPCs `SECURITY DEFINER` executáveis por `authenticated`

Leitura somente leitura em 2026-09-19 no Supabase canônico
`diaegvfveqezispcthwk`. Nenhuma função, grant ou dado foi alterado.

## Resultado

| Métrica | Quantidade |
|---|---:|
| `SECURITY DEFINER` executáveis por `authenticated` | 276 |
| aparência de escrita pelo corpo SQL/PLpgSQL | 148 |
| aparência somente leitura | 128 |
| sem marcador estático de identidade | 81 |
| escrita sem marcador estático de identidade | 32 |
| leitura sem marcador estático de identidade | 49 |

O marcador estático é apenas triagem. Encontrar `auth.uid()` não prova
autorização. `transferir_negocio`, por exemplo, verifica apenas que há uma
sessão e depois permite alterar qualquer negócio e lead. Portanto as 195
funções com algum marcador ainda exigem revisão semântica.

## P0 comprovado — mutações humanas sem escopo do objeto

| RPC | Problema real | Contrato necessário |
|---|---|---|
| `transferir_negocio(bigint,bigint)` | qualquer sessão pode trocar dono de qualquer negócio/lead | somente gestor ou destinatário de transferência pendente para si próprio |
| `transferir_com_aceite(bigint,bigint)` | qualquer sessão pode oferecer qualquer negócio a qualquer corretor | corretor dono ou gestor; destino ativo; auditoria |
| `aceitar_transferencia(bigint)` | não confirma que o usuário é o destinatário | destinatário pendente ou gestor; lock e aceite atômico |
| `solicitar_descarte(bigint,text,text)` | qualquer sessão pode pedir descarte de negócio alheio | dono ou gestor; motivo estruturado; observação obrigatória em “outro” |
| `aprovar_descarte(bigint)` | qualquer sessão pode aprovar descarte | somente gestão; apenas solicitação pendente; auditoria |
| `redistribuir_lead(bigint)` | qualquer sessão pode redistribuir negócio/lead | somente gestão ou serviço; idempotência e auditoria |
| `registrar_acao(bigint,...)` | sessão pode registrar ação e criar tarefa em negócio alheio | dono ou gestor; validação do tipo; trilha do ator |
| `registrar_observacao(bigint,text)` | usuário ativo pode inserir observação em qualquer lead | dono da carteira ou gestor; limite de tamanho; auditoria |
| `funil_mover(uuid,...)` | altera card, negócio e lead sem conferir ator | service-only; movimentos humanos usam comando canônico escopado |
| `ia_salvar_avaliacao(bigint,bigint,...)` | qualquer sessão injeta avaliação arbitrária | service-only ou endpoint autenticado que derive os IDs do contexto |

`mover_negocio(bigint,bigint,text)` foi confrontada como controle: ela confere
se o corretor é dono do negócio, salvo gestão/service role. Isso demonstra que
o modelo de autorização necessário já existe, mas não foi aplicado de forma
consistente às RPCs paralelas.

## Escritas sem guarda: classificação inicial

### Operação humana — exige guarda de objeto/papel

- `aceitar_transferencia(bigint)`;
- `aprovar_descarte(bigint)`;
- `redistribuir_lead(bigint)`;
- `solicitar_descarte(bigint,text,text)`;
- `transferir_com_aceite(bigint,bigint)`.

### Serviço, worker, cron ou trigger — candidato a `service_role` somente

- `dapi_sync_instancias()`;
- `dc_registrar_movimentacao(jsonb,text)`;
- `funil_aplicar_sara(boolean,integer)`;
- `funil_cascata_tick(boolean)`;
- `funil_mover(uuid,text,bigint,text,text,jsonb,integer,boolean)`;
- `ia_salvar_avaliacao(bigint,bigint,numeric,jsonb,jsonb)`;
- `lead_vincular_wa(bigint)`;
- `ncrm_distribuir_lead(bigint)`;
- `ncrm_guardiao_entrada()`;
- `ncrm_sara_classificar(bigint,integer,jsonb,text)`;
- `perf_log(bigint,text,bigint,bigint,numeric,numeric,text,timestamptz,jsonb)`;
- `pj_alerta_atrasadas()`;
- `presenca_avisar_pendentes()`;
- `presenca_derrubar_expirados()`;
- `sla_msg_cache_refresh()`;
- `wa_backfill_funil2(integer)`;
- `wa_backfill_proximos(integer)`;
- `wa_conhecido_gravar(bigint,jsonb)`;
- `wa_espelhar_historico(text,text,jsonb)`;
- `wa_move_respondeu(bigint)`;
- `wa_registrar_saida(text,text,bigint,text,text,text,timestamptz)`.

`social_audit_row()` e `social_mark_product_changed()` são funções de trigger;
o grant de execução direta a `authenticated` é desnecessário, embora os
triggers devam continuar funcionando como owner.

### Exceção pública legada já coberta por outra fatia

- `ficha_publica_obter(text)`;
- `ficha_publica_enviar(text,jsonb)`.

O cutover está desenhado em `P0_PUBLIC_LINKS_HARDENING_DRAFT.sql`.

### Requer análise adicional antes de alterar

- `agente_pedir(text,text)`;
- `escritorio_ip_autoaprender()`;
- `ncrm_guardiao_entrada()` e `ncrm_distribuir_lead(bigint)` ainda aparecem em
  resgate/entrada legada documentada;
- `pj_alerta_atrasadas()` e rotinas de presença possuem cohost/cron e precisam
  preservar o chamador operacional ao retirar `authenticated`.

## Chamadores comprovados

- o Chat ao Vivo chamava `transferir_negocio` diretamente. A rota local agora
  confirma o negócio pelo RLS, valida o destino, usa transferência direta para
  gestão e oferta pendente para corretor; o banco principal ainda mantém a RPC
  antiga até o draft atravessar ensaio isolado;
- `funil_mover` é chamada por `funil_aplicar_sara`, `funil_cascata_tick` e
  `motor_momento_lead`; não há chamador direto no aplicativo local;
- `wa_conhecido_gravar` é chamada pela Edge Function
  `wa-agenda-do-corretor` usando cliente administrativo;
- `presenca_derrubar_expirados`, `presenca_avisar_pendentes` e
  `sla_msg_cache_refresh` são chamadas pelo dispatcher/cohost;
- `social_audit_row` e `social_mark_product_changed` estão associadas a
  triggers de Studio;
- não foi encontrado chamador local ou em função/cron para as cinco RPCs
  humanas inseguras. Isso não prova ausência de cliente externo ou versão
  antiga; antes do cutover é necessário observar logs ou fazer canário.

## Ordem de correção

1. criar guardas canônicas `negócio → corretor atual/gestor` e
   `lead → corretor atual/gestor` com testes por papel;
2. reconstruir transferência com oferta, aceite e auditoria atômicos;
3. estruturar motivos e aprovação de descarte;
4. mover rotinas internas para `service_role` e retirar grants de `PUBLIC` e
   `authenticated` por função;
5. validar chamadores internos, aplicativo e navegador com corretor/gestor;
6. executar canário isolado; somente depois gerar migration produtiva.

Não usar `revoke execute on all functions`: o lote misturaria funções humanas,
serviço, triggers e contratos públicos e poderia interromper a operação.

## Correção local preparada

`P0_CRM_OWNERSHIP_GUARDS_DRAFT.sql` preserva as assinaturas das sete mutações
humanas, adiciona lock, ownership/hierarquia, transições por pipeline,
idempotência de estado, deduplicação curta e auditoria. `redistribuir_lead`
fica service-only porque a roleta não recebe chave idempotente; gestão usa o
destino explícito. O draft não está em `supabase/migrations` e não foi aplicado.

Gate local: 7/7 contratos direcionados, 494/494 testes frontend, typecheck,
lint e build aprovados. Ensaio Postgres por papel e E2E autenticado permanecem
pendentes por inexistência de branch Supabase isolada.
