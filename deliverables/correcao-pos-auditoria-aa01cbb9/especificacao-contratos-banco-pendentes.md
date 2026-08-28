# Contratos de banco pendentes — CRM após auditoria

Data: 28/08/2026
Estado: **especificação somente; nenhuma migration, função, policy ou alteração de schema foi executada**.

## Decisão desta entrega

A inspeção dos contratos existentes confirmou que o banco atual não oferece ao Funil uma operação transacional e autorizável para:

- ganhar, perder e restaurar o negócio canônico;
- desfazer uma mutação já persistida;
- mover vários atendimentos de forma atômica.

`f2_negociacao` é uma oportunidade operacional e não pode ser usada para fingir o fechamento de `negocios`. A RPC `mover_negocio` move entre etapas existentes, mas as etapas atuais auditadas são abertas e não formam um contrato genérico de ganho/perda/restauração. `motor_acoes` não oferece o contrato de UI necessário. Por isso, os controles inseguros foram removidos ou bloqueados antes de qualquer chamada.

## Contrato 1 — encerrar e restaurar negócio canônico

Nome indicativo, sujeito a revisão do banco: `crm_transicionar_negocio`.

Entrada mínima:

- `p_negocio_id`;
- `p_acao`: `ganhar`, `perder` ou `restaurar`;
- `p_motivo_id`/`p_motivo_texto` quando obrigatório;
- `p_versao_esperada`;
- `p_idempotency_key`;
- contexto autenticado obtido da sessão, nunca informado pelo cliente.

Garantias obrigatórias:

1. validar autenticação, papel e escopo do negócio;
2. bloquear a linha e rejeitar versão concorrente com código estável `versao_conflito`;
3. validar a transição de status/etapa conforme regras canônicas já existentes;
4. atualizar `negocios`, etapa/status da pipeline e integrações da Esteira na mesma transação;
5. registrar evento de auditoria com autor, origem, estado anterior e posterior;
6. refletir o resultado operacional no Funil sem criar uma segunda verdade;
7. retornar o estado canônico completo após commit;
8. não disparar WhatsApp/D-API como efeito implícito;
9. garantir idempotência e rejeitar repetição incompatível.

Saída mínima:

- `ok`;
- `negocio_id`;
- `status`, `pipeline_id`, `stage_id`, `versao`;
- `evento_id`;
- `undo_token` opcional quando o contrato 2 estiver habilitado;
- erro estável: 401/403/409/422, sem mensagem ambígua.

## Contrato 2 — Desfazer persistente

Nome indicativo: `crm_desfazer_operacao`.

O servidor deve criar um registro de operação reversível somente após a transação original confirmar. O token não pode conter o snapshot integral no cliente.

Garantias obrigatórias:

- janela ativa de pelo menos 10 segundos após a confirmação renderizada;
- operação vinculada ao autor, escopo e `idempotency_key`;
- uso único;
- verificação de que o objeto não sofreu alteração incompatível depois da operação;
- restauração atômica de estado, posição, totais e histórico;
- evento de auditoria próprio para o desfazer;
- 409 com estado atual quando a restauração não for mais segura;
- nenhuma compensação parcial no frontend.

## Contrato 3 — movimento em massa atômico

Nome indicativo: `f2_mover_lote_atomico`.

Entrada mínima:

- lista não vazia de `{ funil_lead_id, versao_esperada }`;
- etapa/momento de destino;
- `idempotency_key`.

Garantias obrigatórias:

1. limite máximo explícito de itens;
2. autenticação e escopo verificados para todos os itens antes de qualquer update;
3. locks ordenados por ID para reduzir deadlock;
4. validação de versão, etapa ativa e atividade obrigatória para todo o lote;
5. tudo confirma ou nada confirma;
6. trilha única do lote e eventos por item na mesma transação;
7. resposta com estado final de todos os itens;
8. 409 contendo os itens conflitantes, sem aplicar subconjunto.

## Critérios de autorização futura

Antes de qualquer implementação no banco, exigir:

- autorização explícita para migration/RPC/policies;
- revisão das regras comerciais por responsável do CRM/Esteira;
- teste em ambiente isolado com RLS para Corretor, Gestor e Admin;
- testes de concorrência, idempotência, rollback e auditoria;
- plano de rollback da migration;
- confirmação de que nenhum gatilho dispara comunicação externa.

Até esses critérios serem atendidos, a interface deve permanecer honesta: consultar a Esteira, bloquear lote inseguro e não exibir sucesso de fechamento, restauração ou Desfazer.
