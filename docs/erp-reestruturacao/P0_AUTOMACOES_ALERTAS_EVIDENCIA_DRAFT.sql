-- DRAFT NAO EXECUTAVEL / NAO APLICADO EM PRODUCAO
--
-- Fecha alertas de automacao somente quando existe evidencia operacional:
--   * primeira abordagem: card saiu de novo, foi descartado, trocou de dono,
--     teve acao confirmada ou uma saida real foi sincronizada;
--   * canal indisponivel: card descartado ou nova saida real confirmada;
--   * lead em atendimento/quente: o estado deixou de ser verdadeiro.
--
-- Idade nunca e evidencia. O historico e preservado e recebe tipo, referencia
-- local e horario da evidencia. Este arquivo depende do draft de ciclo, fica
-- fora de supabase/migrations e nao foi compilado nem aplicado.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $preflight$
begin
  if to_regclass('public.ncrm_notificacao') is null
     or to_regclass('public.f2_lead') is null
     or to_regclass('public.motor_mensagem_partes') is null
     or to_regclass('public.wa_mensagens') is null then
    raise exception 'AUTOMACAO_ALERTA_EVIDENCIA_TABELA_AUSENTE';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='ncrm_notificacao'
       and column_name='automacao_id'
  ) or not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='ncrm_notificacao'
       and column_name='lead_id'
  ) then
    raise exception 'APLIQUE_PRIMEIRO_O_CONTRATO_DE_CICLO_DAS_AUTOMACOES';
  end if;
end
$preflight$;

alter table public.ncrm_notificacao
  add column if not exists resolucao_evidencia_tipo text null,
  add column if not exists resolucao_evidencia_ref text null,
  add column if not exists resolucao_evidencia_em timestamptz null;

comment on column public.ncrm_notificacao.resolucao_evidencia_tipo is
  'Fato tecnico que encerrou a obrigacao; nunca usar idade como evidencia.';
comment on column public.ncrm_notificacao.resolucao_evidencia_ref is
  'Identificador local sanitizado da linha que comprova o encerramento.';
comment on column public.ncrm_notificacao.resolucao_evidencia_em is
  'Horario do fato operacional usado como evidencia.';

alter table public.ncrm_notificacao
  drop constraint if exists ncrm_notificacao_resolvida_por_check;
alter table public.ncrm_notificacao
  add constraint ncrm_notificacao_resolvida_por_check
  check (resolvida_por is null or resolvida_por in (
    'automatica', 'usuario', 'automatica_f2', 'f2_sync', 'troca_dono_f2',
    'automacao_ciclo', 'automacao_evidencia'
  ) or resolvida_por like 'central:%');

alter table public.ncrm_notificacao
  drop constraint if exists ncrm_notificacao_resolucao_evidencia_tipo_check;
alter table public.ncrm_notificacao
  add constraint ncrm_notificacao_resolucao_evidencia_tipo_check
  check (resolucao_evidencia_tipo is null or resolucao_evidencia_tipo in (
    'f2_descarte', 'f2_estado', 'f2_troca_dono', 'f2_card_removido',
    'motor_saida_confirmada', 'dapi_saida_sincronizada'
  ));

create index if not exists ncrm_notificacao_automacao_lead_aberta_idx
  on public.ncrm_notificacao(lead_id, tipo, criada_em)
  where resolvida_em is null
    and lead_id is not null
    and chave like 'automacao:%';

create index if not exists motor_mensagem_partes_lead_confirmada_idx
  on public.motor_mensagem_partes(lead_id, confirmada_em)
  where lead_id is not null and status in ('enviada','entregue','lida');

-- Uma saida sincronizada e suficiente para fechar a pendencia de primeira
-- abordagem ou a falha de canal anterior do mesmo lead. A referencia e sempre
-- uma PK local; conteudo, telefone e provider_message_id nao sao copiados.
create or replace function ncrm_private.automacao_resolver_por_saida(
  p_lead_id bigint,
  p_evento_em timestamptz,
  p_evidencia_tipo text,
  p_evidencia_ref text
) returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_atualizadas integer := 0;
begin
  if p_lead_id is null then return 0; end if;
  if p_evidencia_tipo not in ('motor_saida_confirmada','dapi_saida_sincronizada') then
    raise exception 'AUTOMACAO_ALERTA_EVIDENCIA_SAIDA_INVALIDA';
  end if;

  update public.ncrm_notificacao n
     set resolvida_em = coalesce(n.resolvida_em, now()),
         resolvida_por = coalesce(n.resolvida_por, 'automacao_evidencia'),
         resolucao_evidencia_tipo = coalesce(n.resolucao_evidencia_tipo, p_evidencia_tipo),
         resolucao_evidencia_ref = coalesce(n.resolucao_evidencia_ref, left(p_evidencia_ref, 160)),
         resolucao_evidencia_em = coalesce(n.resolucao_evidencia_em, p_evento_em)
   where n.lead_id = p_lead_id
     and n.resolvida_em is null
     and n.chave like 'automacao:%'
     and n.tipo in ('primeira_abordagem_pendente','canal_indisponivel')
     and n.criada_em <= p_evento_em;
  get diagnostics v_atualizadas = row_count;
  return v_atualizadas;
