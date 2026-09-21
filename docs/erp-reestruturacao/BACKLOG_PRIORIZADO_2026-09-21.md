# ERP ApeCerto — backlog priorizado e verificável

Atualizado em: 2026-09-21

Este backlog não mede existência de tela. Cada item nasce de uma divergência
reproduzida entre interface, código, banco ou produção. `Publicado` significa
commit confirmado no ambiente indicado; `bloqueado por gate` não significa
descartado.

## P0 — risco de segurança, perda de receita ou fonte não reproduzível

| Item | Cenário e impacto | Evidência atual | Próximo gate | Estado |
|---|---|---|---|---|
| Ownership dentro de `f2_confirmar_acao` | Qualquer sessão `authenticated` possui `EXECUTE` numa função `SECURITY DEFINER` que não valida `auth.uid()` nem o corretor dono. Chamada direta contorna a API e pode fabricar conclusão operacional | catálogo remoto sanitizado; `TRACE_F2_CONFIRMAR_ACAO.md`; `P0_F2_CONFIRMAR_ACAO_DRAFT.sql` | ensaio isolado de ACL, dono, concorrência, idempotência e rollback; depois migration aditiva + Edge + aplicação compatíveis | bloqueado por branch Supabase isolada |
| Ownership dentro de `f2_registrar_resultado_visita` | A mesma combinação permite registrar resultado fora da carteira por RPC direta, apesar da guarda existente na API | catálogo remoto sanitizado; `TRACE_VISITA_FEEDBACK_COBRANCA.md`; `P0_VISITA_OWNER_COBRANCA_DRAFT.sql` | ensaio isolado positivo/negativo, histórico e rollback; depois migration aditiva | bloqueado por branch Supabase isolada |
| RPCs legadas de carteira | Seis funções `SECURITY DEFINER` permitem registrar ação, solicitar/aprovar descarte ou iniciar/aceitar/forçar transferência sem validar objeto, ator e papel dentro da RPC; duas ainda têm `EXECUTE` para `anon`; etapas são buscadas globalmente em vez do funil do negócio | catálogo e definições remotas sanitizadas; `TRACE_RPC_LEGADO_AUTORIZACAO_2026-09-21.md`; `P0_RPC_LEGADO_AUTORIZACAO_DRAFT.sql` | executar casos positivos/negativos por perfil, pipeline, retry e concorrência na branch isolada; depois gerar migration aditiva | draft local 6/6; bloqueado por branch Supabase |
| RPCs internas expostas | Dez rotinas de D-API, WhatsApp, distribuição, funil, Sara/cascata e performance são `SECURITY DEFINER` e ainda aceitam chamada direta de qualquer sessão autenticada; `perf_log_sessao` também aceita `anon` e todos os tipos comerciais | catálogo/definições/ACLs remotos, chamadores internos e cron sanitizados; `TRACE_RPC_INTERNAS_ACL_2026-09-21.md`; `P0_RPC_INTERNAS_ACL_DRAFT.sql` | negar `anon`/corretor e provar jobs, Edge, gatilhos e workers positivos na branch; rodar advisors e observar logs | draft local 5/5; bloqueado por branch Supabase |
| RPCs internas expostas — lote 2 | Avaliação de IA, vínculo e histórico WhatsApp, guardião e redistribuição também permitem escrita privilegiada direta por qualquer sessão autenticada; `redistribuir_lead` ainda usa etapa global e não possui concorrência/auditoria | catálogo/definições/ACLs, chamadores e cron sanitizados; `TRACE_RPC_INTERNAS_ACL_LOTE2_2026-09-21.md`; `P0_RPC_INTERNAS_ACL_LOTE2_DRAFT.sql` | provar gatilho, Edge e motor positivos, negação por corretor e destino das duas autoridades históricas na branch | draft local 3/3; bloqueado por branch Supabase |
| RPCs internas expostas — lote 3 | Agente, autoaprendizado de IP, alertas, presença, SLA e backfills/espelhamento WhatsApp também podem ser executados diretamente; `wa_move_respondeu` usa etapa global | catálogo/definições/ACLs, dispatcher, cron e gatilho sanitizados; `TRACE_RPC_INTERNAS_ACL_LOTE3_2026-09-21.md`; `P0_RPC_INTERNAS_ACL_LOTE3_DRAFT.sql` | provar dispatcher/cron/gatilho/workers, negação por corretor e observação de filas/cache na branch | draft local 3/3; bloqueado por branch Supabase |
| Webhook DataCrazy legado | RPC privilegiada aberta a `PUBLIC`/`anon` aceita segredo no payload e possui fallback embutido; configuração não atende ao mínimo de 32 caracteres, não há consumidor atual nem movimentação persistida | metadados/configuração booleana/volume sanitizados; `TRACE_DATACRAZY_WEBHOOK_2026-09-21.md`; `P0_DATACRAZY_WEBHOOK_ACL_DRAFT.sql` | confirmar emissor externo; ensaiar quarentena; se ativo, substituir por Edge/cofre/idempotência; se inativo, aposentar em migration separada | draft local 3/3; bloqueado por branch Supabase |
| Ficha pública contorna API | API minimiza PII e limita 32 KiB, mas as RPCs públicas podem ser chamadas diretamente: leitura devolve nome/telefone/e-mail e escrita não limita payload/campos, consentimento ou estado encerrado | contrato da API, catálogo/schema/RLS/ACL sanitizados; `TRACE_FICHA_PUBLICA_TOKEN_2026-09-21.md`; `P0_FICHA_PUBLICA_TOKEN_DRAFT.sql` | ensaiar token/estado/payload/consentimento, E2E público e chamada direta negativa/sem PII na branch | draft local 5/5; bloqueado por branch Supabase |
| Confirmação real da próxima ação | A produção bloqueia confirmação manual para não reutilizar uma RPC que carimba Sara sem nova análise; o corretor não consegue concluir de forma auditável ações não D-API | `TRACE_F2_CONFIRMAR_ACAO.md`; candidato `c6691411`; Edge remota ainda idêntica à `main` | aplicar contrato do banco em ambiente isolado, publicar banco → Edge → aplicação e provar E2E | bloqueado por branch Supabase isolada |
| Janela de conversa da Sara | Runtime atual usa 6 s de silêncio/15 s de teto e gerou lotes muito pequenos; custo e estado podem oscilar durante conversa ativa | `TRACE_SARA_JANELA_CONVERSA.md`; quatro migrations produtivas agora versionadas; draft de 90 s/10 min | simular atraso, rajada, teto, repetição e orçamento; promover apenas depois do ensaio | bloqueado por branch Supabase isolada |
| Cobrança persistente de visita | A fila visual está publicada e focada por corretor; o gerente agora possui comando local auditável para registrar a cobrança sem resolver a pendência, mas criação automática/reabertura/dedupe ainda não foram ensaiadas no banco | builds `27b8f960` e `04ab7759`; `TRACE_VISITA_FEEDBACK_COBRANCA.md`; `TRACE_GESTAO_COBRANCA_PERSISTENTE_2026-09-21.md`; 1032/1032 | compilar/publicar o comando da aplicação; ensaiar criação e resolução automáticas, reabertura e dedupe na branch Supabase | aplicação local pronta; automação bloqueada por branch Supabase |
| Deriva de migrations | Após recuperar 26 fontes comprovadas nesta reconstrução, 314 migrations aplicadas continuam sem arquivo; Git sozinho não reconstrói o banco | `supabase/MIGRACOES-FALTANTES.md`; `INVENTARIO_TECNICO_BASELINE.md` | recuperar fontes por lote e também por conteúdo, fixar hash e dependências; nunca reaplicar só para preencher histórico | em andamento |
| Backup integral ApeCerto SP | Banco, Auth e Storage ainda não possuem prova completa de cobertura e restauração; máquina local não comporta dump + objetos + restore seguro | checkpoint B0 e plano mestre S3; ~1,3 GB de relações, ~1,4 GB de objetos e pouco espaço local | ferramenta oficial, credencial read-only, destino privado redundante e capacidade; depois exportação + checksums + restore isolado | bloqueado por ferramenta/credencial/destino |

