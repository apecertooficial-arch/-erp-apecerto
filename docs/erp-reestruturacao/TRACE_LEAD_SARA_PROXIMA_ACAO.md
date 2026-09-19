# Trace — lead → Sara → próxima ação

Atualizado em: 2026-09-19 14:10 America/Sao_Paulo
Escopo: código canônico local + metadados agregados de produção, sem PII e sem escrita.

## Veredito

O caminho operacional vigente é `f2_*` + `motor_fila` + dispatcher persistente.
A família `ncrm_sara_*` está aposentada para CRM, embora alguns objetos e a Edge
Function ainda existam por compatibilidade. A rota `/api/funil2` misturava as
duas gerações para montar o estado exibido na tela; isso foi reproduzido por
teste e corrigido localmente.

## Caminho canônico comprovado

| Passo | Evento/comando | Autoridade persistente | Segurança/concorrência | Evidência |
|---|---|---|---|---|
| 1 | mensagem do D-API é persistida | `wa_mensagens` e vínculo do atendimento | webhook próprio; contrato ainda requer auditoria completa | `dapi-webhook`; migrations de conversa em tempo real |
| 2 | `private.sara_enfileirar_mensagem(uuid)` cria evento único | `motor_fila`, automação `49` | função privada, `service_role`; índices únicos por mensagem/checkpoint | migration `20260828203000_central_sara_evento_unico.sql` |
| 3 | dispatcher reivindica item com lease | `motor_fila` + `private.motor_dispatcher_estado` | claim/lease/renovação; processamento unitário | worker `automations-dispatcher`; migrations de dispatcher |
| 4 | motor chama a Sara com `event_type`, `source_id`, `execution_id` | execução e logs do motor | contexto obrigatório para eventos de prazo | automação 49 + `f2-sara-reclassificar` |
| 5 | Edge lê somente um card pelo `f2_sara_candidato` | `f2_lead`, conversa e catálogo `f2_momento_config` | sem varredura em lote; segredo antes do cliente privilegiado | Edge Function e testes `funil-2-sara-worker` |
| 6 | classificação produz momento, etapa, próxima ação, temperatura e qualidade | `f2_sara_analise` | evidência precisa apontar mensagem real; sugestão versionada | Edge Function + RPCs `f2_sara_registrar_sugestao_v2` |
| 7 | aplicação atualiza o card e agenda nova checagem | `f2_lead`, `f2_evento`, `motor_fila` | versão otimista, idempotência e checkpoint único | `f2_sara_aplicar_analise_v2` e `f2_sara_agendar_checkpoint` |
| 8 | Meu Dia e CRM leem a próxima ação | `/api/funil2` sobre `f2_lead` | sessão real + RLS; ordenação por `proxima_acao_em` | rota e componentes Funil 2.0 |

## Estado remoto sanitizado observado

- projeto Supabase `diaegvfveqezispcthwk`: `ACTIVE_HEALTHY`, Postgres 17;
- dispatcher: modo `worker`, heartbeat com 4 segundos, `lag_seconds=0`;
- fila: 211 pendentes, todas da Sara e nenhuma vencida; 0 processando, 0 falhas;
- cron comercial correspondente: nenhum ativo, conforme o cutover para worker;
- `f2_sara_config`: ligada, modo `completo`, lote 10;
- `ncrm_sara_config`: `observer`; runner legado desligado;
- banco: 232 tabelas públicas, 37 views/materialized views e 562 funções públicas;
- 53 Edge Functions remotas, contra 26 diretórios locais. A diferença exige
  reconciliação; não autoriza remoção;
- `f2-sara-reclassificar` remota está ativa na versão 32; a função legada
  `ncrm-sara-observer` também permanece implantada, mas seu runner está desligado.

## Falha reproduzida e correção local

**Cenário:** a rota do Funil 2.0 consultava `ncrm_sara_modo_status` e
`ncrm_sara_runner_status` para exibir a saúde da Sara, apesar de produção marcar
as tabelas `ncrm_sara_*` como geração aposentada e manter o runner desligado.

**Impacto:** a interface podia declarar o runner desligado ou degradar a fonte
Sara por falha do legado enquanto o dispatcher canônico estava saudável. É o
caso exato de “o front diz uma coisa e o backend real faz outra”.

