# Trace — integridade de Campanhas e Disparos

Atualizado em: 2026-09-20
Estado: P0 de fronteira corrigido localmente; idempotência transacional ainda pendente

## Falhas reproduzidas

`/api/campaigns` devolvia mensagens técnicas do banco diretamente ao navegador.
Falhas ao carregar corretor autor, donos de instância, nomes dos corretores e
abordagens eram ignoradas, permitindo montar um agendamento com contexto
parcial. A inserção também confirmava sucesso sem comprovar quantas linhas de
`mensagens_agendadas` tinham sido retornadas.

Na interface, erro de rede durante a leitura podia deixar o estado de loading
preso. Depois de um agendamento confirmado, falha apenas na recarga do painel
podia substituir o sucesso por uma impressão de fracasso e induzir repetição
de uma campanha já persistida.

## Correção local

- falhas técnicas são sanitizadas; o log contém somente operação fixa e código,
  sem telefone, conteúdo, lista de leads ou payload;
- todas as consultas necessárias interrompem o comando quando falham;
- instâncias são novamente conferidas como ativas e as abordagens precisam ser
  carregadas antes de gerar as linhas;
- a inserção devolve os IDs persistidos e só confirma sucesso quando a contagem
  corresponde integralmente ao lote preparado;
- divergência de contagem responde `reconciliacao_necessaria` e orienta recarga
  antes de repetir;
- loading da interface sempre termina, inclusive em erro de rede;
- sucesso confirmado é preservado quando somente a recarga posterior falha;
- resposta de rede incerta orienta recarregar antes de qualquer nova tentativa.

## Evidência

- 4/4 contratos específicos de Campanhas;
- 25/25 no recorte Campanhas + harness visual;
- 667/667 no gate frontend completo;
- 424/424 ao reproduzir a fatia isolada diretamente sobre a base publicada;
- typecheck, lint focado e build completo aprovados;
- navegador real sanitizado em 1280 × 800 e 390 × 844: erro explícito, retry
  disponível, zero formulário/agendamento liberado, somente GET local, zero
  console e nenhum overflow horizontal.

Nenhum disparo, agendamento real, mutation remota, migration, push ou deploy
foi executado.

## Limites ainda abertos

O lote continua dependente de uma inserção direta sem chave idempotente única.
Uma resposta de rede perdida pode deixar o resultado incerto e uma repetição
manual ainda pode duplicar a campanha. O contrato definitivo precisa de
`request_id` único, RPC transacional que reserve e grave o lote, versão
otimista da seleção e ensaio em Postgres isolado. Isso permanece fora de
produção até migration e rollback serem autorizados e comprovados.