end
$function$;

revoke all on function ncrm_private.automacao_resolver_por_saida(bigint,timestamptz,text,text)
  from public, anon, authenticated;

-- Estado canônico do card resolve apenas obrigacoes incompatíveis com o estado
-- atual. Canal indisponivel nao fecha por mudanca de etapa: exige descarte ou
-- saida real posterior.
create or replace function ncrm_private.automacao_resolver_por_estado_f2(
  p_negocio_id bigint,
  p_card_id uuid,
  p_etapa text,
  p_temperatura text,
  p_descartado_em timestamptz,
  p_ultima_acao_confirmada_em timestamptz,
  p_corretor_id bigint,
  p_evento_em timestamptz
) returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_atualizadas integer := 0;
begin
  if p_negocio_id is null or p_card_id is null then return 0; end if;

  update public.ncrm_notificacao n
     set resolvida_em = coalesce(n.resolvida_em, now()),
         resolvida_por = coalesce(n.resolvida_por, 'automacao_evidencia'),
         resolucao_evidencia_tipo = coalesce(
           n.resolucao_evidencia_tipo,
           case
             when p_descartado_em is not null then 'f2_descarte'
             when n.tipo='primeira_abordagem_pendente'
                  and n.corretor_id is distinct from p_corretor_id then 'f2_troca_dono'
             else 'f2_estado'
           end
         ),
         resolucao_evidencia_ref = coalesce(n.resolucao_evidencia_ref, p_card_id::text),
         resolucao_evidencia_em = coalesce(
           n.resolucao_evidencia_em,
           p_descartado_em,
           p_ultima_acao_confirmada_em,
           p_evento_em
         )
   where n.negocio_id = p_negocio_id
     and n.resolvida_em is null
     and n.chave like 'automacao:%'
     and (
       (n.tipo='primeira_abordagem_pendente' and (
          p_descartado_em is not null
          or p_etapa is distinct from 'novo'
          or p_ultima_acao_confirmada_em is not null
          or n.corretor_id is distinct from p_corretor_id
       ))
       or (n.tipo='canal_indisponivel' and p_descartado_em is not null)
       or (n.tipo='lead_em_atendimento' and (
          p_descartado_em is not null or p_etapa is distinct from 'em_atendimento'
       ))
       or (n.tipo='lead_quente' and (
          p_descartado_em is not null or p_temperatura is distinct from 'quente'
       ))
     );
  get diagnostics v_atualizadas = row_count;
  return v_atualizadas;
end
$function$;

revoke all on function ncrm_private.automacao_resolver_por_estado_f2(
  bigint,uuid,text,text,timestamptz,timestamptz,bigint,timestamptz
) from public, anon, authenticated;

create or replace function ncrm_private.automacao_alerta_reconciliar_f2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trigger$
begin
  if tg_op='DELETE' then
    update public.ncrm_notificacao n
       set resolvida_em=coalesce(n.resolvida_em,now()),
           resolvida_por=coalesce(n.resolvida_por,'automacao_evidencia'),
           resolucao_evidencia_tipo=coalesce(n.resolucao_evidencia_tipo,'f2_card_removido'),
           resolucao_evidencia_ref=coalesce(n.resolucao_evidencia_ref,old.id::text),
           resolucao_evidencia_em=coalesce(n.resolucao_evidencia_em,now())
     where n.negocio_id=old.origem_negocio_id
       and n.resolvida_em is null
       and n.chave like 'automacao:%'
       and n.tipo in (
         'primeira_abordagem_pendente','canal_indisponivel',
         'lead_em_atendimento','lead_quente'
       );
    return old;
  end if;

  perform ncrm_private.automacao_resolver_por_estado_f2(
    new.origem_negocio_id,new.id,new.etapa,new.temperatura,new.descartado_em,
    new.ultima_acao_confirmada_em,new.corretor_id,coalesce(new.atualizado_em,now())
  );
  return new;
end
$trigger$;

revoke all on function ncrm_private.automacao_alerta_reconciliar_f2()
  from public, anon, authenticated;

drop trigger if exists trg_automacao_alerta_reconciliar_f2 on public.f2_lead;
create trigger trg_automacao_alerta_reconciliar_f2
after insert or update or delete on public.f2_lead
for each row execute function ncrm_private.automacao_alerta_reconciliar_f2();