**Correção:** `/api/funil2` deixou de consultar `ncrm_sara_*`; o estado visível
agora deriva apenas de `f2_sara_config`. O texto da tela não afirma saúde do
runtime sem possuir uma consulta autorizada para isso; diz apenas que a
classificação está configurada e é executada pelo motor canônico.

**Teste:** o teste agora falha se a rota voltar a chamar os dois RPCs legados ou
reintroduzir o campo enganoso `runnerAtivo`. Resultado local: 21 testes
direcionados aprovados e ESLint dos arquivos alterados aprovado.

## Métricas agregadas da operação real

As consultas abaixo usam apenas contagens e percentis dos últimos 30 dias:

- 14.820 análises da Sara; 11.764 aplicadas;
- nos eventos diretos de conversa dos últimos 7 dias, a mediana mensagem →
  análise foi 6,5 s e o p95 foi 10,3 s;
- checkpoints de próxima ação aparecem deliberadamente cerca de um dia depois
  da última mensagem; não devem ser misturados ao SLA da conversa em tempo real;
- 671 cards ativos e não legados: 100% possuem etapa, momento e próxima ação;
- 523/671 possuem temperatura, 342/671 possuem nota + resumo de qualidade e
  557/671 já receberam reavaliação da Sara;
- 338/671 próximas ações estão vencidas. As maiores concentrações são cadência
  sem resposta (136), conversando/qualificando (59) e produto enviado (32);
- existem 6 cards em `VISITA_REALIZADA` com próxima ação vencida e 10 em
  acompanhamento pós-visita vencido.

Conclusão: o evento direto da Sara está rápido no período recente. O problema
mais grave não é o transporte imediato da IA, mas o estoque de obrigações
vencidas, a cobertura incompleta de temperatura/qualidade e a apresentação das
cobranças ao corretor e ao gerente.

## P0 descoberto — alertas duplicados por cliente

Produção possuía 690 alertas `acao_vencida` da Sara abertos na primeira leitura
desta fatia, correspondentes a apenas 132 cards. Minutos depois eram 694: 347
para gestão e 347 para corretores. Existem 154 grupos `card + público` com mais
de um alerta; o máximo observado foi 35 alertas para o mesmo card e público.
Dezesseis alertas pertencem a cards já descartados. A variação durante a própria
inspeção comprova que o produtor continua ampliando o estoque.

Todos os alertas atuais têm `execution_id`, mas a chave idempotente é por
execução/checkpoint, não por cliente + público. Assim, cada novo prazo vencido
cria outro item aberto para o mesmo cliente. A RPC de leitura limita a lista a
100 linhas, de modo que duplicatas recentes podem ocultar clientes mais antigos.

Correção correta exige contrato de banco para consolidar a obrigação atual por
cliente, preservar as ocorrências anteriores como histórico e resolver alertas
quando o corretor produzir evidência válida ou o lead sair da carteira. Isso não
deve ser mascarado apenas no frontend. Alterar a função em produção continua no
gate de migration específica.

O contrato local dessa correção está em
`P0_ALERTAS_SARA_DEDUPE_DRAFT.sql`, acompanhado por sete testes de invariantes.
Ele adiciona vínculo direto ao card F2, consolida sem `DELETE`, fecha descartados,
impõe unicidade parcial sob concorrência, resolve por evidência/confirmação e
separa o total autorizado do limite visual de cem itens. Permanece fora de
`supabase/migrations` porque a CLI oficial não está disponível e nomes de
migration não serão inventados manualmente.

## Lacunas e próximos gates

1. comparar os 53 pacotes remotos com os 26 fontes locais e registrar owner;
2. reconciliar os nomes/versões das migrations aplicadas com os 294 arquivos;
3. corrigir, com migration aditiva e rollback, a cardinalidade dos alertas da
   Sara e sua resolução por evidência/saída da carteira;
4. validar a correção no navegador local usando sessão sanitizada;
5. não remover `ncrm_sara_*` até provar ausência de chamadores vivos e preparar
   substituição/rollback; `ncrm_notificacao` e `ncrm_push_*` continuam vivos e
   não pertencem ao conjunto aposentado.
