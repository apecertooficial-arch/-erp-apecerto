-- Funil 2.0 — entrada automática por distribuição.
--
-- Fecha o buraco: hoje o único caminho de entrada é a pesca, que insere
-- corretor_id NULL, e o trigger de aviso ignora linha sem corretor. Resultado:
-- nenhum card do Funil 2.0 notifica ninguém.
--
-- Aqui o lead JÁ distribuído pela roleta vira card Novo com o corretor
-- preenchido, e o trigger existente (f2_lead_notificar_primeira_abordagem)
-- dispara aviso + push sem precisar de nada novo.
--
-- Desenho deliberado: NÃO altera motor_roleta (10 KB em produção). Espelha o
-- padrão já usado por ncrm_private.entrada_por_distribuicao — um cron de
-- minuto que reconcilia. Desligar = UPDATE f2_entrada_config SET ativo=false.

BEGIN;

CREATE TABLE IF NOT EXISTS public.f2_entrada_config (
  id                boolean PRIMARY KEY DEFAULT true CHECK (id),
  ativo             boolean     NOT NULL DEFAULT false,
  vigente_desde     timestamptz NOT NULL DEFAULT now(),
  prazo_primeira_abordagem_min integer NOT NULL DEFAULT 5 CHECK (prazo_primeira_abordagem_min BETWEEN 1 AND 1440),
  lote              integer     NOT NULL DEFAULT 200 CHECK (lote BETWEEN 1 AND 2000),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_por    uuid
);
COMMENT ON TABLE public.f2_entrada_config IS
  'Kill-switch da entrada automatica do Funil 2.0. ativo=false => nada entra. vigente_desde = corte: negocio criado antes disso nao entra por aqui (migracao e por lote, nao por este caminho).';

ALTER TABLE public.f2_entrada_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS f2_entrada_config_admin_select ON public.f2_entrada_config;
CREATE POLICY f2_entrada_config_admin_select ON public.f2_entrada_config
  FOR SELECT USING (public.f2_admin());

REVOKE ALL ON public.f2_entrada_config FROM PUBLIC, anon;
GRANT SELECT ON public.f2_entrada_config TO authenticated;

-- Corte: 05/08/2026 09:30 America/Sao_Paulo. Antes disso nenhum negocio
-- qualifica, entao o cron ja roda hoje provado e inerte ate a virada.
INSERT INTO public.f2_entrada_config (id, ativo, vigente_desde)
VALUES (true, true, timestamptz '2026-08-05 09:30:00-03')
ON CONFLICT (id) DO UPDATE
  SET ativo = excluded.ativo,
      vigente_desde = excluded.vigente_desde,
      atualizado_em = now();


CREATE OR REPLACE FUNCTION public.f2_entrada_por_distribuicao(p_limite integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  cfg      public.f2_entrada_config%ROWTYPE;
  m        public.f2_momento_config%ROWTYPE;
  r        record;
  v_novo   uuid;
  v_corte  timestamptz;
  v_criados int := 0;
  v_ja      int := 0;
BEGIN
  SELECT * INTO cfg FROM public.f2_entrada_config WHERE id;
  IF cfg.id IS NULL OR cfg.ativo IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', true, 'inativo', true, 'criados', 0);
  END IF;

  SELECT * INTO m FROM public.f2_momento_config
   WHERE codigo = 'PRIMEIRA_ABORDAGEM' AND ativo LIMIT 1;
  IF m.codigo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'momento_primeira_abordagem_ausente');
  END IF;

  FOR r IN
    SELECT n.id AS negocio_id, n.corretor_id, l.nome, l.telefone, c.nome AS corretor_nome
      FROM public.negocios n
      JOIN public.leads l      ON l.id = n.lead_id
      JOIN public.corretores c ON c.id = n.corretor_id
     WHERE n.status = 'aberto'
       AND n.corretor_id IS NOT NULL
       AND n.criado_em >= cfg.vigente_desde
       AND n.stage_id IS DISTINCT FROM public.aquario_stage_id()
       AND NOT EXISTS (SELECT 1 FROM public.f2_lead f WHERE f.origem_negocio_id = n.id)
       AND NOT EXISTS (SELECT 1 FROM public.ncrm_leads_guardados g WHERE g.negocio_id = n.id)
     ORDER BY n.criado_em
     LIMIT GREATEST(1, LEAST(COALESCE(p_limite, cfg.lote), 2000))
  LOOP
    v_corte := clock_timestamp();
    BEGIN
      INSERT INTO public.f2_lead (
        origem_negocio_id, nome, telefone, corretor_id, corretor_nome,
        etapa, momento_codigo, acao_codigo, acao_rotulo, proxima_acao_em,
        cadencia_passo, ultima_reavaliacao_resumo, corte_conversa_em, historico_completo
      ) VALUES (
        r.negocio_id, r.nome, r.telefone, r.corretor_id, r.corretor_nome,
        m.etapa, m.codigo, m.acao_codigo, m.acao_rotulo,
        v_corte + make_interval(mins => cfg.prazo_primeira_abordagem_min),
        0, 'Lead distribuido; aguarda a primeira leitura da Sara.', v_corte, false
      )
      ON CONFLICT (origem_negocio_id) DO NOTHING
      RETURNING id INTO v_novo;

      IF v_novo IS NULL THEN
        v_ja := v_ja + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.f2_evento (funil_lead_id, tipo, titulo, detalhe, payload)
      VALUES (v_novo, 'momento_alterado', 'Lead distribuido pela roleta',
              'Entrou como Novo, com a primeira abordagem em '
                || cfg.prazo_primeira_abordagem_min || ' minutos.',
              jsonb_build_object('etapa', m.etapa, 'momento', m.codigo,
                                 'corretor_id', r.corretor_id,
                                 'origem', 'distribuicao',
                                 'corte_conversa_em', v_corte));
      v_criados := v_criados + 1;

    EXCEPTION WHEN unique_violation THEN
      v_ja := v_ja + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'criados', v_criados, 'ja_existiam', v_ja);
END
$fn$;

REVOKE ALL ON FUNCTION public.f2_entrada_por_distribuicao(integer) FROM PUBLIC, anon, authenticated;

-- Cron de reconciliação. Latência máxima de 60s contra um SLA de 5 min.
DO $cron$
BEGIN
  PERFORM cron.unschedule('f2_entrada_distribuicao');
EXCEPTION WHEN OTHERS THEN NULL;
END
$cron$;

SELECT cron.schedule('f2_entrada_distribuicao', '* * * * *',
                     'SELECT public.f2_entrada_por_distribuicao();');

COMMIT;
