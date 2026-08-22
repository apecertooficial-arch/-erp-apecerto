-- Falhas definitivas de transporte seguem por uma saida explicita do bloco de
-- abordagem. A distribuicao permanece confirmada e corretor/gestao sao avisados.

insert into public.ncrm_notificacao_tipos_ativos(tipo,motivo)
values('envio_abordagem_falhou','A abordagem automatica nao pode ser entregue e exige acao humana')
on conflict (tipo) do update set motivo=excluded.motivo;

do $publish$
declare
  r record;
  v_mapa jsonb;
  v_blocks jsonb;
  v_wires jsonb;
  v_idx integer;
  v_versao integer;
  v_versao_id bigint;
  v_esperada bigint;
begin
  for r in
    select * from public.automacoes where id in (65,66) order by id for update
  loop
    v_esperada := case r.id when 65 then 97 else 98 end;
    if r.versao_publicada_id is distinct from v_esperada then
      raise exception 'automacao % mudou: versao publicada atual %',r.id,r.versao_publicada_id;
    end if;
    v_mapa := r.mapa;
    if exists(
      select 1 from jsonb_array_elements(v_mapa#>'{automation,blocks}') e
       where e->>'id'='b20'
    ) then
      raise exception 'automacao % ja possui b20',r.id;
    end if;

    select ord::integer-1 into v_idx
      from jsonb_array_elements(v_mapa#>'{automation,blocks}') with ordinality e(value,ord)
     where value->>'id'='b17';
    if v_idx is null then raise exception 'automacao % sem b17',r.id; end if;
    v_mapa := jsonb_set(
      v_mapa,array['automation','blocks',v_idx::text,'options','errorNextBlockId'],
      to_jsonb('b20'::text)
    );

    v_blocks := v_mapa#>'{automation,blocks}';
    v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
      'id','b20','type','action',
      'options',jsonb_build_object(
        'actions',jsonb_build_array(
          jsonb_build_object(
            'name','send-notification-action','group','',
            'options',jsonb_build_object(
              'tipo','envio_abordagem_falhou','publico','corretor','prioridade',1,
              'titulo','Abordagem automatica nao entregue',
              'detalhe','O lead foi distribuido, mas o WhatsApp recusou a abordagem. Abra o CRM e confira o telefone.'
            )
          ),
          jsonb_build_object(
            'name','send-notification-action','group','',
            'options',jsonb_build_object(
              'tipo','envio_abordagem_falhou','publico','gestao','prioridade',1,
              'titulo','Falha na abordagem automatica',
              'detalhe','A distribuicao foi mantida, mas o WhatsApp recusou a abordagem. Abra o CRM para acompanhar.'
            )
          )
        ),
        'nextBlockId','','errorNextBlockId',''
      ),
      'presentation',jsonb_build_object('x',1900,'y',250),
      'sourceBlockId',gen_random_uuid()::text
    ));
    v_mapa := jsonb_set(v_mapa,'{automation,blocks}',v_blocks);
    v_mapa := jsonb_set(v_mapa,'{editor,blocks,b20}',jsonb_build_object(
      'x',1900,'y',250,'id','b20','fam','acao','sub','',
      'note','Saida explicita quando a abordagem nao pode ser entregue',
      'extra','{}'::jsonb,'parts','[]'::jsonb,'ramos','[]'::jsonb,'noteOpen',false
    ),true);
    v_wires := coalesce(v_mapa#>'{editor,wires}','[]'::jsonb) ||
      jsonb_build_array(jsonb_build_object('from','b17','to','b20','port','error'));
    v_mapa := jsonb_set(v_mapa,'{editor,wires}',v_wires);
    v_mapa := jsonb_set(
      v_mapa,'{editor,uid}',
      to_jsonb(coalesce((v_mapa#>>'{editor,uid}')::integer,0)+1)
    );

    select coalesce(max(versao),0)+1 into v_versao
      from public.automacao_versoes where automacao_id=r.id;
    insert into public.automacao_versoes(
      automacao_id,versao,nome,mapa,observacao,criado_por
    ) values(
      r.id,v_versao,r.nome,v_mapa,
      'Saida visivel para falha definitiva de abordagem, sem desfazer a distribuicao',
      'codex'
    ) returning id into v_versao_id;
    update public.automacoes
       set mapa=v_mapa,mapa_rascunho=v_mapa,
           versao_publicada_id=v_versao_id,
           atualizada_em=now(),publicado_em=now(),status='publicado',ativa=true
     where id=r.id;
  end loop;
end
$publish$;
