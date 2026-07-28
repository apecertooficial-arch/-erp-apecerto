# CRM Nova Era — Rodada NO-GO: correções e limites honestos

Sem deploy/push. **Não declaro ponta a ponta.** Abaixo, o que ficou REALMENTE resolvido e
testado versus o que depende de decisão de arquitetura/deploy (e por quê).

## Resolvido e testado nesta rodada
- **#6 Métricas** (`metricasCalc.ts` + `metricas/route.ts`): taxa de resposta **não duplica** os
  respondidos no denominador (usa o total da carteira); erro de qualquer consulta vira **502**
  (nunca zero silencioso). Testes da fórmula e do denominador (`ncrm-reconciliacao-metricas.test.mjs`).
- **#2 Sara auditável (de verdade)**: migration corretiva mínima
  `supabase/migrations/20260728190000_ncrm_sara_decisao.sql` cria `ncrm_registrar_decisao_sara`
  — RPC **authenticated**, `SECURITY DEFINER`, **fail-closed `pode_operar`**, idempotente, que
  **persiste** o evento auditável `classificacao_sara` com **decisão (aceita/rejeitada), sugestão,
  confiança, justificativa, base_versão, usuário e horário**, **sem** alterar o estado. A API
  `POST /api/ncrm/sara` chama essa RPC e **só responde `registrado=true` após a persistência real**
  (não retorna mais "delegado_ao_ncrm_ingest"). Arquitetura correta: **quem decide é o corretor
  autenticado**, não a service_role se passando por Sara. Testado localmente (7 asserts:
  aceite persiste, estado não muda, idempotência, confiança/decisão inválidas, corretor sem
  permissão negado). **Rollback** incluído. **Não aplicada** em produção (entrega para revisão).
- **#5 Consistência da visita**: máquina de estados pura (`live/reconciliacao.ts`, testada) para o
  cenário "visita criada → `ncrm_saida_visita` falha": status **"encaminhamento pendente"** + botão
  **"Repetir encaminhamento"** com **idempotency_key estável** (`ui:saidaVisita:<neg>:<visita>`), que
  **nunca apaga** a visita válida. Teste específico da falha parcial incluído.
- **#1 (parcial) Localização dos pontos reais**: mapeados por leitura do código —
  **inbound**: RPC `wa_ingerir(jsonb)` (persiste `wa_mensagens` com `wa_message_id`);
  **automação envia**: `motor_envia_abordagem` (via edge `dapi-enviar`);
  **Esteira pré-venda**: `solicitar_venda` → `venda_solicitacoes`. A edge function `ncrm-ingest`
  (service_role, idempotente) e as RPCs já existem; o **planejador puro** está testado.

## NÃO resolvido — precisa de decisão/deploy (não faço às cegas)
- **#1 Integração viva do ingest**: os pontos reais (`wa_ingerir`, `motor_envia_abordagem`) são
  **funções no banco**, e o **webhook de inbound é uma edge function que não está neste repositório**.
  Conectar de verdade exige **uma destas** decisões, todas com risco de produção que **não assumo sem
  aprovação**: (a) migration corretiva que **recria essas funções legadas** anexando uma chamada
  ncrm **guardada por EXCEPTION** (para "falha do NCRM não derrubar WhatsApp") — recriar função de
  motor complexa a partir de dump é arriscado; (b) **trigger em `wa_mensagens`** (tabela legada) —
  antes vetado. Nenhuma é segura sem seu aval. **Config de deploy do `ncrm-ingest`** (documentada no
  cabeçalho de `index.ts`): `supabase functions deploy ncrm-ingest --no-verify-jwt` + secrets
  `NCRM_INGEST_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; **nunca** aceita chamada sem o
  segredo; service_role nunca exposto.
- **#3 Proposta ↔ Esteira**: `solicitar_venda` cria `venda_solicitacoes`, mas **não verifiquei o
  corpo da RPC** (efeitos colaterais: pode marcar `negocios.status='ganho'`/criar registros). Chamar
  às cegas violaria "proposta ≠ venda / impedir criação de vendas". **Precisa** ler `solicitar_venda`
  e decidir o registro pré-venda correto antes de vincular `ncrm_proposta`. Hoje `ncrm_saida_proposta`
  cria o registro de proposta (que **não é venda**) com fail-safe — mas **sem** o vínculo ao registro
  operacional da Esteira.
- **#4 Painel com conversa real**: ainda mostra a trilha ncrm_ + propostas; **falta** embutir
  `/api/live-chat` (mensagens/áudios/transcrições), tarefas e avaliações. Próxima rodada.

## Qualidade
- **Lint** 0/0 nos arquivos novos; **tsc** 0 erros nos novos; **build** vinext OK.
- **Unit (JS)** 61/61 (rules + adapter + flag + validação + schema Sara + ingest + reconciliação/métricas).
- **SQL local** 108 PASS / 0 FALHAS (inclui a migration corretiva da Sara e os 7 testes de decisão);
  `vendas_total` 2→2.
- Testes que exigem rede/ambiente real (ia-router, webhook, criação de visita em produção, Esteira)
  **não** são executados aqui.

## Reafirmação
**Não declaro "funcional ponta a ponta".** Ingest vivo, Esteira e conversa no painel seguem
pendentes de decisão/deploy; entrego o que está seguro, testado e honesto.
