-- CRM Nova Era 3.0 — motor operacional canônico e Meu Dia orientado à execução.
-- Não envia mensagens. Não cria visita/proposta/venda. Apenas padroniza a
-- conduta exposta e a fila autorizada já existente.
BEGIN;

-- Catálogo fechado: quatro momentos comerciais e dez obrigações possíveis.
CREATE TABLE IF NOT EXISTS public.ncrm_momento_padrao (
  codigo text PRIMARY KEY,
  etapa text NOT NULL UNIQUE CHECK (etapa IN ('novo','tentando_contato','em_atendimento','em_acompanhamento')),
  rotulo text NOT NULL,
  objetivo text NOT NULL,
  ordem smallint NOT NULL UNIQUE CHECK (ordem BETWEEN 1 AND 4),
  ativo boolean NOT NULL DEFAULT true
);
ALTER TABLE public.ncrm_momento_padrao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ncrm_momento_padrao FROM PUBLIC, anon;
GRANT SELECT ON public.ncrm_momento_padrao TO authenticated;
DROP POLICY IF EXISTS ncrm_momento_padrao_leitura ON public.ncrm_momento_padrao;
CREATE POLICY ncrm_momento_padrao_leitura ON public.ncrm_momento_padrao
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.ncrm_momento_padrao(codigo,etapa,rotulo,objetivo,ordem) VALUES
 ('NOVO','novo','Novo','Realizar a primeira abordagem humana em até 5 minutos.',1),
 ('TENTANDO_CONTATO','tentando_contato','Tentando contato','Produzir a primeira resposta pela cadência oficial de sete dias.',2),
 ('EM_ATENDIMENTO','em_atendimento','Em atendimento','Manter interação diária e transformar necessidade em visita.',3),
 ('EM_ACOMPANHAMENTO','em_acompanhamento','Em acompanhamento','Tratar visita, retomada, decisão e proposta sem abandonar o cliente.',4)
ON CONFLICT (codigo) DO UPDATE SET etapa=EXCLUDED.etapa,rotulo=EXCLUDED.rotulo,
 objetivo=EXCLUDED.objetivo,ordem=EXCLUDED.ordem,ativo=true;

ALTER TABLE public.ncrm_acao_padrao ADD COLUMN IF NOT EXISTS objetivo text;
UPDATE public.ncrm_acao_padrao SET ativa=false;
INSERT INTO public.ncrm_acao_padrao(codigo,rotulo,proxima_acao_tipo,sla_min,ordem,objetivo,ativa) VALUES
 ('PRIMEIRA_ABORDAGEM','Fazer a primeira abordagem','tentativa_cadencia',5,10,'Iniciar a conversa em até 5 minutos.',true),
 ('ENVIAR_CADENCIA','Enviar a mensagem da cadência','tentativa_cadencia',360,20,'Conseguir a primeira resposta sem deixar o lead parar.',true),
 ('RESPONDER_CLIENTE','Responder o cliente','retornar_contato',15,30,'Manter a conversa ativa e avançar o atendimento.',true),
 ('ENTENDER_NECESSIDADE','Entender o que o cliente procura','entender_necessidade',240,40,'Descobrir e completar perfil, região, valor e prazo.',true),
 ('BUSCAR_E_ENVIAR_IMOVEIS','Buscar e enviar imóveis','enviar_opcoes',1440,50,'Entregar opções compatíveis e provocar uma resposta.',true),
 ('PEDIR_RETORNO','Pedir retorno sobre as opções','confirmar_recebimento',1440,60,'Descobrir o que agradou e ajustar a busca.',true),
 ('REATIVAR_CONVERSA','Reativar a conversa','retornar_contato',1440,70,'Produzir nova interação sem deixar o atendimento parar.',true),
 ('AGENDAR_VISITA','Agendar uma visita','agendar_visita',240,80,'Transformar o interesse em visita com data e hora.',true),
 ('REGISTRAR_RESULTADO_VISITA','Registrar o resultado da visita','retornar_contato',120,90,'Definir o próximo avanço depois da visita.',true),
 ('REGISTRAR_PROPOSTA','Registrar proposta','preparar_proposta',240,100,'Encaminhar uma proposta real para a Esteira de Vendas.',true)