-- Evita abrir uma obrigacao que ja contradiz o card atual. Este trigger roda
-- depois do vinculo automacao/lead criado pelo draft de ciclo.
create or replace function ncrm_private.automacao_alerta_reconciliar_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trigger$
declare
  v_f public.f2_lead%rowtype;
begin
  if new.chave not like 'automacao:%'
     or new.tipo not in (
       'primeira_abordagem_pendente','canal_indisponivel',
       'lead_em_atendimento','lead_quente'
     ) then
    return new;
  end if;
  select * into v_f from public.f2_lead where origem_negocio_id=new.negocio_id;
  if found then
    perform ncrm_private.automacao_resolver_por_estado_f2(
      v_f.origem_negocio_id,v_f.id,v_f.etapa,v_f.temperatura,v_f.descartado_em,
      v_f.ultima_acao_confirmada_em,v_f.corretor_id,coalesce(v_f.atualizado_em,now())
    );
  end if;
  return new;
end
$trigger$;

revoke all on function ncrm_private.automacao_alerta_reconciliar_insert()
  from public, anon, authenticated;

drop trigger if exists trg_automacao_alerta_reconciliar_insert
  on public.ncrm_notificacao;
create trigger trg_automacao_alerta_reconciliar_insert
after insert on public.ncrm_notificacao
for each row execute function ncrm_private.automacao_alerta_reconciliar_insert();

create or replace function ncrm_private.automacao_alerta_saida_motor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trigger$
begin
  if tg_op='UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  if new.lead_id is not null
     and new.status in ('enviada','entregue','lida') then
    perform ncrm_private.automacao_resolver_por_saida(
      new.lead_id,
      coalesce(new.confirmada_em,new.entregue_em,new.lida_em,new.tentada_em,now()),
      'motor_saida_confirmada',new.id::text
    );
  end if;
  return new;
end
$trigger$;

revoke all on function ncrm_private.automacao_alerta_saida_motor()
  from public, anon, authenticated;

drop trigger if exists trg_automacao_alerta_saida_motor
  on public.motor_mensagem_partes;
create trigger trg_automacao_alerta_saida_motor
after insert or update of status on public.motor_mensagem_partes
for each row execute function ncrm_private.automacao_alerta_saida_motor();

create or replace function ncrm_private.automacao_alerta_saida_dapi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trigger$
declare
  v_lead_id bigint;
begin
  if coalesce(new.is_grupo,false)
     or lower(coalesce(new.direcao,'')) not in (
       'enviada','saida','out','outbound','sent'
     ) then
    return new;
  end if;
  select wc.lead_id into v_lead_id
    from public.wa_conversas cv
    join public.wa_contatos wc on wc.id=cv.contato_id
   where cv.id=new.conversa_id;
  perform ncrm_private.automacao_resolver_por_saida(
    v_lead_id,coalesce(new.enviado_em,new.criado_em,now()),
    'dapi_saida_sincronizada',new.id::text
  );
  return new;
end
$trigger$;

revoke all on function ncrm_private.automacao_alerta_saida_dapi()
  from public, anon, authenticated;

drop trigger if exists trg_automacao_alerta_saida_dapi on public.wa_mensagens;
create trigger trg_automacao_alerta_saida_dapi
after insert on public.wa_mensagens
for each row execute function ncrm_private.automacao_alerta_saida_dapi();

-- Reconcilia o estoque atual sem ler ou copiar nome, telefone, e-mail ou
-- conteudo. Primeiro o estado do card; depois a primeira saida real posterior.
do $reconcile_f2$
declare r record;
begin
  for r in select * from public.f2_lead
  loop
    perform ncrm_private.automacao_resolver_por_estado_f2(
      r.origem_negocio_id,r.id,r.etapa,r.temperatura,r.descartado_em,
      r.ultima_acao_confirmada_em,r.corretor_id,coalesce(r.atualizado_em,now())
    );
  end loop;
end
$reconcile_f2$;

