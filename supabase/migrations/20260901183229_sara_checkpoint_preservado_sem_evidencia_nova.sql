-- Uma mensagem enviada pelo corretor conclui a acao corrente e deve renovar o
-- checkpoint mesmo quando o card esta em etapa protegida. Nessa situacao a
-- classificacao deterministica nao muda etapa, momento nem temperatura; logo,
-- exigir uma nova fala textual do cliente para provar uma temperatura que sera
-- apenas preservada deixa o card vencido sem aumentar a seguranca.
--
-- A excecao abaixo e estreita: so vale para origem deterministica, mesmo
-- momento e mesma temperatura. IA, transicao de momento ou mudanca de
-- temperatura continuam exigindo evidencia do cliente.

do $migration$
declare
  v_oid regprocedure :=
    'public.f2_sara_registrar_sugestao_v2(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamp with time zone,numeric,text,text,numeric,jsonb)'::regprocedure;
  v_def text := pg_get_functiondef(v_oid);
  v_novo text;
  v_antigo constant text :=
    $old$when v_respondeu and jsonb_array_length(coalesce(p_temperatura_evidencias,'[]'::jsonb))=0 then 'revisao_humana'$old$;
  v_substituto constant text :=
    $new$when v_respondeu
      and jsonb_array_length(coalesce(p_temperatura_evidencias,'[]'::jsonb))=0
      and not (
        p_origem='deterministica'
        and p_momento_codigo=v_lead.momento_codigo
        and p_temperatura is not distinct from v_lead.temperatura
      ) then 'revisao_humana'$new$;
begin
  if position(v_substituto in v_def)>0 then
    return;
  end if;
  if position(v_antigo in v_def)=0 then
    raise exception 'FUNCTION_PATCH_FAILED: guarda de temperatura mudou';
  end if;
  v_novo := replace(v_def,v_antigo,v_substituto);
  if v_novo=v_def then
    raise exception 'FUNCTION_PATCH_FAILED: substituicao sem efeito';
  end if;
  execute v_novo;
end
$migration$;

comment on function public.f2_sara_registrar_sugestao_v2(
  uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz,
  numeric,text,text,numeric,jsonb
) is 'Registra analise da Sara; preservacao deterministica do mesmo estado pode renovar checkpoint sem fabricar nova evidencia de temperatura.';

do $verify$
declare
  v_def text := pg_get_functiondef(
    'public.f2_sara_registrar_sugestao_v2(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamp with time zone,numeric,text,text,numeric,jsonb)'::regprocedure
  );
begin
  if position($needle$p_origem='deterministica'
        and p_momento_codigo=v_lead.momento_codigo
        and p_temperatura is not distinct from v_lead.temperatura$needle$ in v_def)=0 then
    raise exception 'VERIFY_FAILED: preservacao deterministica nao instalada';
  end if;
end
$verify$;
