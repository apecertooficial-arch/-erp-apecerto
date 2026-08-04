-- Restaura somente os cards alterados pela correção 20260811015000.
BEGIN;

WITH restaurar AS (
  SELECT DISTINCT ON (a.chave)
    a.chave::uuid AS id,
    jsonb_populate_record(NULL::public.f2_lead,a.antes) AS anterior
  FROM public.f2_config_audit a
  WHERE a.tipo='migracao'
    AND a.acao IN ('corrigir_pos_visita_sem_evidencia','promover_visita_realizada')
  ORDER BY a.chave,a.criado_em
)
UPDATE public.f2_lead f
SET etapa=(r.anterior).etapa,
    momento_codigo=(r.anterior).momento_codigo,
    acao_codigo=(r.anterior).acao_codigo,
    acao_rotulo=(r.anterior).acao_rotulo,
    proxima_acao_em=(r.anterior).proxima_acao_em,
    cadencia_passo=(r.anterior).cadencia_passo,
    ultima_reavaliacao_resumo=(r.anterior).ultima_reavaliacao_resumo,
    atualizado_em=now(),
    versao=f.versao+1
FROM restaurar r
WHERE f.id=r.id;

DELETE FROM public.f2_evento
WHERE titulo IN ('Pós-visita corrigido','Visita realizada reconhecida');
DELETE FROM public.f2_config_audit
WHERE tipo='migracao'
  AND acao IN ('corrigir_pos_visita_sem_evidencia','promover_visita_realizada');

ALTER TABLE public.f2_evento DROP CONSTRAINT IF EXISTS f2_evento_tipo_check;
ALTER TABLE public.f2_evento ADD CONSTRAINT f2_evento_tipo_check
  CHECK (tipo IN ('importacao','momento_alterado','acao_confirmada','sara_reavaliou'));

COMMIT;
