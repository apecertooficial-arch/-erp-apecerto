# 10 — Contratos de integração (FASE 2.0 — DESENHO, nenhuma função criada)

> ⚠️ **SUPERSEDIDO EM PARTE PELA FASE 2.2.** Onde este documento divergir dos docs 14–20, prevalecem os 14–20. Em especial: `ncrm_estado` **não** guarda `corretor_id` nem `lead_id`; **não** há trigger de sincronização em `negocios`; a RLS lê a **posse atual** em `negocios` (doc 17); invariantes bidirecionais no doc 16; ordem transacional no doc 15; ciclo da proposta no doc 18; draft autoritativo `sql-drafts/DRAFT-FASE-2.2-modelo-persistente.sql`.

Todas as operações abaixo são RPCs transacionais `SECURITY DEFINER` com `search_path` fixo,
guarda interna (`auth.uid()` + dono/gestor + `has_perm`), grant apenas a `authenticated`
(ou `service_role` quando indicado) e `REVOKE FROM PUBLIC, anon`. Padrão de retorno:
`{ok: true, ...}` ou `{ok: false, erro: <codigo>}` — nunca exceção crua para o cliente.
Erros canônicos: `versao_conflito` · `ja_processado` · `precedencia_humana` · `sem_permissao` ·
`estado_invalido` · `payload_invalido`.

Parâmetros comuns: `p_negocio_id`, `p_versao` (optimistic lock), `p_idem` (chave de idempotência).
**`origem`, `lead_id`, `corretor_id`, `executado_por` e permissão NUNCA vêm do cliente** — são
derivados no banco a partir de `auth.uid()` e de `public.negocios` (bloqueios 4 e 7). O cliente
não envia `p_origem` para operações humanas: a origem é fixada como `'usuario'` pela wrapper.

## Guarda de uma RPC (pseudocódigo completo — bloqueio 4)

Padrão: wrapper PÚBLICO mínimo (exposto ao PostgREST) que valida e delega à lógica em
`ncrm_private` (não exposta). `SECURITY DEFINER`, `SET search_path = ''`, referências qualificadas.

```
-- WRAPPER PÚBLICO (exposto). Só valida identidade/permissão e deriva contexto.
FUNCTION public.ncrm_<acao>(p_negocio_id bigint, p_versao int, ...dados..., p_idem text)
  RETURNS jsonb  LANGUAGE plpgsql  SECURITY DEFINER  SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;

  -- 1. DERIVA negócio→lead→corretor do BANCO (nunca do cliente)
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor
    FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;

  -- 2. PERMISSÃO derivada: dono OU gestor da carteira, E capacidade no módulo
  IF NOT ( v_corretor = public.current_broker_id()
           OR public.manages_broker(v_corretor) )
     OR NOT public.has_perm('crm','operar') THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;

  -- 3. DELEGA à lógica privilegiada; origem FIXADA (não é parâmetro do cliente)
  RETURN ncrm_private.aplicar_<acao>(
    p_negocio_id, p_versao, ...dados..., v_lead, v_corretor, v_uid,
    'usuario'::text, COALESCE(p_idem, 'ui:'||gen_random_uuid()::text) );
END $$;
REVOKE ALL ON FUNCTION public.ncrm_<acao>(...) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_<acao>(...) TO authenticated;

-- LÓGICA PRIVILEGIADA (ncrm_private, NÃO exposta). Transação evento+estado com lock.
FUNCTION ncrm_private.aplicar_<acao>(...)  SECURITY DEFINER  SET search_path = ''
AS $$
BEGIN
  -- INSERT public.ncrm_evento (workflow_config_id da config vigente, estado_versao_antes = p_versao, ...)
  -- UPDATE public.ncrm_estado SET ..., versao = versao + 1
  --   WHERE negocio_id = p_negocio_id AND versao = p_versao;   -- optimistic lock
  -- IF NOT FOUND THEN RAISE ... 'versao_conflito'  (aborta a transação inteira)
  -- ON CONFLICT (idempotency_key) DO NOTHING no evento => se já existe, retorna 'ja_processado'
END $$;
```

Notas de segurança: `SECURITY DEFINER` NÃO é usado para "furar" RLS — é usado para concentrar a
escrita transacional; a autorização é explícita na wrapper. Sara: wrapper própria que exige claim
de `app_metadata` (nunca `user_metadata`) e aplica precedência humana (doc 08).

## 0. Núcleo operacional

| RPC | Faz (em UMA transação) |
|---|---|
| `ncrm_registrar_tentativa(p_negocio_id, p_versao, p_canal, p_resultado, p_obs, p_proxima_*, p_idem)` | valida regras da Fase 1.2 (espelho de `validarConclusaoTentativa`); INSERT evento `tentativa` (numero = tentativas_feitas+1); UPDATE estado (contador, respondeu/primeira_resposta se resultado=respondeu, próxima ação aprovada, etapa derivada, versao+1) |
| `ncrm_concluir_acao(p_negocio_id, p_versao, p_resultado, p_obs, p_proxima_*, p_visita, p_proposta, p_descarte, p_idem)` | espelho de `aplicarResultadoAcaoComercial`; nunca toca contador de tentativas; roteia p/ contratos A/B/C quando o resultado é saída |
| `ncrm_registrar_msg_automatica(p_negocio_id, p_instancia_id, p_wa_message_id, p_enviado_em)` — **service_role** | evento `mensagem_automatica` com `idem='auto:'||p_wa_message_id`; estado: msg_automatica_em, aguardando_automacao=true, próxima ação "Primeira intervenção humana" calculada pela config vigente (janela+espera); repetido → `ja_processado` |
| `ncrm_registrar_resposta_cliente(p_negocio_id, p_wa_message_id, p_em)` — **service_role** (chamada pelo fluxo de ingestão WA) | evento `resposta_cliente` (`idem='wa:'||wa_message_id`); estado: respondeu=true, primeira_resposta_em (se null), resposta_pendente=true, aguardando_automacao=false |
| `ncrm_reagendar(p_negocio_id, p_versao, p_proxima_em, p_motivo, p_idem)` | evento `reagendamento`; atualiza proxima_acao_em |
| `ncrm_sara_classificar(p_negocio_id, p_sugestao jsonb, p_base_estado_em)` — claim `app_role='sara'` | SEMPRE grava evento `classificacao_sara`; aplica ao estado somente se `ultima_decisao_humana_em <= p_base_estado_em`; senão devolve `precedencia_humana` (aplicado=false) |

