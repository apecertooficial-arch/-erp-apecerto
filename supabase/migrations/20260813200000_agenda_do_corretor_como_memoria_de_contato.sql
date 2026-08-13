-- O QUE O APARELHO DO CORRETOR SABE E O ERP NAO
--
-- O Romulo foi direto: "nao quero que o corretor saiba, quero que voce
-- verifique antes de mandar". Entao a verificacao tem que sair de uma fonte que
-- nao dependa de ninguem declarar nada.
--
-- Essa fonte existe: o proprio WhatsApp do corretor, pela D-API. Uma sonda de
-- leitura confirmou dois endpoints (os outros dez candidatos devolveram 500):
--   GET /api/v1/chats?sessionId=X    -> a lista de conversas da sessao
--   GET /api/v1/contacts?sessionId=X -> a agenda de contatos da sessao
--
-- Por que isso alcanca o que o ERP nao alcanca: a sincronizacao de mensagens
-- trouxe o historico a partir de jan/2026 (Fabiano) ou nov/2025 (Tica), e so de
-- quem conversou. O aparelho tem conversas mais antigas -- a sonda achou chat
-- criado em 14/11/2025 -- e, mais importante, tem a AGENDA: se o cliente esta
-- salvo no telefone do corretor, os dois se conhecem mesmo que nunca tenham
-- trocado mensagem ali. Contato salvo e prova de relacionamento; e o sinal que
-- faltava.
--
-- ESCOPO, honesto: isto cobre WhatsApp e agenda. Quem foi trabalhado so por
-- ligacao, e nunca virou contato salvo nem conversa, continua invisivel para
-- qualquer verificacao automatica -- nao existe onde ler.

create table if not exists public.wa_conhecido (
  corretor_id  bigint not null,
  telefone     text   not null,
  fonte        text   not null,           -- 'conversa' | 'agenda'
  nome_no_wpp  text,
  ultima_troca timestamptz,               -- so para 'conversa'
  visto_em     timestamptz not null default now(),
  primary key (corretor_id, telefone)
);

create index if not exists wa_conhecido_tel on public.wa_conhecido (telefone);
alter table public.wa_conhecido enable row level security;

comment on table public.wa_conhecido is
  'Telefones que o aparelho de cada corretor conhece -- conversa aberta ou contato salvo na agenda. Lido do WhatsApp dele pela D-API, sem participacao dele. Alimenta a regra da voz nova.';

-- Gravacao em lote.
--
-- O `group by telefone` nao e enfeite: dois contatos diferentes da agenda viram
-- o MESMO numero depois de normalizados (o classico contato salvo com e sem o
-- nono digito), e o Postgres recusa o lote INTEIRO com "ON CONFLICT DO UPDATE
-- command cannot affect row a second time". Na primeira execucao isso derrubou
-- a gravacao de 5 das 9 instancias. Deduplicar antes de inserir e a correcao;
-- fica com o sinal mais forte (conversa > agenda) e a troca mais recente.
create or replace function public.wa_conhecido_gravar(p_corretor_id bigint, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_n int := 0;
begin
  with bruto as (
    select public.telefone_br_normalizado(x->>'telefone') as telefone,
           coalesce(x->>'fonte', 'agenda') as fonte,
           nullif(x->>'nome','') as nome,
           nullif(x->>'ultima_troca','')::timestamptz as ultima_troca
      from jsonb_array_elements(p_itens) x
  ), limpo as (
    select telefone,
           case when bool_or(fonte = 'conversa') then 'conversa' else 'agenda' end as fonte,
           max(nome) as nome,
           max(ultima_troca) as ultima_troca
      from bruto where telefone is not null
     group by telefone
  )
  insert into public.wa_conhecido (corretor_id, telefone, fonte, nome_no_wpp, ultima_troca, visto_em)
  select p_corretor_id, telefone, fonte, nome, ultima_troca, now() from limpo
  on conflict (corretor_id, telefone) do update
     set visto_em = now(),
         fonte = case when public.wa_conhecido.fonte = 'conversa' then 'conversa' else excluded.fonte end,
         nome_no_wpp = coalesce(excluded.nome_no_wpp, public.wa_conhecido.nome_no_wpp),
         ultima_troca = greatest(public.wa_conhecido.ultima_troca, excluded.ultima_troca);
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'gravados', v_n);
end $function$;

