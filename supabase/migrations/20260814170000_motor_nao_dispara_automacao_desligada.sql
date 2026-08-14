-- 14/08: ABORDAGENS AUTOMATICAS SAINDO DE AUTOMACOES DESLIGADAS
--
-- O Romulo viu varios corretores disparando abordagem sozinhos. Era o ERP:
-- automacoes #57 ("Entrada - lead distribuido dispara a abordagem") e #53
-- ("Cadencia de contato") enviaram texto + video pelas instancias dos
-- corretores, HTTP 200, para 14 clientes. As duas estavam com ativa = false.
--
-- DUAS FALHAS INDEPENDENTES, e as duas precisam ser fechadas:
--
-- (1) A FILA NAO RECONFERE NADA. motor_evento_disparar filtra por `ativa` na
--     hora de enfileirar -- correto. Mas motor_processar_fila pegava qualquer
--     linha 'pendente' e mandava rodar sem olhar a automacao de novo. Desligar
--     a automacao nao parava o que ja estava na fila: 144 itens continuariam
--     saindo depois do desligamento. Desligar tem que ser um freio, nao um
--     pedido para os proximos.
--
-- (2) A CHAVE GERAL NAO ESTAVA LIGADA EM NADA. Existe motor_flags
--     'abordagem_automatica' = false desde sempre, e nenhuma funcao de envio
--     consultava. Um interruptor que nao interrompe e pior do que nao ter:
--     quem olha o painel acredita que esta desligado.
--
-- Onde a trava (2) foi colocada e uma escolha deliberada: dentro de
-- ncrm_bloqueia_abordagem_automatica, que motor_envia_abordagem ja chama na
-- primeira linha. Poderia ter reescrito motor_envia_abordagem -- 300 linhas com
-- failover, anti-duplicidade e variantes de numero -- mas reproduzir tudo isso
-- para acrescentar um `if` seria arriscar quebrar o envio inteiro para
-- consertar um interruptor. CONTRAPARTIDA ASSUMIDA: o registro em
-- motor_execucoes vai dizer "primeira abordagem e humana" mesmo quando o
-- bloqueio veio da chave geral. Se isso confundir na leitura do painel, o
-- proximo passo e separar as duas mensagens.

create or replace function public.motor_processar_fila()
returns integer
language plpgsql
security definer
as $function$
declare r record; n int:=0; claimed int; v_ok boolean;
begin
  for r in select id, automacao_id, bloco_id, lead from motor_fila
           where status='pendente' and due_at<=now()
           order by due_at limit 50
           for update skip locked loop

    -- A AUTOMACAO AINDA PODE RODAR? Reconferido AQUI, no momento de executar,
    -- e nao so no momento de enfileirar. Entre uma coisa e outra pode ter
    -- passado uma hora e alguem ter desligado.
    select (a.ativa is true and coalesce(a.status,'publicado') = 'publicado'
            and not coalesce(a.arquivada,false))
      into v_ok
      from automacoes a where a.id = r.automacao_id;

    if coalesce(v_ok,false) is not true then
      update motor_fila set status='cancelado', processado_em=now() where id=r.id;
      continue;
    end if;

    update motor_fila set status='processando' where id=r.id and status='pendente';
    get diagnostics claimed = row_count;
    if claimed = 0 then continue; end if;
    begin
      perform motor_rodar(r.automacao_id, r.lead, nullif(r.bloco_id,'START'), case when r.bloco_id='START' then 0 else 1 end);
      update motor_fila set status='ok', processado_em=now() where id=r.id;
    exception when others then
      update motor_fila set status='erro', processado_em=now() where id=r.id;
    end;
    n:=n+1;
  end loop;
  return n;
end $function$;

-- A CHAVE GERAL DE ABORDAGEM AUTOMATICA, finalmente ligada em alguma coisa.
--
-- Ordem importa: a flag e verificada ANTES de qualquer outra regra. Quando
-- 'abordagem_automatica' esta desligada, nenhuma abordagem sai por nenhum
-- caminho -- e nao interessa o modo de primeira abordagem, o momento do lead
-- nem a automacao. E o freio de mao.
--
-- Fail-closed de proposito: se a flag nao existir na tabela, o padrao e
-- BLOQUEAR. O custo de uma abordagem que nao saiu e um corretor mandando na
-- mao; o custo de uma que saiu sem querer e uma mensagem no WhatsApp de um
-- cliente que ninguem pode apagar.
create or replace function public.ncrm_bloqueia_abordagem_automatica(p_lead_id bigint)
returns boolean
language plpgsql
stable security definer
set search_path to ''
as $function$
DECLARE v_modo text; v_neg bigint; v_flag boolean;
BEGIN
  SELECT f.ativo INTO v_flag FROM public.motor_flags f WHERE f.nome = 'abordagem_automatica';
  IF COALESCE(v_flag, false) IS NOT TRUE THEN RETURN true; END IF;

  SELECT modo_primeira_abordagem INTO v_modo FROM public.ncrm_entrada_config WHERE id;
  IF COALESCE(v_modo,'automatica') <> 'humana' THEN RETURN false; END IF;
  SELECT n.id INTO v_neg FROM public.negocios n
   WHERE n.lead_id = p_lead_id AND n.status = 'aberto'
   ORDER BY n.criado_em DESC, n.id DESC LIMIT 1;
  IF v_neg IS NULL THEN RETURN false; END IF;
  RETURN COALESCE(ncrm_private.negocio_elegivel_nova_era(v_neg), false);
EXCEPTION WHEN OTHERS THEN RETURN true;  -- duvida nao autoriza envio
END $function$;

-- Limpeza do que ja estava enfileirado por automacao desligada. Sem isto o
-- conserto valeria so para o futuro e as 144 mensagens sairiam do mesmo jeito.
update public.motor_fila f
   set status = 'cancelado', processado_em = now()
  from public.automacoes a
 where a.id = f.automacao_id
   and f.status = 'pendente'
   and (a.ativa is distinct from true or coalesce(a.status,'publicado') <> 'publicado' or coalesce(a.arquivada,false));
