# Trace — integridade e fronteira da API Financeira

Atualizado em: 2026-09-20
Estado: P0 parcial de aplicação publicado e validado; banco intacto

## Falhas reproduzidas no código

- o painel carregava 16 conjuntos, mas verificava erro somente em 12; ranking,
  repasses e extratos podiam falhar e ainda resultar em resposta de sucesso;
- falhas do Postgres eram devolvidas diretamente ao navegador em categorias,
  caixa, recebimentos, repasses, extratos e comissões;
- gravações de auditoria e atualizações de linhas do extrato tinham erros
  ignorados;
- operações compostas podiam concluir a primeira escrita, falhar na segunda e
  responder sem um código estável de reconciliação;
- a resposta do corretor dependia excessivamente de RLS e podia carregar
  conjuntos administrativos que não pertencem ao seu painel individual;
- uma venda nova ou `savePayout` aceitava representar repasse como pago sem o
  comando que também registra a saída no caixa;
- a tela do corretor chamava a soma das comissões de “a receber”, sem descontar
  repasses já pagos.

## Correção local

- toda consulta obrigatória participa do mesmo gate fail-closed;
- falha técnica retorna somente `falha_banco`, `sem_permissao` ou
  `reconciliacao_necessaria`; logs guardam operação fixa e código do provedor,
  sem mensagem SQL, payload ou PII;
- nenhuma gravação conhecida da rota continua com o resultado ignorado;
- falha depois de uma primeira mutação informa estado parcial e orienta a não
  repetir cegamente;
- somente papéis do grupo canônico `financeiro` recebem o painel integral;
  demais perfis recebem exclusivamente comissões, repasses, vendas e metas do
  próprio corretor, sem caixa, recebimentos gerais, extratos, categorias ou
  cadastros administrativos;
- repasse novo sempre nasce `previsto`; um repasse pago só pode ser alterado
  depois de desfazer a baixa pelo comando próprio;
- o painel individual separa “Já recebido” de “Minha comissão a receber”.
- falha na primeira carga deixa o estado de conexão e mostra uma mensagem
  sanitizada com nova tentativa; falha posterior de Realtime preserva os dados
  visíveis e passa a ser tratada, sem rejeição não observada.

## Evidência local

- 19/19 contratos financeiros direcionados;
- TypeScript sem erros;
- ESLint dos arquivos alterados sem erros;
- gate frontend amplo: 637/637 testes aprovados;
- build completo aprovado, incluindo `/api/finance` e `/financeiro`;
- o teste adicional de HTML renderizado passou 6/7; a única falha exige uma
  regra CSS literal do CRM que já não existia no `HEAD` antes desta fatia e os
  arquivos envolvidos não foram alterados pelo Financeiro;
- navegador real com o componente produtivo e dados sanitizados: corretor em
  desktop 1280 × 720 e aplicativo 390 × 844, estados normal, vazio e erro, sem
  overflow horizontal, console limpo e somente `GET /api/finance`; o erro
  inicialmente reproduzido como loading infinito foi corrigido e revalidado.

## Dívida P0 preservada, sem falsa declaração de atomicidade

A rota agora falha de forma explícita, mas estas sequências ainda precisam ser
substituídas por comandos/RPCs atômicos e idempotentes, ensaiados em Postgres
isolado antes de qualquer migration:

1. criar lançamento e baixar recebimento;
2. excluir lançamento, reabrir recebimento e gravar auditoria;
3. atualizar venda e baixar todas as parcelas;
4. criar/alterar/remover caixa e atualizar repasse;
5. criar importação e suas linhas;
6. lançar caixa e marcar linha de extrato como resolvida;
7. baixa direta de recebimento sem lançamento de caixa correspondente.

Nenhum desses pontos foi chamado de resolvido por esta correção. Não houve
push, migration, alteração de RLS, escrita remota ou deploy.

## Pacote isolado sobre o `main` atual

A correção foi reaplicada sobre `origin/main` em
`codex/deploy-finance-20260920`, com base no commit publicado de Visitas
`3713561db93b2d6270a0319bea4cf16c84fb7d58`.
O pacote isolado contém somente a API, o contrato de venda, a tela/estado de
erro, o CSS do estado, este trace, os testes financeiros e um harness visual
local sem efeitos externos.

- 20/20 testes financeiros direcionados;
- 39/39 contratos das APIs promovidas e 468/468 no gate frontend atual;
- TypeScript, ESLint focado e build completo aprovados;
- componente produtivo validado em navegador a 1280 × 720 e 390 × 844, nos
  estados normal, vazio e erro, sem overflow ou console e com somente
  `GET /api/finance`;
- commit publicado: `b87eb5af07f4452586c807def8f029c11f3a80a3`;
- `/api/build` confirmou o SHA e o painel autenticado foi revalidado em
  1280 × 720 e 390 × 844, sem alerta, log de erro/aviso ou overflow;
- nenhuma migration ou escrita produtiva foi executada.
