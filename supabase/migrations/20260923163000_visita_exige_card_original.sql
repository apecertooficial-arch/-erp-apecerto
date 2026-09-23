-- Decisão 19: uma edição só pode reutilizar o ID da visita no card ao qual
-- ela já pertence. Antes desta guarda, um ID de outra visita fazia o UPSERT
-- não alterar a visita, mas ainda avançava o card informado e criava evento.

do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.f2_salvar_visita(uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,bigint,timestamptz)'::regprocedure
  ) into v_def;

  if position('visita_incompativel' in v_def) > 0 then
    return;
  end if;

  v_new := replace(
    v_def,
    $old$  IF v_uid IS NULL OR public.f2_pode_operar_lead(p_lead_id) IS NOT TRUE THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;
  SELECT * INTO v_lead FROM public.f2_lead WHERE id=p_lead_id FOR UPDATE;$old$,
    $new$  IF v_uid IS NULL OR public.f2_pode_operar_lead(p_lead_id) IS NOT TRUE THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;

  IF p_id IS NOT NULL THEN
    PERFORM 1
      FROM public.f2_visita v
     WHERE v.id=p_id
       AND v.funil_lead_id=p_lead_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'erro','visita_incompativel');
    END IF;
  END IF;

  SELECT * INTO v_lead FROM public.f2_lead WHERE id=p_lead_id FOR UPDATE;$new$
  );

  if v_new = v_def
     or position('v.funil_lead_id=p_lead_id' in v_new) = 0
     or position('visita_incompativel' in v_new) = 0 then
    raise exception 'f2_salvar_visita sem ancora para validar card original';
  end if;

  execute v_new;
end
$migration$;

do $verify$
declare
  v_def text := pg_get_functiondef(
    'public.f2_salvar_visita(uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,bigint,timestamptz)'::regprocedure
  );
begin
  if position('v.funil_lead_id=p_lead_id' in v_def) = 0
     or position('visita_incompativel' in v_def) = 0 then
    raise exception 'guarda de visita/card não foi instalada';
  end if;
end
$verify$;
