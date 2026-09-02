-- pgsql-http controla o timeout por CURLOPT_TIMEOUT_MS.
-- A fila amplia a janela somente durante videos e restaura cinco segundos ao final.

CREATE OR REPLACE FUNCTION public.processar_agendadas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r record; v_body text; v_resp extensions.http_response; n int:=0; v_token text;
begin
  select decrypted_secret into v_token
    from vault.decrypted_secrets where name = 'ncrm_envio_interno_token';
  if v_token is null or length(v_token) < 16 then
    raise warning 'processar_agendadas: token de envio interno ausente; nenhuma mensagem foi enviada';
    return 0;
  end if;

  for r in
    select * from mensagens_agendadas
     where status in ('pendente','agendado') and quando <= now()
     order by quando
     limit 50
  loop
    v_body := jsonb_strip_nulls(jsonb_build_object(
      'to',r.telefone,'tipo',r.tipo,'texto',r.texto,'url',r.url,
      'instancia_id',r.instancia_id,'corretor_nome',r.corretor_nome,
      'fileName',r.file_name,'mimetype',r.mimetype
    ))::text;
    begin
      perform extensions.http_set_curlopt(
        'CURLOPT_TIMEOUT_MS',
        case when lower(coalesce(r.tipo, '')) = 'video' then '30000' else '5000' end
      );
      v_resp := extensions.http(('POST','https://diaegvfveqezispcthwk.supabase.co/functions/v1/dapi-enviar',
        array[extensions.http_header('Content-Type','application/json'),
              extensions.http_header('x-envio-interno', v_token)],'application/json',v_body)::extensions.http_request);
      perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','5000');
      if v_resp.status between 200 and 299 then
        update mensagens_agendadas set status='enviado', resultado=left(v_resp.content,200) where id=r.id;
      else
        update mensagens_agendadas set status='erro', resultado='HTTP '||v_resp.status||' '||left(v_resp.content,180) where id=r.id;
      end if;
      n:=n+1;
    exception when others then
      perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','5000');
      update mensagens_agendadas set status='erro', resultado=left(sqlerrm,180) where id=r.id;
    end;
  end loop;
  return n;
end $function$;

REVOKE ALL ON FUNCTION public.processar_agendadas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processar_agendadas() TO service_role;
