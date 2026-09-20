# Trace — presença e ciclo dos alertas

Atualizado em: 2026-09-19 America/Sao_Paulo
Escopo: código canônico local + metadados agregados de produção, sem PII e sem escrita.

## Evidência sanitizada

O catálogo produtivo possuía três alertas `presenca_pendente` abertos. O
confronto agregado com `presenca_estado` mostrou:

- 3 alertas abertos;
- 0 corretores ainda com `aguardando_desde` preenchido;
- 3 alertas contraditos pelo estado atual;
- 0 linhas de identidade ou conteúdo operacional consultadas.

A função produtiva `presenca_avisar_pendentes()` contém a resolução, mas executa
o teste de configuração/dia/horário antes do `update`. À noite, em fim de semana
ou com a função desativada, ela retorna e preserva avisos de uma obrigação já
cumprida. Isso explica o estoque observado sem atribuí-lo à interface.

## Segurança

`motor_dispatcher_manutencao_tick(text)` é `SECURITY DEFINER`, usa
`search_path=''` e permite execução apenas por `service_role`. Entretanto, três
rotinas internas chamadas por ele ainda permitem `authenticated`:

- `presenca_avisar_pendentes()`;
- `presenca_derrubar_expirados()`;
- `sla_msg_cache_refresh()`.

Não foi encontrado chamador humano local, em função remota ou cron. O chamador
comprovado é o dispatcher/cohost. Manter grants humanos cria uma porta paralela
para manutenção privilegiada e não é necessário para o aplicativo.

## Correção preparada

`P0_PRESENCA_ALERTAS_CICLO_DRAFT.sql`:

1. resolve estado superado antes de qualquer retorno por configuração/janela;
2. mantém criação e push somente na janela configurada;
3. preserva chave idempotente e histórico;
4. usa nomes qualificados e `search_path=''`;
5. restringe as três rotinas internas a `service_role`;
6. falha se restar aviso aberto contradito pelo estado ou grant humano.

O draft está fora de `supabase/migrations` e não foi aplicado. A definição
anterior deve ser capturada no preflight da futura migration para rollback. Não
se deve reabrir alerta cuja obrigação já foi cumprida.

## Gates restantes

1. gerar migration oficial a partir do draft;
2. compilar em Postgres/Supabase isolado;
3. testar confirmação durante e fora da janela, função inativa e concorrência;
4. testar dispatcher com `service_role` e negar `authenticated`;
5. executar advisors e ensaiar rollback;
6. obter autorização específica antes de aplicar em produção.