## P1 — jornada operacional incompleta ou risco alto de manutenção

| Item | Cenário e impacto | Evidência atual | Próximo gate | Estado |
|---|---|---|---|---|
| Áudio de feedback | Interface e contrato privado existem, mas Storage, transcrição, retry e confirmação não estão ativos de ponta a ponta | `P1_VISITA_FEEDBACK_AUDIO_DRAFT.sql`; testes de contrato | ensaio isolado sem provedor externo e E2E com áudio sanitizado | local |
| Pipeline configurável | Existem autoridades e jornadas históricas concorrentes; criar pipeline/etapa ainda não possui contrato único comprovado com automação | `MATRIZ_INTEGRAL.md`; inventário de CRM | mapear comandos reais, dependências e migração; eleger autoridade sem apagar legado ativo | inventário |
| Financeiro essencial | Telas existem, mas atomicidade, rateio, conciliação e segregação completa ainda têm gaps; não pode ser autoridade contábil confiável | traces e testes financeiros; matriz `/financeiro` | fechar uma venda sintética ponta a ponta com comissão, recebimento, estorno e auditoria | parcial |
| Push/WhatsApp gerencial | Push existe parcialmente; entrega insistente, dedupe, confirmação e canal WhatsApp do gerente não estão comprovados | matriz `/notificacoes`; contratos PWA | E2E em dispositivo físico e adapter WhatsApp explicitamente autorizado | parcial |
| Estados offline/conflito no aplicativo | Há casca offline e alguns estados fail-closed, mas todas as mutações críticas ainda não foram exercitadas sob perda e reconexão | testes PWA e matriz mobile | E2E por jornada com rede interrompida, fila pendente e conflito de versão | parcial |
| Observabilidade das automações | Entrada foi endurecida, mas ciclo completo de efeitos, dead letter, alerta e reconciliação ainda possui autoridades históricas | `TRACE_ENTRADA_EDGE_HARDENING.md`; matriz `/automacoes` | fechar uma automação sintética sem WhatsApp real e provar uma única consequência | parcial |

