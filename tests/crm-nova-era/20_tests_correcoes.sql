-- Testes das correções (fail-closed, imutabilidade, Sara suggestion-only, message_id, novas RPCs,
-- cadência, unique_violation). Rodam após core + concorrência, na mesma base.
\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages TO notice;
\set A '''cccccccc-0000-0000-0000-000000000001'''
\set B '''dddddddd-0000-0000-0000-000000000001'''
\set GER '''bbbbbbbb-0000-0000-0000-000000000001'''
\set FF '''ffffffff-0000-0000-0000-000000000001'''

-- Estados iniciais p/ os negócios de correção
RESET ROLE; SELECT set_config('request.jwt.claims','{}',false); SET ROLE service_role;
SELECT public.ncrm_registrar_msg_automatica(800,'a800',now());
SELECT public.ncrm_registrar_msg_automatica(810,'a810',now());
SELECT public.ncrm_registrar_msg_automatica(820,'a820',now());
SELECT public.ncrm_registrar_msg_automatica(830,'a830',now());
SELECT public.ncrm_registrar_msg_automatica(840,'a840',now());
SELECT public.ncrm_registrar_msg_automatica(841,'a841',now());
SELECT public.ncrm_registrar_msg_automatica(842,'a842',now());
SELECT public.ncrm_registrar_msg_automatica(843,'a843',now());
SELECT public.ncrm_registrar_msg_automatica(844,'a844',now());
RESET ROLE;

-- ===== item 4: message_id vazio/espacos/NULL rejeitado =====
SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false);
SELECT public.test_assert((public.ncrm_registrar_msg_automatica(800,'   ',now()) ->> 'erro')='message_id_obrigatorio','C-msgid: espaços rejeitado');
SELECT public.test_assert((public.ncrm_registrar_msg_automatica(800,NULL,now()) ->> 'erro')='message_id_obrigatorio','C-msgid: NULL rejeitado');
SELECT public.test_assert((public.ncrm_registrar_resposta_cliente(810,'  ',now()) ->> 'erro')='message_id_obrigatorio','C-msgid: resposta_cliente espaços rejeitado');
RESET ROLE;

-- ===== item 6: mensagem automática NÃO conta como tentativa (843) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT tentativas_feitas FROM public.ncrm_estado WHERE negocio_id=843)=0,'C-cadencia: msg automática não conta tentativa (tentativas_feitas=0)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE negocio_id=843 AND tipo='mensagem_automatica')=1
                          AND (SELECT count(*) FROM public.ncrm_evento WHERE negocio_id=843 AND tipo='tentativa')=0,'C-cadencia: só evento mensagem_automatica, 0 tentativa');
RESET ROLE;

-- ===== item 6: limite máximo de tentativas (800) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=800 \gset
SELECT public.ncrm_registrar_tentativa(800,:v,'whatsapp','nao_respondeu','1','tentativa_cadencia','t', now(),'ui:m1');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=800 \gset
SELECT public.ncrm_registrar_tentativa(800,:v,'whatsapp','nao_respondeu','2','tentativa_cadencia','t', now(),'ui:m2');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=800 \gset
SELECT public.ncrm_registrar_tentativa(800,:v,'whatsapp','nao_respondeu','3','tentativa_cadencia','t', now(),'ui:m3');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=800 \gset
SELECT public.ncrm_registrar_tentativa(800,:v,'whatsapp','nao_respondeu','4','tentativa_cadencia','t', now(),'ui:m4');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=800 \gset
SELECT public.test_assert((SELECT tentativas_feitas FROM public.ncrm_estado WHERE negocio_id=800)=4,'C-cadencia: 4 tentativas registradas');
SELECT public.test_assert((public.ncrm_registrar_tentativa(800,:v,'whatsapp','nao_respondeu','5','tentativa_cadencia','t', now(),'ui:m5') ->> 'erro')='cadencia_esgotada','C-cadencia: 5ª tentativa acima do limite negada');
RESET ROLE;

-- ===== item 5A + item 6: resposta do cliente encerra a cadência (810) =====
SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false);
SELECT public.test_assert((public.ncrm_registrar_resposta_cliente(810,'wa810',now()) ->> 'ok')::boolean,'C-resposta: registrar_resposta_cliente ok');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT respondeu AND NOT aguardando_automacao AND resposta_pendente AND proxima_acao_tipo='entender_necessidade' FROM public.ncrm_estado WHERE negocio_id=810),'C-resposta: estado marca respondeu/pendente/próxima ação padrão');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=810 \gset
SELECT public.test_assert((public.ncrm_registrar_tentativa(810,:v,'whatsapp','nao_respondeu','x','tentativa_cadencia','t', now(),'ui:pos') ->> 'erro')='cadencia_encerrada','C-resposta: tentativa de prospecção após resposta negada');
RESET ROLE;

