# Trace — visita, resultado e cobrança

Atualizado em: 2026-09-19
Estado: fatia em reconstrução; três correções P0 locais validadas

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

A fila também permitia que a gestão abrisse o formulário e registrasse o
resultado no lugar do corretor. A interface foi fechada para esse atalho: a
gestão agora vê pendências agrupadas por responsável, quantidade e idade, mas
somente o corretor dono recebe a ação `Responder`. Web e aplicativo repetem a
mesma regra. Isso não substitui o futuro escalonamento persistido; apenas impede
que a cobrança seja confundida com execução pelo gerente.

## Evidência

- teste escrito antes da correção falhou no comportamento anterior;
- testes direcionados: 33/33 passaram;
- gate frontend oficial ampliado com os novos contratos: 436/436 passou;
- ESLint dos arquivos alterados: passou;
- build Vinext completo: passou;
- `git diff --check`: passou.
- navegador desktop 1600 × 1000: 2 grupos, 3 cobranças, 0 botões de resultado
  para a gestão, largura do documento igual à viewport e console limpo;
- navegador móvel 375 × 844: 3 cobranças com responsável/idade, 0 botões de
  resultado para a gestão e nenhum overflow horizontal;
- perfil corretor no navegador: 2 pendências próprias com `Responder`, uma de
  terceiro somente leitura, formulário validado e erro de escrita explícito no
  harness que bloqueia mutações;
- estado de erro no navegador: alerta, calendário preservado e nova tentativa.

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

Desenhar o contrato aditivo sem expiração e o escalonamento persistido por
corretor/gestão, com índice, autorização, paginação e métricas. Criar migration
apenas pela CLI oficial quando a ferramenta e o ambiente isolado forem
autorizados/disponibilizados.
