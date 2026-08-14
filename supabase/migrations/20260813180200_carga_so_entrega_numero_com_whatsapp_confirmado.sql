-- QUARTA TRAVA DA CARGA: NUMERO SEM VEREDITO NAO SAI.
--
-- O QUE ACONTECEU. Em 11/08 dez leads chegaram ao corretor com numero que o
-- WhatsApp recusa ("este numero nao existe"). Elizangela descartou os leads --
-- o custo nao foi so o tempo dela, foi o funil perder gente que talvez fosse
-- recuperavel, e a fila perder credibilidade com o time.
--
-- As travas que existiam nao alcancavam isso:
--   (a) formato   -- telefone_br_normalizado: pega o numero quebrado, nao o
--                    numero bem formado que simplesmente nao existe;
--   (b) historico -- telefones_sem_whatsapp: so sabe do numero DEPOIS que um
--                    corretor ja bateu nele. E aprendizado por dano.
--
-- Agora existe (c): a D-API responde se o numero esta no WhatsApp antes de
-- qualquer entrega (wa-varredura-numeros -> wa_numero_veredito).
--
-- A REGRA E FAIL-CLOSED, e essa e a decisao que importa aqui: sem veredito
-- gravado o lead NAO e distribuido -- ele espera a varredura. O contrario
-- (entregar na duvida) e exatamente o comportamento que produziu o problema.
-- O preco e a fila andar mais devagar quando a varredura atrasa; e o preco
-- certo, porque fila parada e visivel e reversivel, e lead descartado nao.
--
-- Muda tambem o criterio de selecao: o tick agora aceita 'aguardando_varredura'
-- junto com 'pendente'. Nao ha risco em juntar os dois, porque quem decide a
-- saida passou a ser o veredito, nao o rotulo da linha -- e um estado a menos
-- para alguem ter que lembrar de destravar na mao.

create or replace function public.f2_carga_tick(p_teto integer default 6)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record; v_auto bigint; v_bloco text;
  v_lead bigint; v_neg bigint; v_cor bigint; v_nome text; v_card uuid; v_tel text;
  v_tz text; v_h1 time; v_h2 time;
  v_ja bigint[]; v_pulou text; v_tem boolean;
  v_feitos int := 0; v_pulados int := 0; v_esperando int := 0; v_voz_nova int := 0;
  v_ruim int := 0; v_morto int := 0; v_sem_veredito int := 0; v_sem_wa int := 0;
