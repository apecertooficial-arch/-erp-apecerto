# 15 — Contrato transacional estado ↔ evento imutável (FASE 2.2)

Fecha a ordem canônica (correção 5) e o endurecimento das funções (correção 7). Nenhuma função é
criada nesta fase — isto é especificação.

## 1. Ordem canônica (uma transação por mutação)

Toda RPC que altera `ncrm_estado` executa EXATAMENTE nesta ordem:

```
1. SELECT versao INTO v_antes
     FROM public.ncrm_estado
     WHERE negocio_id = p_negocio_id
     FOR UPDATE;                         -- trava a linha; serializa mutações concorrentes do MESMO negócio
2. IF NOT FOUND THEN
     -- criação só é permitida a caminhos controlados (automação/migração); operações humanas -> 'estado_inexistente'
3. IF p_versao <> v_antes THEN RETURN {ok:false, erro:'versao_conflito'};  -- lock OTIMISTA sob a trava física
4. <validar regras de negócio>          -- espelho das funções puras da Fase 1.2 (validar tentativa/ação/saída)
5. UPDATE public.ncrm_estado
     SET <campos>, versao = v_antes + 1, atualizado_em = now(), atualizado_por = v_uid, origem_ultima = v_origem
     WHERE negocio_id = p_negocio_id AND versao = v_antes;   -- afeta 1 linha (garantido pela trava)
6. INSERT INTO public.ncrm_evento (
     negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, ...,
     origem, executado_por, idempotency_key,
     estado_versao_antes = v_antes, estado_versao_apos = v_antes + 1);
     -- EVENTO POR ÚLTIMO. Se a UNIQUE(idempotency_key) colidir com uma transação concorrente que
     -- já commitou, ESTE INSERT falha e TODA a transação (incl. o UPDATE do passo 5) sofre ROLLBACK.
7. RETURN {ok:true, versao: v_antes + 1};   -- COMMIT implícito
```

**Por que o evento por último?** Garante o invariante “todo evento reflete um estado que realmente
avançou”. A `UNIQUE(idempotency_key)` converte corrida em rollback atômico — nunca em evento órfão
(evento sem mudança de estado) nem em estado avançado sem evento.

**Idempotência.** Reenvio com o mesmo `idempotency_key` cai no passo 6 (conflito) → a transação
inteira aborta e o wrapper devolve `{ok:true, ja_processado:true}` após reconsultar o evento
existente. O cliente gera `ui:<uuid>` por ação; webhook usa `wa:<wa_message_id>`; automação usa
`auto:<execucao_id>`.

**Conflito de versão.** `versao_conflito` no passo 3 significa que o cliente leu um estado velho;
ele deve recarregar o snapshot e reavaliar (as funções puras da Fase 1.2 rodam de novo no cliente
antes de reenviar). Nenhuma decisão é sobrescrita silenciosamente.

## 2. Casos especiais

- **Criação do snapshot** (primeiro toque, via automação/migração): não há linha para travar; a
  ordem é `INSERT estado (versao=1)` → `INSERT evento (estado_versao_antes=0, estado_versao_apos=1)`
  na mesma transação. `0` denota pré-existência (documentado no CHECK do evento).
- **Evento apenas sugestivo (Sara sem aplicação)**: não há UPDATE de estado; o evento entra com
  `estado_versao_antes/apos = NULL` e `payload.aplicado = false`. Precedência humana no §3.
- **Saídas (visita/proposta/descarte/nutrição)**: seguem a mesma ordem; o passo 5 grava
  `saida`, `saida_em` e a FK correspondente (`visita_id`/`proposta_id`) e ZERA a próxima ação —
  respeitando os invariantes bidirecionais do doc 16 dentro da mesma transação.
- **Reativação**: passo 5 limpa `saida`/FK e re-exige próxima ação; evento `reativacao` (doc 18).

## 3. Guarda e endurecimento das funções (correção 7)

Wrapper PÚBLICO mínimo (exposto ao PostgREST) + lógica em `ncrm_private` (não exposta):

```
FUNCTION public.ncrm_<acao>(p_negocio_id bigint, p_versao int, <dados>, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;

  -- DERIVA do BANCO (nunca do cliente): negócio -> lead/corretor ATUAIS
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor
    FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;

  -- AUTORIZAÇÃO derivada (posse atual + capacidade); origem FIXADA (não é parâmetro)
  IF NOT ncrm_private.pode_operar_negocio(p_negocio_id) THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;

  RETURN ncrm_private.aplicar_<acao>(
    p_negocio_id, p_versao, <dados>, v_lead, v_corretor, v_uid,
    'usuario'::text, COALESCE(p_idem, 'ui:'||gen_random_uuid()::text));
END $$;
REVOKE ALL ON FUNCTION public.ncrm_<acao>(...) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_<acao>(...) TO authenticated;
```

Regras de endurecimento (todas as funções `ncrm_*`):

1. `SET search_path = ''` e **todas** as referências qualificadas (`public.ncrm_estado`,
   `public.negocios`, `ncrm_private.…`).
2. `SECURITY DEFINER` serve para concentrar a transação — **não** para contornar RLS. A autorização
   é explícita (`ncrm_private.pode_operar_negocio`), lida da posse atual em `negocios`.
3. `origem`, `lead_id`, `corretor_id`, `executado_por` e permissão são **derivados** de `auth.uid()`
   e de `public.negocios`. `p_origem`/`p_corretor_id`/`p_lead_id` do cliente são **ignorados**.
4. `REVOKE ALL ... FROM PUBLIC, anon`; `GRANT EXECUTE` só ao papel necessário (`authenticated`, ou
   `service_role` para automação/webhook).
5. Retorno padronizado `{ok, erro?, versao?, ja_processado?}` — nunca exceção crua ao cliente
   (exceto `versao_conflito`/idempotência tratados acima).
6. **Sara**: wrapper própria (`ncrm_sara_classificar`) que exige claim de `app_metadata` (nunca
   `user_metadata`); aplica ao estado só se `ultima_decisao_humana_em <= p_base_estado_em`, senão
   registra o evento sugestivo com `aplicado=false` e devolve `precedencia_humana`.

## 4. Ordem de implementação (fase 3+, referência)

config (rascunho→publicar) → helpers de posse → estado/evento → registrar_tentativa/concluir_acao →
saídas (visita/proposta/descarte/nutrição) → reativação → automação (service_role) → Sara.
