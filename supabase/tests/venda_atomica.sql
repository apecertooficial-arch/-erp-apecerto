-- Teste de venda_criar / venda_excluir (migration 20260916120000_fase2_venda_atomica).
--
-- SEGURO PARA RODAR EM PRODUÇÃO: tudo acontece entre BEGIN e ROLLBACK. Nada fica
-- gravado. Pré-requisito: a migration aplicada — ou cole o conteúdo dela logo
-- depois do BEGIN abaixo (DDL no Postgres é transacional e sai no ROLLBACK).
--
-- Roda como `authenticated`, com o JWT de um admin ativo (e depois de um
-- corretor), para que a RLS valha exatamente como na chamada da rota.
-- Resultado: a última consulta devolve uma linha por verificação (ok = true).

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (lidas como dono, antes de trocar de papel)
-- ---------------------------------------------------------------------------
create temp table _fx on commit drop as
select
  (select id from public.usuarios where role::text = 'admin' and ativo order by id limit 1)                    as admin_id,
  (select id from public.usuarios where role::text = 'corretor' and ativo order by id limit 1)                 as corretor_user_id,
  (select id from public.usuarios where role::text = 'corretor' and ativo order by id offset 1 limit 1)        as corretor2_user_id,
  (select id from public.negocios where venda_id is null order by id limit 1)                                   as negocio_id,
  (select id from public.negocios where venda_id is null order by id offset 1 limit 1)                          as negocio2_id;

create temp table _r (ordem serial, caso text, ok boolean, detalhe text) on commit drop;
grant select on _fx to authenticated;
grant all on _r to authenticated;
grant usage on sequence _r_ordem_seq to authenticated;