begin
  select timezone, horario_oficial_inicio, horario_oficial_fim
    into v_tz, v_h1, v_h2 from ncrm_operacao_config where id;
  if not ((now() at time zone v_tz)::time >= v_h1 and (now() at time zone v_tz)::time < v_h2) then
    return jsonb_build_object('ok', true, 'acao', 'fora da janela oficial');
  end if;

  select me.automacao_id, me.bloco_id into v_auto, v_bloco
    from motor_execucoes me
   where me.evento = 'distribuicao' and me.automacao_id is not null
     and exists (select 1 from motor_roleta_contadores rc
                  where rc.automacao_id = me.automacao_id and rc.bloco_id = me.bloco_id)
   order by me.criado_em desc limit 1;
  if v_auto is null then return jsonb_build_object('ok', false, 'erro', 'sem_fila_configurada'); end if;

  for r in
    select * from f2_carga_lead
     where distribuido_em is null and situacao in ('pendente', 'aguardando_varredura')
       and quando is not null and quando <= now()
     order by quando, id
     limit greatest(1, least(coalesce(p_teto, 6), 30))
  loop
    v_lead := null; v_neg := null; v_card := null; v_pulou := null;

    -- (a) FORMATO
    v_tel := public.telefone_br_normalizado(r.telefone);
    if v_tel is null then
      update f2_carga_lead
         set situacao = 'telefone_invalido', distribuido_em = now(),
             motivo = 'telefone impossivel de normalizar (' || r.telefone || ')'
       where id = r.id;
      v_ruim := v_ruim + 1;
      continue;
    end if;

    -- (b) NUMERO JA PROVADO MORTO POR UM CORRETOR
    if exists (select 1 from public.telefones_sem_whatsapp t where t.ult8 = right(v_tel, 8)) then
      update f2_carga_lead
         set situacao = 'telefone_invalido', distribuido_em = now(), telefone = v_tel,
             motivo = 'telefone ja provado sem WhatsApp por corretor em entrega anterior'
       where id = r.id;
      v_morto := v_morto + 1;
      continue;
    end if;

    -- (c) VEREDITO DA D-API. Fail-closed: na duvida o lead espera, nao sai.
    select v.tem_whatsapp into v_tem
      from public.wa_numero_veredito v where v.telefone = v_tel;

    if v_tem is null then
      update f2_carga_lead
         set situacao = 'aguardando_varredura', telefone = v_tel,
             motivo = 'esperando a varredura confirmar que este numero tem WhatsApp'
       where id = r.id;
      v_sem_veredito := v_sem_veredito + 1;
      continue;
    end if;

    if v_tem = false then
      update f2_carga_lead
         set situacao = 'sem_whatsapp', distribuido_em = now(), telefone = v_tel,
             motivo = 'a D-API confirmou que este numero nao esta no WhatsApp'
       where id = r.id;
      v_sem_wa := v_sem_wa + 1;
      continue;
    end if;

    select l.id into v_lead from leads l
     where right(regexp_replace(coalesce(l.telefone,''), '\D', '', 'g'), 8) = right(v_tel, 8)
     order by l.id desc limit 1;

    if v_lead is not null and (
         exists (select 1 from leads l where l.id = v_lead and l.corretor_id is not null)
      or exists (select 1 from f2_lead f join negocios n on n.id = f.origem_negocio_id
                  where n.lead_id = v_lead and f.descartado_em is null)
    ) then
      update f2_carga_lead
         set situacao = 'pulado', distribuido_em = now(), lead_id = v_lead,
             motivo = 'ja tem dono ou card ativo no Funil 2.0',
             corretor_nome = (select c.nome from leads l join corretores c on c.id = l.corretor_id where l.id = v_lead)
       where id = r.id;
      v_pulados := v_pulados + 1;
      continue;
    end if;

    select coalesce(array_agg(x), '{}'::bigint[]) into v_ja
      from f2_corretores_com_historico(v_tel) x;

    v_cor := motor_proximo_sequencial_exceto(v_auto, v_bloco, v_ja);
    if v_cor is null then v_esperando := v_esperando + 1; continue; end if;
    select nome into v_nome from corretores where id = v_cor;

    if array_length(v_ja, 1) > 0 then
      if v_cor = any(v_ja) then
        v_pulou := 'todos os aptos ja falaram com o cliente; a regra da voz nova foi ignorada nesta entrega';
      else
        v_voz_nova := v_voz_nova + 1;
        v_pulou := 'pulou ' || (select string_agg(c.nome, ', ' order by c.nome)
                                  from corretores c where c.id = any(v_ja))
                   || ' — ja tinham conversa com este cliente';
      end if;
    end if;

    if v_lead is null then
      insert into leads (nome, telefone, email, origem, status, extras)
      values (r.nome, v_tel, nullif(r.email,''), coalesce(r.origem, 'planilha'), 'novo',
              coalesce(r.extras, '{}'::jsonb))
      returning id into v_lead;
    else
      update leads set telefone = v_tel
       where id = v_lead and coalesce(telefone,'') is distinct from v_tel;
    end if;

    select n.id into v_neg from negocios n
     where n.lead_id = v_lead and n.pipeline_id = f2_pipeline_id() and n.status = 'aberto'
     order by n.id desc limit 1;
    if v_neg is null then
      insert into negocios (lead_id, pipeline_id, stage_id, status, ultima_movimentacao, criado_em)
      values (v_lead, f2_pipeline_id(),
              (select s.id from pipeline_stages s where s.pipeline_id = f2_pipeline_id()
                order by s.ordem nulls last, s.id limit 1),
              'aberto', now(), now())
      returning id into v_neg;
    end if;

    update leads    set corretor_id = v_cor where id = v_lead;
    update negocios set corretor_id = v_cor where lead_id = v_lead and corretor_id is null;

    update leads
       set tags = coalesce((select jsonb_agg(t) from jsonb_array_elements(tags) t
                             where t->>'name' is distinct from 'Aquário'), '[]'::jsonb)
     where id = v_lead and tags @> '[{"name":"Aquário"}]'::jsonb;

    v_card := f2_entrada_direta(v_neg, 'novo');

    insert into lead_dono_auditoria(lead_id, de, para, origem, quando)
    values (v_lead, null, v_cor, 'carga_planilha:' || r.lote, now());

    insert into motor_execucoes(automacao_id, automacao_nome, bloco_id, evento, status,
                                lead_nome, lead_telefone, detalhe)
    values (v_auto, 'Carga de planilha ' || r.lote, v_bloco, 'distribuicao',
            case when v_card is null then 'alerta' else 'ok' end, r.nome, v_tel,
            case when v_card is null
                 then 'Lead da carga entregue a ' || coalesce(v_nome,'?') || ' — ATENCAO: card do Funil 2.0 nao foi criado'
                 else 'Lead da carga entregue a ' || coalesce(v_nome,'?') || ' e card criado no Funil 2.0' end
            || ' · numero confirmado no WhatsApp antes da entrega'
            || coalesce(' · ' || v_pulou, ''));

    update f2_carga_lead
       set situacao = 'distribuido', distribuido_em = now(), motivo = v_pulou, telefone = v_tel,
           lead_id = v_lead, negocio_id = v_neg, corretor_id = v_cor, corretor_nome = v_nome
     where id = r.id;
    v_feitos := v_feitos + 1;
  end loop;

  return jsonb_build_object('ok', true, 'distribuidos', v_feitos, 'pulados', v_pulados,
                            'esperando_corretor_apto', v_esperando,
                            'desviados_por_historico', v_voz_nova,
                            'barrados_por_formato', v_ruim,
                            'barrados_por_numero_morto', v_morto,
                            'barrados_sem_whatsapp', v_sem_wa,
                            'esperando_varredura', v_sem_veredito);
end $function$;

-- Entrega a cada 5 minutos dentro do horario oficial. O cron roda de minuto em
-- minuto com teto 1 de proposito: o espacamento real vem do campo `quando` de
-- cada linha, e rodar a cada minuto so serve para a fila se recuperar sozinha
-- depois de uma pausa, em vez de acumular atraso ate alguem perceber.
select cron.schedule('f2-carga-planilha', '* * * * *', 'select public.f2_carga_tick(1);')
 where not exists (select 1 from cron.job where jobname = 'f2-carga-planilha');
