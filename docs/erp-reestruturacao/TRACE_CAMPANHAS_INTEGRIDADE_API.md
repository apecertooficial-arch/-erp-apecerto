# Trace — integridade de Campanhas e Disparos

Atualizado em: 2026-09-20
Estado: P0 de fronteira corrigido e pronto para publicação; idempotência transacional ainda pendente

## Falhas reproduzidas

`/api/campaigns` devolvia mensagens técnicas do banco diretamente ao navegador.
Falhas ao carregar corretor autor, donos de instância, nomes dos corretores e
abordagens eram ignoradas, permitindo montar um agendamento com contexto
parcial. A inserção também confirmava sucesso sem comprovar quantas linhas de
`mensagens_agendadas` tinham sido retornadas.

A interface exibia período, dias e horário final, mas esses campos não
atravessavam o contrato. O servidor agendava apenas pela data inicial e
velocidade, usando o fuso do processo. Isso fazia a configuração visível não
ter consequência real e podia colocar os passos finais de uma abordagem depois
do horário prometido.

Na interface, erro de rede durante a leitura podia deixar o estado de loading
preso. Depois de um agendamento confirmado, falha apenas na recarga do painel
podia substituir o sucesso por uma impressão de fracasso e induzir repetição
de uma campanha já persistida.

## Correção

- falhas técnicas são sanitizadas; o log contém somente operação fixa e código,
  sem telefone, conteúdo, lista de leads ou payload;
- leitura e envio exigem autorização efetiva no servidor;
- todas as consultas necessárias interrompem o comando quando falham;
- data, janela diária, dias, período e velocidade são validados em horário de
  São Paulo e determinam o agendamento real;
- o horário final inclui todos os passos e pausas da abordagem, não somente a
  primeira mensagem;
- a vazão é calculada por instância ativa e a capacidade insuficiente bloqueia
  o lote antes de qualquer escrita;
- lotes acima de 5.000 mensagens são rejeitados e precisam ser divididos;
- instâncias são novamente conferidas como ativas e as abordagens precisam ser
  carregadas e permanecer ativas antes de gerar as linhas;
- a inserção devolve os IDs persistidos e só confirma sucesso quando a contagem
  corresponde integralmente ao lote preparado;
- divergência de contagem responde `reconciliacao_necessaria` e orienta recarga
  antes de repetir;
- loading da interface sempre termina, inclusive em erro de rede;
- sucesso confirmado é preservado quando somente a recarga posterior falha;
- resposta de rede incerta orienta recarregar antes de qualquer nova tentativa.

## Evidência

- 14/14 contratos específicos de Campanhas, incluindo horário de São Paulo,
  capacidade, autorização, reconciliação e harness visual;
- 507/507 no gate frontend canônico do projeto;
- typecheck, lint focado e build completo aprovados;
- navegador real sanitizado em 1280 × 800 e 390 × 844, nos estados carregado e
  erro: controles reais, erro explícito, retry disponível, alvos móveis de 44
  px, somente GET local, zero console e nenhum overflow horizontal.

Nenhum disparo, agendamento real, mutation remota ou migration foi executado.

## Limites ainda abertos

O lote continua dependente de uma inserção direta sem chave idempotente única.
Uma resposta de rede perdida pode deixar o resultado incerto e uma repetição
manual ainda pode duplicar a campanha. O contrato definitivo precisa de
`request_id` único, RPC transacional que reserve e grave o lote, versão
otimista da seleção e ensaio em Postgres isolado. Isso permanece fora de
produção até migration e rollback serem autorizados e comprovados.
