-- Corrige o contrato das tres abordagens Miruna 603:
-- video MP4 compativel sempre antes do texto, sem alterar o conteudo escrito.
do $migration$
declare
  v_atuais integer;
  v_validas integer;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (select 1 from public.abordagens where id in (18,19,20)) then
    return;
  end if;

  select count(*)
    into v_atuais
    from public.abordagens a
   where a.id in (18, 19, 20)
     and a.grupo = 'Miruna 603'
     and jsonb_typeof(a.mensagens) = 'array'
     and jsonb_array_length(a.mensagens) = 2
     and a.mensagens #>> '{0,name}' = 'send-text-message'
     and a.mensagens #>> '{1,name}' = 'send-video-message'
     and a.mensagens #>> '{1,options,mimetype}' = 'video/quicktime'
     and a.mensagens #>> '{1,options,url}' like '%.mov';

  if v_atuais <> 3 then
    raise exception
      'Abordagens Miruna mudaram desde a auditoria; esperado 3 registros MOV com texto antes do video, encontrado %',
      v_atuais;
  end if;

  update public.abordagens a
     set mensagens = jsonb_build_array(
       jsonb_set(
         jsonb_set(
           jsonb_set(
             a.mensagens -> 1,
             '{options,url}',
             to_jsonb(case a.id
               when 19 then 'https://diaegvfveqezispcthwk.supabase.co/storage/v1/object/public/chat-midia/abordagens/miruna-603/miruna-02-whatsapp-720p.mp4'
               else 'https://diaegvfveqezispcthwk.supabase.co/storage/v1/object/public/chat-midia/abordagens/miruna-603/miruna-01-whatsapp-720p.mp4'
             end::text),
             false
           ),
           '{options,filename}',
           to_jsonb(case a.id
             when 19 then 'miruna-02-whatsapp-720p.mp4'
             else 'miruna-01-whatsapp-720p.mp4'
           end::text),
           false
         ),
         '{options,mimetype}',
         '"video/mp4"'::jsonb,
         false
       ),
       a.mensagens -> 0
     )
   where a.id in (18, 19, 20);

  select count(*)
    into v_validas
    from public.abordagens a
   where a.id in (18, 19, 20)
     and a.grupo = 'Miruna 603'
     and jsonb_array_length(a.mensagens) = 2
     and a.mensagens #>> '{0,name}' = 'send-video-message'
     and a.mensagens #>> '{0,options,mimetype}' = 'video/mp4'
     and a.mensagens #>> '{0,options,url}' like '%.mp4'
     and a.mensagens #>> '{1,name}' = 'send-text-message';

  if v_validas <> 3 then
    raise exception
      'Validacao final Miruna falhou; esperado 3 sequencias video MP4 -> texto, encontrado %',
      v_validas;
  end if;
end
$migration$;
