-- Corrige exclusivamente o evento Adelmo que entrou durante a troca de versao.
-- A chave externa do Meta e estavel e torna o alvo inequivoco. Executa somente
-- os blocos publicados de Campos e Tags.

begin;

do $backfill_modules$
declare
  r record;
  v_item jsonb;
  v_field_id text;
  v_tag_id text;
  v_field_ops jsonb;
  v_actions jsonb;
  v_ctx jsonb;
begin
  for r in
    select id,nome,mapa from public.automacoes
     where id=65 and status='publicado'
  loop
    select b->>'id',b#>'{options,fieldOperations}'
      into v_field_id,v_field_ops
      from jsonb_array_elements(r.mapa->'automation'->'blocks') b
     where b->>'type'='field-operation' limit 1;
    select b->>'id',b#>'{options,actions}'
      into v_tag_id,v_actions
      from jsonb_array_elements(r.mapa->'automation'->'blocks') b
     where b->>'id' like 'b-tags-entrada-%' limit 1;
    if v_field_id is null or v_tag_id is null then
      raise exception 'Entrada % sem Campos/Tags publicados',r.nome;
    end if;

    for v_item in
      select distinct on (l.id)
             f.lead||jsonb_build_object('__lead_id',l.id)
        from public.automacao_eventos_entrada e
        join public.motor_fila f on f.id=e.fila_id
        join public.leads l on (
          case when f.lead->>'__lead_id' ~ '^\d+$'
               then (f.lead->>'__lead_id')::bigint=l.id else false end
          or (
            nullif(regexp_replace(coalesce(f.lead->>'telefone',''),'\D','','g'),'') is not null
            and regexp_replace(coalesce(l.telefone,''),'\D','','g')=
                regexp_replace(coalesce(f.lead->>'telefone',''),'\D','','g')
          )
          or (
            nullif(regexp_replace(coalesce(f.lead->>'telefone',''),'\D','','g'),'') is null
            and nullif(lower(btrim(f.lead->>'email')),'')=lower(btrim(l.email))
          )
        )
       where e.automacao_id=r.id
         and e.idempotency_key='meta-lead-2045245893021711'
       order by l.id,e.criado_em desc
    loop
      v_ctx:=public.motor_campos_deterministico(
        r.id,r.nome,v_field_id,v_item,v_field_ops,
        nullif(v_item->>'__lead_id','')::bigint,null
      );
      perform public.motor_acoes(
        r.id,r.nome,v_tag_id,coalesce(v_ctx->'contexto',v_item),v_actions,
        nullif(v_ctx->>'lead_id','')::bigint,null,0
      );
    end loop;
  end loop;
end
$backfill_modules$;

commit;
