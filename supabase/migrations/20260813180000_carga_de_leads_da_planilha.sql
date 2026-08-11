-- CARGA DE LEADS DE PLANILHA, ENTREGUE NO RITMO DA OPERACAO
--
-- O PROBLEMA QUE ISTO RESOLVE. Chega uma planilha com centenas de leads. Jogar
-- tudo de uma vez na roleta entrega 60 leads para o mesmo corretor em cinco
-- minutos -- ele nao liga para nenhum, e a planilha inteira vira carteira morta
-- no primeiro dia. A carga existe para transformar um arquivo em uma fila que
-- pinga no ritmo em que um corretor consegue trabalhar.
--
-- ESTE ARQUIVO E UM ACERTO DE CONTAS. As funcoes aqui foram aplicadas direto em
-- producao durante a operacao de 11/08 (a regra da casa permite escrita direta
-- no Supabase de producao) e ficaram sem versao no repositorio. Sem isto,
-- qualquer reset de banco recriaria um ERP que distribui leads sem nenhuma das
-- travas abaixo -- que e exatamente o estado que causou o incidente. O conteudo
-- foi extraido do proprio banco, nao reescrito de memoria.

create table if not exists public.f2_carga_lead (
  id             bigserial primary key,
  lote           text not null,
  linha          integer,
  nome           text not null,
  telefone       text not null,
  telefone_dig   text,
  email          text,
  origem         text,
  extras         jsonb not null default '{}'::jsonb,
  quando         timestamptz,
  distribuido_em timestamptz,
  lead_id        bigint,
  negocio_id     bigint,
  corretor_id    bigint,
  corretor_nome  text,
  situacao       text not null default 'pendente',
  motivo         text,
  criado_em      timestamptz not null default now()
);

create index if not exists f2_carga_lead_fila
  on public.f2_carga_lead (lote, distribuido_em, quando) where distribuido_em is null;
create index if not exists f2_carga_lead_tel
  on public.f2_carga_lead (telefone_dig);

alter table public.f2_carga_lead enable row level security;

create or replace view public.f2_carga_resumo as
  select lote, situacao, count(*) as leads,
         min(quando) as primeiro_agendado, max(quando) as ultimo_agendado,
         min(distribuido_em) as primeiro_feito, max(distribuido_em) as ultimo_feito
    from public.f2_carga_lead
   group by lote, situacao;

-- NORMALIZACAO DE TELEFONE BRASILEIRO.
--
-- A decisao central esta no fim: com 14 digitos ou mais a funcao devolve NULL
-- em vez de tentar consertar. Nao da para saber QUAL digito sobra, e cada chute
-- aqui entrega o telefone de um estranho para um corretor ligar. Recusar e mais
-- barato do que acertar por sorte.
create or replace function public.telefone_br_normalizado(p_tel text)
returns text language plpgsql immutable
as $function$
declare d text; ddd text; resto text;
begin
  d := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
  if d = '' then return null; end if;

  -- tira o zero de operadora na frente (0xx) antes de qualquer coisa
  if length(d) in (11, 12) and left(d, 1) = '0' then d := substring(d, 2); end if;

  -- ja no formato internacional completo
  if length(d) = 13 and left(d, 2) = '55' then
    ddd := substring(d, 3, 2);
    if ddd < '11' or ddd > '99' then return null; end if;
    if substring(d, 5, 1) <> '9' then return null; end if;   -- celular exige o nono
    return d;
  end if;

  -- 55 + DDD + 8 digitos: celular antigo, sem o nono digito
  if length(d) = 12 and left(d, 2) = '55' then
    ddd := substring(d, 3, 2); resto := substring(d, 5);
    if ddd < '11' or ddd > '99' then return null; end if;
    -- so celular ganha o nono; fixo (2 a 5) o WhatsApp nao atende mesmo
    if left(resto, 1) not in ('6','7','8','9') then return null; end if;
    return '55' || ddd || '9' || resto;
  end if;

  -- DDD + 9 digitos, sem o codigo do pais
  if length(d) = 11 then
    ddd := substring(d, 1, 2);
    if ddd < '11' or ddd > '99' then return null; end if;
    if substring(d, 3, 1) <> '9' then return null; end if;
    return '55' || d;
  end if;

  -- DDD + 8 digitos: falta o pais E o nono
  if length(d) = 10 then
    ddd := substring(d, 1, 2); resto := substring(d, 3);
    if ddd < '11' or ddd > '99' then return null; end if;
    if left(resto, 1) not in ('6','7','8','9') then return null; end if;
    return '55' || ddd || '9' || resto;
  end if;

  -- 14 digitos ou mais nao da para consertar com honestidade: nao da para
  -- saber QUAL digito sobra. Chutar aqui e entregar o numero de outra pessoa.
  return null;