ON CONFLICT (codigo) DO UPDATE SET rotulo=EXCLUDED.rotulo,proxima_acao_tipo=EXCLUDED.proxima_acao_tipo,
 sla_min=EXCLUDED.sla_min,ordem=EXCLUDED.ordem,objetivo=EXCLUDED.objetivo,ativa=true;

-- Uma única decisão operacional. Texto livre serve como evidência auxiliar;
-- o retorno sempre pertence ao catálogo fechado acima.
CREATE OR REPLACE FUNCTION public.ncrm_conduta_oficial(
  p_etapa text, p_respondeu boolean, p_resposta_pendente boolean,
  p_tentativas integer, p_proxima_tipo text, p_proxima_titulo text,
  p_proxima_em timestamptz
) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $fn$
  WITH base AS (
    SELECT lower(COALESCE(p_proxima_titulo,'')) AS t
  ), decisao AS (
    SELECT CASE
      WHEN p_etapa='novo' THEN 'PRIMEIRA_ABORDAGEM'
      WHEN NOT COALESCE(p_respondeu,false) THEN 'ENVIAR_CADENCIA'
      WHEN COALESCE(p_resposta_pendente,false) THEN 'RESPONDER_CLIENTE'
      WHEN p_proxima_tipo='preparar_proposta' OR t LIKE '%proposta%' THEN 'REGISTRAR_PROPOSTA'
      WHEN p_proxima_tipo='agendar_visita' OR t LIKE '%visita%' THEN 'AGENDAR_VISITA'
      WHEN t LIKE '%resultado%visita%' OR t LIKE '%pos-visita%' THEN 'REGISTRAR_RESULTADO_VISITA'
      WHEN p_proxima_tipo='enviar_opcoes' OR t ~ '(buscar|procurar|separar|enviar).*(imovel|op)' THEN 'BUSCAR_E_ENVIAR_IMOVEIS'
      WHEN p_proxima_tipo='confirmar_recebimento' OR t ~ '(feedback|o que achou|retorno).*(op|imovel)' THEN 'PEDIR_RETORNO'
      WHEN t ~ '(reativ|retomar|parou de responder)' THEN 'REATIVAR_CONVERSA'
      ELSE 'ENTENDER_NECESSIDADE' END AS codigo
    FROM base
  )
  SELECT jsonb_build_object(
    'momento_codigo',m.codigo,'momento',m.rotulo,'momento_ordem',m.ordem,
    'acao_codigo',a.codigo,
    'acao',CASE WHEN a.codigo='ENVIAR_CADENCIA'
      THEN concat('Enviar cadência ',LEAST(GREATEST(COALESCE(p_tentativas,0)+1,1),6),' de 6')
      ELSE a.rotulo END,
    'objetivo',a.objetivo,'prazo',p_proxima_em,
    'sla_min',a.sla_min
  )
  FROM decisao d
  JOIN public.ncrm_acao_padrao a ON a.codigo=d.codigo
  JOIN public.ncrm_momento_padrao m ON m.etapa=p_etapa;
