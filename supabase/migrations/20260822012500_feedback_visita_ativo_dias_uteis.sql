-- A regra fica ativa na operacao normal. A funcao de elegibilidade publicada
-- anteriormente a ignora somente aos sabados e domingos.

-- A coluna existia no ambiente vivo, mas nao constava na migration que criou
-- ncrm_operacao_config. Declarar aqui fecha tanto bases novas quanto upgrades
-- de instalações que ainda nao receberam esse contrato.
alter table public.ncrm_operacao_config
  add column if not exists exigir_feedback_visita boolean not null default true;

update public.ncrm_operacao_config
   set exigir_feedback_visita=true
 where id=true;

do $check$
begin
  if not coalesce((
    select exigir_feedback_visita
      from public.ncrm_operacao_config
     where id=true
  ),false) then
    raise exception 'feedback_visita_dias_uteis_nao_ativado';
  end if;
end
$check$;
