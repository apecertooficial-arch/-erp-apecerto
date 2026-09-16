-- Fase 0: ia_audios_pendentes levava ~10 s por chamada (a cada 2 min) e somava 59 h de CPU.
-- Causa: count(*) sem indice em transcrito_em e EXISTS com join por expressao linha a linha.
-- Nova versao: sufixos de telefone calculados uma vez e hash join (~80 ms medido).
create index if not exists idx_wa_msg_transcrito_em on public.wa_mensagens (transcrito_em) where transcrito_em is not null;

create or replace function public.ia_audios_pendentes(p_limite integer default 10)
returns table(id uuid, media_url text)
language plpgsql stable security definer
set search_path to 'public'
as $function$
declare
  v_ativo boolean;
  v_teto integer;
  v_hoje integer;
begin
  select c.ativo, c.teto_diario into v_ativo, v_teto from ia_transcricao_config c where c.id = 1;
  if not coalesce(v_ativo, true) then return; end if;

  select count(*) into v_hoje
  from wa_mensagens w
  where w.transcrito_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
  if v_hoje >= coalesce(v_teto, 400) then return; end if;

  return query
  with sufixos as (
    select distinct right(regexp_replace(coalesce(f.telefone, ''), '\D', '', 'g'), 8) as s
    from f2_lead f where f.telefone is not null
  ),
  conversas_ok as (
    select cv.id
    from wa_contatos ct
    join sufixos x on x.s = right(regexp_replace(coalesce(ct.telefone, ''), '\D', '', 'g'), 8)
    join wa_conversas cv on cv.contato_id = ct.id
  )
  select m.id, m.media_url
  from wa_mensagens m
  join conversas_ok co on co.id = m.conversa_id
  where m.tipo = 'audio'
    and m.transcricao is null
    and m.media_url is not null
    and coalesce(m.transcricao_tentativas, 0) < 3
    and not coalesce(m.is_grupo, false)
  order by case when m.direcao = 'recebida' then 0 else 1 end, m.enviado_em desc nulls last
  limit greatest(1, least(coalesce(p_limite, 10), 25));
end;
$function$;

-- Retencao do log do pg_cron: 1,1 milhao de linhas (303 MB) nunca limpas.
select cron.schedule('limpar-cron-job-run-details', '41 4 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
