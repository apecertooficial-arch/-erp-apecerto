-- Alinha as duas guardas do banco ao contrato deterministico da Edge Function:
-- sem resposta do cliente, somente NOVO/TENTANDO_CONTATO pode migrar para a
-- cadencia. Cards em etapa posterior/protegida podem, contudo, preservar
-- exatamente etapa, momento e temperatura para renovar a proxima acao depois
-- de uma mensagem enviada pelo corretor.

do $migration$
declare
  v_reg regprocedure :=
    'public.f2_sara_registrar_sugestao_v2(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamp with time zone,numeric,text,text,numeric,jsonb)'::regprocedure;
  v_app regprocedure :=
    'public.f2_sara_aplicar_analise_v2(bigint,boolean,boolean,boolean,boolean,boolean)'::regprocedure;
  v_def text;
  v_novo text;
  v_old_reg constant text :=
    $old$when not v_respondeu and (p_momento_codigo<>'CADENCIA_SEM_RESPOSTA' or v_m.etapa<>'tentando_contato' or p_temperatura<>'frio') then 'revisao_humana'$old$;
  v_new_reg constant text :=
    $new$when not v_respondeu
      and (p_momento_codigo<>'CADENCIA_SEM_RESPOSTA' or v_m.etapa<>'tentando_contato' or p_temperatura<>'frio')
      and not (
        p_origem='deterministica'
        and p_momento_codigo=v_lead.momento_codigo
        and v_m.etapa=v_lead.etapa
        and p_temperatura is not distinct from v_lead.temperatura
      ) then 'revisao_humana'$new$;
  v_old_app constant text :=
    $old$if (not v_respondeu and (v_m.codigo<>'CADENCIA_SEM_RESPOSTA' or v_m.etapa<>'tentando_contato' or v_a.temperatura_sugerida<>'frio'))
     or (v_respondeu and v_m.codigo='CADENCIA_SEM_RESPOSTA') then$old$;
  v_new_app constant text :=
    $new$if (not v_respondeu
      and (v_m.codigo<>'CADENCIA_SEM_RESPOSTA' or v_m.etapa<>'tentando_contato' or v_a.temperatura_sugerida<>'frio')
      and not (
        v_a.origem='deterministica'
        and v_m.codigo=v_f.momento_codigo
        and v_m.etapa=v_f.etapa
        and v_a.temperatura_sugerida is not distinct from v_f.temperatura
      ))
     or (v_respondeu and v_m.codigo='CADENCIA_SEM_RESPOSTA') then$new$;
begin
  v_def := pg_get_functiondef(v_reg);
  if position(v_new_reg in v_def)=0 then
    if position(v_old_reg in v_def)=0 then
      raise exception 'FUNCTION_PATCH_FAILED: guarda de registro mudou';
    end if;
    v_novo := replace(v_def,v_old_reg,v_new_reg);
    if v_novo=v_def then raise exception 'FUNCTION_PATCH_FAILED: registro sem efeito'; end if;
    execute v_novo;
  end if;

  v_def := pg_get_functiondef(v_app);
  if position(v_new_app in v_def)=0 then
    if position(v_old_app in v_def)=0 then
      raise exception 'FUNCTION_PATCH_FAILED: guarda de aplicacao mudou';
    end if;
    v_novo := replace(v_def,v_old_app,v_new_app);
    if v_novo=v_def then raise exception 'FUNCTION_PATCH_FAILED: aplicacao sem efeito'; end if;
    execute v_novo;
  end if;
end
$migration$;

do $verify$
declare
  v_reg text := pg_get_functiondef(
    'public.f2_sara_registrar_sugestao_v2(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamp with time zone,numeric,text,text,numeric,jsonb)'::regprocedure
  );
  v_app text := pg_get_functiondef(
    'public.f2_sara_aplicar_analise_v2(bigint,boolean,boolean,boolean,boolean,boolean)'::regprocedure
  );
begin
  if position($needle$and v_m.etapa=v_lead.etapa
        and p_temperatura is not distinct from v_lead.temperatura$needle$ in v_reg)=0 then
    raise exception 'VERIFY_FAILED: guarda do registro ausente';
  end if;
  if position($needle$and v_m.etapa=v_f.etapa
        and v_a.temperatura_sugerida is not distinct from v_f.temperatura$needle$ in v_app)=0 then
    raise exception 'VERIFY_FAILED: guarda da aplicacao ausente';
  end if;
end
$verify$;
