# Trace — versionamento das automações

Atualizado em: 2026-09-24

## Contrato verificado

- `mapa_rascunho` é editável sem substituir o snapshot publicado;
- automação em `rascunho` não entra na fila, mesmo se `ativa=true`;
- a publicação exige gestão, valida o mapa, cria uma linha imutável em
  `automacao_versoes` e rejeita uma versão esperada desatualizada;
- a fila fixa `automacao_versao_id` e o runtime lê o mapa dessa versão, não o
  rascunho corrente;
- execução direta por usuário autenticado continua bloqueada; o worker usa o
  contexto de serviço.

## Prova produtiva com rollback

Uma automação temporária foi criada dentro de transação com o mesmo produto e
referências válidas da automação 73. O rascunho apontava o gatilho para `b16`,
enquanto o snapshot publicado terminava imediatamente após a Entrada.

Resultados observados:

- enfileiramento em estado `rascunho`: recusado com
  `AUTOMATION_NOT_RUNNABLE`;
- publicação autorizada: versão criada e vinculada à automação;
- fila posterior: `automacao_versao_id` e o contexto receberam a mesma versão;
- execução pelo contexto do worker: `Entrada → fim`, exatamente como no
  snapshot publicado;
- resultado: 1 lead, 0 negócios e 0 cards. Se o rascunho tivesse sido usado, o
  caminho completo teria avançado para ações comerciais;
- pós-`ROLLBACK`: 0 automações, 0 versões, 0 filas, 0 leads, 0 negócios e 0
  cards da prova.

Nenhuma abordagem, notificação ou outro efeito externo foi executado.