## P2 — expansão do produto implantável

| Item | Cenário e impacto | Evidência atual | Próximo gate | Estado |
|---|---|---|---|---|
| Portal do proprietário | Requisito aprovado, mas não integra a jornada mínima atual | requisitos canônicos §9 | contrato de consentimento, escopo e dados antes de interface | ausente |
| Provisionamento por imobiliária | Ainda não há prova repetível de ambiente, domínio, banco, Storage, usuários, identidade e rollback | plano contínuo e critério de ERP vendável | comparar dedicada/multiempresa/híbrida e executar primeiro provisionamento isolado | ausente |
| Personalização sem fork | Logo/cores foram preservados, mas módulos, funis, campos e integrações ainda dependem parcialmente do núcleo | requisitos canônicos §13 e inventário | catálogo de configuração + adapters ApeCerto + teste de segunda organização | parcial |
| Restore e recuperação ensaiados | Checksums sem restauração isolada não provam recuperabilidade | plano mestre de migração e B0 | ambiente com espaço/rede externa desabilitada, restore e reconciliação | ausente |

## Ordem imediata

1. executar em branch Supabase isolada os drafts de ownership de ação e visita;
2. fechar confirmação da ação e cobrança persistente como uma fatia comercial;
3. ensaiar a janela de conversa da Sara;
4. continuar recuperação de migrations em paralelo, sempre por hash;
5. retomar o backup integral quando ferramenta, credencial e destino forem
   explicitamente disponibilizados.

Até os P0 de autorização e backup passarem, o ERP não deve ser classificado
como vendável nem perfeitamente reconstruível.
