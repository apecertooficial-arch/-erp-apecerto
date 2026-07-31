-- ncrm_bloqueia_abordagem_automatica e uma funcao de SISTEMA: quem a chama e
-- motor_envia_abordagem, dentro do proprio banco. Nunca houve motivo para a UI
-- chama-la.
--
-- Concedida a authenticated, ela virava um oraculo: qualquer usuario logado
-- podia passar lead_id arbitrarios e descobrir, um a um, quais corretores
-- participam da abordagem humana. Nao expoe dado pessoal, mas revela a
-- configuracao do piloto para quem nao precisa saber.
--
-- Achado da auditoria da propria rodada de contencao.

REVOKE ALL ON FUNCTION public.ncrm_bloqueia_abordagem_automatica(bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ncrm_bloqueia_abordagem_automatica(bigint)
  TO service_role;

DO $v$
BEGIN
  IF has_function_privilege('authenticated','public.ncrm_bloqueia_abordagem_automatica(bigint)','EXECUTE')
     OR has_function_privilege('anon','public.ncrm_bloqueia_abordagem_automatica(bigint)','EXECUTE') THEN
    RAISE EXCEPTION 'ABORTADO: a funcao continua alcancavel por anon/authenticated';
  END IF;
END $v$;
