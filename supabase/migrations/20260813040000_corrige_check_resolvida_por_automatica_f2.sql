-- Corrige incompatibilidade entre o trigger do Funil 2.0 e o CHECK da notificacao.
--
-- ncrm_private.f2_notificar_primeira_abordagem() resolve o aviso gravando
-- resolvida_por='automatica_f2', mas o CHECK so admitia 'automatica'|'usuario'.
--
-- Consequencia latente: qualquer UPDATE em f2_lead que saia da etapa 'novo' ou
-- preencha ultima_acao_confirmada_em (ou seja: a confirmacao da primeira
-- abordagem, o caminho feliz) abortaria com violacao de constraint. O mesmo
-- para DELETE de um card com aviso aberto.
--
-- Nao explodiu ate hoje porque f2_pescar_negocio inseria corretor_id NULL, o
-- trigger nao criava o aviso, e o UPDATE nao encontrava linha para resolver.
-- Ao passar a gravar o dono no card, o caminho vira alcancavel.
--
-- Correcao aditiva: aceita o valor que o trigger ja usa, preservando a
-- rastreabilidade de que a resolucao veio do Funil 2.0.

BEGIN;

ALTER TABLE public.ncrm_notificacao
  DROP CONSTRAINT IF EXISTS ncrm_notificacao_resolvida_por_check;

ALTER TABLE public.ncrm_notificacao
  ADD CONSTRAINT ncrm_notificacao_resolvida_por_check
  CHECK (resolvida_por IS NULL
         OR resolvida_por = ANY (ARRAY['automatica'::text, 'usuario'::text, 'automatica_f2'::text]));

COMMIT;
