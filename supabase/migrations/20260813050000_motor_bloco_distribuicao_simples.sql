-- Automacoes: bloco "Distribuir lead (simples)" no motor.
--
-- O bloco `distribution` atual faz TRES coisas: distribui, envia a abordagem
-- automatica e retem o lead ate 12h esperando resposta. As duas ultimas
-- contradizem o contrato do Funil 2.0 ("a primeira abordagem nunca e enviada
-- automaticamente"), entao o bloco novo `distribution-simple` distribui e para.
--
-- Diferencas em relacao ao `distribution`:
--   * NAO chama motor_envia_abordagem
--   * NAO cria entrada RESP: em motor_fila (nao retem o lead)
--   * tambemNegocio FORCADO true — negocio sem corretor nao entra no Funil 2.0,
--     e esse checkbox desmarcado no bloco antigo era a causa de lead com dono
--     e negocio orfao
--   * onlineOnly default true (a roleta oficial e entre presentes aptos)
--   * duas saidas apenas: `out` (proximo passo) e `err` (ninguem disponivel)
--
-- IMPLEMENTACAO POR PATCH, e nao por CREATE OR REPLACE completo, porque
-- public.motor_rodar_unchecked nunca foi versionada neste repositorio: a fonte
-- de verdade e o banco. Reescrever a funcao inteira aqui a partir de uma copia
-- perderia qualquer alteracao feita no banco depois desta migration. O patch
-- e idempotente: se o ramo ja existe, nao faz nada.

BEGIN;

DO $mig$
DECLARE d text; novo text; ok int;
BEGIN
  SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE proname='motor_rodar_unchecked';
  IF d IS NULL THEN RAISE EXCEPTION 'motor_rodar_unchecked ausente'; END IF;

  IF position('tipo=''distribution-simple''' in d) > 0 THEN
    RAISE NOTICE 'ramo distribution-simple ja instalado';
    RETURN;
  END IF;

  novo := E'elsif tipo=''distribution-simple'' then\n'
       || E'      -- Funil 2.0: distribui e PARA. Sem abordagem automatica, sem reter o\n'
       || E'      -- lead esperando resposta. Quem manda a mensagem e o corretor, pelo\n'
       || E'      -- celular, e a evidencia e o D-API. tambemNegocio e forcado TRUE:\n'
       || E'      -- negocio sem corretor nao entra no Funil 2.0.\n'
       || E'      select motor_roleta(p_auto_id, a_nome, cur, p_lead, v_lead_id, v_negocio_id,\n'
       || E'        coalesce(b#>''{options,distribuicao,items}'',''[]''::jsonb),\n'
       || E'        coalesce((b#>>''{options,distribuicao,onlineOnly}'')::boolean, true),\n'
       || E'        true,\n'
       || E'        coalesce(b#>''{options,distribuicao,protecao}'', ''["venda","visita_agendada","visita_realizada"]''::jsonb)) into _dist_cor;\n'
       || E'      if _dist_cor is null then\n'
       || E'        trace:=trace||E''>> Distribuicao simples (ninguem disponivel)\\n'';\n'
       || E'        cur:=b#>>''{options,errorNextBlockId}'';\n'
       || E'      else\n'
       || E'        trace:=trace||E''>> Distribuicao simples\\n'';\n'
       || E'        cur:=b#>>''{options,nextBlockId}'';\n'
       || E'      end if;\n\n'
       || E'    elsif tipo=''distribution'' then';

  d := replace(d, E'elsif tipo=''distribution'' then', novo);

  SELECT count(*) INTO ok FROM regexp_matches(d, 'tipo=''distribution-simple''', 'g');
  IF ok <> 1 THEN RAISE EXCEPTION 'patch nao aplicou corretamente (ocorrencias=%)', ok; END IF;

  EXECUTE d;
END
$mig$;

DO $check$
BEGIN
  IF position('distribution-simple' in (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='motor_rodar_unchecked')) = 0 THEN
    RAISE EXCEPTION 'ramo_distribution_simple_ausente';
  END IF;
END
$check$;

COMMIT;
