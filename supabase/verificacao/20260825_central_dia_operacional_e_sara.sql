-- Somente leitura. Execute depois da migracao e dos deploys.

select public.motor_periodo_distribuicao(
  '{"modo":"dia-operacional","inicio":"09:30","fim":"18:30"}'::jsonb,
  timestamptz '2026-08-25 08:00:00-03'
) as antes_da_abertura;

select public.motor_periodo_distribuicao(
  '{"modo":"dia-operacional","inicio":"09:30","fim":"18:30"}'::jsonb,
  timestamptz '2026-08-25 10:00:00-03'
) as janela_oficial;

select public.motor_periodo_distribuicao(
  '{"modo":"dia-operacional","inicio":"09:30","fim":"18:30"}'::jsonb,
  timestamptz '2026-08-25 19:00:00-03'
) as depois_do_fechamento;

select a.nome,a.versao_publicada_id,
       b#>'{options,distribuicao,regraElegibilidade}' as regra_elegibilidade
  from public.automacoes a
  cross join lateral jsonb_array_elements(a.mapa#>'{automation,blocks}') b
 where a.nome in ('Entrada Adelmo','Entrada Miruna')
   and b->>'type'='distribution-simple'
 order by a.nome;

select a.nome,f.status,count(*) as quantidade,
       min(f.criado_em) as primeiro,max(f.criado_em) as ultimo
  from public.motor_fila f join public.automacoes a on a.id=f.automacao_id
 where a.nome in ('Entrada Adelmo','Entrada Miruna')
   and f.criado_em>=timestamptz '2026-08-25 00:00:00-03'
 group by a.nome,f.status order by a.nome,f.status;

select status,count(*) as analises,
       count(*) filter(where aplicada_em is not null) as aplicadas,
       min(analisado_em) as primeira,max(analisado_em) as ultima
  from public.f2_sara_analise
 where analisado_em>=timestamptz '2026-08-25 00:00:00-03'
 group by status order by status;
