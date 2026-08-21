begin;

-- Publicar uma automacao nao decide a politica de autenticacao do webhook.
-- A configuracao explicita e preservada: false continua publico e true
-- continua exigindo o token configurado.
create or replace function public.automacao_versao_publicada_compat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_validacao jsonb;
begin
  if new.criado_por is distinct from 'construtor' then
    return new;
  end if;

  v_validacao := public.automacao_validar_mapa(new.mapa);
  if coalesce((v_validacao->>'ok')::boolean,false) is not true then
    raise exception using errcode='22023',
      message='AUTOMATION_INVALID: '||(v_validacao->'erros')::text;
  end if;

  update public.automacoes
     set nome=coalesce(nullif(btrim(new.nome),''),nome),
         mapa=new.mapa,
         mapa_rascunho=new.mapa,
         versao_publicada_id=new.id,
         status='publicado',
         publicado_em=now(),
         atualizada_em=now()
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
  v_token text;
  v_token_enforced boolean;
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

  update public.automacoes
     set nome=coalesce(nullif(btrim(p_nome),''),nome),
         mapa=p_mapa,
         mapa_rascunho=p_mapa,
         versao_publicada_id=v_versao_id,
         status='publicado',
         publicado_em=now(),
         atualizada_em=now()
   where id=p_automacao_id;

  select a.webhook_token,a.webhook_token_enforced
    into v_token,v_token_enforced
    from public.automacoes a
   where a.id=p_automacao_id;

  return jsonb_build_object(
    'ok',true,'versao',v_versao,'versao_id',v_versao_id,
    'webhook_token',v_token,
    'webhook_token_enforced',v_token_enforced
  );
end;
$function$;

revoke all on function public.automacao_publicar(bigint,text,jsonb)
  from public, anon;
grant execute on function public.automacao_publicar(bigint,text,jsonb)
  to authenticated, service_role;

comment on function public.automacao_publicar(bigint,text,jsonb) is
  'Publica snapshot atomico sem alterar a configuracao de autenticacao do webhook.';

commit;