-- A regra da voz nova passa a ler a agenda do aparelho -- e essa fonte vem
-- primeiro de proposito: e a unica que nao depende do que o ERP sincronizou.
create or replace function public.f2_corretores_com_historico(p_telefone text)
returns setof bigint language sql stable security definer set search_path to 'public'
as $function$
with alvo as (
  select right(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'), 8) as ult8
), ids as (
  select l.id from leads l, alvo a
   where length(a.ult8) = 8
     and right(regexp_replace(coalesce(l.telefone,''), '\D', '', 'g'), 8) = a.ult8
), fontes as (
  -- O APARELHO DO CORRETOR: conversa aberta ou contato salvo na agenda.
  select k.corretor_id as cid from wa_conhecido k, alvo a
   where length(a.ult8) = 8 and right(regexp_replace(k.telefone, '\D', '', 'g'), 8) = a.ult8
  union
  select i.corretor_id
    from alvo a
    join wa_contatos ct on right(regexp_replace(coalesce(ct.telefone,''), '\D', '', 'g'), 8) = a.ult8
    join wa_conversas cv on cv.contato_id = ct.id
    join wa_mensagens m  on m.conversa_id = cv.id and not coalesce(m.is_grupo, false)
    join wa_instancias i on i.id = cv.instancia_id
   where length(a.ult8) = 8
  union
  select i.corretor_id
    from alvo a
    join wa_contatos ct on right(regexp_replace(coalesce(ct.telefone,''), '\D', '', 'g'), 8) = a.ult8
    join wa_conversas cv on cv.contato_id = ct.id
    join wa_instancias i on i.id = cv.instancia_id
   where length(a.ult8) = 8
  union
  select b.corretor_id from f2_voz_nova_bloqueio b, alvo a
   where length(a.ult8) = 8 and right(regexp_replace(b.telefone, '\D', '', 'g'), 8) = a.ult8
  union
  select d.para from lead_dono_auditoria d where d.lead_id in (select id from ids)
  union
  select f.corretor_id from f2_lead f, alvo a
   where length(a.ult8) = 8 and right(regexp_replace(coalesce(f.telefone,''), '\D', '', 'g'), 8) = a.ult8
  union
  select n.corretor_id from negocios n where n.lead_id in (select id from ids)
  union
  select x.corretor_id from crm_atividades x    where x.lead_id in (select id from ids)
  union
  select x.corretor_id from atendimento_acoes x where x.lead_id in (select id from ids)
  union
  select x.corretor_id from crm_tarefas x       where x.lead_id in (select id from ids)
  union
  select x.corretor_id from visitas x           where x.lead_id in (select id from ids)
  union
  select x.corretor_id from lead_momentos x     where x.lead_id in (select id from ids)
  union
  select x.corretor_id from negocio_estagio_historico x where x.lead_id in (select id from ids)
  union
  select x.corretor_id from ia_notas_atendimento x, alvo a
   where x.lead_id in (select id from ids)
      or (length(a.ult8) = 8 and right(regexp_replace(coalesce(x.telefone,''), '\D', '', 'g'), 8) = a.ult8)
)
select distinct cid from fontes where cid is not null;
$function$;

-- De duas em duas horas. A agenda de um corretor nao muda de minuto em minuto,
-- e cada execucao sao duas leituras por instancia conectada -- barato o
-- suficiente para manter, caro demais para rodar a cada tick.
select cron.schedule('wa-agenda-do-corretor', '17 */2 * * *', $j$
  select net.http_post(
    url := 'https://diaegvfveqezispcthwk.supabase.co/functions/v1/wa-agenda-do-corretor',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-envio-interno', (select decrypted_secret from vault.decrypted_secrets where name='ncrm_envio_interno_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$j$) where not exists (select 1 from cron.job where jobname = 'wa-agenda-do-corretor');
