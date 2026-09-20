# Trace — integridade da Biblioteca de Abordagens

Atualizado em: 2026-09-20
Estado: P0 de autorização e preservação corrigido localmente; ordenação concorrente ainda pendente

## Falhas reproduzidas

`/api/approaches` devolvia mensagens técnicas do banco diretamente ao navegador
e aceitava mutações sem repetir no servidor a exigência de gestão. Create,
update, toggle e delete podiam confirmar sucesso sem comprovar linha afetada.
A contagem usada na ordem de uma nova abordagem ignorava erro.

A mesma rota mantinha uma criação de produto paralela ao módulo Produtos e
permitia excluir fisicamente uma abordagem, mesmo que automações históricas a
referenciassem dentro de mapas JSON. Na falha inicial de leitura, a tela ainda
mostrava uma biblioteca vazia com botões de criação e edição.

## Correção local

- a leitura e todas as mutações sanitizam falhas técnicas e registram somente
  operação fixa e código, sem conteúdo das mensagens ou payload;
- qualquer escrita exige papel do grupo canônico `gestao`; falha ao resolver o
  acesso interrompe como indisponibilidade, não como falso `403`;
- criação verifica erro da contagem e exige a linha inserida de volta;
- edição e arquivamento exigem uma linha realmente afetada;
- renomear ou dissolver grupo confirma as linhas alcançadas e não finge sucesso
  para grupo inexistente;
- a criação paralela de produto foi aposentada em favor do módulo Produtos;
- exclusão física foi bloqueada; a operação suportada é arquivar, preservando
  histórico e referências das automações;
- a interface separa loading, falha e vazio real, não expõe mutações durante
  erro e preserva sucesso se somente a recarga posterior falhar.

## Evidência

- 6/6 contratos específicos de Abordagens;
- 28/28 no recorte Abordagens + harness visual;
- 674/674 no gate frontend completo;
- 426/426 ao reproduzir somente esta fatia sobre `origin/main`;
- typecheck, lint sem erros e build completo aprovados;
- navegador real sanitizado em 1280 × 800 e 390 × 844: erro explícito, retry
  disponível, nenhum controle mutável, somente GET local, zero console e nenhum
  overflow horizontal.

Nenhuma abordagem, produto, automação, mensagem ou dado remoto foi alterado.
Não houve migration, push ou deploy.

## Limites ainda abertos

A ordem inicial ainda resulta de `count + insert`, sem lock ou constraint de
unicidade por produto. Criações concorrentes podem receber a mesma ordem. A
correção definitiva exige RPC transacional ou coluna de posição com regra
concorrente, ensaio em Postgres isolado e rollback aprovado. A autorização da
aplicação está fail-closed, mas as policies/grants remotos ainda precisam ser
reconciliados no ensaio de banco antes de qualquer migration produtiva.
