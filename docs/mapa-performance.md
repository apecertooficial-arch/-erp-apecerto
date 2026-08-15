# Central de Gestão de Corretores — arquitetura canônica

## Decisão

Existe uma única área gerencial: `/performance`. O Funil 2.0 permanece operacional
(Meu Dia, Funil, Todos os Leads, Visitas, Esteira e Configurações) e não possui
painel, pesos ou score paralelo.

```
Central de Gestão de Corretores
  -> GET /api/performance
     -> performance_painel(início, fim)
        -> perf_eventos (mensagens, follow-up, primeira resposta, reativação)
        -> f2_lead (carteira, prazos, Sara e descartes)
        -> visitas (agenda, realização, cancelamento e feedback)
        -> ia_notas_atendimento (qualidade e dimensões)
        -> crm_tarefas (disciplina de tarefas)
        -> vendas + venda_corretores (vendas, VGV e comissão)
        -> metas (metas cadastradas para o período)
        -> performance_atividade_app (uso visível e recente do ERP)
```

## O que a empresa passa a controlar

- Visão executiva: nota de execução, cobertura da nota, alertas e comparação.
- Trabalho e disciplina: atividade real no ERP, contatos únicos, follow-ups,
  atualizações, carteira, ações e tarefas vencidas.
- Atendimento: primeira resposta, SLA de 15 minutos, mensagens e qualidade da IA.
- Funil e visitas: recebidos, trabalhados, respondidos, visitas, cancelamentos,
  feedback, propostas quando houver captura e vendas.
- Resultado comercial: vendas concluídas/pagas, VGV, comissão e meta cadastrada.
- Cobertura dos dados: distingue zero, sem amostra e sem captura.

## Regras de confiança

1. `corretores.online` significa disponibilidade para distribuição; não mede
   trabalho nem uso do ERP.
2. A atividade é gravada apenas com a aba visível e atividade recente. O banco
   consolida múltiplas abas em um único bloco de cinco minutos.
3. A nota de execução não incorpora vendas silenciosamente. Resultado é exibido
   à parte para permitir gestão de processo e de receita.
4. Um pilar sem fonte ou sem amostra suficiente não recebe nota zero; seu peso é
   retirado e a cobertura efetivamente medida permanece visível.
5. Propostas e ligações aparecem como `Sem captura` enquanto não existir produtor
   integrado. Meta ausente aparece como `Não cadastrada`.
6. Acesso respeita o banco: gestor autorizado vê a equipe; corretor vê somente
   seu próprio registro.

## Medição de atividade

O componente global envia um sinal por minuto somente quando o ERP está visível e
houve interação nos últimos cinco minutos. `performance_registrar_atividade()`
resolve o corretor por `auth.uid()` e consolida o sinal no bloco de cinco minutos.
A tabela é fechada por RLS e não tem acesso direto para `anon` ou `authenticated`.

A nota de atividade só considera os dias úteis desde o primeiro sinal real da
nova medição. Assim, a implantação no meio do mês não pune os corretores por dias
em que a fonte ainda não existia.

## Estrutura aposentada

A migração `20260815182228_remover_performance_legada.sql` remove o cron de
snapshot, a tabela `perf_snapshots` e as RPCs antigas de score/ranking. O cron
`perf_derivar_eventos` permanece, pois transforma fatos operacionais úteis para o
painel canônico. Os eventos históricos continuam preservados como trilha.

## Próximas integrações de dados

- Propostas/contratos: criar o produtor no momento oficial do negócio.
- Ligações: integrar telefonia ou um registro operacional auditável.
- Motivo de cancelamento de visita: tornar obrigatório para separar cliente,
  corretor e imóvel na análise de causa.
- Meta individual: cadastrar em `metas` para o período; o painel não usa fallback.
