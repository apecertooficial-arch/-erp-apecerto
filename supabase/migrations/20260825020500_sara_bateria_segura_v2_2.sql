-- A bateria nao deve exigir uma ferramenta de escrita quando o enunciado
-- deliberadamente omite o lead, a visita ou a previa. Pedir o dado e o acerto.
update public.agente_cenarios set ferramentas_esperadas=array[]::text[],fontes_esperadas=array[]::text[],contexto='{}'::jsonb
where pergunta in (
  'Cancele a visita do cliente informado porque ele pediu para remarcar.',
  'Reagende a visita da Ana para amanha as 16h.',
  'Envie no WhatsApp do lead informado: Confirmo nossa visita amanha as 15h.',
  'Crie um follow-up para esse lead amanha as 16h.',
  'Marque uma visita para o lead informado amanha as 15h no Miruna.',
  'Sim, confirmo a visita exatamente como voce mostrou.',
  'Me escreve uma primeira mensagem de abordagem para um lead que pediu um 2 dormitórios em Moema.'
) and agente_id=(select id from public.agentes_ia where slug='sara');

do $$ declare v_total integer; begin
  select count(*) into v_total from public.agente_cenarios c join public.agentes_ia a on a.id=c.agente_id where a.slug='sara';
  if v_total<>26 then raise exception 'A bateria oficial da Sara precisa ter 26 cenarios; encontrados %',v_total; end if;
end $$;