with evidencia as (
  select distinct on (n.id)
         n.id notificacao_id, mp.id::text evidencia_ref,
         coalesce(mp.confirmada_em,mp.entregue_em,mp.lida_em,mp.tentada_em) evidencia_em
    from public.ncrm_notificacao n
    join public.motor_mensagem_partes mp on mp.lead_id=n.lead_id
   where n.resolvida_em is null
     and n.chave like 'automacao:%'
     and n.tipo in ('primeira_abordagem_pendente','canal_indisponivel')
     and mp.status in ('enviada','entregue','lida')
     and coalesce(mp.confirmada_em,mp.entregue_em,mp.lida_em,mp.tentada_em)>=n.criada_em
   order by n.id,coalesce(mp.confirmada_em,mp.entregue_em,mp.lida_em,mp.tentada_em),mp.id
)
update public.ncrm_notificacao n
   set resolvida_em=coalesce(n.resolvida_em,now()),
       resolvida_por=coalesce(n.resolvida_por,'automacao_evidencia'),
       resolucao_evidencia_tipo='motor_saida_confirmada',
       resolucao_evidencia_ref=e.evidencia_ref,
       resolucao_evidencia_em=e.evidencia_em
  from evidencia e
 where n.id=e.notificacao_id and n.resolvida_em is null;

with evidencia as (
  select distinct on (n.id)
         n.id notificacao_id, wm.id::text evidencia_ref,
         coalesce(wm.enviado_em,wm.criado_em) evidencia_em
    from public.ncrm_notificacao n
    join public.wa_contatos wc on wc.lead_id=n.lead_id
    join public.wa_conversas cv on cv.contato_id=wc.id
    join public.wa_mensagens wm on wm.conversa_id=cv.id
   where n.resolvida_em is null
     and n.chave like 'automacao:%'
     and n.tipo in ('primeira_abordagem_pendente','canal_indisponivel')
     and coalesce(wm.is_grupo,false) is false
     and lower(coalesce(wm.direcao,'')) in ('enviada','saida','out','outbound','sent')
     and coalesce(wm.enviado_em,wm.criado_em)>=n.criada_em
   order by n.id,coalesce(wm.enviado_em,wm.criado_em),wm.id
)
update public.ncrm_notificacao n
   set resolvida_em=coalesce(n.resolvida_em,now()),
       resolvida_por=coalesce(n.resolvida_por,'automacao_evidencia'),
       resolucao_evidencia_tipo='dapi_saida_sincronizada',
       resolucao_evidencia_ref=e.evidencia_ref,
       resolucao_evidencia_em=e.evidencia_em
  from evidencia e
 where n.id=e.notificacao_id and n.resolvida_em is null;

do $verify$
declare
  v_sem_trilha integer;
  v_estado_obsoleto integer;
  v_saida_ignorada integer;
begin
  select count(*) into v_sem_trilha
    from public.ncrm_notificacao
   where resolvida_por='automacao_evidencia'
     and (resolucao_evidencia_tipo is null
          or resolucao_evidencia_ref is null
          or resolucao_evidencia_em is null);

  select count(*) into v_estado_obsoleto
    from public.ncrm_notificacao n
    join public.f2_lead f on f.origem_negocio_id=n.negocio_id
   where n.resolvida_em is null and n.chave like 'automacao:%'
     and (
       (n.tipo='primeira_abordagem_pendente' and (
         f.descartado_em is not null or f.etapa<>'novo'
         or f.ultima_acao_confirmada_em is not null
         or n.corretor_id is distinct from f.corretor_id
       ))
       or (n.tipo='canal_indisponivel' and f.descartado_em is not null)
       or (n.tipo='lead_em_atendimento' and (
         f.descartado_em is not null or f.etapa<>'em_atendimento'
       ))
       or (n.tipo='lead_quente' and (
         f.descartado_em is not null or f.temperatura is distinct from 'quente'
       ))
     );

  select count(*) into v_saida_ignorada
    from public.ncrm_notificacao n
   where n.resolvida_em is null and n.chave like 'automacao:%'
     and n.tipo in ('primeira_abordagem_pendente','canal_indisponivel')
     and (
       exists (
         select 1 from public.motor_mensagem_partes mp
          where mp.lead_id=n.lead_id
            and mp.status in ('enviada','entregue','lida')
            and coalesce(mp.confirmada_em,mp.entregue_em,mp.lida_em,mp.tentada_em)>=n.criada_em
       )
       or exists (
         select 1 from public.wa_contatos wc
         join public.wa_conversas cv on cv.contato_id=wc.id
         join public.wa_mensagens wm on wm.conversa_id=cv.id
          where wc.lead_id=n.lead_id
            and coalesce(wm.is_grupo,false) is false
            and lower(coalesce(wm.direcao,'')) in ('enviada','saida','out','outbound','sent')
            and coalesce(wm.enviado_em,wm.criado_em)>=n.criada_em
       )
     );

  if v_sem_trilha<>0 or v_estado_obsoleto<>0 or v_saida_ignorada<>0 then
    raise exception
      'AUTOMACAO_ALERTA_EVIDENCIA_FAILED: sem_trilha=%, estado_obsoleto=%, saida_ignorada=%',
      v_sem_trilha,v_estado_obsoleto,v_saida_ignorada;
  end if;
end
$verify$;

commit;
