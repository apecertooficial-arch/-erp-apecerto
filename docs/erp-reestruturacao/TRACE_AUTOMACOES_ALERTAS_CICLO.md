# Trace — ciclo de vida dos alertas de automação

Atualizado em: 2026-09-19 21:08 America/Sao_Paulo
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
- a automação ativa 49 ainda possui dois alertas `cliente_respondeu`, público
  `gestao`, do bloco `b3`; o bloco não existe mais no mapa publicado e não há
  ação de notificação correspondente;
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

## Resolução por evidência dos 162 alertas preservados

O estoque de ações ainda publicadas foi separado por obrigação, sem consultar
nomes, telefones, e-mails, títulos, detalhes ou conteúdo de mensagens:

| obrigação | abertos | evidência de encerramento encontrada | devem permanecer |
|---|---:|---:|---:|
| primeira abordagem pendente | 40 | 32 | 8 |
| canal indisponível | 120 | 94 | 26 |
| etapa/temperatura da Sara | 2 | 2 | 0 |
| **total** | **162** | **128** | **34** |

As regras foram derivadas do contrato produtivo, não da idade:

- `primeira_abordagem_pendente`: fecha se o card foi descartado, deixou a etapa
  `novo`, confirmou ação, trocou de corretor ou recebeu saída real posterior;
- `canal_indisponivel`: não fecha por simples mudança de etapa; fecha somente
  com descarte ou uma saída posterior confirmada pelo motor/D-API;
- `lead_em_atendimento`: fecha quando o card deixa `em_atendimento`;
- `lead_quente`: fecha quando a temperatura deixa `quente`;
- remoção do card encerra a obrigação, preservando a notificação e registrando
  a referência local do card removido.

O banco já possui `f2_resolver_notificacao_obsoleta`, que acompanha
`primeira_abordagem_pendente` por negócio, mas não reconcilia todas as
notificações criadas depois de um estado já superado e não cobre
`canal_indisponivel`, etapa ou temperatura. Também não registra a linha técnica
que provou o encerramento.

A inspeção encontrou ainda uma incompatibilidade produtiva: o trigger atual de
troca de dono grava `troca_dono_f2`, enquanto o `CHECK` de `resolvida_por`
aceita somente `automatica`, `usuario` e `automatica_f2`. Os drafts preservam os
atores históricos conhecidos (`f2_sync` e `central:*`) e acrescentam os dois
atores novos sem deixar o campo livre para qualquer texto.

`P0_AUTOMACOES_ALERTAS_EVIDENCIA_DRAFT.sql` fecha essa lacuna de forma aditiva:

1. registra tipo, referência local e horário da evidência;
2. reconcilia o estado atual do F2 e impede nova abertura já obsoleta;
3. observa confirmação do transporte no `motor_mensagem_partes`;
4. observa saída real sincronizada pelo webhook em `wa_mensagens`;
5. preserva os 34 alertas sem prova de resolução no snapshot observado;
6. mantém todas as funções internas fora da Data API;
7. aborta se restar alerta contradito pelo estado/evidência ou resolução sem
   trilha técnica.

O novo SQL também é draft, está fora de `supabase/migrations` e não foi
executado. A contagem é um preflight do snapshot observado e deve ser medida
novamente dentro da mesma transação antes de qualquer aplicação futura.
Nove contratos específicos passaram e o gate frontend completo ficou em
561/561; compilação SQL e comportamento persistente continuam reservados ao
ensaio Postgres isolado.

## Revalidação da superfície acionável

Uma nova leitura somente agregada, sem PII, encontrou sete tipos técnicos abertos no
catálogo produtivo: `acao_vencida`, `canal_indisponivel`,
`primeira_abordagem_pendente`, `presenca_pendente`, `cliente_respondeu` e as
duas transições da Sara. O estoque Sara chegou a 798 `acao_vencida`; os 697
alertas antigos de automações arquivadas permanecem e 696 continuam sem
`deep_link`. Ações ainda configuradas somam 164 no novo recorte; o preflight
128/34 continua sendo evidência do snapshot anterior e precisa ser recalculado
transacionalmente antes da futura migration.

O recorte por chave confirmou que os dois `cliente_respondeu` são exatamente
`automacao:49:b3:*`, ambos para gestão. Eles não ampliam o estoque configurado:
já são os dois itens `ação removida ou alterada` incluídos nos 699 alertas sem
autoridade do draft de ciclo. Criar outra rotina de encerramento para esse tipo
duplicaria autoridade e foi descartado.

A interface local passou a cobrir todos os tipos atualmente abertos com ação
real: negócio abre a ficha, canal abre diretamente Conexões inclusive no celular
do gestor, feedback abre Agenda e presença abre Meu Dia. `presenca_pendente`
agora é urgente no service worker, com rótulo `Confirmar presença`; o componente
global existente continua sendo a única autoridade de confirmação e valida
sessão + IP na Edge Function. Links externos e rotas inventadas falham fechados.
Nenhuma linha remota foi alterada.

## Gates restantes

1. gerar a migration pela CLI oficial;
2. compilar e ensaiar em banco isolado com fixtures sem PII;
3. testar arquivo, desarquivo, desativação, republicação, remoção e mudança de
   público/tipo sob concorrência;
4. confirmar contagens antes/depois: 699 alertas sem autoridade devem fechar no
   snapshot observado, e alertas de ações ainda publicadas devem permanecer;
5. rodar advisors e plano de rollback;
6. obter autorização específica antes de aplicar em produção.
7. no ensaio isolado, confirmar 128 encerramentos e 34 preservações no snapshot
   equivalente, além de inserts concorrentes e eventos fora de ordem.
