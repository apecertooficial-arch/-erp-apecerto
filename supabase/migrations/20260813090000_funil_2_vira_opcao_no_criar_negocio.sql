-- Funil 2.0 vira uma opcao normal no "Criar negocio": escolhe o funil, escolhe a etapa.
--
-- JA APLICADA EM PRODUCAO em 04/08/2026. Espelho fiel do banco (item 12 do contrato).
--
-- POR QUE ASSIM
-- negocios.pipeline_id e NOT NULL: todo negocio precisa de um funil. A tentativa
-- anterior criou um seletor paralelo so para o Funil 2.0 dentro de uma acao propria -
-- ficou confuso e expunha o negocio-ancora, que e detalhe de implementacao.
--
-- Agora o Funil 2.0 EXISTE como funil de verdade, com as 4 etapas dele. O dropdown
-- de "Criar negocio" o mostra sozinho, as etapas aparecem sozinhas, e o front nao
-- precisa de nenhum caso especial. Um modulo so, como deve ser.
--
-- O vinculo entre a etapa do funil e a etapa do Funil 2.0 fica em
-- pipeline_stages.chave, coluna que ja existia exatamente para isso.
--
-- ROLLBACK
--   DELETE FROM pipeline_stages WHERE pipeline_id = public.f2_pipeline_id();
--   DELETE FROM pipelines WHERE nome = 'Funil 2.0';   -- so se nao houver negocio nele
--   DROP FUNCTION IF EXISTS public.f2_pipeline_id();
--   -- e remover o bloco f2_pipeline_id() do ramo create-business-action de motor_acoes.

INSERT INTO pipelines(nome, grupo, ordem)
SELECT 'Funil 2.0', 'Operação', 0
 WHERE NOT EXISTS (SELECT 1 FROM pipelines WHERE nome = 'Funil 2.0');

INSERT INTO pipeline_stages(pipeline_id, nome, ordem, tipo, chave, rotulo)
SELECT p.id, e.rotulo, e.ordem, 'aberto', e.codigo, e.rotulo
  FROM pipelines p
  CROSS JOIN f2_etapa_config e
 WHERE p.nome = 'Funil 2.0'
   AND coalesce(e.ativo, true)
   AND NOT EXISTS (
     SELECT 1 FROM pipeline_stages s WHERE s.pipeline_id = p.id AND s.chave = e.codigo
   );

CREATE OR REPLACE FUNCTION public.f2_pipeline_id()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT id FROM pipelines WHERE nome = 'Funil 2.0' LIMIT 1; $function$;

-- motor_acoes: criou negocio no Funil 2.0 -> cria tambem o card, na etapa da chave.
-- Insere um bloco no fim do ramo create-business-action. Idempotente.
DO $mig$
DECLARE d text; ancora text := 'elsif act_name=''move-business-action'' then'; bloco text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='motor_acoes';
  IF d IS NULL THEN RAISE EXCEPTION 'motor_acoes nao encontrada'; END IF;

  IF position('f2_pipeline_id()' in d) > 0 THEN
    RAISE NOTICE 'ponte do Funil 2.0 ja existe em create-business-action';
    RETURN;
  END IF;

  IF strpos(d, ancora) = 0 THEN
    RAISE EXCEPTION 'ancora move-business-action nao encontrada';
  END IF;

  bloco := ' if v_negocio_id is not null and v_pipe is not distinct from public.f2_pipeline_id() then'
        || '   perform public.f2_entrada_direta(v_negocio_id,'
        || '     coalesce((select s.chave from pipeline_stages s'
        || '                where s.id = coalesce(v_stage,(select stage_id from negocios where id=v_negocio_id))),''novo''));'
        || '   insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)'
        || '   values(p_auto,p_nome,p_bloco,''acao'',''ok'',p_lead->>''nome'',v_tel,'
        || '     ''Funil 2.0: card criado para o negocio #''||v_negocio_id);'
        || ' end if;'
        || ' ';

  d := replace(d, ancora, bloco || ancora);
  EXECUTE d;
  RAISE NOTICE 'ponte do Funil 2.0 adicionada ao create-business-action';
END
$mig$;
