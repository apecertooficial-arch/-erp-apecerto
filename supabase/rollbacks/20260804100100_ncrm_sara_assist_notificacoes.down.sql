-- ROLLBACK versionado. Remove o modo assist e as notificações do Nova Era.
-- Nenhum atendimento, evento ou análise é apagado.
DROP FUNCTION IF EXISTS public.ncrm_notificacao_vista(bigint);
DROP FUNCTION IF EXISTS public.ncrm_notificacoes();
DROP FUNCTION IF EXISTS ncrm_private.notificacoes_sincronizar();
DROP TABLE IF EXISTS public.ncrm_notificacao;

DROP FUNCTION IF EXISTS public.ncrm_sara_assist_relatorio(int);
DROP FUNCTION IF EXISTS public.ncrm_sara_reverter(bigint);
DROP FUNCTION IF EXISTS public.ncrm_sara_organizar(bigint,bigint);
DROP FUNCTION IF EXISTS ncrm_private.sara_transicao_permitida(text,text);
DROP TABLE IF EXISTS public.ncrm_sara_acao;
DROP TABLE IF EXISTS public.ncrm_sara_assist_config;

-- Volta o CHECK de modo ao conjunto anterior. Se a Sara estiver em assist, cai para observer.
UPDATE public.ncrm_sara_config SET modo = 'observer' WHERE modo = 'assist';
ALTER TABLE public.ncrm_sara_config DROP CONSTRAINT IF EXISTS ncrm_sara_config_modo_check;
ALTER TABLE public.ncrm_sara_config ADD CONSTRAINT ncrm_sara_config_modo_check
  CHECK (modo IN ('observer','suggest','execute'));
