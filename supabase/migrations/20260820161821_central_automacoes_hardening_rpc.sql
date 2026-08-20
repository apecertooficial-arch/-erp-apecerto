-- O construtor nao simula mais execucoes reais. O runtime e exclusivamente
-- interno e somente o service_role pode iniciar uma automacao.
begin;

revoke all on function public.motor_rodar(bigint,jsonb,text,integer)
  from public,anon,authenticated;
grant execute on function public.motor_rodar(bigint,jsonb,text,integer)
  to service_role;

commit;
