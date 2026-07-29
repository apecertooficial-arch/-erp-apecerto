-- V7.2 GATE 0 — backup lógico recuperável + preflight.
-- Puramente aditivo. Não altera nada do legado.
create schema if not exists wa_backup_v72;
revoke all on schema wa_backup_v72 from public, anon, authenticated;
grant usage on schema wa_backup_v72 to service_role;

comment on schema wa_backup_v72 is
  'Backup lógico do estado ANTES do cutover V7.2 (30/07/2026). Somente leitura. Nada aqui deve ser alterado.';

-- 1) definição e ACL de toda função que será substituída ou terá grant alterado
create table if not exists wa_backup_v72.funcao_antes (
  capturado_em timestamptz not null default now(),
  assinatura   text not null,
  prosecdef    boolean,
  dono         text,
  prosrc       text,
  md5_prosrc   text,
  acl          text,
  proconfig    text[],
  primary key (assinatura, capturado_em)
);

insert into wa_backup_v72.funcao_antes (assinatura, prosecdef, dono, prosrc, md5_prosrc, acl, proconfig)
select p.oid::regprocedure::text, p.prosecdef, pg_get_userbyid(p.proowner),
       p.prosrc, md5(p.prosrc), coalesce(array_to_string(p.proacl,','),'(padrao)'), p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('motor_envia_abordagem','enviar_abordagem_lead','reenviar_abordagem',
                    'motor_rodar_unchecked','motor_processar_fila','dapi_sync_instancias',
                    'excluir_instancia','instancias_vincular_corretores','instancia_saudavel',
                    'corretor_pode_receber','presenca_derrubar_expirados','distribuicao_saude',
                    'erp_config_atual','wa_ingerir','wa_registrar_saida','processar_agendadas');

-- 2) cópia dos dados de inventário e vínculo (não é DELETE de nada; é cópia)
create table if not exists wa_backup_v72.instancias_antes as
  select now() as capturado_em, i.* from public.instancias i;
create table if not exists wa_backup_v72.wa_instancias_antes as
  select now() as capturado_em, w.* from public.wa_instancias w;
create table if not exists wa_backup_v72.corretor_instancias_antes as
  select now() as capturado_em, c.* from public.corretor_instancias c;
create table if not exists wa_backup_v72.distribuicao_config_antes as
  select now() as capturado_em, d.* from public.distribuicao_config d;
create table if not exists wa_backup_v72.corretores_antes as
  select now() as capturado_em, c.id, c.nome, c.ativo, c.online, c.no_escritorio,
         c.ultima_presenca, c.forcar_distribuicao, c.peso, c.ordem
    from public.corretores c;

-- 3) hashes de histórico por conversa, para provar depois que nada foi perdido
create table if not exists wa_backup_v72.historico_hash_antes as
  select now() as capturado_em, m.conversa_id, count(*) as mensagens,
         md5(string_agg(m.wa_message_id, ',' order by m.wa_message_id)) as hash_ids
    from public.wa_mensagens m group by m.conversa_id;

-- 4) crons e configuração de Edge Functions (só nomes/estado, nunca segredo)
create table if not exists wa_backup_v72.cron_antes as
  select now() as capturado_em, jobid, schedule, jobname, active from cron.job;

-- 5) totais globais
create table if not exists wa_backup_v72.totais_antes (
  capturado_em timestamptz not null default now(),
  chave text not null, valor text not null, primary key (chave, capturado_em));
insert into wa_backup_v72.totais_antes (chave, valor) values
 ('instancias',           (select count(*)::text from public.instancias)),
 ('wa_instancias',        (select count(*)::text from public.wa_instancias)),
 ('corretor_instancias',  (select count(*)::text from public.corretor_instancias)),
 ('wa_conversas',         (select count(*)::text from public.wa_conversas)),
 ('wa_mensagens',         (select count(*)::text from public.wa_mensagens)),
 ('wa_contatos',          (select count(*)::text from public.wa_contatos)),
 ('md5_motor_envia_abordagem',
    (select md5(prosrc) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='motor_envia_abordagem'));

revoke all on all tables in schema wa_backup_v72 from public, anon, authenticated;
grant select on all tables in schema wa_backup_v72 to service_role;
