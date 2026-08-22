-- Invariante global da biblioteca: se uma abordagem tem video e texto,
-- nenhuma mensagem de texto pode aparecer antes do video.
create or replace function public.abordagem_video_antes_texto(p_mensagens jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $function$
  select case
    when jsonb_typeof(p_mensagens) <> 'array' then false
    else not exists (
      select 1
        from jsonb_array_elements(p_mensagens) with ordinality as texto(parte, posicao)
       where texto.parte ->> 'name' = 'send-text-message'
         and exists (
           select 1
             from jsonb_array_elements(p_mensagens) with ordinality as video(parte, posicao)
            where video.parte ->> 'name' = 'send-video-message'
              and video.posicao > texto.posicao
         )
    )
  end
$function$;

do $migration$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'abordagens_video_antes_texto_chk'
       and conrelid = 'public.abordagens'::regclass
  ) then
    alter table public.abordagens
      add constraint abordagens_video_antes_texto_chk
      check (public.abordagem_video_antes_texto(mensagens))
      not valid;
  end if;
end
$migration$;

alter table public.abordagens
  validate constraint abordagens_video_antes_texto_chk;

comment on constraint abordagens_video_antes_texto_chk on public.abordagens is
  'Impede salvar texto antes de video na mesma abordagem; a ordem cadastrada continua sendo a ordem executada.';
