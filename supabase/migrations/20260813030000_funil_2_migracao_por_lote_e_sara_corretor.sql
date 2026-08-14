-- Funil 2.0 — migração da carteira por lote + RLS da Sara para o corretor.
--
-- (1) f2_sara_analise so tinha policy de admin. No celular o corretor abria o
--     card e o resumo da Sara vinha vazio. Agora ele le a analise do proprio lead.
--
-- (2) f2_migrar_lote: migra a carteira aberta em grupos auditaveis, um de cada
--     vez, com dry_run. Uma regra unica (mapa de estagio -> etapa/momento) em
--     vez de dois caminhos, porque a Sara reclassifica o momento no tick
--     seguinte de qualquer forma.
--
-- REGRA DELIBERADA: migracao NUNCA cria etapa 'novo'.
--   a) o trigger de push so dispara em etapa='novo' — migrar em massa como novo
--      geraria centenas de notificacoes falsas no celular dos corretores;
--   b) um lead parado ha semanas em "Lead Novo" nunca foi abordado, o que e
--      exatamente 'tentando_contato'. Chamar isso de novo mentiria na metrica
--      de primeira abordagem em 5 minutos.
--   Etapa 'novo' fica exclusiva de quem chegou agora, pela roleta ou pela pesca.

BEGIN;

DROP POLICY IF EXISTS f2_sara_analise_corretor_select ON public.f2_sara_analise;
CREATE POLICY f2_sara_analise_corretor_select ON public.f2_sara_analise
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.f2_lead f
             WHERE f.id = f2_sara_analise.funil_lead_id
               AND f.corretor_id = (SELECT public.f2_corretor_atual()))
  );


