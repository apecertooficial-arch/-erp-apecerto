-- Funil 2.0: regra deterministica de resposta, acesso mobile por carteira e
-- operacao segura do corretor. Nao toca em leads/negocios/visitas/vendas de origem.
BEGIN;

CREATE OR REPLACE FUNCTION public.f2_corretor_atual()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $fn$
  SELECT c.id FROM public.corretores c
  WHERE c.usuario_id=(SELECT auth.uid())
  ORDER BY c.id LIMIT 1;
$fn$;
REVOKE ALL ON FUNCTION public.f2_corretor_atual() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_corretor_atual() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.f2_pode_operar_lead(p_funil_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $fn$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND (
       public.f2_admin() IS TRUE
       OR EXISTS (
         SELECT 1
         FROM public.f2_lead f
         JOIN public.corretores c ON c.id=f.corretor_id
         WHERE f.id=p_funil_lead_id
           AND c.usuario_id=(SELECT auth.uid())
       )
     );
$fn$;
REVOKE ALL ON FUNCTION public.f2_pode_operar_lead(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f2_pode_operar_lead(uuid) TO service_role;

-- O app do corretor ve somente a propria carteira. Gestao continua vendo tudo.
CREATE POLICY f2_lead_corretor_select ON public.f2_lead FOR SELECT TO authenticated
USING (
  corretor_id=(SELECT public.f2_corretor_atual())
);
CREATE POLICY f2_evento_corretor_select ON public.f2_evento FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.f2_lead f
  WHERE f.id=funil_lead_id AND f.corretor_id=(SELECT public.f2_corretor_atual())
));
CREATE POLICY f2_visita_corretor_select ON public.f2_visita FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.f2_lead f
  WHERE f.id=funil_lead_id AND f.corretor_id=(SELECT public.f2_corretor_atual())
));
CREATE POLICY f2_negociacao_corretor_select ON public.f2_negociacao FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.f2_lead f
  WHERE f.id=funil_lead_id AND f.corretor_id=(SELECT public.f2_corretor_atual())
));
CREATE POLICY f2_historico_vinculo_corretor_select ON public.f2_historico_vinculo FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.f2_lead f
  WHERE f.id=funil_lead_id AND f.corretor_id=(SELECT public.f2_corretor_atual())
));
CREATE POLICY f2_momento_config_corretor_select ON public.f2_momento_config FOR SELECT TO authenticated USING (ativo);
CREATE POLICY f2_etapa_config_corretor_select ON public.f2_etapa_config FOR SELECT TO authenticated USING (ativo);
CREATE POLICY f2_operacao_config_corretor_select ON public.f2_operacao_config FOR SELECT TO authenticated USING (id);

CREATE INDEX IF NOT EXISTS f2_lead_corretor_prazo_idx ON public.f2_lead(corretor_id,proxima_acao_em);
CREATE INDEX IF NOT EXISTS f2_visita_funil_lead_idx ON public.f2_visita(funil_lead_id,inicio_em DESC);
CREATE INDEX IF NOT EXISTS f2_negociacao_funil_lead_idx ON public.f2_negociacao(funil_lead_id,atualizado_em DESC);

-- Escrita direta fica fechada; toda mutacao passa pelas RPCs com autorizacao.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.f2_lead,public.f2_evento,
  public.f2_momento_config,public.f2_etapa_config,public.f2_visita,public.f2_negociacao
FROM authenticated;

-- As RPCs operacionais passam a aceitar o dono do lead sem abrir a carteira alheia.
DO $do$
DECLARE
  v_oid regprocedure;
  v_def text;
  v_item record;
  v_antiga constant text := 'IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN RETURN jsonb_build_object(''ok'',false,''erro'',''sem_permissao''); END IF;';
BEGIN
  FOR v_item IN SELECT * FROM (VALUES
    ('public.f2_atualizar_momento(uuid,integer,text,timestamptz,text)','p_id'),
    ('public.f2_confirmar_acao(uuid,integer,text,text)','p_id'),
    ('public.f2_salvar_visita(uuid,uuid,timestamptz,text,text,text)','p_lead_id'),
    ('public.f2_salvar_negociacao(uuid,uuid,text,text,numeric,text)','p_lead_id')
  ) AS x(assinatura,parametro)
  LOOP
    v_oid:=to_regprocedure(v_item.assinatura);
    IF v_oid IS NULL THEN RAISE EXCEPTION 'f2_rpc_ausente:%',v_item.assinatura; END IF;
    v_def:=pg_get_functiondef(v_oid);
    IF position(v_antiga IN v_def)=0 THEN RAISE EXCEPTION 'f2_guarda_inesperada:%',v_item.assinatura; END IF;
    v_def:=replace(v_def,v_antiga,
      format('IF v_uid IS NULL OR public.f2_pode_operar_lead(%s) IS NOT TRUE THEN RETURN jsonb_build_object(''ok'',false,''erro'',''sem_permissao''); END IF;',v_item.parametro));
    EXECUTE v_def;
  END LOOP;
