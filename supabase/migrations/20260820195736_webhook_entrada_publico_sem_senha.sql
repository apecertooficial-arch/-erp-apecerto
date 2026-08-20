begin;

-- A URL da automacao e o contrato do webhook. Publicar ou republicar nao pode
-- criar uma senha oculta que o Make precise conhecer.
update public.automacoes a
   set webhook_token_enforced = false
  from public.automacao_versoes av
 where av.id = a.versao_publicada_id
   and exists (
     select 1
       from jsonb_array_elements(av.mapa->'automation'->'blocks') b,
            lateral jsonb_array_elements(coalesce(b->'options'->'triggers','[]'::jsonb)) t
      where t->>'name' = 'json-http-request-trigger'
   );

create or replace function public.automacao_versao_publicada_compat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_validacao jsonb;
  v_tem_webhook boolean;
begin
  if new.criado_por is distinct from 'construtor' then
    return new;
  end if;

  v_validacao := public.automacao_validar_mapa(new.mapa);
  if coalesce((v_validacao->>'ok')::boolean,false) is not true then
    raise exception using errcode='22023',
      message='AUTOMATION_INVALID: '||(v_validacao->'erros')::text;
  end if;

  select exists (
    select 1
      from jsonb_array_elements(new.mapa->'automation'->'blocks') b,
           lateral jsonb_array_elements(coalesce(b->'options'->'triggers','[]'::jsonb)) t
     where t->>'name'='json-http-request-trigger'
  ) into v_tem_webhook;

  update public.automacoes
     set nome=coalesce(nullif(btrim(new.nome),''),nome),
         mapa=new.mapa,
         mapa_rascunho=new.mapa,
         versao_publicada_id=new.id,
         status='publicado',
         publicado_em=now(),
         atualizada_em=now(),
         webhook_token_enforced=case when v_tem_webhook then false else webhook_token_enforced end
   where id=new.automacao_id;
  return new;
end;
$function$;

revoke all on function public.automacao_versao_publicada_compat()
  from public, anon, authenticated;

create or replace function public.automacao_publicar(
  p_automacao_id bigint,
  p_nome text,
  p_mapa jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_validacao jsonb;
  v_versao integer;
  v_versao_id bigint;
  v_tem_webhook boolean;
begin
  if not public.can_manage_all() then
    raise exception using errcode='42501', message='AUTOMATION_FORBIDDEN';
  end if;

  perform 1 from public.automacoes where id=p_automacao_id for update;
  if not found then
    raise exception using errcode='P0001', message='AUTOMATION_NOT_FOUND';
  end if;

  v_validacao := public.automacao_validar_mapa(p_mapa);
  if coalesce((v_validacao->>'ok')::boolean,false) is not true then
    raise exception using errcode='22023',
      message='AUTOMATION_INVALID: '||(v_validacao->'erros')::text;
  end if;

  select coalesce(max(versao),0)+1 into v_versao
    from public.automacao_versoes where automacao_id=p_automacao_id;

  insert into public.automacao_versoes(
    automacao_id,versao,nome,mapa,observacao,criado_por
  ) values (
    p_automacao_id,v_versao,nullif(btrim(p_nome),''),p_mapa,
    'Publicacao atomica pelo construtor',auth.uid()::text
  ) returning id into v_versao_id;

  select exists (
    select 1
      from jsonb_array_elements(p_mapa->'automation'->'blocks') b,
           lateral jsonb_array_elements(coalesce(b->'options'->'triggers','[]'::jsonb)) t
     where t->>'name'='json-http-request-trigger'
  ) into v_tem_webhook;

  update public.automacoes
     set nome=coalesce(nullif(btrim(p_nome),''),nome),
         mapa=p_mapa,
         mapa_rascunho=p_mapa,
         versao_publicada_id=v_versao_id,
         status='publicado',
         publicado_em=now(),
         atualizada_em=now(),
         webhook_token_enforced=case when v_tem_webhook then false else webhook_token_enforced end
   where id=p_automacao_id;

  return jsonb_build_object(
    'ok',true,'versao',v_versao,'versao_id',v_versao_id,
    'webhook_token',null,
    'webhook_token_enforced',false
  );
end;
$function$;

revoke all on function public.automacao_publicar(bigint,text,jsonb)
  from public, anon;
grant execute on function public.automacao_publicar(bigint,text,jsonb)
  to authenticated, service_role;

comment on function public.automacao_publicar(bigint,text,jsonb) is
  'Publica snapshot atomico; webhook HTTP permanece publico, sem senha ou token.';

commit;
