-- Usa o tipo canonico ja permitido pela central de notificacoes.
insert into public.ncrm_notificacao_tipos_ativos(tipo,motivo)
values('canal_indisponivel','WhatsApp ou outro canal recusou a abordagem automatica')
on conflict (tipo) do update set motivo=excluded.motivo;

do $publish$
declare
  r record;
  v_mapa jsonb;
  v_versao integer;
  v_versao_id bigint;
  v_esperada bigint;
begin
  for r in select * from public.automacoes where id in(65,66) order by id for update
  loop
    v_esperada:=case r.id when 65 then 99 else 100 end;
    if r.versao_publicada_id is distinct from v_esperada then
      raise exception 'automacao % mudou: versao publicada atual %',r.id,r.versao_publicada_id;
    end if;
    v_mapa:=replace(
      r.mapa::text,'"envio_abordagem_falhou"','"canal_indisponivel"'
    )::jsonb;
    if v_mapa=r.mapa then raise exception 'tipo antigo ausente na automacao %',r.id; end if;
    select coalesce(max(versao),0)+1 into v_versao
      from public.automacao_versoes where automacao_id=r.id;
    insert into public.automacao_versoes(
      automacao_id,versao,nome,mapa,observacao,criado_por
    ) values(
      r.id,v_versao,r.nome,v_mapa,
      'Saida de erro usa o tipo canonico canal_indisponivel','codex'
    ) returning id into v_versao_id;
    update public.automacoes
       set mapa=v_mapa,mapa_rascunho=v_mapa,versao_publicada_id=v_versao_id,
           atualizada_em=now(),publicado_em=now()
     where id=r.id;
  end loop;
end
$publish$;