CREATE OR REPLACE FUNCTION public.f2_migrar_lote(
  p_grupo   text,
  p_limite  integer DEFAULT 50,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  r          record;
  m          public.f2_momento_config%ROWTYPE;
  v_uid      uuid := (SELECT auth.uid());
  v_novo     uuid;
  v_criados  int := 0;
  v_ja       int := 0;
  v_falhas   int := 0;
  v_amostra  jsonb := '[]'::jsonb;
  v_chaves   text[];
  v_momento  text;
BEGIN
  IF public.f2_admin() IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  -- Grupos de migracao. Descarte, Bolsao, Comprou, Repassar e disparo ficam de
  -- fora de proposito: nao sao carteira ativa, sao arquivo.
  v_chaves := CASE p_grupo
    WHEN 'pos_visita' THEN ARRAY['dcp4_3','dcp3_2','dcp3_1','dcp4_1','dcp4_2']
    WHEN 'em_atendimento' THEN ARRAY['dcmaio_7','dcmaio_3','dcmaio_8','dcmaio_9','dcp4_4','dcp3_3','dcp3_0','dcp4_0']
    WHEN 'tentando_contato' THEN ARRAY['dcmaio_6','dcmaio_4','dcmaio_11','dcmaio_12','dcmaio_13','dcmaio_14','dcmaio_15','dcmaio_10','dcmaio_0','operacao_novo']
    ELSE NULL
  END;

  IF v_chaves IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'grupo_invalido',
      'grupos_validos', jsonb_build_array('tentando_contato','em_atendimento','pos_visita'));
  END IF;

  FOR r IN
    SELECT n.id AS negocio_id, n.corretor_id, n.criado_em,
           l.nome, l.telefone, c.nome AS corretor_nome, s.chave AS stage_chave
      FROM public.negocios n
      JOIN public.leads l          ON l.id = n.lead_id
      JOIN public.corretores c     ON c.id = n.corretor_id
      JOIN public.pipeline_stages s ON s.id = n.stage_id
     WHERE n.status = 'aberto'
       AND n.corretor_id IS NOT NULL
       AND s.chave = ANY(v_chaves)
       AND NOT EXISTS (SELECT 1 FROM public.f2_lead f WHERE f.origem_negocio_id = n.id)
     ORDER BY n.ultima_movimentacao DESC NULLS LAST, n.id
     LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 50), 500))
  LOOP
    -- Momento de aterrissagem por estagio de origem.
    v_momento := CASE r.stage_chave
      WHEN 'dcmaio_8'  THEN 'TENTANDO_AGENDAMENTO'
      WHEN 'dcmaio_9'  THEN 'PROCURANDO_PRODUTO'
      WHEN 'dcp3_0'    THEN 'VISITA_AGENDADA'
      WHEN 'dcp4_0'    THEN 'VISITA_AGENDADA'
      WHEN 'dcp4_3'    THEN 'COLETAR_FEEDBACK'
      WHEN 'dcp3_2'    THEN 'COLETAR_FEEDBACK'
      WHEN 'dcp3_1'    THEN 'REMARCAR_VISITA'
      WHEN 'dcp4_1'    THEN 'REMARCAR_VISITA'
      WHEN 'dcp4_2'    THEN 'REMARCAR_VISITA'
      WHEN 'dcp4_4'    THEN 'ACOMPANHAMENTO_POS_VISITA'
      WHEN 'dcp3_3'    THEN 'ACOMPANHAMENTO_POS_VISITA'
      WHEN 'dcmaio_7'  THEN 'CONVERSANDO_QUALIFICANDO'
      WHEN 'dcmaio_3'  THEN 'CONVERSANDO_QUALIFICANDO'
      ELSE 'CADENCIA_SEM_RESPOSTA'
    END;

    SELECT * INTO m FROM public.f2_momento_config WHERE codigo = v_momento AND ativo LIMIT 1;
    IF m.codigo IS NULL THEN v_falhas := v_falhas + 1; CONTINUE; END IF;

    IF jsonb_array_length(v_amostra) < 5 THEN
      v_amostra := v_amostra || jsonb_build_object(
        'negocio_id', r.negocio_id, 'nome', r.nome, 'de', r.stage_chave,
        'para_etapa', m.etapa, 'para_momento', m.codigo, 'corretor', r.corretor_nome);
    END IF;

    CONTINUE WHEN p_dry_run;

    BEGIN
      INSERT INTO public.f2_lead (
        origem_negocio_id, nome, telefone, corretor_id, corretor_nome,
        etapa, momento_codigo, acao_codigo, acao_rotulo, proxima_acao_em,
        cadencia_passo, ultima_reavaliacao_resumo, historico_completo, atualizado_por
      ) VALUES (
        r.negocio_id, r.nome, r.telefone, r.corretor_id, r.corretor_nome,
        m.etapa, m.codigo, m.acao_codigo, m.acao_rotulo,
        -- Prazo conta a partir de AGORA. Herdar o prazo antigo faria a carteira
        -- inteira nascer vencida e transformaria o Meu Dia em lixo no dia 1.
        now() + make_interval(mins => COALESCE(m.prazo_minutos, 1440)),
        0, 'Carteira migrada para o Funil 2.0; a Sara reavalia o momento no proximo ciclo.',
        true, v_uid
      )
      ON CONFLICT (origem_negocio_id) DO NOTHING
      RETURNING id INTO v_novo;

      IF v_novo IS NULL THEN v_ja := v_ja + 1; CONTINUE; END IF;

      INSERT INTO public.f2_evento (funil_lead_id, tipo, titulo, detalhe, payload, criado_por)
      VALUES (v_novo, 'importacao', 'Carteira migrada para o Funil 2.0',
              'Historico completo preservado. O negocio de origem nao foi alterado.',
              jsonb_build_object('origem_negocio_id', r.negocio_id, 'grupo', p_grupo,
                                 'stage_origem', r.stage_chave,
                                 'etapa', m.etapa, 'momento', m.codigo), v_uid);
      v_criados := v_criados + 1;

    EXCEPTION WHEN OTHERS THEN
      v_falhas := v_falhas + 1;
    END;
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.f2_config_audit (tipo, chave, acao, depois, criado_por)
    VALUES ('migracao', p_grupo, 'f2_migrar_lote',
            jsonb_build_object('criados', v_criados, 'ja_existiam', v_ja, 'falhas', v_falhas), v_uid);
  END IF;

  RETURN jsonb_build_object('ok', true, 'grupo', p_grupo, 'dry_run', p_dry_run,
    'criados', v_criados, 'ja_existiam', v_ja, 'falhas', v_falhas, 'amostra', v_amostra);
END
$fn$;

REVOKE ALL ON FUNCTION public.f2_migrar_lote(text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f2_migrar_lote(text, integer, boolean) TO authenticated;

COMMIT;
