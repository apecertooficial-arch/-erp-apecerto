# Sala de Comando de Performance — arquitetura canônica

## Decisão

Existe uma única área gerencial: `/performance`. O Funil 2.0 permanece operacional
(Meu Dia, Funil, Todos os Leads, Visitas, Esteira e Configurações) e não possui
painel, pesos ou score paralelo.

```text
Sala de Comando
  -> GET /api/performance
     -> performance_sala_comando(início, fim)
        -> vendas + metas (resultado, meta, comissão e margem)
        -> negócios + leads (jornada, pipeline e origem)
        -> f2_lead (carteira, prazo e capacidade)
        -> wa_mensagens + perf_eventos (D-API e primeira resposta)
        -> visitas (marcação, realização, cancelamento e feedback)
        -> ia_notas_atendimento (experiência)
        -> performance_atividade_app (uso ativo do ERP)
```

## Regras de confiança

1. Aquário/Bolsão e `Pescado` não contam como performance individual.
2. Resultado, jornada, capacidade, experiência e confiança do dado são blocos separados.
3. Ausência de amostra não vira zero e ausência de ligação não vira conversão inventada.
4. Forecast, CAC/ROI e coorte ficam bloqueados enquanto a captura não sustentar o cálculo.
5. Uso ativo do ERP é evidência auxiliar; não representa jornada de trabalho nem nota de produtividade.
6. Gestor autorizado vê a empresa; corretor vê somente o próprio registro.

## Estrutura substituída

A migração `20260815203057_performance_sala_comando_ceo.sql` cria o contrato único
e remove, sem `CASCADE`, as RPCs intermediárias `performance_painel`,
`performance_resumo_empresa` e `performance_bolsao_ajustes`. Os fatos históricos e
as fontes brutas permanecem preservados.

O estudo, os números auditados e o contrato completo das métricas estão em
`docs/estudo-performance-imobiliaria-2026.md`.
