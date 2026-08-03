-- Funil 2.0 — laboratório isolado com limite físico de dois leads-cópia.
--
-- Não altera ncrm_estado, negocios, leads, visitas, vendas ou qualquer automação.
-- Os dois registros de teste são importados depois da migration pela RPC
-- service_role-only f2_importar_negocio(bigint). O limite de duas cópias fica
-- garantido no banco até a operação autorizar a próxima fase.
BEGIN;

CREATE OR REPLACE FUNCTION public.f2_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $fn$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND (
       (SELECT auth.uid()) = '4dfdffae-0009-41de-8d6f-2365a06dc066'::uuid
       OR COALESCE(public.can_manage_all(), false)
     );
$fn$;
REVOKE ALL ON FUNCTION public.f2_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f2_admin() TO authenticated, service_role;

CREATE TABLE public.f2_momento_config (
  codigo text PRIMARY KEY,
  etapa text NOT NULL CHECK (etapa IN ('novo','tentando_contato','em_atendimento','pos_visita')),
  ordem smallint NOT NULL UNIQUE CHECK (ordem BETWEEN 1 AND 10),
  rotulo text NOT NULL,
  descricao text NOT NULL,
  acao_codigo text NOT NULL,
  acao_rotulo text NOT NULL,
  prazo_minutos integer NULL CHECK (prazo_minutos IS NULL OR prazo_minutos BETWEEN 1 AND 43200),
  prazo_rotulo text NOT NULL,
  exige_dapi boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true
);

INSERT INTO public.f2_momento_config
  (codigo,etapa,ordem,rotulo,descricao,acao_codigo,acao_rotulo,prazo_minutos,prazo_rotulo,exige_dapi)
VALUES
 ('PRIMEIRA_ABORDAGEM','novo',1,'Primeira abordagem','O lead acabou de chegar. A primeira mensagem precisa ser confirmada pelo D-API.','PRIMEIRA_ABORDAGEM','Fazer a primeira abordagem',5,'5 minutos',true),
 ('CADENCIA_SEM_RESPOSTA','tentando_contato',2,'Cadência sem resposta','O cliente nunca respondeu. Siga somente os dias 1, 2, 4, 6 e 7.','ENVIAR_CADENCIA','Enviar a mensagem da cadência',1440,'dias 1, 2, 4, 6 e 7',true),
 ('CONVERSANDO_QUALIFICANDO','em_atendimento',3,'Conversando e qualificando','Mantenha a conversa viva e complete o perfil do cliente.','RESPONDER_E_QUALIFICAR','Responder e qualificar',1440,'24 horas',true),
 ('PROCURANDO_PRODUTO','em_atendimento',4,'Procurando produto','Encontre opções compatíveis com o que o cliente pediu.','PROCURAR_PRODUTO','Procurar imóveis compatíveis',1440,'24 horas',false),
 ('PRODUTO_ENVIADO','em_atendimento',5,'Produto enviado','Confirme o interesse nas opções e descubra o que precisa ser ajustado.','PEDIR_RETORNO_PRODUTO','Pedir retorno sobre as opções',1440,'24 horas',true),
 ('TENTANDO_AGENDAMENTO','em_atendimento',6,'Tentando agendamento','Converta o interesse em visita com data e hora.','AGENDAR_VISITA','Combinar data e horário da visita',720,'12 horas',true),
 ('RETORNO_PROGRAMADO','em_atendimento',7,'Retorno programado','Retome exatamente na data combinada; sem data, use cinco dias.','RETOMAR_NO_COMBINADO','Retomar no horário combinado',7200,'data combinada ou 5 dias',true),
 ('COLETAR_FEEDBACK','pos_visita',8,'Coletar feedback','Registre o resultado da visita e a reação do cliente.','REGISTRAR_FEEDBACK','Registrar feedback da visita',120,'2 horas após a visita',false),
 ('REMARCAR_VISITA','pos_visita',9,'Remarcar visita','Visita cancelada ou cliente ausente: combine uma nova data.','REMARCAR_VISITA','Remarcar a visita',720,'12 horas',true),
 ('ACOMPANHAMENTO_POS_VISITA','pos_visita',10,'Acompanhamento pós-visita','Transforme o feedback em nova opção, retorno ou proposta.','AVANCAR_POS_VISITA','Definir o próximo avanço',1440,'24 horas',true)
