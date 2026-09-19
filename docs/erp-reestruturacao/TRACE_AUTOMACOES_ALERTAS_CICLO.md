# Trace — ciclo de vida dos alertas de automação

Atualizado em: 2026-09-19 20:10 America/Sao_Paulo
Escopo: código canônico local + metadados agregados de produção, sem PII e sem escrita.

## Veredito

Os alertas com prefixo `automacao:*` e os alertas `sara:*` são produzidos por
contratos diferentes e não podem ser deduplicados pela mesma regra.

- Sara identificava a obrigação pela execução/checkpoint e criava várias linhas
  abertas para o mesmo card e público;
- o motor de automações já usa chave estável por
  `automação + bloco + lead + público + tipo` e o índice de chave aberta evita
  repetição exata;
- o problema do motor é ciclo de vida: desativar, arquivar ou remover a ação do
  mapa não encerra os alertas já abertos.

## Evidência sanitizada de produção

Leituras agregadas no projeto `diaegvfveqezispcthwk` provaram:

- os 697 alertas abertos `automacao:*` do tipo `acao_vencida` pertencem somente
  às automações 58, 59 e 60;
- as três estão `ativa=false`, `arquivada=true` e não produzem novas entradas;
- distribuição: automação 58 = 521, automação 60 = 175, automação 59 = 1;
- a janela desses alertas vai de 2026-08-11 a 2026-08-22;
- 696 desses alertas ainda usam a chave legada de quatro partes; somente um já
  usa a chave atual de seis partes, que inclui público e tipo;
- nenhuma chave aberta exata está repetida;
- a automação ativa 49 ainda possui dois alertas de um bloco `b3` que não existe
  mais no mapa publicado;
- automações ativas 65, 66, 70 e 71 possuem alertas de blocos ainda publicados,
  principalmente `canal_indisponivel` e `primeira_abordagem_pendente`. Eles não
  foram classificados como lixo nem incluídos na reconciliação automática.

O preflight que replica a regra do draft sobre todo o estoque aberto classificou
697 alertas como `autoridade_inativa`, dois como `ação removida ou alterada` e
162 como `ativa_configurada`. A correção deve fechar exatamente os primeiros
699 no snapshot observado e preservar os 162 últimos.

Nenhum nome de lead, telefone, e-mail, conteúdo de mensagem, título configurado
ou detalhe operacional foi consultado ou armazenado.

## Falha de contrato

`motor_acoes` cria a notificação com chave determinística, mas a tabela guarda
apenas a chave textual. Não há FK direta para automação/bloco/lead e não existe
função produtiva que encerre `automacao:*` quando sua automação é arquivada,
desligada, despublicada ou perde a ação correspondente. A interface atual altera
`automacoes.arquivada` sem um encerramento transacional das obrigações.

## Correção local preparada

`P0_AUTOMACOES_ALERTAS_CICLO_DRAFT.sql`:

1. adiciona vínculos diretos para automação, bloco e lead;
2. faz backfill das chaves legadas e atuais, somente para autores existentes;
3. preserva histórico e registra resolução como `automacao_ciclo`;
4. valida se o mapa publicado ainda contém o mesmo bloco, público e tipo;
5. fecha somente alertas cuja automação perdeu autoridade;
6. vincula novos inserts por trigger, sem copiar a função extensa `motor_acoes`;
   gravações novas com chave legada ou malformada falham fechadas;
7. repete a reconciliação em toda mudança de atividade, publicação, arquivo ou
   mapa;
8. aborta se restar chave canônica sem vínculo ou alerta aberto sem autoridade.

O SQL é draft, está fora de `supabase/migrations` e não foi executado.

Validação local: 9/9 contratos específicos, 17/17 combinados com o draft da
Sara, gate frontend 552/552, typecheck e build aprovados; lint sem erros e com
os mesmos dez avisos preexistentes. A validação desta fatia é de contrato e
preflight agregado; comportamento persistente ainda depende do ensaio isolado.

## Gates restantes

1. gerar a migration pela CLI oficial;
2. compilar e ensaiar em banco isolado com fixtures sem PII;
3. testar arquivo, desarquivo, desativação, republicação, remoção e mudança de
   público/tipo sob concorrência;
4. confirmar contagens antes/depois: 699 alertas sem autoridade devem fechar no
   snapshot observado, e alertas de ações ainda publicadas devem permanecer;
5. rodar advisors e plano de rollback;
6. obter autorização específica antes de aplicar em produção.
