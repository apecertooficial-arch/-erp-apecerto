# Trace — visita, resultado e cobrança

Atualizado em: 2026-09-19
Estado: fatia em reconstrução; duas correções P0 locais validadas

## Contrato atual comprovado

`Agenda web/app → GET /api/agenda → ncrm_agenda_corretor +
f2_visitas_resultado_pendente → fila de cobrança →
PATCH /api/agenda registerVisitResult → f2_registrar_resultado_visita`

- desktop e aplicativo usam a mesma API e a mesma RPC de gravação;
- resultado exige `status`, motivo compatível e justificativa útil;
- a RPC limita leitura ao gestor ou ao corretor dono da carteira;
- o resultado atualiza visita, lead, próxima ação e histórico;
- a fila inclui visita passada ainda agendada/confirmada e encerramento sem
  motivo ou justificativa suficiente.

## Falha P0 reproduzida e corrigida localmente

Antes, qualquer erro de `f2_visitas_resultado_pendente` era convertido em
`itens: []`. Web e aplicativo exibiam zero pendências, embora o banco pudesse
estar indisponível. Isso viola o requisito operacional de nunca perder a
cobrança pós-visita.

Agora a API devolve `pendencias_resultado_erro` sem expor detalhes internos. A
agenda continua utilizável, mas web e aplicativo mostram um alerta explícito e
uma ação de nova tentativa. A interface só apresenta a fila vazia quando a
consulta foi concluída com sucesso.

Uma segunda falha foi confirmada por contagem agregada no banco: setembro tinha
8 pendências, enquanto 53 pendências de agosto ficavam invisíveis porque a API
consultava somente o mês selecionado. Nenhum nome, telefone ou registro de
cliente foi lido. A API local agora consulta uma janela operacional de 365 dias,
o máximo seguro dentro do limite vigente da RPC, e deixa de vincular a cobrança
ao mês exibido no calendário. Isso cobre integralmente o histórico atual, que
começa em agosto de 2026.

## Evidência

- teste escrito antes da correção falhou no comportamento anterior;
- testes direcionados: 33/33 passaram;
- gate frontend oficial ampliado com os novos contratos: 433/433 passou;
- ESLint dos arquivos alterados: passou;
- build Vinext completo: passou;
- `git diff --check`: passou.

## Lacunas ainda abertas

1. A correção local cobre os últimos 365 dias e todo o histórico atual, mas o
   contrato definitivo precisa manter a pendência sem prazo de expiração. Isso
   exige migration aditiva, paginação e teste isolado antes de produção.
2. O formulário atual registra desfecho, motivo e justificativa, mas ainda não
   cobre acompanhantes, produtos apresentados, pontos positivos/negativos,
   objeções, proposta, próxima ação detalhada nem áudio transcrito.
3. Cobrança progressiva, confirmação do gerente, qualidade do feedback e
   indicadores por corretor ainda não estão comprovados ponta a ponta.
4. A validação autenticada no navegador local depende de configuração pública
   segura do Supabase; nenhum segredo foi copiado ou criado.

## Próximo gate

Desenhar o contrato aditivo sem expiração para todas as pendências abertas, com
índice, autorização, paginação e métricas. Criar migration apenas pela CLI
oficial quando a ferramenta e o ambiente isolado forem autorizados/disponibilizados.
