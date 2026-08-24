-- A operacao externa do fim de semana comeca na sexta-feira as 18h.
-- D-API conectada e suspensoes continuam obrigatorias. A liberacao e feita
-- no ponto unico de elegibilidade e a fila preserva sua identidade original.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create or replace function public.ncrm_corretor_elegibilidade(
  p_corretor_id bigint,
  p_agora timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $fn$
declare
  c public.corretores%rowtype;
  cfg public.ncrm_operacao_config%rowtype;
  apto boolean;
  conectado boolean;
  visita_pendente integer;
  suspenso_ate timestamptz;
  v_validade integer;
  v_local timestamp;
  v_fim_de_semana boolean;
begin
  select * into c from public.corretores where id=p_corretor_id;
  if c.id is null or coalesce(c.ativo,false) is not true then
    return jsonb_build_object('elegivel',false,'motivo','corretor_inativo');
  end if;

  select * into cfg from public.ncrm_operacao_config where id=true;
  v_validade:=public.regra_presenca_validade_min();
  v_local:=p_agora at time zone coalesce(cfg.timezone,'America/Sao_Paulo');
  v_fim_de_semana:=extract(isodow from v_local) in (6,7)
    or (extract(isodow from v_local)=5 and v_local::time>=time '18:00');

  conectado:=exists(
    select 1
      from public.instancias i
     where i.corretor_id=c.id
       and coalesce(i.ativa,true)
       and coalesce(i.conectada,false)
       and i.status_dapi='connected'
  );
  if not conectado then
    return jsonb_build_object('elegivel',false,'motivo','dapi_desconectada');
  end if;

  select max(s.fim_em) into suspenso_ate
    from public.ncrm_corretor_suspensao s
   where s.corretor_id=c.id
     and s.revogada_em is null
     and s.inicio_em<=p_agora
     and s.fim_em>p_agora;
  if suspenso_ate is not null then
    return jsonb_build_object('elegivel',false,'motivo','suspenso','ate',suspenso_ate);
  end if;

  if v_fim_de_semana then
    return jsonb_build_object(
      'elegivel',true,
      'motivo','fim_de_semana_sem_exigencia_presenca',
      'feedback_visita_exigido',false,
      'timezone',coalesce(cfg.timezone,'America/Sao_Paulo')
    );
  end if;

  if coalesce(cfg.exigir_feedback_visita,true) then
    select count(*) into visita_pendente
      from public.visitas v
     where v.corretor_id=c.id
       and v.criado_em>=cfg.corte_feedback_visita
       and v.status='realizada'
       and v.resultado is null
       and (v.data+coalesce(
             nullif(v.hora_fim::text,''),nullif(v.hora_inicio::text,''),'18:00'
           )::time) at time zone cfg.timezone
           < p_agora-make_interval(mins=>cfg.feedback_visita_min);
    if visita_pendente>0 then
      return jsonb_build_object('elegivel',false,'motivo','feedback_visita_pendente');
    end if;
  end if;

  apto:=coalesce(c.no_escritorio,false)
    and c.ultima_presenca is not null
    and c.ultima_presenca>p_agora-make_interval(mins=>v_validade);

  if apto then
    return jsonb_build_object(
      'elegivel',true,
      'motivo','presenca_atual_no_escritorio',
      'valida_ate',c.ultima_presenca+make_interval(mins=>v_validade)
    );
  end if;

  return jsonb_build_object(
    'elegivel',false,
    'motivo',case
      when coalesce(c.no_escritorio,false) and c.ultima_presenca is not null
        then 'presenca_expirada'
      when coalesce(c.online,false) then 'fora_da_rede_do_escritorio'
      else 'presenca_nao_confirmada'
    end,
    'validade_min',v_validade
  );
end
$fn$;

revoke all on function public.ncrm_corretor_elegibilidade(bigint,timestamptz)
  from public,anon;
grant execute on function public.ncrm_corretor_elegibilidade(bigint,timestamptz)
  to authenticated,service_role;

do $preflight$
declare
  v_id bigint;
begin
  for v_id in
    select distinct c.id
      from public.corretores c
      join public.automacoes a on a.id in (
        select id from public.automacoes where nome in ('Entrada Adelmo','Entrada Miruna')
      )
     where c.ativo
       and c.nome in ('Claudia','Elizângela','Tica','Fabiano','Edrisia','Kapri Pimeiro')
  loop
    if coalesce((public.ncrm_corretor_elegibilidade(v_id)->>'elegivel')::boolean,false) is not true then
      raise exception 'Corretor % continua inelegivel; liberacao abortada',v_id;
    end if;
  end loop;
end
$preflight$;

insert into public.motor_flags(nome,ativo,atualizado_em)
values('abordagem_automatica',true,now())
on conflict(nome) do update
set ativo=excluded.ativo,atualizado_em=excluded.atualizado_em;

insert into private.central_config_audit(chave,valor,usuario_id)
values(
  'abordagem_automatica',
  jsonb_build_object(
    'ativo',true,
    'motivo','liberacao_operacao_sexta_noite',
    'fila_reprocessada',true
  ),
  null
);

update public.motor_fila f
   set status='pendente',
       due_at=now(),
       processado_em=null,
       tentativas=0,
       ultimo_erro=case
         when f.status='erro' then 'REPROCESSAMENTO_AUTORIZADO_OPERACAO_LIBERADA'
         else null
       end
 where f.automacao_id in (
   select a.id from public.automacoes a
    where a.nome in ('Entrada Adelmo','Entrada Miruna')
      and a.ativa and a.status='publicado' and not coalesce(a.arquivada,false)
 )
   and f.status in ('pendente','erro')
   and (
     f.status='pendente'
     or coalesce(f.ultimo_erro,'') like '%DISTRIBUTION_UNAVAILABLE%'
   );

commit;
