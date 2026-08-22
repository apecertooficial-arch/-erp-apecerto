-- Uma recuperacao somente pode reenviar a abordagem se a execucao original
-- realmente percorreu uma versao que continha o bloco send-approach.

begin;

create or replace function public.motor_abordagem_preflight_execucao(
  p_automacao_id bigint,
  p_lead_id bigint,
  p_telefone text,
  p_execution_id text
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $fn$
declare
  v_padrao jsonb;
  v_exec bigint;
  v_exec_lead jsonb;
  v_original_texto text;
  v_original_exec bigint;
begin
  -- A recuperacao e identificada pela propria fila e vinculada a execucao
  -- original. A versao original, e nao a versao atual, define o que podia rodar.
  if p_automacao_id in (65,66) and coalesce(p_execution_id,'')~'^[1-9][0-9]*$' then
    v_exec:=p_execution_id::bigint;

    select mf.lead
      into v_exec_lead
      from public.motor_fila mf
     where mf.id=v_exec
       and mf.automacao_id=p_automacao_id;

    v_original_texto:=coalesce(
      nullif(v_exec_lead->>'__motor_recovery_of',''),
      nullif(v_exec_lead->>'__motor_recovery_card_of','')
    );

    if v_original_texto is not null then
      if v_original_texto!~'^[1-9][0-9]*$' then
        return jsonb_build_object(
          'ok',false,'status','bloqueado',
          'motivo','recuperacao_sem_execucao_original_valida'
        );
      end if;

      v_original_exec:=v_original_texto::bigint;
      if not exists(
        select 1
          from public.motor_fila original
          join public.automacao_versoes av
            on av.id=original.automacao_versao_id
         where original.id=v_original_exec
           and original.automacao_id=p_automacao_id
           and exists(
             select 1
               from jsonb_array_elements(
                 coalesce(av.mapa#>'{automation,blocks}','[]'::jsonb)
               ) bloco
              where bloco->>'type'='send-approach'
           )
      ) then
        return jsonb_build_object(
          'ok',false,'status','bloqueado',
          'motivo','recuperacao_fora_da_versao_original',
          'original_execution_id',v_original_exec
        );
      end if;
    end if;
  end if;

  v_padrao:=public.motor_abordagem_preflight(p_lead_id,p_telefone);
  if coalesce((v_padrao->>'ok')::boolean,false) then
    return v_padrao;
  end if;
  if v_padrao->>'motivo'<>'conversa_existente' then
    return v_padrao;
  end if;

  -- Nenhuma outra automacao recebe a excecao de conversa antiga.
  if p_automacao_id not in (65,66) or coalesce(p_execution_id,'')!~'^[1-9][0-9]*$' then
    return v_padrao;
  end if;
  v_exec:=p_execution_id::bigint;

  -- A identidade precisa pertencer a esta automacao e a versao publicada.
  if not exists(
    select 1
      from public.motor_fila mf
      join public.automacoes a on a.id=mf.automacao_id
     where mf.id=v_exec and mf.automacao_id=p_automacao_id
       and mf.automacao_versao_id=a.versao_publicada_id
  ) then
    return v_padrao;
  end if;

  -- Somente a captacao fresca, materializada no Funil 2.0 apos o corte.
  if not exists(
    select 1
      from public.f2_lead f
      join public.negocios n on n.id=f.origem_negocio_id
     where n.lead_id=p_lead_id
       and public.f2_lead_automatico_elegivel(f.id)
  ) then
    return v_padrao;
  end if;

  return jsonb_build_object(
    'ok',true,'status','apto',
    'motivo','captacao_fresca_com_execucao_idempotente',
    'execution_id',v_exec
  );
end
$fn$;

revoke all on function public.motor_abordagem_preflight_execucao(bigint,bigint,text,text)
  from public,anon,authenticated;
grant execute on function public.motor_abordagem_preflight_execucao(bigint,bigint,text,text)
  to service_role;

commit;
