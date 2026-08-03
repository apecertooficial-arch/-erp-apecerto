-- Rollback lógico da operação v4. Restaura os corpos exatos e os catálogos
-- ativos capturados antes da migration. Não apaga atendimento operacional.
BEGIN;

DO $restore$
DECLARE r record;
BEGIN
  FOR r IN SELECT payload->>'definicao' AS definicao
    FROM public.ncrm_operacao_v4_backup WHERE chave LIKE 'funcao:%'
  LOOP EXECUTE r.definicao; END LOOP;
END $restore$;

-- CREATE OR REPLACE preserva a ACL da versão nova. Esta função era chamada
-- pelo fluxo autenticado antes da migration; restaure também a permissão.
REVOKE ALL ON FUNCTION public.corretor_pode_receber(bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.corretor_pode_receber(bigint) TO authenticated,service_role;

DROP FUNCTION IF EXISTS public.ncrm_atualizar_momento(bigint,integer,text,text);
DROP FUNCTION IF EXISTS public.ncrm_fila_trabalho_v4(text,bigint,int);
DROP FUNCTION IF EXISTS public.ncrm_sara_aplicar_conduta_automatica(bigint,bigint,text,text);
DROP TRIGGER IF EXISTS ncrm_estado_prazo_lead_novo ON public.ncrm_estado;
DROP FUNCTION IF EXISTS ncrm_private.normalizar_prazo_lead_novo();
DROP FUNCTION IF EXISTS public.ncrm_primeira_abordagem_prazo(timestamptz);
DROP FUNCTION IF EXISTS public.ncrm_conduta_oficial_v4(text,text,boolean,boolean,integer,timestamptz);
DROP FUNCTION IF EXISTS public.ncrm_corretor_elegibilidade(bigint,timestamptz);

-- Remova primeiro a unicidade parcial da versão nova. Caso um momento antigo
-- e um momento 3.1 compartilhem a mesma ordem, reativar o antigo antes de
-- excluir o novo produziria colisão durante o próprio rollback.
DROP INDEX IF EXISTS public.ncrm_momento_padrao_ordem_ativa_idx;
UPDATE public.ncrm_momento_padrao m SET ativo=coalesce((
  SELECT b.payload ? m.codigo FROM public.ncrm_operacao_v4_backup b WHERE b.chave='momentos_ativos'),false);
DELETE FROM public.ncrm_momento_padrao m
WHERE NOT coalesce((SELECT b.payload ? m.codigo FROM public.ncrm_operacao_v4_backup b WHERE b.chave='momentos_ativos'),false);
ALTER TABLE public.ncrm_momento_padrao
  DROP COLUMN IF EXISTS acao_codigo,
  DROP COLUMN IF EXISTS sla_min,
  DROP COLUMN IF EXISTS ajuda;
ALTER TABLE public.ncrm_momento_padrao
  ADD CONSTRAINT ncrm_momento_padrao_etapa_key UNIQUE(etapa),
  ADD CONSTRAINT ncrm_momento_padrao_ordem_key UNIQUE(ordem),
  ADD CONSTRAINT ncrm_momento_padrao_ordem_check CHECK(ordem BETWEEN 1 AND 4);

UPDATE public.ncrm_acao_padrao a SET ativa=coalesce((
  SELECT b.payload ? a.codigo FROM public.ncrm_operacao_v4_backup b WHERE b.chave='acoes_ativas'),false);

UPDATE public.distribuicao_config d SET
  janela_inicio=((b.payload->'distribuicao'->>'janela_inicio')::time),
  janela_fim=((b.payload->'distribuicao'->>'janela_fim')::time),
  receber_ate=((b.payload->'distribuicao'->>'receber_ate')::time),atualizado_em=now()
FROM public.ncrm_operacao_v4_backup b WHERE d.id=1 AND b.chave='horarios';
UPDATE public.presenca_config p SET
  hora_inicio=((b.payload->'presenca'->>'hora_inicio')::time),
  hora_fim=((b.payload->'presenca'->>'hora_fim')::time),
  intervalo_min=((b.payload->'presenca'->>'intervalo_min')::integer),atualizado_em=now()
FROM public.ncrm_operacao_v4_backup b WHERE p.id=1 AND b.chave='horarios';
UPDATE public.ncrm_sla_redistribuicao_config s SET
  tolerancia_min=((b.payload->'sla'->>'tolerancia_min')::integer),atualizado_em=now()
FROM public.ncrm_operacao_v4_backup b WHERE s.id=true AND b.chave='horarios';

DROP INDEX IF EXISTS public.ncrm_estado_momento_acao_idx;
ALTER TABLE public.ncrm_estado DROP COLUMN IF EXISTS momento_codigo;
DROP TABLE IF EXISTS public.ncrm_corretor_suspensao;
DROP TABLE IF EXISTS public.ncrm_operacao_config;
DROP TABLE IF EXISTS public.ncrm_operacao_v4_backup;

COMMIT;
