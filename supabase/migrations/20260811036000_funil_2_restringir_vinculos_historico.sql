-- Mantém vínculo auxiliar somente quando o lead não possui mensagem pelo
-- lead_id canônico. Evita anexar um segundo contato desnecessário ao chat.
BEGIN;
DELETE FROM public.f2_historico_vinculo h
USING public.f2_lead f,public.negocios n
WHERE f.id=h.funil_lead_id
  AND n.id=f.origem_negocio_id
  AND EXISTS (
    SELECT 1 FROM public.wa_contatos c
    JOIN public.wa_conversas v ON v.contato_id=c.id
    JOIN public.wa_mensagens m ON m.conversa_id=v.id
    WHERE c.lead_id=n.lead_id
  );
COMMIT;
