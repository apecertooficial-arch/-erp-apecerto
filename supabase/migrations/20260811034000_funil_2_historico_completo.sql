-- Funil 2.0 — histórico D-API completo para a carteira migrada.
--
-- Leads vindos dos pipes antigos preservam toda a conversa. Leads pescados
-- do Aquário continuam nascendo com conversa nova, a partir do corte. Quando
-- um contato antigo perdeu lead_id, criamos um vínculo F2 auditável somente
-- se telefone, lead F2 e contato com mensagens forem todos unívocos.
BEGIN;

ALTER TABLE public.f2_lead
  ADD COLUMN IF NOT EXISTS historico_completo boolean NOT NULL DEFAULT false;

UPDATE public.f2_lead f
SET historico_completo=true
WHERE EXISTS (
  SELECT 1 FROM public.f2_evento e
  WHERE e.funil_lead_id=f.id
    AND e.tipo='importacao'
    AND e.titulo='Migrado dos pipes antigos'
);

CREATE TABLE IF NOT EXISTS public.f2_historico_vinculo (
  funil_lead_id uuid NOT NULL REFERENCES public.f2_lead(id) ON DELETE CASCADE,
  contato_id uuid NOT NULL REFERENCES public.wa_contatos(id) ON DELETE CASCADE,
  metodo text NOT NULL DEFAULT 'telefone_unico' CHECK (metodo='telefone_unico'),
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(funil_lead_id,contato_id),
  UNIQUE(contato_id)
);
ALTER TABLE public.f2_historico_vinculo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.f2_historico_vinculo FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.f2_historico_vinculo TO authenticated,service_role;
CREATE POLICY f2_historico_vinculo_admin_select
  ON public.f2_historico_vinculo FOR SELECT TO authenticated
  USING (public.f2_admin());

WITH f2_telefone AS (
  SELECT f.id AS funil_lead_id,
         right(regexp_replace(COALESCE(f.telefone,''),'\D','','g'),11) AS telefone
  FROM public.f2_lead f
), f2_unico AS (
  SELECT telefone,min(funil_lead_id::text)::uuid AS funil_lead_id
  FROM f2_telefone
  WHERE char_length(telefone) BETWEEN 10 AND 11
  GROUP BY telefone HAVING count(*)=1
), contato_telefone AS (
  SELECT c.id AS contato_id,
         right(regexp_replace(COALESCE(c.telefone,''),'\D','','g'),11) AS telefone
  FROM public.wa_contatos c
  WHERE c.lead_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.wa_conversas v
      JOIN public.wa_mensagens m ON m.conversa_id=v.id
      WHERE v.contato_id=c.id
    )
), contato_unico AS (
  SELECT telefone,min(contato_id::text)::uuid AS contato_id
  FROM contato_telefone
  WHERE char_length(telefone) BETWEEN 10 AND 11
  GROUP BY telefone HAVING count(*)=1
)
INSERT INTO public.f2_historico_vinculo(funil_lead_id,contato_id)
SELECT f.funil_lead_id,c.contato_id
FROM f2_unico f JOIN contato_unico c USING(telefone)
ON CONFLICT DO NOTHING;

DROP FUNCTION public.f2_sara_elegiveis(integer);
CREATE FUNCTION public.f2_sara_elegiveis(p_lote integer DEFAULT 5)
RETURNS TABLE(
  funil_lead_id uuid, origem_negocio_id bigint, lead_id bigint, versao integer,
  etapa text, momento_codigo text, acao_codigo text, cadencia_passo smallint,
  corte_conversa_em timestamptz, historico_completo boolean,
  ultima_reavaliacao_sara_em timestamptz, ultima_mensagem_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT f.id,f.origem_negocio_id,n.lead_id,f.versao,f.etapa,f.momento_codigo,
         f.acao_codigo,f.cadencia_passo,f.corte_conversa_em,f.historico_completo,
         f.ultima_reavaliacao_sara_em,ult.ultima_mensagem_em
  FROM public.f2_lead f
  JOIN public.negocios n ON n.id=f.origem_negocio_id
  CROSS JOIN public.f2_sara_config cfg
  LEFT JOIN LATERAL (
    SELECT max(COALESCE(m.enviado_em,m.criado_em)) AS ultima_mensagem_em
    FROM (
      SELECT c.id FROM public.wa_contatos c WHERE c.lead_id=n.lead_id
      UNION
      SELECT h.contato_id FROM public.f2_historico_vinculo h WHERE h.funil_lead_id=f.id
    ) contatos
    JOIN public.wa_conversas v ON v.contato_id=contatos.id
    JOIN public.wa_mensagens m ON m.conversa_id=v.id
    WHERE f.historico_completo
       OR COALESCE(m.enviado_em,m.criado_em)>=f.corte_conversa_em
  ) ult ON true
  WHERE (f.ultima_reavaliacao_sara_em IS NULL
     OR ult.ultima_mensagem_em>f.ultima_reavaliacao_sara_em)
    AND (
      cfg.modo_execucao='completo'
      OR f.id IN (
        SELECT f_canary.id FROM public.f2_lead f_canary
        ORDER BY f_canary.criado_em,f_canary.id LIMIT cfg.canary_limite
      )
    )
  ORDER BY f.ultima_reavaliacao_sara_em NULLS FIRST,
           ult.ultima_mensagem_em DESC NULLS LAST,f.id
  LIMIT LEAST(GREATEST(COALESCE(p_lote,5),1),10)
$fn$;
REVOKE ALL ON FUNCTION public.f2_sara_elegiveis(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f2_sara_elegiveis(integer) TO service_role;

COMMIT;