END;
$do$;

-- Corrige somente cadencias que contradizem uma resposta real do cliente.
WITH respondidos AS (
  SELECT DISTINCT f.id
  FROM public.f2_lead f
  WHERE f.momento_codigo='CADENCIA_SEM_RESPOSTA'
    AND (
      EXISTS (
        SELECT 1 FROM public.negocios n
        JOIN public.wa_contatos c ON c.lead_id=n.lead_id
        JOIN public.wa_conversas cv ON cv.contato_id=c.id
        JOIN public.wa_mensagens wm ON wm.conversa_id=cv.id
        WHERE n.id=f.origem_negocio_id AND wm.direcao='recebida'
      )
      OR EXISTS (
        SELECT 1 FROM public.f2_historico_vinculo hv
        JOIN public.wa_conversas cv ON cv.contato_id=hv.contato_id
        JOIN public.wa_mensagens wm ON wm.conversa_id=cv.id
        WHERE hv.funil_lead_id=f.id AND wm.direcao='recebida'
      )
    )
), corrigidos AS (
  UPDATE public.f2_lead f
  SET etapa='em_atendimento',momento_codigo='CONVERSANDO_QUALIFICANDO',
      acao_codigo=m.acao_codigo,acao_rotulo=m.acao_rotulo,
      proxima_acao_em=now()+make_interval(mins=>m.prazo_minutos),
      ultima_reavaliacao_sara_em=now(),
      ultima_reavaliacao_resumo='Cliente ja respondeu. A cadencia sem resposta foi encerrada e a conversa voltou para qualificacao.',
      versao=f.versao+1,atualizado_em=now(),atualizado_por=NULL
  FROM respondidos r, public.f2_momento_config m
  WHERE f.id=r.id AND m.codigo='CONVERSANDO_QUALIFICANDO'
  RETURNING f.id
)
INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
SELECT id,'sara_reavaliou','Resposta do cliente encontrada — cadencia encerrada',
  'Correcao deterministica: Tentando contato e exclusivo para quem nunca respondeu.',
  jsonb_build_object('origem','regra_resposta_cliente','momento_anterior','CADENCIA_SEM_RESPOSTA','momento_novo','CONVERSANDO_QUALIFICANDO'),NULL
FROM corrigidos;

-- Defesa definitiva: a Sara nao pode voltar um cliente que respondeu para cadencia.
DO $do$
DECLARE v_oid regprocedure:=to_regprocedure('public.f2_sara_registrar_classificacao(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz)');
        v_def text; v_anchor text;
BEGIN
  IF v_oid IS NULL THEN RAISE EXCEPTION 'f2_sara_rpc_ausente'; END IF;
  v_def:=pg_get_functiondef(v_oid);
  v_anchor:='IF p_confianca IS NULL OR p_confianca<COALESCE(v_cfg.confianca_minima,0.650)';
  IF position(v_anchor IN v_def)=0 THEN RAISE EXCEPTION 'f2_sara_guarda_inesperada'; END IF;
  v_def:=replace(v_def,v_anchor,
    'IF p_momento_codigo=''CADENCIA_SEM_RESPOSTA'' AND EXISTS ('||
    'SELECT 1 FROM public.wa_mensagens wm JOIN public.wa_conversas cv ON cv.id=wm.conversa_id '||
    'LEFT JOIN public.wa_contatos c ON c.id=cv.contato_id '||
    'LEFT JOIN public.negocios n ON n.id=v_lead.origem_negocio_id '||
    'LEFT JOIN public.f2_historico_vinculo hv ON hv.funil_lead_id=v_lead.id AND hv.contato_id=cv.contato_id '||
    'WHERE wm.direcao=''recebida'' AND (c.lead_id=n.lead_id OR hv.funil_lead_id IS NOT NULL)'||
    ') THEN v_status:=''revisao_humana'';'||E'\n    ELSIF '||substr(v_anchor,4));
  EXECUTE v_def;
END;
$do$;

COMMIT;
