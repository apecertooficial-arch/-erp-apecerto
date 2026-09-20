# Trace — integridade da Biblioteca de Abordagens

Atualizado em: 2026-09-20
Estado: P0 de autorização e preservação pronto para publicação; ordenação concorrente ainda pendente

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
- a leitura exige `abordagens:ver`; qualquer escrita exige papel do grupo
  canônico `gestao` e a permissão específica de criar, editar, publicar ou
  excluir; falha ao resolver o acesso interrompe como indisponibilidade;
- JSON inválido, conteúdo acima do limite, arquivamento sem booleano e grupo
  sem mudança são rejeitados antes da persistência;
- criação verifica erro da contagem e exige a linha inserida de volta;
- edição e arquivamento exigem uma linha realmente afetada;
- renomear ou dissolver grupo confirma as linhas alcançadas e não finge sucesso
  para grupo inexistente;
- a criação paralela de produto foi aposentada em favor do módulo Produtos;
- exclusão física foi bloqueada; a operação suportada é arquivar, preservando
  histórico e referências das automações;
- a interface separa loading, falha e vazio real, não expõe mutações durante
  erro, não aceita resposta `2xx` sem confirmação e preserva sucesso se somente
  a recarga posterior falhar;
- controles interativos críticos têm alvo mínimo de 44 px no celular.
  A primeira validação publicada encontrou a folha de redesign sobrescrevendo
  os botões dos cards para 34 px; a regra foi movida para a camada vencedora e
  exige nova confirmação produtiva.

## Evidência

- 8/8 contratos específicos de Abordagens;
- 47/47 no recorte de APIs endurecidas e 507/507 no gate frontend canônico;
- typecheck e build completo aprovados; lint sem erros e com um aviso antigo de
  imagem não otimizada na prévia;
- navegador real sanitizado em 1280 × 800 e 390 × 844: erro explícito, retry
  disponível, nenhum controle mutável, somente GET local, zero console e nenhum
  overflow horizontal.

Nenhuma abordagem, produto, automação, mensagem ou dado remoto foi alterado.
Não houve migration nem alteração remota de dados.

## Limites ainda abertos

A ordem inicial ainda resulta de `count + insert`, sem lock ou constraint de
unicidade por produto. Criações concorrentes podem receber a mesma ordem. A
correção definitiva exige RPC transacional ou coluna de posição com regra
concorrente, ensaio em Postgres isolado e rollback aprovado. A autorização da
aplicação está fail-closed, mas as policies/grants remotos ainda precisam ser
reconciliados no ensaio de banco antes de qualquer migration produtiva.