-- ===== item 5B: concluir_acao exige próxima ação (820) =====
SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false);
SELECT public.ncrm_registrar_resposta_cliente(820,'wa820',now());
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=820 \gset
SELECT public.test_assert((public.ncrm_concluir_acao(820,:v,'opcoes_enviadas','obs',NULL,NULL,NULL,'ui:ca0') ->> 'erro')='proxima_acao_obrigatoria','C-concluir: sem próxima ação rejeitado');
SELECT public.test_assert((public.ncrm_concluir_acao(820,:v,'opcoes_enviadas','obs','ligar_retorno','Ligar', now()+interval '1 day','ui:ca1') ->> 'ok')::boolean,'C-concluir: com próxima ação ok');
SELECT public.test_assert((SELECT NOT resposta_pendente AND proxima_acao_tipo='ligar_retorno' FROM public.ncrm_estado WHERE negocio_id=820),'C-concluir: resposta_pendente=false e próxima ação atualizada');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE negocio_id=820 AND tipo='acao_comercial')=1,'C-concluir: evento acao_comercial gravado');
RESET ROLE;

-- ===== item 5C: descarte (830) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=830 \gset
SELECT public.test_assert((public.ncrm_saida_descarte(830,:v,'outro',NULL,'ui:d0') ->> 'erro')='detalhe_obrigatorio','C-descarte: outro sem detalhe rejeitado');
SELECT public.test_assert((public.ncrm_saida_descarte(830,:v,'sem_interesse',NULL,'ui:d1') ->> 'ok')::boolean,'C-descarte: motivo estruturado ok');
SELECT public.test_assert((SELECT saida='descartado' AND descarte_motivo='sem_interesse' AND proxima_acao_tipo IS NULL FROM public.ncrm_estado WHERE negocio_id=830),'C-descarte: estado descartado sem próxima ação');
RESET ROLE;

-- ===== item 5D+5E: nutrição e reativação comum (840) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=840 \gset
SELECT public.test_assert((public.ncrm_saida_nutricao(840,:v,'compra futura','ui:n1') ->> 'ok')::boolean,'C-nutricao: saída nutrição ok');
SELECT public.test_assert((SELECT saida='nutricao' AND proxima_acao_tipo IS NULL FROM public.ncrm_estado WHERE negocio_id=840),'C-nutricao: estado nutricao sem próxima ação');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=840 \gset
SELECT public.test_assert((public.ncrm_reativar(840,:v,'retomou','tentando_contato',NULL,NULL,NULL,'ui:r0') ->> 'erro')='proxima_acao_obrigatoria','C-reativar: sem próxima ação rejeitado');
SELECT public.test_assert((public.ncrm_reativar(840,:v,'retomou','tentando_contato','tentativa_cadencia','1ª', now()+interval '1 day','ui:r1') ->> 'ok')::boolean,'C-reativar: reativação comum ok');
SELECT public.test_assert((SELECT saida IS NULL AND proxima_acao_tipo IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=840),'C-reativar: saída limpa e próxima ação definida');
RESET ROLE;

-- ===== item 3: Sara suggestion-only (841) =====
-- 3a) base atual: aplicado=false, motivo aguardando_aprovacao_humana, estado inalterado
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated','app_metadata', json_build_object('app_role','sara'))::text, false); SET ROLE authenticated;
SELECT versao AS v841 FROM public.ncrm_estado WHERE negocio_id=841 \gset
SELECT public.test_assert((public.ncrm_sara_classificar(841,:v841,'{"temperatura":"quente"}'::jsonb,'ui:sara1') ->> 'aplicado')::boolean = false,'C-sara: nunca aplica (aplicado=false)');
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=841)=:v841,'C-sara: versão do estado inalterada');
SELECT public.test_assert((SELECT (payload->>'aplicado')::boolean=false AND payload->>'motivo'='aguardando_aprovacao_humana' FROM public.ncrm_evento WHERE idempotency_key='ui:sara1'),'C-sara: evento aplicado=false / aguardando_aprovacao_humana');
RESET ROLE;

