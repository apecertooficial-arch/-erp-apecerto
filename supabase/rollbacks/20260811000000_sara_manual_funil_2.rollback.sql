BEGIN;
UPDATE public.agentes_ia a
SET system_prompt = b.payload->>'system_prompt',
    versao_atual = (b.payload->>'versao_atual')::integer,
    atualizado_em = now()
FROM public.ncrm_sara_treinamento_backup b
WHERE a.slug='sara' AND b.chave='antes_funil_2';

DELETE FROM public.agente_fonte_links l
USING public.agentes_ia a, public.agente_fontes f
WHERE l.agente_id=a.id AND l.fonte_id=f.id
  AND a.slug='sara' AND f.titulo='Manual Operacional do Funil 2.0';
UPDATE public.agente_fontes SET situacao='rascunho',atualizado_em=now()
WHERE titulo='Manual Operacional do Funil 2.0';
COMMIT;
