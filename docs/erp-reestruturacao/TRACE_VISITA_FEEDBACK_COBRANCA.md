# Trace — visita, feedback e cobrança

Atualizado em: 2026-09-21
Branch de promoção: `codex/deploy-visita-feedback-20260920`
Base: `48fcce626d726a8ed71da6c11433834acb003dea`

Estado real: a aplicação da fatia já é ancestral do `main` publicado, mas o
contrato P0 do banco não foi aplicado. A jornada não pode ser chamada de pronta.

## Falhas reproduzidas

- o Pipe de Visitas do CRM encerrava a visita com campos livres incompatíveis
  com o contrato estruturado aceito pela API;
- uma falha ao salvar removia o formulário e fazia o corretor perder o texto;
- a fila de resultados podia virar vazia silenciosamente quando a consulta ao
  banco falhava;
- pendências de meses anteriores não permaneciam na cobrança;
- a gestão podia ser confundida com o responsável por responder a visita;
- a API não repetia explicitamente a regra de ownership do corretor dono.

## Correção do pacote

- Agenda, aplicativo e CRM usam `ResultadoVisitaForm` como formulário único;
- presença, acompanhantes, percepção, pontos positivos, objeções, alternativas,
  definição e próxima ação formam um envelope determinístico;
- feedback abaixo de 9/10 não pode ser enviado;
- cancelamento e ausência exigem motivo e próxima ação;
- erro de mutação preserva o formulário preenchido e a carteira carregada;
- a API valida o corretor dono antes de gravar resultado;
- fila de cobrança falha fechada e preserva pendências antigas;
- gestão enxerga atraso e responsável, mas não responde em nome do corretor;
- áudio está preparado de forma privada e falha fechada enquanto banco e Edge
  não forem promovidos separadamente;
- performance por corretor só considera feedback estruturado; histórico legado
  não recebe nota inventada.

## Contratos de banco fora de migrations

`P0_VISITA_OWNER_COBRANCA_DRAFT.sql` e
`P1_VISITA_FEEDBACK_AUDIO_DRAFT.sql` permanecem fora de
`supabase/migrations`. Eles documentam ownership, cobrança persistente, Storage
privado, idempotência e retry, mas não são aplicados por este pacote. Migration,
Edge Function e configuração remota exigem gates e autorização próprios.

## Evidência revalidada sobre o `main` atual

- 57/57 testes direcionados de Agenda, CRM, feedback, áudio e contratos;
- 39/39 contratos das APIs já promovidas e 459/459 no gate frontend;
- typecheck, build e lint focado aprovados; a fonte Deno é ignorada pelo
  ESLint do frontend e permanece coberta por contrato estático até existir a
  CLI oficial para o gate próprio;
- navegador desktop e aplicativo em 390 × 844: feedback 10/10, sem overflow,
  formulário preservado após falha simulada e console vazio;
- nenhuma mutação remota, migration, deploy de Edge ou dado pessoal utilizado.

## Divergência remota confirmada em 2026-09-21

Consulta somente de catálogo no projeto `diaegvfveqezispcthwk`, sem linhas
operacionais ou PII:

- `f2_registrar_resultado_visita(uuid,text,text,text)` existe, é
  `SECURITY DEFINER`, está fechado para `anon` e aberto para `authenticated`;
- a função remota não contém ownership pelo `current_broker_id`, envelope
  `FEEDBACK_VISITA_V1` nem bloqueio `feedback_qualidade_insuficiente`;
- uma chamada autenticada direta à RPC pode contornar a verificação feita pela
  API da aplicação;
- `f2_visitas_resultado_pendente(date,date)` existe, mas não cria a obrigação
  persistente `visita_feedback_pendente`;
- as funções de performance e áudio, a coluna `visita_id`, o índice de dedupe,
  o sincronizador e o cron novos ainda não existem;
- hashes do baseline remoto foram fixados no draft e o ensaio agora termina
  obrigatoriamente em `ROLLBACK`.

O gate seguinte é executar os drafts em uma branch Supabase isolada, validar
ACL, concorrência, idempotência, cron e rollback, e somente então gerar as
migrations aditivas de produção. A única branch catalogada hoje é a `main`, com
status `MIGRATIONS_FAILED`; criar uma branch nova tem custo informado de
US$ 0,01344 por hora e exige confirmação do usuário.

Depois da publicação, o mesmo SHA deve ser repetido em produção antes de
classificar a jornada como validada.
