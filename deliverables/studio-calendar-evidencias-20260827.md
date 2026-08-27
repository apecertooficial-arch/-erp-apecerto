# StudioCalendar — evidências

## Implementação

- Componente próprio: `app/features/studio/StudioCalendar.tsx`.
- Três estruturas DOM distintas: `calendar-month` (grade 6×7), `calendar-week` (7 colunas com slots 08:00–19:00) e `calendar-list` (agrupamento cronológico).
- Eventos usam `onDragStart`, `onDragOver` e `onDrop`; o payload é o schedule em memória e o alvo calcula o instante sem `window.prompt`.
- Conversão usa explicitamente `America/Sao_Paulo` e confirma antes de persistir.
- Atualização otimista ocorre imediatamente; resposta `409 schedule_conflict` remove a alteração otimista e restaura o horário anterior.
- Ação backend `moveSchedule` valida colisões reais antes do `PATCH`.

## Testes executados

- Teste de contrato do componente: três modos, drop targets, cálculo de instante, modal e ausência de prompt.
- Suíte Studio: 19 testes verdes.
- Regressão completa: 487 testes verdes.
- Build Vinext: verde.
- Lint dos arquivos Studio: verde (apenas avisos preexistentes em outros módulos).

## Validação visual

O componente foi integrado à rota local `/studio` e à fixture `/studio-visual-test`. Screenshots desktop/mobile não puderam ser gerados neste workspace porque não há runtime Playwright nem conector de navegador disponível; não há evidência visual fabricada.