ON CONFLICT (codigo) DO UPDATE SET
  etapa=EXCLUDED.etapa,ordem=EXCLUDED.ordem,rotulo=EXCLUDED.rotulo,
  descricao=EXCLUDED.descricao,acao_codigo=EXCLUDED.acao_codigo,
  acao_rotulo=EXCLUDED.acao_rotulo,prazo_minutos=EXCLUDED.prazo_minutos,
  prazo_rotulo=EXCLUDED.prazo_rotulo,exige_dapi=EXCLUDED.exige_dapi,ativo=true;

CREATE TABLE public.f2_lead (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_negocio_id bigint NOT NULL UNIQUE,
  nome text NOT NULL,
  telefone text NULL,
  corretor_id bigint NULL,
  corretor_nome text NULL,
  etapa text NOT NULL CHECK (etapa IN ('novo','tentando_contato','em_atendimento','pos_visita')),
  momento_codigo text NOT NULL REFERENCES public.f2_momento_config(codigo),
  acao_codigo text NOT NULL,
  acao_rotulo text NOT NULL,
  proxima_acao_em timestamptz NOT NULL,
  cadencia_passo smallint NOT NULL DEFAULT 0 CHECK (cadencia_passo BETWEEN 0 AND 5),
  ultima_interacao_em timestamptz NULL,
  ultima_acao_confirmada_em timestamptz NULL,
  ultima_acao_fonte text NULL CHECK (ultima_acao_fonte IS NULL OR ultima_acao_fonte IN ('dapi','registro_operacional','importacao')),
  ultima_reavaliacao_sara_em timestamptz NULL,
  ultima_reavaliacao_resumo text NULL,
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid NULL
);
CREATE INDEX f2_lead_etapa_prazo_idx ON public.f2_lead(etapa,proxima_acao_em);

CREATE TABLE public.f2_evento (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  funil_lead_id uuid NOT NULL REFERENCES public.f2_lead(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('importacao','momento_alterado','acao_confirmada','sara_reavaliou')),
  titulo text NOT NULL,
  detalhe text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid NULL
);
CREATE INDEX f2_evento_lead_data_idx ON public.f2_evento(funil_lead_id,criado_em DESC);

ALTER TABLE public.f2_momento_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f2_lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f2_evento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.f2_momento_config,public.f2_lead,public.f2_evento FROM PUBLIC,anon;
GRANT SELECT ON public.f2_momento_config,public.f2_lead,public.f2_evento TO authenticated;

CREATE POLICY f2_config_admin_select ON public.f2_momento_config FOR SELECT TO authenticated
  USING (public.f2_admin());
CREATE POLICY f2_lead_admin_select ON public.f2_lead FOR SELECT TO authenticated
  USING (public.f2_admin());
CREATE POLICY f2_evento_admin_select ON public.f2_evento FOR SELECT TO authenticated
  USING (public.f2_admin());

CREATE OR REPLACE FUNCTION public.f2_limitar_dois_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM public.f2_lead WHERE origem_negocio_id=NEW.origem_negocio_id) THEN
    RETURN NEW;
  END IF;
  IF (SELECT count(*) FROM public.f2_lead) >= 2 THEN
    RAISE EXCEPTION 'funil_2_limite_dois_leads';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.f2_limitar_dois_leads() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER f2_lead_limite_dois BEFORE INSERT ON public.f2_lead
FOR EACH ROW EXECUTE FUNCTION public.f2_limitar_dois_leads();

