# Trace — visita, resultado e cobrança

Atualizado em: 2026-09-19
Estado: fatia em reconstrução; primeira correção P0 local validada

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

## Evidência

- teste escrito antes da correção falhou no comportamento anterior;
- testes direcionados: 33/33 passaram;
- gate frontend oficial ampliado com o novo contrato: 432/432 passou;
- ESLint dos arquivos alterados: passou;
- build Vinext completo: passou;
- `git diff --check`: passou.

## Lacunas ainda abertas

1. A consulta atual é limitada ao mês escolhido. Uma visita sem resultado pode
   desaparecer da cobrança na virada do mês. O requisito do usuário é manter a
   pendência até desfecho explícito; a correção exige novo contrato de banco e
   migration aditiva, testada em ambiente isolado antes de produção.
2. O formulário atual registra desfecho, motivo e justificativa, mas ainda não
   cobre acompanhantes, produtos apresentados, pontos positivos/negativos,
   objeções, proposta, próxima ação detalhada nem áudio transcrito.
3. Cobrança progressiva, confirmação do gerente, qualidade do feedback e
   indicadores por corretor ainda não estão comprovados ponta a ponta.
4. A validação autenticada no navegador local depende de configuração pública
   segura do Supabase; nenhum segredo foi copiado ou criado.

## Próximo gate

Desenhar o contrato aditivo que mantém todas as pendências abertas até a
resolução, com índice, autorização, paginação, métricas e testes de virada de
mês. Criar migration apenas pela CLI oficial quando a ferramenta e o ambiente
isolado forem autorizados/disponibilizados.
