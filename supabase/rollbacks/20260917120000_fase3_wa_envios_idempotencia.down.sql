-- Desfaz 20260917120000_fase3_wa_envios_idempotencia.
-- ATENÇÃO: antes de rodar, volte dapi-enviar para a versão anterior (v24 de produção,
-- snapshot em arquivo/edge-functions-producao-20260915). A nova dapi-enviar recusa
-- enviar (503 idempotencia_indisponivel) se wa_envio_reservar não existir.
-- wa_envios só guarda o livro-razão de envios; apagá-la não perde dado de negócio
-- (as mensagens continuam em wa_mensagens).

drop function if exists public.wa_envio_reservar(text,text,text,text,text,boolean,integer,integer);
drop function if exists public.wa_envio_concluir(text,text,text,text,text,jsonb);
drop table if exists public.wa_envios;

-- processar_agendadas: o campo idempotency_key extra é ignorado pela dapi-enviar
-- antiga, então não é preciso reverter a função. Se quiser o texto idêntico ao
-- anterior, reaplique supabase/migrations/20260902015500_agendadas_timeout_video_curl.sql.

notify pgrst, 'reload schema';