CREATE OR REPLACE FUNCTION public.f2_importar_negocio(p_negocio_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE v_id uuid; v_m public.f2_momento_config%ROWTYPE;
BEGIN
  SELECT m.* INTO v_m
  FROM public.ncrm_estado e
  JOIN public.f2_momento_config m ON m.codigo = CASE e.momento_codigo
    WHEN 'BUSCANDO_PRODUTO' THEN 'PROCURANDO_PRODUTO'
    WHEN 'FEEDBACK_POS_VISITA' THEN 'COLETAR_FEEDBACK'
    WHEN 'DECISAO_POS_VISITA' THEN 'ACOMPANHAMENTO_POS_VISITA'
    ELSE e.momento_codigo END
  WHERE e.negocio_id=p_negocio_id;
  IF v_m.codigo IS NULL THEN RAISE EXCEPTION 'momento_do_negocio_nao_mapeado'; END IF;

  INSERT INTO public.f2_lead(
    origem_negocio_id,nome,telefone,corretor_id,corretor_nome,etapa,momento_codigo,
    acao_codigo,acao_rotulo,proxima_acao_em,ultima_interacao_em,
    ultima_acao_confirmada_em,ultima_acao_fonte,ultima_reavaliacao_sara_em,
    ultima_reavaliacao_resumo)
  SELECT n.id,l.nome,l.telefone,n.corretor_id,c.nome,v_m.etapa,v_m.codigo,
    v_m.acao_codigo,v_m.acao_rotulo,
    COALESCE(e.proxima_acao_em,now()+make_interval(mins=>COALESCE(v_m.prazo_minutos,1440))),
    e.ultima_interacao_em,e.ultima_interacao_em,'importacao',now(),
    'Cópia criada para desenhar e validar o Funil 2.0; o lead original permanece intacto.'
  FROM public.ncrm_estado e
  JOIN public.negocios n ON n.id=e.negocio_id
  JOIN public.leads l ON l.id=n.lead_id
  LEFT JOIN public.corretores c ON c.id=n.corretor_id
  WHERE e.negocio_id=p_negocio_id
  ON CONFLICT (origem_negocio_id) DO UPDATE SET atualizado_em=public.f2_lead.atualizado_em
  RETURNING id INTO v_id;

  IF NOT EXISTS (SELECT 1 FROM public.f2_evento WHERE funil_lead_id=v_id AND tipo='importacao') THEN
    INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload)
    VALUES(v_id,'importacao','Lead copiado para o laboratório','O negócio original não foi alterado.',jsonb_build_object('origem_negocio_id',p_negocio_id));
  END IF;
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.f2_importar_negocio(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f2_importar_negocio(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.f2_atualizar_momento(
  p_id uuid,p_versao integer,p_momento_codigo text,p_prazo_combinado timestamptz DEFAULT NULL,p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE v_uid uuid:=(SELECT auth.uid()); v_atual public.f2_lead%ROWTYPE;
        v_m public.f2_momento_config%ROWTYPE; v_prazo timestamptz;
BEGIN
  IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  SELECT * INTO v_atual FROM public.f2_lead WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','lead_inexistente'); END IF;
  IF v_atual.versao<>p_versao THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  SELECT * INTO v_m FROM public.f2_momento_config WHERE codigo=p_momento_codigo AND ativo;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','momento_invalido'); END IF;
  v_prazo:=CASE WHEN v_m.codigo='RETORNO_PROGRAMADO'
    THEN COALESCE(p_prazo_combinado,now()+interval '5 days')
    ELSE now()+make_interval(mins=>COALESCE(v_m.prazo_minutos,1440)) END;
  IF v_prazo<=now() THEN RETURN jsonb_build_object('ok',false,'erro','prazo_no_passado'); END IF;

  UPDATE public.f2_lead SET etapa=v_m.etapa,momento_codigo=v_m.codigo,
    acao_codigo=v_m.acao_codigo,acao_rotulo=v_m.acao_rotulo,proxima_acao_em=v_prazo,
    cadencia_passo=CASE WHEN v_m.codigo='CADENCIA_SEM_RESPOSTA' THEN 0 ELSE cadencia_passo END,
    ultima_reavaliacao_sara_em=now(),
    ultima_reavaliacao_resumo=COALESCE(NULLIF(btrim(p_observacao),''),'Momento alterado no laboratório e próxima obrigação recalculada.'),
    versao=versao+1,atualizado_em=now(),atualizado_por=v_uid
  WHERE id=p_id;
  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(p_id,'momento_alterado','Momento atualizado para '||v_m.rotulo,p_observacao,
    jsonb_build_object('etapa_anterior',v_atual.etapa,'momento_anterior',v_atual.momento_codigo,'prazo',v_prazo),v_uid);
  RETURN jsonb_build_object('ok',true,'versao',v_atual.versao+1,'etapa',v_m.etapa,'momento_codigo',v_m.codigo,'prazo',v_prazo);
END;
$fn$;
REVOKE ALL ON FUNCTION public.f2_atualizar_momento(uuid,integer,text,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_atualizar_momento(uuid,integer,text,timestamptz,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.f2_confirmar_acao(
  p_id uuid,p_versao integer,p_fonte text,p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE v_uid uuid:=(SELECT auth.uid()); v_atual public.f2_lead%ROWTYPE;
        v_m public.f2_momento_config%ROWTYPE; v_passo smallint; v_dias smallint; v_prazo timestamptz;
BEGIN
  IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_fonte NOT IN ('dapi','registro_operacional') THEN RETURN jsonb_build_object('ok',false,'erro','fonte_invalida'); END IF;
  SELECT * INTO v_atual FROM public.f2_lead WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','lead_inexistente'); END IF;
  IF v_atual.versao<>p_versao THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  SELECT * INTO v_m FROM public.f2_momento_config WHERE codigo=v_atual.momento_codigo;
  IF v_m.exige_dapi AND p_fonte<>'dapi' THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_dapi_obrigatoria'); END IF;

  IF v_atual.momento_codigo='CADENCIA_SEM_RESPOSTA' THEN
    v_passo:=LEAST(v_atual.cadencia_passo+1,5);
    v_dias:=(ARRAY[1,2,4,6,7])[v_passo];
    v_prazo:=date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
      + make_interval(days=>v_dias)+interval '9 hours';
    IF v_passo=5 THEN v_prazo:=now()+interval '24 hours'; END IF;
  ELSE
    v_passo:=v_atual.cadencia_passo;
    v_prazo:=now()+make_interval(mins=>COALESCE(v_m.prazo_minutos,1440));
  END IF;

  UPDATE public.f2_lead SET cadencia_passo=v_passo,proxima_acao_em=v_prazo,
    ultima_acao_confirmada_em=now(),ultima_acao_fonte=p_fonte,
    ultima_reavaliacao_sara_em=now(),
    ultima_reavaliacao_resumo='A ação foi confirmada; a Sara revisou o laboratório e manteve a conduta atual.',
    versao=versao+1,atualizado_em=now(),atualizado_por=v_uid
  WHERE id=p_id;
  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(p_id,'acao_confirmada','Ação confirmada por '||CASE p_fonte WHEN 'dapi' THEN 'D-API' ELSE 'registro operacional' END,
    p_observacao,jsonb_build_object('acao',v_atual.acao_codigo,'proximo_prazo',v_prazo,'cadencia_passo',v_passo),v_uid);
  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(p_id,'sara_reavaliou','Sara reavaliou a cópia','A conduta foi mantida após a ação de demonstração.',
    jsonb_build_object('momento',v_atual.momento_codigo,'acao',v_atual.acao_codigo),v_uid);
  RETURN jsonb_build_object('ok',true,'versao',v_atual.versao+1,'prazo',v_prazo,'cadencia_passo',v_passo);
END;
$fn$;
REVOKE ALL ON FUNCTION public.f2_confirmar_acao(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_confirmar_acao(uuid,integer,text,text) TO authenticated,service_role;

COMMIT;
