-- CRM Nova Era 3.0 — catálogo operacional e cadência D1/D2/D4/D6/D7.
-- Aditiva. Não envia WhatsApp, não altera visita, proposta, venda ou Esteira.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ncrm_acao_padrao (
  codigo text PRIMARY KEY,
  rotulo text NOT NULL,
  proxima_acao_tipo text NOT NULL,
  sla_min integer NOT NULL CHECK (sla_min BETWEEN 1 AND 10080),
  ativa boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ncrm_acao_padrao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ncrm_acao_padrao FROM PUBLIC, anon;
GRANT SELECT ON public.ncrm_acao_padrao TO authenticated;
DROP POLICY IF EXISTS ncrm_acao_padrao_leitura ON public.ncrm_acao_padrao;
CREATE POLICY ncrm_acao_padrao_leitura ON public.ncrm_acao_padrao
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.ncrm_acao_padrao (codigo,rotulo,proxima_acao_tipo,sla_min,ordem) VALUES
 ('RESPONDER_CLIENTE','Responder o cliente','retornar_contato',15,10),
 ('QUALIFICAR_NECESSIDADE','Entender a necessidade','entender_necessidade',120,20),
 ('QUALIFICAR_REGIAO','Confirmar região desejada','entender_necessidade',120,30),
 ('QUALIFICAR_IMOVEL','Confirmar tipo de imóvel','entender_necessidade',120,40),
 ('QUALIFICAR_ORCAMENTO','Confirmar faixa de valor','entender_necessidade',120,50),
 ('QUALIFICAR_PRAZO','Confirmar prazo de compra','entender_necessidade',120,60),
 ('ENVIAR_OPCOES','Enviar opções de imóveis','enviar_opcoes',240,70),
 ('VALIDAR_OPCOES','Validar as opções enviadas','confirmar_recebimento',1440,80),
 ('CONTORNAR_OBJECAO','Tratar a objeção do cliente','retornar_contato',240,90),
 ('CONVIDAR_VISITA','Convidar para uma visita','agendar_visita',240,100),
 ('CONFIRMAR_VISITA','Confirmar a visita','agendar_visita',120,110),
 ('RETOMAR_COMBINADO','Retomar no horário combinado','retornar_contato',60,120),
 ('LIGAR_CLIENTE','Ligar para o cliente','ligar_retorno',360,130),
 ('ENCERRAR_SEM_RESPOSTA','Encerrar a cadência sem resposta','avaliar_descarte',360,140),
 ('REVISAR_MANUALMENTE','Revisar este atendimento','outro',120,150)
ON CONFLICT (codigo) DO UPDATE SET
 rotulo=EXCLUDED.rotulo, proxima_acao_tipo=EXCLUDED.proxima_acao_tipo,
 sla_min=EXCLUDED.sla_min, ativa=true, ordem=EXCLUDED.ordem;

-- Workflow v3: primeira abordagem em até 5 min; reforço no mesmo dia;
-- retomadas nos dias 2, 4 e 6; encerramento no dia 7.
DO $$
DECLARE v_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ncrm_workflow_config WHERE versao = 3) THEN RETURN; END IF;
  INSERT INTO public.ncrm_workflow_config
    (status,versao,timezone,janela_inicio,janela_fim,max_tentativas,fds_operacional,
     espera_apos_automacao_min,vigencia_inicio)
  VALUES ('rascunho',3,'America/Sao_Paulo','09:00','19:00',6,false,360,now())
  RETURNING id INTO v_id;

  INSERT INTO public.ncrm_workflow_passo
    (config_id,ordem,rotulo,canal_sugerido,intervalo_min,texto_orientacao) VALUES
   (v_id,1,'Primeira abordagem — chamar em até 5 minutos','whatsapp',5,'Apresente-se e confirme o interesse do cliente.'),
   (v_id,2,'Cadência 1 — facilitar uma resposta curta','whatsapp',360,'Faça uma pergunta simples, com alternativas curtas.'),
   (v_id,3,'Cadência D+2 — nova tentativa humana','whatsapp',1080,'Retome sem repetir a mensagem anterior.'),
   (v_id,4,'Cadência D+4 — entregar informação útil','whatsapp',2880,'Entregue valor ligado ao interesse original.'),
   (v_id,5,'Cadência D+6 — última retomada de valor','whatsapp',2880,'Faça uma última retomada curta e útil.'),
   (v_id,6,'Cadência D+7 — encerramento elegante','whatsapp',1440,'Encerre sem pressão e mantenha o canal aberto.');

  UPDATE public.ncrm_workflow_config
     SET status='encerrada',vigencia_fim=now()
   WHERE status='publicada' AND vigencia_fim IS NULL;
  UPDATE public.ncrm_workflow_config SET status='publicada',publicado_em=now() WHERE id=v_id;
END $$;

UPDATE public.ncrm_cadencia_config
   SET max_tentativas=6,
       intervalos_min='[5,360,1080,2880,2880,1440]'::jsonb,
       hora_inicio=9,hora_fim=19,dias_uteis=ARRAY[1,2,3,4,5],
       tolerancia_min=15,atualizado_em=now()
 WHERE id=true;

COMMIT;