end $function$;

-- MEMORIA DE NUMERO MORTO. Quando um corretor descarta por "Contato inválido",
-- o WhatsApp ja disse a ele que o numero nao existe. Guardar isso impede que o
-- mesmo numero volte pela fila e queime o tempo do proximo corretor.
-- Compara pelos ultimos 8 digitos porque o nono varia entre as bases.
create or replace view public.telefones_sem_whatsapp as
  select distinct right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 8) as ult8,
         min(descartado_em) as primeira_prova
    from public.f2_lead f
   where descartado_em is not null
     and descarte_motivo = 'Contato inválido'
     and length(regexp_replace(coalesce(telefone, ''), '\D', '', 'g')) >= 8
   group by right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 8);

-- REGRA DA VOZ NOVA: quem ja falou com este cliente nao recebe ele de novo.
-- Um cliente que nao respondeu a Kapri em junho nao responde a Kapri em agosto;
-- ele responde a outra pessoa. Grupo fica de fora -- conversa de grupo nao e
-- relacionamento com o lead.
create or replace function public.f2_corretores_com_historico(p_telefone text)
returns setof bigint language sql stable security definer set search_path to 'public'
as $function$
  select distinct i.corretor_id
    from wa_contatos ct
    join wa_conversas cv on cv.contato_id = ct.id
    join wa_mensagens m  on m.conversa_id = cv.id and not coalesce(m.is_grupo, false)
    join wa_instancias i on i.id = cv.instancia_id
   where i.corretor_id is not null
     and length(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g')) >= 8
     and right(regexp_replace(coalesce(ct.telefone,''), '\D', '', 'g'), 8)
       = right(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'), 8);
$function$;

-- A ROLETA COM EXCLUSAO. Mesma logica sequencial da automacao (respeita quem
-- esta marcado, quem esta ativo e quem esta apto), so que podendo pular uma
-- lista de corretores.
--
-- A LINHA QUE IMPORTA e a que zera v_ex quando ninguem sobra: se todos os aptos
-- ja falaram com o cliente, a regra da voz nova cai e o lead sai assim mesmo.
-- Lead entregue para quem ja falou e pior do que o ideal; lead parado na fila
-- para sempre e pior do que os dois.
create or replace function public.motor_proximo_sequencial_exceto(p_auto bigint, p_bloco text, p_excluir bigint[])
returns bigint language plpgsql security definer set search_path to 'public'
as $function$
declare v_total numeric; v_id bigint; v_marcados int; v_exige boolean;
        v_ex bigint[] := coalesce(p_excluir, '{}'::bigint[]);
        v_sobra int;
begin
  perform pg_advisory_xact_lock(hashtext(coalesce(p_auto,0)::text||':'||coalesce(p_bloco,'_')));

  v_exige := coalesce(public.distribuicao_exige_apto(p_auto, p_bloco), true);
  select count(*) into v_marcados from public.distribuicao_marcados(p_auto, p_bloco);

  if v_marcados > 0 then
    update motor_roleta_contadores rc set peso = 0
     where rc.automacao_id = p_auto and rc.bloco_id = p_bloco
       and coalesce(rc.peso,0) > 0
       and not exists (select 1 from public.distribuicao_marcados(p_auto, p_bloco) m
                        where m.corretor_id = rc.corretor_id);
    insert into motor_roleta_contadores(automacao_id, bloco_id, corretor_id, peso)
    select p_auto, p_bloco, m.corretor_id, m.peso
      from public.distribuicao_marcados(p_auto, p_bloco) m
    on conflict (automacao_id, bloco_id, corretor_id) do update set peso = excluded.peso;
  end if;

  -- Sobrou alguem depois da exclusao? Se nao, a exclusao cai: lead entregue
  -- para quem ja falou e melhor do que lead parado.
  select count(*) into v_sobra
    from motor_roleta_contadores rc join corretores c on c.id = rc.corretor_id
   where rc.automacao_id = p_auto and rc.bloco_id = p_bloco
     and coalesce(rc.peso,0) > 0 and coalesce(c.ativo,true)
     and (not v_exige or public.corretor_pode_receber(c.id))
     and not (rc.corretor_id = any(v_ex));
  if v_sobra = 0 then v_ex := '{}'::bigint[]; end if;

  select sum(rc.peso) into v_total
    from motor_roleta_contadores rc join corretores c on c.id = rc.corretor_id
   where rc.automacao_id = p_auto and rc.bloco_id = p_bloco
     and coalesce(rc.peso,0) > 0 and coalesce(c.ativo,true)
     and (not v_exige or public.corretor_pode_receber(c.id))
     and not (rc.corretor_id = any(v_ex));
  if coalesce(v_total,0) <= 0 then return null; end if;

  update motor_roleta_contadores rc
     set credito = rc.credito + rc.peso
    from corretores c
   where c.id = rc.corretor_id and rc.automacao_id = p_auto and rc.bloco_id = p_bloco
     and coalesce(rc.peso,0) > 0 and coalesce(c.ativo,true)
     and (not v_exige or public.corretor_pode_receber(c.id))
     and not (rc.corretor_id = any(v_ex));

  select rc.corretor_id into v_id
    from motor_roleta_contadores rc join corretores c on c.id = rc.corretor_id
   where rc.automacao_id = p_auto and rc.bloco_id = p_bloco
     and coalesce(rc.peso,0) > 0 and coalesce(c.ativo,true)
     and (not v_exige or public.corretor_pode_receber(c.id))
     and not (rc.corretor_id = any(v_ex))
   order by rc.credito desc, rc.recebidos asc, rc.corretor_id asc
   limit 1;
  if v_id is null then return null; end if;

  update motor_roleta_contadores
     set credito = credito - v_total, recebidos = recebidos + 1, atualizado_em = now()
   where automacao_id = p_auto and bloco_id = p_bloco and corretor_id = v_id;

  return v_id;
end $function$;

-- AGENDAMENTO DA FILA. Espalha as linhas pendentes pelos minutos uteis (dia de
-- semana, dentro do horario oficial) do intervalo pedido.
--
-- A trava do p_intervalo_min e o ponto: pedir "1 a cada 5 minutos" para mais
-- leads do que a janela comporta faria a fila estourar o prazo em silencio.
-- Quando o pedido nao cabe, o passo cai para o que cabe -- em vez de aceitar o
-- numero e entregar metade depois da data combinada.
create or replace function public.f2_carga_agendar(
  p_lote text, p_de timestamptz default now(),
  p_ate timestamptz default null, p_intervalo_min integer default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_tz text; v_h1 time; v_h2 time; v_min int; v_linhas int; v_ate timestamptz; v_passo int;
begin
  select timezone, horario_oficial_inicio, horario_oficial_fim
    into v_tz, v_h1, v_h2 from ncrm_operacao_config where id;
  v_ate := coalesce(p_ate, p_de + interval '7 days');

  select count(*) into v_linhas from f2_carga_lead
   where lote = p_lote and distribuido_em is null and situacao = 'pendente';
  if v_linhas = 0 then return jsonb_build_object('ok', false, 'erro', 'lote_sem_linhas_pendentes'); end if;

  create temporary table if not exists _minutos_uteis (k int, m timestamptz) on commit drop;
  delete from _minutos_uteis;

  insert into _minutos_uteis (k, m)
  select row_number() over (order by g), g
    from generate_series(date_trunc('minute', p_de), v_ate, interval '1 minute') g
   where (g at time zone v_tz)::time >= v_h1
     and (g at time zone v_tz)::time <  v_h2
     and extract(isodow from (g at time zone v_tz)) between 1 and 5;

  select count(*) into v_min from _minutos_uteis;
  if v_min = 0 then return jsonb_build_object('ok', false, 'erro', 'sem_minutos_uteis_no_intervalo'); end if;

  v_passo := coalesce(p_intervalo_min, greatest(1, v_min / v_linhas));
  if v_passo * v_linhas > v_min then v_passo := greatest(1, v_min / v_linhas); end if;

  with pend as (
    select id, row_number() over (order by coalesce(linha, id), id) as rn
      from f2_carga_lead
     where lote = p_lote and distribuido_em is null and situacao = 'pendente'
  ), alvo as (
    select p.id, least(v_min, 1 + (p.rn - 1) * v_passo) as k from pend p
  )
  update f2_carga_lead c
     set quando = d.m + make_interval(secs => floor(random() * 30)::int)
    from alvo a join _minutos_uteis d on d.k = a.k
   where c.id = a.id;

  return jsonb_build_object('ok', true, 'lote', p_lote, 'linhas', v_linhas,
    'intervalo_min', v_passo,
    'intervalo_pedido', p_intervalo_min,
    'minutos_uteis_disponiveis', v_min,
    'primeiro', (select min(quando) from f2_carga_lead where lote = p_lote and distribuido_em is null),
    'ultimo',   (select max(quando) from f2_carga_lead where lote = p_lote and distribuido_em is null));
end $function$;
