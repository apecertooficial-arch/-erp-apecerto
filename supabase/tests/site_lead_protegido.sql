-- Teste de public.site_lead_ingest (migration 20260917160000_fase3_site_lead_protegido).
--
-- SEGURO PARA RODAR EM PRODUÇÃO: tudo acontece entre BEGIN e ROLLBACK. O insert
-- em site_leads dispara os triggers de CRM/automação, mas tudo sai no ROLLBACK
-- (motor_fila inclusive — nada é entregue antes do COMMIT).
-- Resultado: uma linha por verificação (ok = true).

begin;

create temp table _r (ordem serial, caso text, ok boolean, detalhe text) on commit drop;
grant all on _r to service_role;
grant usage on sequence _r_ordem_seq to service_role;

set local role service_role;

do $$
declare
  ip   text := repeat('c', 64);
  ph   text := repeat('d', 64);
  r1   uuid := '00000000-0000-4000-8000-00000000a001';
  r2   uuid := '00000000-0000-4000-8000-00000000a002';
  j    jsonb;
  j2   jsonb;
  n    int;
begin
  j := public.site_lead_ingest(r1, ip, ph, 'proprietario', '[TESTE] site_lead_ingest',
         '5511900000077', 'teste@exemplo.com', null, null, null, null, null,
         '{}'::jsonb, '{"source":"teste_sql"}'::jsonb);
  insert into _r(caso, ok, detalhe) values ('primeiro envio aceito', j->>'accepted' = 'true' and j->>'duplicate' = 'false', j::text);

  j2 := public.site_lead_ingest(r1, ip, ph, 'proprietario', '[TESTE] site_lead_ingest',
         '5511900000077', 'teste@exemplo.com', null, null, null, null, null,
         '{}'::jsonb, '{"source":"teste_sql"}'::jsonb);
  insert into _r(caso, ok, detalhe) values ('mesmo request_id devolve o mesmo id', j2->>'duplicate' = 'true' and j2->>'id' = j->>'id', j2::text);

  j2 := public.site_lead_ingest(r2, ip, ph, 'proprietario', '[TESTE] site_lead_ingest',
         '5511900000077', 'teste@exemplo.com', null, null, null, null, null,
         '{}'::jsonb, '{"source":"teste_sql"}'::jsonb);
  insert into _r(caso, ok, detalhe) values ('outro request_id em 30 min deduplica', j2->>'duplicate' = 'true' and j2->>'id' = j->>'id', j2::text);

  select count(*) into n from public.site_leads where telefone = '5511900000077' and nome = '[TESTE] site_lead_ingest';
  insert into _r(caso, ok, detalhe) values ('uma única linha', n = 1, n::text);

  j2 := public.site_lead_ingest(gen_random_uuid(), ip, ph, 'proprietario', 'X', '5511900000077', null, null, null, null, null, null, '{}'::jsonb, '{}'::jsonb);
  insert into _r(caso, ok, detalhe) values ('terceiro envio do telefone passa no limite mas nome inválido', j2->>'code' = 'invalid_request', j2::text);

  j2 := public.site_lead_ingest(gen_random_uuid(), ip, ph, 'proprietario', '[TESTE] site_lead_ingest', '5511900000077', null, null, null, null, null, null, '{}'::jsonb, '{}'::jsonb);
  insert into _r(caso, ok, detalhe) values ('quarto envio do mesmo telefone -> rate_limited', j2->>'code' = 'rate_limited', j2::text);

  j2 := public.site_lead_ingest(gen_random_uuid(), ip, repeat('e', 64), 'financiamento', '[TESTE] x', '5511900000078', null, null, null, null, null, null, '{}'::jsonb, '{}'::jsonb);
  insert into _r(caso, ok, detalhe) values ('financiamento recusado', j2->>'code' = 'invalid_request', j2::text);

  j2 := public.site_lead_ingest(gen_random_uuid(), ip, repeat('e', 64), 'comprador', '[TESTE] x', '11900000078', null, null, null, null, null, null, '{}'::jsonb, '{}'::jsonb);
  insert into _r(caso, ok, detalhe) values ('telefone sem 55 recusado', j2->>'code' = 'invalid_request', j2::text);
end $$;

reset role;

insert into _r(caso, ok, detalhe)
select 'anon/authenticated sem EXECUTE na RPC',
       not has_function_privilege('anon', 'public.site_lead_ingest(uuid,text,text,text,text,text,text,uuid,uuid,text,text,uuid,jsonb,jsonb)', 'execute')
   and not has_function_privilege('authenticated', 'public.site_lead_ingest(uuid,text,text,text,text,text,text,uuid,uuid,text,text,uuid,jsonb,jsonb)', 'execute'),
       null;

insert into _r(caso, ok, detalhe)
select 'policy anon original preservada',
       exists (select 1 from pg_policy where polrelid = 'public.site_leads'::regclass and polname = 'site_leads_insert_anon'),
       null;

select caso, ok, detalhe from _r order by ordem;

rollback;
