-- A regra fica ativa na operacao normal. A funcao de elegibilidade publicada
-- anteriormente a ignora somente aos sabados e domingos.

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
