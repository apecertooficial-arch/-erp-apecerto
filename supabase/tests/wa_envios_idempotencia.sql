-- Teste de wa_envios / wa_envio_reservar / wa_envio_concluir
-- (migration 20260917120000_fase3_wa_envios_idempotencia).
--
-- SEGURO PARA RODAR EM PRODUÇÃO: tudo acontece entre BEGIN e ROLLBACK. Nada fica
-- gravado. Pré-requisito: a migration aplicada — ou cole o conteúdo dela logo
-- depois do BEGIN abaixo (DDL no Postgres é transacional e sai no ROLLBACK).
--
-- As RPCs rodam como service_role (quem a Edge Function usa). As verificações de
-- privilégio conferem que anon/authenticated não leem a tabela nem chamam as RPCs.
-- Resultado: a consulta final devolve uma linha por verificação (ok = true).

begin;

create temp table _r (ordem serial, caso text, ok boolean, detalhe text) on commit drop;
grant all on _r to service_role;
grant usage on sequence _r_ordem_seq to service_role;

set local role service_role;

do $$
declare
  h1 text := repeat('a', 64);
  h2 text := repeat('b', 64);
  j jsonb;
  b boolean;
begin
  -- 1. chave nova -> enviar
  j := public.wa_envio_reservar('teste:k1', 'sess-teste', '5511900000001', 'text', h1, false);
  insert into _r(caso, ok, detalhe) values ('chave nova reserva e autoriza envio', j->>'acao' = 'enviar' and j#>>'{registro,status}' = 'reservado', j::text);

  -- 2. mesma chave com reserva viva -> em_andamento
  j := public.wa_envio_reservar('teste:k1', 'sess-teste', '5511900000001', 'text', h1, false);
  insert into _r(caso, ok, detalhe) values ('reserva viva bloqueia segunda chamada', j->>'acao' = 'em_andamento', j->>'acao');

  -- 3. concluir enviado -> reservar de novo devolve o resultado anterior
  b := public.wa_envio_concluir('teste:k1', 'enviado', '3EBTESTE1', '5511900000001', null, '{"success":true}'::jsonb);
  j := public.wa_envio_reservar('teste:k1', 'sess-teste', '5511900000001', 'text', h1, false);
  insert into _r(caso, ok, detalhe) values ('enviado devolve resultado anterior sem reenviar', b and j->>'acao' = 'devolver' and j#>>'{registro,provider_message_id}' = '3EBTESTE1', j->>'acao');

  -- 4. enviado nunca é rebaixado
  b := public.wa_envio_concluir('teste:k1', 'falhou', null, null, 'x', null);
  insert into _r(caso, ok, detalhe) values ('enviado nao e rebaixado para falhou', not b, b::text);

  -- 5. mesma chave, outro conteúdo -> conflito
  j := public.wa_envio_reservar('teste:k1', 'sess-teste', '5511900000001', 'text', h2, false);
  insert into _r(caso, ok, detalhe) values ('mesma chave com outro conteudo e conflito', j->>'acao' = 'conflito', j->>'acao');

  -- 6. chave derivada diferente, mesma mensagem ao mesmo telefone dentro de 120 s -> devolver
  j := public.wa_envio_reservar('auto:teste-balde-2', 'sess-teste', '5511900000001', 'text', h1, true);
  insert into _r(caso, ok, detalhe) values ('derivada: janela deslizante pega envio igual recente', j->>'acao' = 'devolver' and j#>>'{registro,idempotency_key}' = 'teste:k1', j::text);

  -- 7. chave explícita diferente com o mesmo conteúdo -> enviar (chave explícita manda)
  j := public.wa_envio_reservar('teste:k2', 'sess-teste', '5511900000001', 'text', h1, false);
  insert into _r(caso, ok, detalhe) values ('chave explicita nova nao usa janela', j->>'acao' = 'enviar', j->>'acao');

  -- 8. incerto: não reenvia; falhou não sobrescreve; enviado confirma depois
  perform public.wa_envio_reservar('teste:k3', 'sess-teste', '5511900000003', 'text', h1, false);
  b := public.wa_envio_concluir('teste:k3', 'incerto', null, null, 'timeout', null);
  j := public.wa_envio_reservar('teste:k3', 'sess-teste', '5511900000003', 'text', h1, false);
  insert into _r(caso, ok, detalhe) values ('incerto nao autoriza reenvio', b and j->>'acao' = 'incerto', j->>'acao');
  b := public.wa_envio_concluir('teste:k3', 'falhou', null, null, 'x', null);
  insert into _r(caso, ok, detalhe) values ('incerto nao vira falhou', not b, b::text);
  b := public.wa_envio_concluir('teste:k3', 'enviado', '3EBTESTE3', '5511900000003', null, null);
  insert into _r(caso, ok, detalhe) values ('incerto pode ser confirmado como enviado', b, b::text);

  -- 9. falhou: nova tentativa permitida, tentativas incrementa
  perform public.wa_envio_reservar('teste:k4', 'sess-teste', '5511900000004', 'image', h2, false);
  perform public.wa_envio_concluir('teste:k4', 'falhou', null, null, 'HTTP 400 not on WhatsApp', null);
  j := public.wa_envio_reservar('teste:k4', 'sess-teste', '5511900000004', 'image', h2, false);
  insert into _r(caso, ok, detalhe) values ('falhou libera nova tentativa', j->>'acao' = 'enviar' and (j#>>'{registro,tentativas}')::int = 2, j::text);

  -- 10. derivada em telefone sem envio prévio reserva normalmente
  j := public.wa_envio_reservar('auto:teste-k4b', 'sess-teste', '5511900000005', 'image', h2, true);
  insert into _r(caso, ok, detalhe) values ('derivada em telefone sem envio previo reserva', j->>'acao' = 'enviar', j->>'acao');
end $$;

reset role;

-- 11. reserva vencida (função morreu no meio) vira incerto
update public.wa_envios set reservado_ate = now() - interval '1 second' where idempotency_key = 'teste:k2';
set local role service_role;
insert into _r(caso, ok, detalhe)
select 'reserva vencida vira incerto', x->>'acao' = 'incerto' and x#>>'{registro,status}' = 'incerto', x::text
  from (select public.wa_envio_reservar('teste:k2', 'sess-teste', '5511900000001', 'text', repeat('a',64), false) x) s;
reset role;

-- 12. constraints
do $$
begin
  begin
    insert into public.wa_envios(idempotency_key, instancia, telefone, tipo, conteudo_hash, status)
    values ('teste:k9', 's', '1', 'text', repeat('c',64), 'xyz');
    insert into _r(caso, ok, detalhe) values ('status invalido rejeitado', false, 'aceitou');
  exception when check_violation then
    insert into _r(caso, ok, detalhe) values ('status invalido rejeitado', true, sqlerrm);
  end;
  begin
    insert into public.wa_envios(idempotency_key, instancia, telefone, tipo, conteudo_hash)
    values ('teste:k1', 's', '1', 'text', repeat('c',64));
    insert into _r(caso, ok, detalhe) values ('idempotency_key unica', false, 'aceitou');
  exception when unique_violation then
    insert into _r(caso, ok, detalhe) values ('idempotency_key unica', true, sqlerrm);
  end;
end $$;

-- 13. RLS fechada e privilégios
insert into _r(caso, ok, detalhe)
select 'RLS ligada e sem policies',
       c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename='wa_envios'),
       'rls=' || c.relrowsecurity
  from pg_class c where c.oid = 'public.wa_envios'::regclass;

insert into _r(caso, ok, detalhe)
select 'anon/authenticated sem privilegio na tabela',
       not has_table_privilege('anon','public.wa_envios','select,insert,update,delete')
   and not has_table_privilege('authenticated','public.wa_envios','select,insert,update,delete'),
       null;

insert into _r(caso, ok, detalhe)
select 'anon/authenticated nao executam as RPCs',
       not has_function_privilege('anon','public.wa_envio_reservar(text,text,text,text,text,boolean,integer,integer)','execute')
   and not has_function_privilege('authenticated','public.wa_envio_reservar(text,text,text,text,text,boolean,integer,integer)','execute')
   and not has_function_privilege('anon','public.wa_envio_concluir(text,text,text,text,text,jsonb)','execute')
   and not has_function_privilege('authenticated','public.wa_envio_concluir(text,text,text,text,text,jsonb)','execute')
   and has_function_privilege('service_role','public.wa_envio_reservar(text,text,text,text,text,boolean,integer,integer)','execute'),
       null;

do $$
begin
  set local role authenticated;
  begin
    perform 1 from public.wa_envios limit 1;
    reset role;
    insert into _r(caso, ok, detalhe) values ('authenticated nao le wa_envios (execucao real)', false, 'leu');
  exception when insufficient_privilege then
    reset role;
    insert into _r(caso, ok, detalhe) values ('authenticated nao le wa_envios (execucao real)', true, sqlerrm);
  end;
end $$;

-- 14. processar_agendadas manda chave estável
insert into _r(caso, ok, detalhe)
select 'processar_agendadas envia idempotency_key agendada:<id>',
       prosrc like '%''idempotency_key'',''agendada:''||r.id%', null
  from pg_proc where oid = 'public.processar_agendadas'::regproc;

select ordem, caso, ok, left(detalhe, 120) as detalhe from _r order by ordem;

rollback;
