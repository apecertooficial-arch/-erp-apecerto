# CRM Nova Era — Correção dos bloqueadores (rodada backend-crítico + fluxos reais)

Escopo priorizado com o revisor: backend-crítico + fluxos reais, sem deploy/push/Render.
**Não é "funcional ponta a ponta"**: entrada e persistência auditável da Sara só ficam realmente
ativas com deploy da edge function service_role (proibido nesta rodada). Abaixo, o que está conectado
no código versus o que depende de ativação externa.

## Conectado nesta rodada
- **#8 Validação de API** (`app/api/ncrm/validate.ts`, testado): GET/PATCH validam negócio inteiro
  positivo, versão, limite/offset, enums, datas, valor de proposta > 0, limites de texto e **rejeitam
  campos incompatíveis com cada ação** (422). O banco continua sendo a autorização final.
- **#2 Sara no contrato REAL do ia-router** (`app/api/ncrm/sara/route.ts`): usa
  `agente_slug:"sara"` + `input` + `override_prompt` (idêntico a `copiloto-lead`), aproveitando as
  ferramentas `consultar_lead`/`avaliar_conversa` (mensagens, áudios transcritos, avaliações). A
  resposta é **validada/normalizada por schema explícito** (`saraSchema.ts`, testado); se não for JSON
  válido → **falha controlada** (nunca exibe JSON cru). O painel mostra os campos estruturados.
- **#3 (parcial) Rejeição da Sara**: `POST /api/ncrm/sara` persiste o feedback (`perf_log_sessao`) e
  **só responde "registrado" se persistiu** (não engole erro). Ao aceitar, o painel **pré-preenche o
  formulário** (tipo/prazo sugeridos) e **exige confirmação humana final**, que executa a RPC
  operacional. **Pendente de deploy:** o evento auditável `classificacao_sara` (exige papel `sara`) é
  delegado à edge function service_role.
- **#4 Visitas — fluxo real**: eliminado o "cole o ID". O formulário cria a visita **real** pelo fluxo
  existente (`PATCH /api/crm` `createVisit`, que passou a **retornar o `visitaId`**), e **só após** a
  visita existir chama `ncrm_saida_visita`. **Fail-safe:** se a criação falhar, o lead **não** sai do
  funil. Idempotência do lado ncrm pela `idempotency_key`.
- **#7 Métricas** (`app/api/ncrm/metricas/route.ts`): agregado **RLS-escopado** sobre a carteira
  autorizada (count exato no banco: total/ativos/resposta/visitas/propostas/atrasados/sem próxima).
  A visão gerencial usa esse endpoint; enquanto carrega, mostra números **rotulados "página atual"**.
- **#1 Entrada — código pronto (sem deploy)**: `supabase/functions/ncrm-ingest/` — planejador PURO
  testado (`logic.ts`) + handler Deno service_role (`index.ts`). Recebe eventos reais do motor/webhook
  e chama `ncrm_registrar_msg_automatica` / `ncrm_registrar_resposta_cliente` de forma **idempotente
  pelo ID real da mensagem** (as RPCs deduplicam; retries do webhook não duplicam). **Nunca** no
  frontend. Não altera distribuição/WhatsApp.

## Ainda NÃO conectado de fato (precisa de ativação externa / próxima rodada)
- **Entrada real (#1):** exige `supabase functions deploy ncrm-ingest` + secrets + o motor/webhook
  chamarem essa função. Sem isso, o quadro nasce vazio (nenhum estado é criado pelo frontend).
- **Persistência auditável da Sara (#3):** o evento `classificacao_sara` (aceite/rejeição com
  sugestão/confiança/usuário/horário) precisa da edge function service_role.
- **#5 Proposta ↔ Esteira:** `ncrm_saida_proposta` cria o registro de proposta (que **não é venda**) e
  encaminha à Esteira, com fail-safe. **Falta** vincular ao registro operacional pré-venda existente
  (`venda_solicitacoes`) — decisão de produto pendente para não criar venda nem segunda Esteira.
- **#6 Painel do lead — conversa real:** ainda mostra a trilha ncrm_ + propostas; **falta** embutir a
  conversa/áudios/transcrições via `/api/live-chat` e tarefas — próxima iteração.

## Qualidade (local)
- **Lint** 0/0 nos arquivos novos; **tsc** 0 erros nos novos; **build** vinext OK
  (`/api/ncrm`, `/api/ncrm/sara`, `/api/ncrm/metricas` registradas).
- **Testes** 57/57: validação de payloads, schema da Sara (válido/჻inválido/JSON-em-string/falha
  controlada), planejador do ingest (idempotência/automação-não-conta/inbound), adaptador e flag.
- Testes que dependem de rede real (ia-router, webhook, criação de visita em produção) **não** são
  executados aqui — validamos a lógica pura e os contratos; a execução ponta a ponta exige deploy/keys.

## Não declarado
Reafirmando: **não declaro "funcional ponta a ponta"**. Entrada e persistência da Sara dependem de
deploy service_role; proposta↔Esteira e conversa no painel seguem para a próxima rodada.
