-- Recuperacao explicita para itens antigos cuja versao publicada deixou de
-- satisfazer o contrato atual do runtime. A troca de versao nunca e implicita:
-- exige gestao, ausencia total de partes de mensagem e fica auditada.

begin;

create or replace function public.central_reprocessar_fila_versao_publicada(
  p_fila_id bigint
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_fila public.motor_fila%rowtype;
  v_auto public.automacoes%rowtype;
  v_validacao jsonb;
  v_versao_anterior bigint;
begin
  if not public.can_manage_all() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_fila
    from public.motor_fila
   where id=p_fila_id
   for update;

  if not found then
    return jsonb_build_object('ok',false,'motivo','fila_nao_encontrada');
  end if;
  if v_fila.status<>'erro' then
    return jsonb_build_object('ok',false,'motivo','fila_nao_esta_em_erro');
  end if;
  if exists(
    select 1 from public.motor_mensagem_partes
     where execution_id=p_fila_id::text
  ) then
    return jsonb_build_object('ok',false,'motivo','execucao_ja_possui_parte_de_mensagem');
  end if;

  select * into v_auto
    from public.automacoes
   where id=v_fila.automacao_id
   for update;

  if not found
     or not coalesce(v_auto.ativa,false)
     or v_auto.status<>'publicado'
     or v_auto.versao_publicada_id is null then
    return jsonb_build_object('ok',false,'motivo','automacao_publicada_indisponivel');
  end if;

  if not exists(
    select 1
      from public.automacao_versoes av,
           lateral jsonb_array_elements(
             coalesce(av.mapa#>'{automation,blocks}','[]'::jsonb)
           ) bloco
     where av.id=v_fila.automacao_versao_id
       and av.automacao_id=v_fila.automacao_id
       and bloco->>'type'='send-approach'
  ) then
    return jsonb_build_object('ok',false,'motivo','versao_original_sem_abordagem');
  end if;

  v_validacao:=public.automacao_validar_mapa(v_auto.mapa);
  if coalesce((v_validacao->>'ok')::boolean,false) is not true then
    return jsonb_build_object(
      'ok',false,'motivo','versao_publicada_invalida','erros',v_validacao->'erros'
    );
  end if;

  v_versao_anterior:=v_fila.automacao_versao_id;
  update public.motor_fila
     set automacao_versao_id=v_auto.versao_publicada_id,
         lead=(coalesce(lead,'{}'::jsonb)-'__automacao_versao_id')
              ||jsonb_build_object('__automacao_versao_id',v_auto.versao_publicada_id),
         status='pendente',
         due_at=now(),
         processado_em=null,
         tentativas=0,
         ultimo_erro='REPROCESSAMENTO_EXPLICITO_NA_VERSAO_PUBLICADA'
   where id=p_fila_id;

  insert into public.motor_execucoes(
    automacao_id,automacao_nome,bloco_id,evento,status,
    lead_nome,lead_telefone,detalhe
  ) values(
    v_fila.automacao_id,v_auto.nome,v_fila.bloco_id,'reprocessamento','alerta',
    coalesce(v_fila.lead->>'nome',v_fila.lead->>'name','Lead sem nome'),
    coalesce(v_fila.lead->>'telefone',v_fila.lead->>'phone'),
    'Item #'||p_fila_id||' migrou explicitamente da versao '
      ||v_versao_anterior||' para a versao publicada '
      ||v_auto.versao_publicada_id||'; nenhuma parte de mensagem existia.'
  );

  return jsonb_build_object(
    'ok',true,
    'fila_id',p_fila_id,
    'status','pendente',
    'versao_anterior_id',v_versao_anterior,
    'versao_publicada_id',v_auto.versao_publicada_id
  );
end
$fn$;

revoke all on function public.central_reprocessar_fila_versao_publicada(bigint)
  from public,anon;
grant execute on function public.central_reprocessar_fila_versao_publicada(bigint)
  to authenticated,service_role;

commit;