## A. Saída: Visita agendada — `ncrm_saida_visita`

Assinatura: `(p_negocio_id, p_versao, p_data, p_hora_inicio, p_hora_fim, p_local, p_gerente_id, p_obs, p_idem)`

Transação:
1. Trava o estado (`SELECT ... FOR UPDATE WHERE negocio_id AND versao = p_versao AND saida IS NULL`);
   0 linhas → `versao_conflito` (ou `estado_invalido` se já tem saída).
2. **Reuso**: procura `visitas` futura do mesmo negócio com `status='agendada'`
   (`negocio_id = p_negocio_id AND data >= current_date`); se existir, usa `visita_id` existente
   (não cria segunda visita); senão INSERT em `visitas` com os MESMOS campos do fluxo atual
   (crm/route.ts:378) — `created_by`, `corretor_id` do estado, `status='agendada'`.
3. UPDATE `ncrm_estado`: `saida='pipeline_visitas'`, `saida_em=now()`, `visita_id`, limpa
   próxima ação, `versao+1` — o índice único parcial garante saída única.
4. INSERT evento `visita_agendada` (payload: visita_id, data/hora, reuso=true/false).
5. **Não** move o negócio de funil nesta fase (o efeito colateral por `ilike` do CRM atual —
   crm/route.ts:389-392 — fica FORA do contrato; convivência tratada no shadow, decisão 12.9).

## B. Saída: Proposta REGISTRADA — `ncrm_saida_proposta` (proposta ≠ venda)

Assinatura: `(p_negocio_id, p_versao, p_produto_id, p_unidade_id, p_valor, p_data, p_obs, p_idem)`

Transação:
1. Trava o estado (`FOR UPDATE WHERE versao = p_versao AND saida IS NULL`).
2. **Reuso**: se existe `ncrm_proposta` "viva" (`registrada|em_negociacao|aceita`) do negócio,
   reutiliza (não cria segunda — `ux_ncrm_proposta_viva`); senão INSERT em `ncrm_proposta`
   (`status='registrada'`, `valor`, `data_proposta`, lead/corretor derivados, `venda_id = NULL`).
3. **NÃO cria linha em `vendas`. NÃO marca `negocios.status='ganho'`. NÃO toca a Esteira legada.**
   Registrar proposta não infla VGV vendido.
4. UPDATE estado: `saida='esteira_vendas'`, `proposta_id`, `saida_em`, limpa próxima ação, versao+1.
5. INSERT evento `proposta_registrada` (payload: proposta_id, produto, valor, data, reuso).

## B2. Conversão: Proposta → Venda — `ncrm_converter_proposta`

Assinatura: `(p_proposta_id, p_versao_proposta, p_idem)`. Disparada no **aceite/conclusão** definido
pela operação (decisão aberta: momento exato).

Transação:
1. Trava `ncrm_proposta` (`versao = p_versao_proposta`, `status IN ('registrada','em_negociacao','aceita')`).
2. **Só aqui** cria/reutiliza `vendas` (vgv=valor) + `venda_processos` na etapa inicial (espelho de
   sales:437-458), aplicando a regra oficial de "ganho" da operação.
3. UPDATE `ncrm_proposta`: `status='convertida'`, `venda_id`, `convertida_em`.
4. INSERT evento `proposta_convertida` (payload: proposta_id, venda_id).
5. Esteira legada passa a enxergar a venda normalmente — **sem segunda interface** (doc 13 §Esteira,
   recomendação C→B). Até a conversão, a Esteira unificada mostra a proposta via leitura combinada.

## C. Saída: Descarte / Nutrição — `ncrm_saida_descarte` / `ncrm_nutricao`

- Descarte: `(p_negocio_id, p_versao, p_motivo /*CHECK na lista estruturada*/, p_detalhe, p_idem)` →
  evento `descarte` (motivo, detalhe, origem, executado_por) + estado `saida='descartado'`.
  **Não** altera `negocios.status/motivo_perda` nesta fase (convivência: decisão 12.9).
- Nutrição: análogo com `saida='nutricao'`.
- **Reativação auditável**: `ncrm_reativar(p_negocio_id, p_versao, p_motivo, p_proxima_*, p_idem)`
  → só de `descartado|nutricao`; evento `reativacao` (payload: saída anterior, motivo); estado
  volta a `saida=NULL` com etapa recalculada e próxima ação obrigatória. O histórico de descarte
  permanece nos eventos (nada é apagado).

## D. Leitura (API do app)

- `GET /api/crm-nova-era?vista=quadro&etapa=...&cursor=...` e `?vista=fila` — novas rotas FINAS
  (fase 3) sobre as consultas do doc 09; **nunca** acrescentar ao payload monolítico do
  `GET /api/crm`. Nesta fase: contrato apenas.

## E. Ordem de implantação dos contratos (fase 3+, referência)

config → estado/evento → leitura → tentativa/ação → automação (service_role) → saídas → Sara.
