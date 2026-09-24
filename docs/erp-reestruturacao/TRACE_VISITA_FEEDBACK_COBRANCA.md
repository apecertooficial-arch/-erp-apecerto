# Trace — visita, feedback e cobrança

Atualizado em: 2026-09-24

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

## Promoção do áudio

`P0_VISITA_OWNER_COBRANCA_DRAFT.sql` permanece fora de migrations. O contrato
de áudio foi promovido para
`20260924170000_feedback_visita_audio_privado.sql`, ainda desligado por padrão.
A própria reserva recusa upload antes do cutover. O dispatcher reutiliza o
segredo interno já usado pelos runners da Sara, sem criar credencial paralela,
e continua service-only, limitado e auditável.

Em produção, a migration `feedback_visita_audio_privado` foi aplicada e a Edge
`f2-feedback-visita-transcrever` chegou à versão 2. O preflight confirmou bucket
privado, tabela e configuração, cron, Vault, chave da OpenAI no cofre, zero
áudios e `enabled=false`. Sem segredo, a Edge respondeu 401; com o segredo
interno, carregou a chave privada e alcançou a RPC, que recusou corretamente o
UUID inexistente com 409. O tick desligado despachou zero itens e a reserva
retornou `audio_indisponivel`.

O cutover não foi executado. Habilitá-lo permitiria que gravações potencialmente
sensíveis de visitas fossem enviadas à OpenAI para transcrição, o que requer
aprovação específica e informada para esse destino. A infraestrutura permanece
vazia e fail-closed até essa decisão.

## Evidência revalidada sobre o `main` atual

- 57/57 testes direcionados de Agenda, CRM, feedback, áudio e contratos;
- 39/39 contratos das APIs já promovidas e 459/459 no gate frontend;
- typecheck, build e lint focado aprovados; a fonte Deno é ignorada pelo
  ESLint do frontend e permanece coberta por contrato estático até existir a
  CLI oficial para o gate próprio;
- navegador desktop e aplicativo em 390 × 844: feedback 10/10, sem overflow,
  formulário preservado após falha simulada e console vazio;
- nenhuma mutação remota, migration, deploy de Edge ou dado pessoal utilizado.

Depois da publicação, o mesmo SHA deve ser repetido em produção antes de
classificar a jornada como validada.
