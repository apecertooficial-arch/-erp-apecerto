-- P0 — identidade de entrada e proteção do dono na reincidência.
--
-- DRAFT NÃO APLICADO. Compilar e ensaiar em Postgres isolado antes de mover
-- para supabase/migrations. Não executar diretamente em produção.
--
-- Contrato:
--   * telefone e e-mail são chaves fortes; nome nunca une pessoas sozinho;
--   * se telefone e e-mail apontarem para leads diferentes, parar sem escolher;
--   * sem visita/negociação, a nova entrada pode voltar ao rodízio;
--   * com visita ou negociação ativa, preservar o dono anterior;
--   * preservar o dono não encerra a automação: o bloco seguinte (abordagem)
--     continua responsável pelo envio idempotente.

BEGIN;

CREATE OR REPLACE FUNCTION public.motor_materializar_entrada(p_lead jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  v_tel text:=pg_catalog.regexp_replace(
    pg_catalog.coalesce(p_lead->>'telefone',''),'\D','','g'
  );
  v_email text:=pg_catalog.lower(pg_catalog.nullif(pg_catalog.btrim(p_lead->>'email'),''));
  v_nome text:=pg_catalog.nullif(pg_catalog.btrim(p_lead->>'nome'),'');
  v_ids bigint[];
  v_id bigint;
BEGIN
  IF v_tel='' AND v_email IS NULL THEN
    RAISE EXCEPTION USING errcode='22023',message='LEAD_WITHOUT_STRONG_CONTACT';
  END IF;

  -- Ordem fixa evita deadlock quando duas entradas compartilham as duas chaves.
  IF v_tel<>'' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('motor_ingresso:telefone:'||v_tel,0)
    );
  END IF;
  IF v_email IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('motor_ingresso:email:'||v_email,0)
    );
  END IF;

  SELECT pg_catalog.array_agg(DISTINCT l.id ORDER BY l.id)
    INTO v_ids
    FROM public.leads l
   WHERE (v_tel<>'' AND pg_catalog.regexp_replace(
            pg_catalog.coalesce(l.telefone,''),'\D','','g'
          )=v_tel)
      OR (v_email IS NOT NULL AND pg_catalog.lower(pg_catalog.btrim(l.email))=v_email);

  IF pg_catalog.coalesce(pg_catalog.cardinality(v_ids),0)>1 THEN
    -- Não inclui telefone, e-mail ou nome na exceção/log.
    RAISE EXCEPTION USING errcode='P0001',message='LEAD_IDENTITY_CONFLICT';
  END IF;

  v_id:=v_ids[1];
  IF v_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.leads l
     WHERE l.id=v_id
       AND (
         (v_tel<>''
          AND pg_catalog.regexp_replace(pg_catalog.coalesce(l.telefone,''),'\D','','g')<>''
          AND pg_catalog.regexp_replace(pg_catalog.coalesce(l.telefone,''),'\D','','g')<>v_tel)
         OR (v_email IS NOT NULL
             AND pg_catalog.nullif(pg_catalog.lower(pg_catalog.btrim(l.email)),'') IS NOT NULL
             AND pg_catalog.lower(pg_catalog.btrim(l.email))<>v_email)
       )
  ) THEN
    RAISE EXCEPTION USING errcode='P0001',message='LEAD_IDENTITY_DIVERGENCE';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.leads(nome,telefone,email,origem,status)
    VALUES(
      pg_catalog.coalesce(v_nome,'Lead'),pg_catalog.nullif(v_tel,''),v_email,
      pg_catalog.coalesce(pg_catalog.nullif(pg_catalog.btrim(p_lead->>'origem'),''),'automacao'),
      'novo'
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN pg_catalog.coalesce(p_lead,'{}'::jsonb)
    ||pg_catalog.jsonb_build_object('__lead_id',v_id);
END
$fn$;

REVOKE ALL ON FUNCTION public.motor_materializar_entrada(jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.motor_materializar_entrada(jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION private.motor_motivo_protecao_dono(
  p_lead_id bigint,
  p_protecao jsonb
) RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  v_protecao jsonb:=pg_catalog.coalesce(p_protecao,'[]'::jsonb);
BEGIN
  IF v_protecao ? 'sempre' THEN
    RETURN 'protecao total ativada no bloco';
  END IF;

  -- `venda` permanece como alias compatível para mapas já publicados.
  IF (v_protecao ? 'negociacao' OR v_protecao ? 'venda') AND (
    EXISTS (
      SELECT 1
        FROM public.f2_negociacao fn
        JOIN public.f2_lead f ON f.id=fn.funil_lead_id
       JOIN public.negocios n ON n.id=f.origem_negocio_id
       WHERE n.lead_id=p_lead_id
         AND f.descartado_em IS NULL
         AND fn.etapa<>'perdida'
    )
    OR EXISTS (
      SELECT 1
       FROM public.negocios n
       WHERE n.lead_id=p_lead_id
         AND (n.venda_id IS NOT NULL OR pg_catalog.lower(pg_catalog.coalesce(n.status,''))='ganho')
    )
  ) THEN
    RETURN 'negociacao ativa';
  END IF;

  IF (v_protecao ? 'visita_agendada' OR v_protecao ? 'visita_realizada') AND (
    EXISTS (
      SELECT 1
        FROM public.f2_visita fv
        JOIN public.f2_lead f ON f.id=fv.funil_lead_id
        JOIN public.negocios n ON n.id=f.origem_negocio_id
       WHERE n.lead_id=p_lead_id
         AND f.descartado_em IS NULL
         AND (
           (v_protecao ? 'visita_agendada' AND fv.status IN ('agendada','confirmada'))
           OR (v_protecao ? 'visita_realizada' AND fv.status='realizada')
         )
    )
    OR EXISTS (
      SELECT 1
        FROM public.visitas vi
       WHERE (vi.lead_id=p_lead_id OR vi.negocio_id IN (
              SELECT n.id FROM public.negocios n
               WHERE n.lead_id=p_lead_id
            ))
         AND (
           (v_protecao ? 'visita_agendada' AND vi.status IN ('agendada','confirmada'))
           OR (v_protecao ? 'visita_realizada' AND vi.status='realizada')
         )
    )
  ) THEN
    RETURN 'visita protegida';
  END IF;

  RETURN NULL;
END
$fn$;

REVOKE ALL ON FUNCTION private.motor_motivo_protecao_dono(bigint,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.motor_motivo_protecao_dono(bigint,jsonb)
  TO service_role;

-- Adiciona a autoridade canônica sem reescrever a função de roleta inteira.
-- O ensaio isolado deve comparar pg_get_functiondef antes/depois e abortar se
-- a âncora divergir do commit/baseline verificado.
DO $patch$
DECLARE
  v_oid regprocedure:='public.motor_roleta(bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb)'::regprocedure;
  v_def text;
  v_new text;
  v_anchor text:=E') then\n    if coalesce(p_protecao,''[]''::jsonb) ? ''sempre'' then';
  v_insert text:=E') then\n    v_motivo:=private.motor_motivo_protecao_dono(p_lead_id,p_protecao);\n    v_proteger:=v_motivo is not null;\n    if coalesce(p_protecao,''[]''::jsonb) ? ''sempre'' then';
BEGIN
  SELECT pg_catalog.pg_get_functiondef(v_oid::oid) INTO v_def;
  IF position('private.motor_motivo_protecao_dono' IN v_def)>0 THEN
    RETURN;
  END IF;
  IF position(v_anchor IN v_def)=0 THEN
    RAISE EXCEPTION 'motor_roleta_anchor_divergente';
  END IF;
  v_new:=pg_catalog.replace(v_def,v_anchor,v_insert);
  IF v_new=v_def OR position('private.motor_motivo_protecao_dono' IN v_new)=0 THEN
    RAISE EXCEPTION 'motor_roleta_patch_nao_aplicado';
  END IF;
  EXECUTE v_new;
END
$patch$;

-- Validação mínima do artefato compilado. O teste comportamental deve ainda
-- cobrir: sem proteção redistribui; visita protege; negociação protege; conflito
-- de identidade para; e retorno protegido continua no nextBlockId da abordagem.
DO $check$
DECLARE v_def text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.motor_roleta(bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb)'::regprocedure::oid
  ) INTO v_def;
  IF position('private.motor_motivo_protecao_dono' IN v_def)=0 THEN
    RAISE EXCEPTION 'motor_roleta_sem_protecao_canonica';
  END IF;
END
$check$;

COMMIT;