$fn$;
REVOKE ALL ON FUNCTION public.ncrm_conduta_oficial(text,boolean,boolean,integer,text,text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ncrm_conduta_oficial(text,boolean,boolean,integer,text,text,timestamptz)
  TO service_role;

-- A Sara decide a próxima obrigação, mas dentro do catálogo. Não envia
-- mensagem, não cria visita/proposta e não conclui ação em nome do corretor.
CREATE OR REPLACE FUNCTION public.ncrm_sara_aplicar_proxima_acao(
  p_negocio_id bigint, p_analise_id bigint, p_acao_codigo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_e public.ncrm_estado%ROWTYPE;
        v_a public.ncrm_sara_analise%ROWTYPE; v_cat public.ncrm_acao_padrao%ROWTYPE;
        v_lead bigint; v_corretor bigint; v_prazo timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  SELECT * INTO v_a FROM public.ncrm_sara_analise
   WHERE id=p_analise_id AND negocio_id=p_negocio_id;
  IF v_a.id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','analise_inexistente'); END IF;
  IF v_a.analisado_em < now()-interval '30 minutes' THEN
    RETURN jsonb_build_object('ok',false,'erro','analise_desatualizada'); END IF;
  IF COALESCE(v_a.confianca,0) < .70 THEN
    RETURN jsonb_build_object('ok',false,'erro','revisao_humana','aplicado',false); END IF;
  SELECT * INTO v_cat FROM public.ncrm_acao_padrao WHERE codigo=p_acao_codigo AND ativa;
  IF v_cat.codigo IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','acao_fora_do_catalogo'); END IF;
  SELECT * INTO v_e FROM public.ncrm_estado WHERE negocio_id=p_negocio_id FOR UPDATE;
  IF v_e.negocio_id IS NULL OR v_e.saida IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'erro','estado_indisponivel'); END IF;
  -- Momentos inequívocos vencem qualquer interpretação do modelo.
  IF v_e.etapa='novo' AND p_acao_codigo <> 'PRIMEIRA_ABORDAGEM' THEN
    RETURN jsonb_build_object('ok',false,'erro','acao_incompativel_com_momento'); END IF;
  IF NOT v_e.respondeu AND v_e.etapa='tentando_contato' AND p_acao_codigo <> 'ENVIAR_CADENCIA' THEN
    RETURN jsonb_build_object('ok',false,'erro','acao_incompativel_com_momento'); END IF;
  IF v_e.resposta_pendente AND p_acao_codigo <> 'RESPONDER_CLIENTE' THEN
    RETURN jsonb_build_object('ok',false,'erro','cliente_aguardando_resposta'); END IF;

  v_prazo := GREATEST(COALESCE(v_a.prazo_sugerido,now()+make_interval(mins=>v_cat.sla_min)),now()+interval '1 minute');
  SELECT lead_id,corretor_id INTO v_lead,v_corretor FROM public.negocios WHERE id=p_negocio_id;
  UPDATE public.ncrm_estado SET
    proxima_acao_tipo=v_cat.proxima_acao_tipo,
    proxima_acao_titulo=v_cat.rotulo,
    proxima_acao_em=v_prazo,
    temperatura=COALESCE(temperatura,'frio'),
    versao=v_e.versao+1,atualizado_em=now(),atualizado_por=v_uid,
    origem_ultima='sara'
  WHERE negocio_id=p_negocio_id AND versao=v_e.versao;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','conflito_versao'); END IF;
  INSERT INTO public.ncrm_evento(negocio_id,lead_id,corretor_id_no_evento,workflow_config_id,
    tipo,resultado,payload,origem,executado_por,idempotency_key,estado_versao_antes,estado_versao_apos)
  VALUES(p_negocio_id,v_lead,v_corretor,v_e.workflow_config_id,'classificacao_sara',p_acao_codigo,
    jsonb_build_object('analise_id',p_analise_id,'prazo',v_prazo),'sara',NULL,
    concat('sara:conduta:',p_analise_id),v_e.versao,v_e.versao+1)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  RETURN jsonb_build_object('ok',true,'aplicado',true,'acao_codigo',p_acao_codigo,
    'acao',v_cat.rotulo,'prazo',v_prazo,'versao',v_e.versao+1);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_aplicar_proxima_acao(bigint,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_aplicar_proxima_acao(bigint,bigint,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ncrm_fila_trabalho(p_filtro text DEFAULT 'agora', p_corretor bigint DEFAULT NULL, p_limite int DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lim int := LEAST(GREATEST(COALESCE(p_limite,100),1),300);
        v_admin boolean; v_broker bigint; v_itens jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  v_admin := COALESCE(public.can_manage_all(),false);
  v_broker := public.current_broker_id();

  SELECT COALESCE(jsonb_agg(item ORDER BY (item->>'prioridade')::int,
    (item->>'proxima_acao_em')::timestamptz NULLS LAST),'[]'::jsonb) INTO v_itens
  FROM (
    SELECT jsonb_build_object(
      'negocio_id',e.negocio_id,'lead_nome',l.nome,'etapa',e.etapa,
      'temperatura',e.temperatura,'corretor_id',n.corretor_id,
      'corretor_nome',COALESCE(u.nome,'—'),'proxima_acao_titulo',e.proxima_acao_titulo,
      'proxima_acao_em',e.proxima_acao_em,'respondeu',e.respondeu,
      'resposta_pendente',e.resposta_pendente,'tentativas_feitas',e.tentativas_feitas,
      'prioridade',CASE WHEN e.resposta_pendente THEN 1 WHEN e.etapa='novo' THEN 2
        WHEN e.proxima_acao_em < now() THEN 3
        WHEN (e.proxima_acao_em AT TIME ZONE 'America/Sao_Paulo')::date=(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 4
        ELSE 5 END,
      'motivo',CASE WHEN e.resposta_pendente THEN 'Cliente respondeu — aguardando você'
        WHEN e.etapa='novo' THEN 'Lead novo — primeira abordagem'
        WHEN e.proxima_acao_em < now() THEN 'Ação atrasada'
        ELSE 'Ação programada' END,
      'espera_min',GREATEST(0,EXTRACT(epoch FROM (now()-COALESCE(e.proxima_acao_em,e.ultima_interacao_em,now())))/60)::numeric(12,1),
      'conduta',public.ncrm_conduta_oficial(e.etapa,e.respondeu,e.resposta_pendente,e.tentativas_feitas,e.proxima_acao_tipo,e.proxima_acao_titulo,e.proxima_acao_em)
    ) item
    FROM public.ncrm_estado e
    JOIN public.negocios n ON n.id=e.negocio_id
    JOIN public.leads l ON l.id=n.lead_id
    LEFT JOIN public.corretores c ON c.id=n.corretor_id
    LEFT JOIN public.usuarios u ON u.id=c.usuario_id
    WHERE e.saida IS NULL
      AND (v_admin OR n.corretor_id=v_broker OR COALESCE(public.manages_broker(n.corretor_id),false))
      AND (p_corretor IS NULL OR n.corretor_id=p_corretor)
      AND CASE COALESCE(p_filtro,'agora')
        WHEN 'agora' THEN e.resposta_pendente OR e.etapa='novo' OR e.proxima_acao_em <= date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo' + interval '1 day'
        WHEN 'vencidos' THEN e.proxima_acao_em < now()
        WHEN 'hoje' THEN (e.proxima_acao_em AT TIME ZONE 'America/Sao_Paulo')::date=(now() AT TIME ZONE 'America/Sao_Paulo')::date
        WHEN 'proximos' THEN e.proxima_acao_em > date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo' + interval '1 day'
        WHEN 'respondeu' THEN e.respondeu
        WHEN 'sem_resposta' THEN NOT e.respondeu
        WHEN 'risco' THEN e.proxima_acao_em < now()-interval '24 hours'
        WHEN 'quente' THEN e.temperatura IN ('quente','negociando')
        ELSE false END
    ORDER BY CASE WHEN e.resposta_pendente THEN 1 WHEN e.etapa='novo' THEN 2 WHEN e.proxima_acao_em<now() THEN 3 ELSE 4 END,
      e.proxima_acao_em NULLS LAST
    LIMIT v_lim
  ) q;
  RETURN jsonb_build_object('ok',true,'itens',v_itens,'regra','motor_operacional_v1');
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_fila_trabalho(text,bigint,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ncrm_fila_trabalho(text,bigint,int) TO authenticated;

COMMIT;
