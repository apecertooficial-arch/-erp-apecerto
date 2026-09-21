# Trace — janela inteligente da conversa da Sara

Atualizado em: 2026-09-21

## Estado comprovado

- a produção já usa agrupamento por card, idempotência por mensagem e auditoria
  individual, mas essa autoridade existia sem quatro fontes no repositório;
- as quatro migrations foram recuperadas pelo conteúdo e MD5 registrados no
  histórico remoto, sem reaplicação no banco;
- `private.sara_enfileirar_mensagem(uuid)` tem SHA-256
  `c12a68df57a7dac2e0f8733decfd054bec8e8dfe65ca7495f62cef0c17876b71`;
- configuração ativa observada: 6 segundos de silêncio e 15 segundos de teto;
- perfil agregado de 24 horas: 210 mensagens, 176 lotes, 1,19 mensagem por
  lote, latência p50 de 7,98 s e p95 de 15,55 s;
- a telemetria mostra que o mecanismo está saudável, mas classifica rápido
  demais para representar o encerramento de uma conversa humana.

## Correção proposta

O draft `P0_SARA_JANELA_CONVERSA_DRAFT.sql` propõe:

- 90 segundos de silêncio depois da última mensagem;
- teto de 10 minutos desde a primeira mensagem do lote;
- faixas configuráveis de 30–300 s e 60–900 s;
- preflight pelo hash exato da função, constraints e configuração observada;
- verificação dentro da transação e `ROLLBACK` obrigatório.

## Gate

O SQL não foi aplicado. Antes da migration definitiva é necessário executá-lo
em uma branch Supabase isolada, simular rajadas, conversa longa, concorrência e
retry, medir custo/latência e só então preparar promoção e rollback de produção.
