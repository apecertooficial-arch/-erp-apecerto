-- As versoes MP4 ja foram enviadas pelo usuario em Abordagens.
-- Esta migracao apenas troca os ponteiros antigos MOV/HEVC pelos MP4 compativeis.

do $migration$
declare
  v_base constant text :=
    'https://diaegvfveqezispcthwk.supabase.co/storage/v1/object/public/chat-midia/abordagens/miruna-603/';
  v_old_01 constant text := v_base||'fullhd-hevc-01-miruna-603.mov';
  v_old_02 constant text := v_base||'fullhd-hevc-02-miruna-603.mov';
  v_new_01 constant text := v_base||'miruna-01-whatsapp-720p.mp4';
  v_new_02 constant text := v_base||'miruna-02-whatsapp-720p.mp4';
  v_count integer;
begin
  select count(*) into v_count
    from storage.objects
   where bucket_id='chat-midia'
     and name in (
       'abordagens/miruna-603/miruna-01-whatsapp-720p.mp4',
       'abordagens/miruna-603/miruna-02-whatsapp-720p.mp4'
     )
     and metadata->>'mimetype'='video/mp4'
     and coalesce((metadata->>'size')::bigint,0)>0;
  if v_count<>2 then
    raise exception 'MP4s compativeis do Miruna ausentes ou invalidos';
  end if;

  if not exists(
    select 1 from public.abordagens a
    where a.id=18 and a.grupo='Miruna 603'
      and a.mensagens#>>'{0,options,url}'=v_old_01
  ) or not exists(
    select 1 from public.abordagens a
    where a.id=19 and a.grupo='Miruna 603'
      and a.mensagens#>>'{0,options,url}'=v_old_02
  ) or not exists(
    select 1 from public.abordagens a
    where a.id=20 and a.grupo='Miruna 603'
      and a.mensagens#>>'{0,options,url}'=v_old_01
  ) then
    raise exception 'Abordagens Miruna mudaram; substituicao abortada';
  end if;

  update public.abordagens
     set mensagens=jsonb_set(
       mensagens,'{0,options,url}',
       to_jsonb(case when id=19 then v_new_02 else v_new_01 end),
       false
     )
   where id in (18,19,20) and grupo='Miruna 603';

  if not exists(
    select 1 from public.abordagens
     where id=18 and mensagens#>>'{0,options,url}'=v_new_01
  ) or not exists(
    select 1 from public.abordagens
     where id=19 and mensagens#>>'{0,options,url}'=v_new_02
  ) or not exists(
    select 1 from public.abordagens
     where id=20 and mensagens#>>'{0,options,url}'=v_new_01
  ) then
    raise exception 'Falha ao aplicar os MP4s do Miruna';
  end if;
end
$migration$;
