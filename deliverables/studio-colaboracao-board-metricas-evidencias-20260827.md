# Evidências — colaboração, board e métricas

- Colaboração contextual mantém contexto geral/slide/cena, valida índices no payload, exibe chips na timeline e permite resolver/reabrir.
- Board extraído para `StudioManagerBoard.tsx`, com campanha, formato, status, responsável, revisor, template, atalhos de prazo (vencidos/hoje/sem prazo), ordenação e deep link.
- Métricas extraídas para `StudioMetricsDashboard.tsx`, com filtros de campanha, imóvel (código do produto), template, formato e datas inicial/final; agregação dos sete indicadores e tabela navegável.
- Calendário preservado em `StudioCalendar.tsx`.

## Gates

- Suíte Studio: 20 testes verdes.
- Regressão completa: 489 testes verdes (487 existentes + 2 novos contratos).
- Build Vinext: verde.
- Lint: verde, apenas avisos de componentes legados não usados.

## Limitação

Não foram gerados screenshots nesta rodada porque o runtime/conector de navegador não está disponível no workspace. Não houve deploy, migration remota ou publicação.
