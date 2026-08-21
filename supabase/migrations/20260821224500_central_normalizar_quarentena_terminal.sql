-- Separa resultados terminais de regras de negocio dos erros tecnicos recuperaveis.
-- Nenhum item e reexecutado e nenhum lead e alterado nesta normalizacao.

with normalizados as (
  update public.motor_fila
     set status = 'ignorado',
         processado_em = coalesce(processado_em, now()),
         ultimo_erro = case
           when ultimo_erro like '%ai-agent:analise_nao_aplicavel%'
             then 'AI_RESULTADO_TERMINAL_IGNORADO: analise_nao_aplicavel'
           when ultimo_erro like '%ai-agent:lead_fora_do_funil%'
             then 'AI_RESULTADO_TERMINAL_IGNORADO: lead_fora_do_funil'
           else ultimo_erro
         end
   where status = 'erro'
     and (
       ultimo_erro like '%ai-agent:analise_nao_aplicavel%'
       or ultimo_erro like '%ai-agent:lead_fora_do_funil%'
     )
  returning id
)
insert into private.central_config_audit(chave, valor, usuario_id, criado_em)
select
  'normalizar_resultado_terminal',
  jsonb_build_object('itens', count(*), 'sem_reexecucao', true),
  auth.uid(),
  now()
from normalizados;

do $$
begin
  if exists (
    select 1
      from public.motor_fila
     where status = 'erro'
       and (
         ultimo_erro like '%ai-agent:analise_nao_aplicavel%'
         or ultimo_erro like '%ai-agent:lead_fora_do_funil%'
       )
  ) then
    raise exception 'CENTRAL_TERMINAL_NORMALIZATION_FAILED';
  end if;
end
$$;