-- ===== item 1: autorização fail-closed (NULL) =====
-- (b) current_broker_id NULL (usuário sem corretor) -> negado
SELECT set_config('request.jwt.claims', json_build_object('sub',:FF,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_registrar_tentativa(842,1,'whatsapp','nao_respondeu','x','tentativa_cadencia','t', now(),'ui:ff') ->> 'erro')='sem_permissao','C-authz: current_broker_id NULL negado');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado)=0,'C-authz: usuário sem corretor não vê nada');
RESET ROLE;
-- (d) usuário inexistente -> negado
SELECT set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_registrar_tentativa(842,1,'whatsapp','nao_respondeu','x','tentativa_cadencia','t', now(),'ui:nx') ->> 'erro')='sem_permissao','C-authz: usuário inexistente negado');
RESET ROLE;
-- (e) token sem sub -> nao_autenticado
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_registrar_tentativa(842,1,'whatsapp','nao_respondeu','x','tentativa_cadencia','t', now(),'ui:ns') ->> 'erro')='nao_autenticado','C-authz: token sem sub negado');
RESET ROLE;
-- (a) has_perm NULL -> negado (swap temporário)
CREATE OR REPLACE FUNCTION public.has_perm(p_modulo text, p_acao text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT NULL::boolean $$;
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_registrar_tentativa(842,1,'whatsapp','nao_respondeu','x','tentativa_cadencia','t', now(),'ui:hp') ->> 'erro')='sem_permissao','C-authz: has_perm NULL negado (fail-closed)');
RESET ROLE;
CREATE OR REPLACE FUNCTION public.has_perm(p_modulo text, p_acao text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_role text; v_uid uuid := (select auth.uid()); v_over jsonb; v_prof jsonb;
begin
  if v_uid is null then return false; end if;
  select u.role::text, u.permissoes into v_role, v_over from usuarios u where u.id = v_uid and u.ativo;
  if v_role is null then return false; end if;
  if v_role in ('admin','executivo') then return true; end if;
  if v_over is not null and v_over ? p_modulo then return (v_over -> p_modulo) ? p_acao; end if;
  select p.permissoes into v_prof from perfis p where p.id = v_role;
  if v_prof is not null and v_prof ? p_modulo then return (v_prof -> p_modulo) ? p_acao; end if;
  return false;
end $$;
-- (c) manages_broker NULL -> gestor não vê (swap temporário)
CREATE OR REPLACE FUNCTION public.manages_broker(p_corretor_id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT NULL::boolean $$;
SELECT set_config('request.jwt.claims', json_build_object('sub',:GER,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=842)=0,'C-authz: manages_broker NULL -> gestor não vê (fail-closed)');
RESET ROLE;
CREATE OR REPLACE FUNCTION public.manages_broker(p_corretor_id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  with me as (select u.id, u.role::text as role from usuarios u where u.id = (select auth.uid()) and u.ativo)
  select exists (
    select 1 from me cross join lateral (
      with recursive tree as (
        select id from usuarios where superior_id = me.id
        union all select u.id from usuarios u join tree t on u.superior_id = t.id
      ) select id from tree
    ) sub join corretores c on c.usuario_id = sub.id
    where me.role in ('gerente','diretor') and c.id = p_corretor_id);
$$;

-- ===== item 7: unique_violation NÃO relacionada à idempotência é relançada (842) =====
-- pré-insere uma proposta com idempotency_key que colidirá com p_idem||':prop'
INSERT INTO public.ncrm_proposta (negocio_id, lead_id, valor, data_proposta, status, motivo_encerramento, encerrada_em, idempotency_key, criada_por)
VALUES (845,19,1,now(),'recusada','x',now(),'DUP:prop','cccccccc-0000-0000-0000-000000000001');
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v842 FROM public.ncrm_estado WHERE negocio_id=842 \gset
SELECT public.test_expect_error(
  'SELECT public.ncrm_saida_proposta(842,'||:v842||',NULL,NULL,100,now(),''x'',''DUP'')','23505',
  'C-unique: colisão não-idempotente é RELANÇADA (não engolida como ja_processado)');
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key='DUP'),'C-unique: nenhum evento DUP criado (rollback atômico)');
RESET ROLE;

-- ===== item 2: imutabilidade de config/passo publicados (por último; encerra v1 no fim) =====
SELECT id AS cfg1 FROM public.ncrm_workflow_config WHERE versao=1 \gset
SELECT public.test_expect_error('INSERT INTO public.ncrm_workflow_passo(config_id,ordem,canal_sugerido,intervalo_min,rotulo) VALUES ('||:cfg1||',9,''ligacao'',1,''x'')','passos_imutaveis','C-config: INSERT passo em config publicada negado');
SELECT public.test_expect_error('UPDATE public.ncrm_workflow_passo SET intervalo_min=5 WHERE config_id='||:cfg1||' AND ordem=1','passos_imutaveis','C-config: UPDATE passo em config publicada negado');
SELECT public.test_expect_error('DELETE FROM public.ncrm_workflow_passo WHERE config_id='||:cfg1||' AND ordem=4','passos_imutaveis','C-config: DELETE passo em config publicada negado');
SELECT public.test_expect_error('UPDATE public.ncrm_workflow_config SET status=''rascunho'' WHERE id='||:cfg1,'config_transicao_invalida','C-config: publicada->rascunho negado');
SELECT public.test_expect_error('UPDATE public.ncrm_workflow_config SET max_tentativas=9 WHERE id='||:cfg1,'config_publicada_regras_imutaveis','C-config: alterar regra de config publicada negado');
-- publicada->encerrada permitido; depois encerrada é imutável
UPDATE public.ncrm_workflow_config SET status='encerrada', vigencia_fim=now() WHERE id=:cfg1;
SELECT public.test_assert((SELECT status FROM public.ncrm_workflow_config WHERE id=:cfg1)='encerrada','C-config: publicada->encerrada permitido');
SELECT public.test_expect_error('UPDATE public.ncrm_workflow_config SET status=''publicada'' WHERE id='||:cfg1,'config_encerrada_imutavel','C-config: encerrada->publicada negado');

SELECT '==== TODOS OS TESTES DE CORREÇÃO PASSARAM ====' AS resultado;