select set_config('request.jwt.claims',
  json_build_object('sub', (select admin_id from _fx), 'role', 'authenticated')::text, true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Sucesso: arredondamento, rateio no banco, vínculo com negócio, auditoria
-- ---------------------------------------------------------------------------
do $$
declare
  fx record; r jsonb; v uuid; req uuid := '00000000-0000-4000-8000-000000000001';
  aud_antes integer;
begin
  select * into fx from _fx;
  select count(*) into aud_antes from public.erp_auditoria where modulo = 'financeiro' and entidade = 'venda';
  r := public.venda_criar(jsonb_build_object(
    'request_id', req,
    'data_venda', '2026-09-16',
    'vgv', 500000.004,
    'percentual', 4.5,
    'custos', 10.005,
    'status', 'pendente',
    'obs', 'TESTE venda_atomica',
    'negocio_id', fx.negocio_id,
    'corretores', jsonb_build_array(
      jsonb_build_object('corretor_id', fx.corretor_user_id,  'corretor_nome', 'A', 'fracao', 0.6),
      jsonb_build_object('corretor_id', fx.corretor2_user_id, 'corretor_nome', 'B', 'fracao', 0.4)),
    'comissoes', jsonb_build_array(
      jsonb_build_object('papel', 'corretor', 'valor', 9000.005, 'ratear', true),
      jsonb_build_object('papel', 'apecerto', 'valor', 13499.99)),
    'recebimentos', jsonb_build_array(jsonb_build_object('numero_parcela', 1, 'valor', 22500, 'data_prevista', '2026-10-01')),
    'repasses', jsonb_build_array(jsonb_build_object('beneficiario_id', fx.corretor_user_id, 'papel', 'corretor', 'valor', 5400.01, 'ordem', 1, 'status', 'previsto'))
  ));
  v := (r->>'venda_id')::uuid;
  insert into _r (caso, ok, detalhe) values
    ('1.1 sucesso: retorno', (r->>'ok')::boolean and not (r->>'idempotente')::boolean and (r->>'comissao_bruta')::numeric = 22500.00 and (r->>'comissao_distribuida')::numeric = 22500.00, r::text),
    ('1.2 sucesso: vgv/custos/percentual arredondados', exists (select 1 from public.vendas where id = v and vgv = 500000.00 and custos = 10.01 and percentual_comissao = 0.045 and scale(vgv) <= 2),
       (select jsonb_build_object('vgv', vgv, 'custos', custos, 'pct', percentual_comissao)::text from public.vendas where id = v)),
    ('1.3 sucesso: 2 corretores, rateio = 1', (select count(*) = 2 and sum(fracao) = 1 from public.venda_corretores where venda_id = v), null),
    ('1.4 sucesso: comissão de corretor rateada no banco 60/40 com centavo exato',
       (select array_agg(valor_final order by valor_final desc) = array[5400.01, 3600.00]::numeric[] from public.comissoes where venda_id = v and papel = 'corretor'),
       (select string_agg(valor_final::text, ', ') from public.comissoes where venda_id = v and papel = 'corretor')),
    ('1.5 sucesso: soma das comissões = bruta, 2 casas', (select sum(valor_final) = 22500.00 and bool_and(scale(valor_final) <= 2) from public.comissoes where venda_id = v), null),
    ('1.6 sucesso: parcela gravada', (select count(*) = 1 from public.recebimentos where venda_id = v), null),
    ('1.7 sucesso: repasse ligado à comissão do beneficiário', exists (select 1 from public.pagamentos_comissao p join public.comissoes c on c.id = p.comissao_id where p.venda_id = v and c.beneficiario_id = fx.corretor_user_id), null),
    ('1.8 sucesso: negócio vinculado', exists (select 1 from public.negocios where id = fx.negocio_id and venda_id = v), null),
    ('1.9 sucesso: auditoria registrada', (select count(*) from public.erp_auditoria where modulo = 'financeiro' and entidade = 'venda') = aud_antes + 1, null);

  -- 2. Idempotência
  r := public.venda_criar(jsonb_build_object('request_id', req, 'data_venda', '2026-09-16', 'vgv', 1));
  insert into _r (caso, ok, detalhe) values
    ('2 idempotência: mesmo request_id devolve a mesma venda', (r->>'idempotente')::boolean and (r->>'venda_id')::uuid = v
       and (select count(*) from public.vendas where request_id = req) = 1, r::text);
end $$;

-- ---------------------------------------------------------------------------
-- 3..8. Rejeições: nada gravado
-- ---------------------------------------------------------------------------
reset role;
create temp table _casos_erro (caso text, esperado text, payload jsonb) on commit drop;
grant select on _casos_erro to authenticated;
insert into _casos_erro
select c.caso, c.esperado, c.payload
from _fx fx, lateral (values
  ('3 rateio ≠ 100%', 'VENDA_RATEIO:', jsonb_build_object('data_venda', '2026-09-16', 'vgv', 100000, 'percentual', 5,
     'corretores', jsonb_build_array(jsonb_build_object('corretor_id', fx.corretor_user_id, 'fracao', 0.5),
                                     jsonb_build_object('corretor_id', fx.corretor2_user_id, 'fracao', 0.4)))),
  ('4.1 comissão negativa', 'VENDA_VALOR_INVALIDO:', jsonb_build_object('data_venda', '2026-09-16', 'vgv', 100000, 'percentual', 5,
     'comissoes', jsonb_build_array(jsonb_build_object('papel', 'corretor', 'valor', -10)))),
  ('4.2 custos negativos', 'VENDA_VALOR_INVALIDO:', jsonb_build_object('data_venda', '2026-09-16', 'vgv', 100000, 'custos', -1)),
  ('4.3 VGV zero', 'VENDA_VALOR_INVALIDO:', jsonb_build_object('data_venda', '2026-09-16', 'vgv', 0)),
  ('4.4 parcela negativa', 'VENDA_VALOR_INVALIDO:', jsonb_build_object('data_venda', '2026-09-16', 'vgv', 100000,
     'recebimentos', jsonb_build_array(jsonb_build_object('valor', -5)))),
  ('5 papel inválido', 'VENDA_PAPEL_INVALIDO:', jsonb_build_object('data_venda', '2026-09-16', 'vgv', 100000, 'percentual', 5,
     'comissoes', jsonb_build_array(jsonb_build_object('papel', 'diretor', 'valor', 10)))),
  ('6.1 comissões acima da bruta', 'VENDA_COMISSAO_EXCEDE:', jsonb_build_object('data_venda', '2026-09-16', 'vgv', 100000, 'percentual', 5,
     'comissoes', jsonb_build_array(jsonb_build_object('papel', 'corretor', 'valor', 4000), jsonb_build_object('papel', 'apecerto', 'valor', 1000.01)))),
  ('6.2 comissão sem percentual', 'VENDA_COMISSAO_SEM_PERCENTUAL:', jsonb_build_object('data_venda', '2026-09-16', 'vgv', 100000,
     'comissoes', jsonb_build_array(jsonb_build_object('papel', 'corretor', 'valor', 10)))),
  ('6.3 repasse acima das comissões', 'VENDA_REPASSE_EXCEDE:', jsonb_build_object('data_venda', '2026-09-16', 'vgv', 100000, 'percentual', 5,
     'comissoes', jsonb_build_array(jsonb_build_object('papel', 'corretor', 'beneficiario_id', fx.corretor_user_id, 'valor', 100)),
     'repasses', jsonb_build_array(jsonb_build_object('papel', 'corretor', 'beneficiario_id', fx.corretor_user_id, 'valor', 100.01)))),
  ('6.4 data inválida', 'VENDA_DADOS_INVALIDOS:', jsonb_build_object('data_venda', '2026-02-31', 'vgv', 100000)),
  -- 7. Falha no MEIO: venda, corretores, comissões e parcelas já inseridos; o
  --    repasse aponta para usuário inexistente (FK) e explode na 5ª gravação.
  ('7 falha no meio (FK do repasse)', '23503', jsonb_build_object('data_venda', '2026-09-16', 'vgv', 100000, 'percentual', 5,
     'negocio_id', fx.negocio2_id,
     'corretores', jsonb_build_array(jsonb_build_object('corretor_id', fx.corretor_user_id, 'fracao', 1)),
     'comissoes', jsonb_build_array(jsonb_build_object('papel', 'corretor', 'valor', 5000, 'ratear', true)),
     'recebimentos', jsonb_build_array(jsonb_build_object('valor', 5000)),
     'repasses', jsonb_build_array(jsonb_build_object('papel', 'corretor', 'beneficiario_id', '00000000-0000-4000-8000-00000000dead', 'valor', 10))))
) as c(caso, esperado, payload);
set local role authenticated;

do $$
declare
  c record; req uuid; antes jsonb; depois jsonb; msg text; st text;
begin
  for c in select * from _casos_erro loop
    req := gen_random_uuid();
    select jsonb_build_object(
      'vendas', (select count(*) from public.vendas), 'corretores', (select count(*) from public.venda_corretores),
      'comissoes', (select count(*) from public.comissoes), 'recebimentos', (select count(*) from public.recebimentos),
      'repasses', (select count(*) from public.pagamentos_comissao), 'negocios_com_venda', (select count(*) from public.negocios where venda_id is not null),
      'auditoria', (select count(*) from public.erp_auditoria)) into antes;
    begin
      perform public.venda_criar(c.payload || jsonb_build_object('request_id', req));
      msg := 'NÃO deu erro'; st := null;
    exception when others then
      get stacked diagnostics msg = message_text, st = returned_sqlstate;
    end;
    select jsonb_build_object(
      'vendas', (select count(*) from public.vendas), 'corretores', (select count(*) from public.venda_corretores),
      'comissoes', (select count(*) from public.comissoes), 'recebimentos', (select count(*) from public.recebimentos),
      'repasses', (select count(*) from public.pagamentos_comissao), 'negocios_com_venda', (select count(*) from public.negocios where venda_id is not null),
      'auditoria', (select count(*) from public.erp_auditoria)) into depois;
    insert into _r (caso, ok, detalhe) values (
      c.caso || ' → erro e nada gravado',
      (msg like c.esperado || '%' or st = c.esperado) and antes = depois,
      coalesce(st, '') || ' | ' || msg || case when antes <> depois then ' | CONTAGENS MUDARAM ' || antes::text || ' → ' || depois::text else '' end);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Sem permissão (corretor) — RLS / regra de gestão
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', (select corretor_user_id from _fx), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare msg text;
begin
  begin
    perform public.venda_criar(jsonb_build_object('data_venda', '2026-09-16', 'vgv', 1000));
    msg := 'NÃO deu erro';
  exception when others then msg := sqlerrm; end;
  insert into _r (caso, ok, detalhe) values ('8.1 corretor não cria venda', msg like 'VENDA_SEM_PERMISSAO:%', msg);
  begin
    perform public.venda_excluir('00000000-0000-4000-8000-000000000001');
    msg := 'NÃO deu erro';
  exception when others then msg := sqlerrm; end;
  insert into _r (caso, ok, detalhe) values ('8.2 corretor não apaga venda', msg like 'VENDA_SEM_PERMISSAO:%', msg);
end $$;
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', (select admin_id from _fx), 'role', 'authenticated')::text, true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 9. Exclusão completa da venda do caso 1
-- ---------------------------------------------------------------------------
do $$
declare
  fx record; v uuid; r jsonb; lanc uuid; msg text;
begin
  select * into fx from _fx;
  select id into v from public.vendas where request_id = '00000000-0000-4000-8000-000000000001';
  -- simula a baixa de um repasse: lançamento de caixa amarrado à venda e ao repasse
  insert into public.lancamentos_caixa (data, tipo, categoria, descricao, valor, venda_id, origem, natureza)
  values ('2026-09-16', 'saida', 'Comissão paga', 'TESTE venda_atomica', 5400.01, v, 'erp', 'comissao_paga')
  returning id into lanc;
  update public.pagamentos_comissao set lancamento_id = lanc, status = 'pago', data_pagamento = '2026-09-16' where venda_id = v;

  r := public.venda_excluir(v);
  insert into _r (caso, ok, detalhe) values
    ('9.1 exclusão: retorno com contagens', (r->>'comissoes')::int = 3 and (r->>'recebimentos')::int = 1 and (r->>'repasses')::int = 1
        and (r->>'corretores')::int = 2 and (r->>'negocios_desvinculados')::int = 1 and (r->>'lancamentos_caixa_desvinculados')::int = 1, r::text),
    ('9.2 exclusão: nada sobra da venda',
        not exists (select 1 from public.vendas where id = v)
        and not exists (select 1 from public.venda_corretores where venda_id = v)
        and not exists (select 1 from public.comissoes where venda_id = v)
        and not exists (select 1 from public.recebimentos where venda_id = v)
        and not exists (select 1 from public.pagamentos_comissao where venda_id = v), null),
    ('9.3 exclusão: negócio volta a ficar sem venda', exists (select 1 from public.negocios where id = fx.negocio_id and venda_id is null), null),
    ('9.4 exclusão: lançamento de caixa preservado, só desvinculado', exists (select 1 from public.lancamentos_caixa where id = lanc and venda_id is null), null),
    ('9.5 exclusão: auditoria com retrato completo',
        exists (select 1 from public.erp_auditoria where acao = 'excluir' and entidade = 'venda' and entidade_id = v::text
                  and jsonb_array_length(antes->'comissoes') = 3 and jsonb_array_length(antes->'repasses') = 1
                  and jsonb_array_length(antes->'corretores') = 2), null);

  begin
    perform public.venda_excluir(v);
    msg := 'NÃO deu erro';
  exception when others then msg := sqlerrm; end;
  insert into _r (caso, ok, detalhe) values ('10 excluir de novo → não encontrada', msg like 'VENDA_NAO_ENCONTRADA:%', msg);
end $$;

reset role;
select ordem, caso, ok, detalhe from _r order by ordem;

rollback;
