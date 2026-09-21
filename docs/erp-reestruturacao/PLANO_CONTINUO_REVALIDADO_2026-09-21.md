# ERP ApeCerto — plano contínuo revalidado

Data de corte: 2026-09-21
Meta operacional: domingo, 2026-09-27, às 18h (America/Sao_Paulo)

## Regra de execução

O trabalho não espera janelas de duas horas. A sequência é contínua:

`inspecionar -> reproduzir -> corrigir -> testar -> validar no navegador -> publicar com gate -> validar em produção -> registrar evidência -> seguir`

O intervalo de duas horas, quando usado, é somente um checkpoint de comunicação. Se uma fatia passar pelos gates antes, ela avança antes. Se uma fatia ficar bloqueada por banco, credencial, custo ou produção, o bloqueio é registrado e outra fatia local independente continua.

## Baseline confirmado

- repositório canônico: `https://github.com/apecertooficial-arch/-erp-apecerto.git`;
- produção: `https://apecerto-erp.onrender.com`;
- branch publicada: `main`;
- commit publicado em 2026-09-21: `b75aa537ac4af05d3115344876b3a9dc5bc6d39e`;
- projeto Supabase canônico: `diaegvfveqezispcthwk`;
- reconstrução em branch isolada: `codex/crm-sara-determinismo-20260921`;
- candidato funcional iniciado em `c669141151e0868805cdec72ac755e8f7339aa6a`; o `HEAD` da branch isolada é a autoridade do pacote em validação;
- há múltiplos candidatos históricos locais; nenhum será promovido por nome ou conveniência, apenas por diff, dependências e testes sobre o `main` atual.

## Entrega-alvo de domingo

A meta de domingo não será descrita como “ERP perfeito”. O alvo verificável é uma versão operacional estável das jornadas que protegem receita:

1. lead entra, é identificado e distribuído conforme a regra operacional;
2. primeira abordagem e conversa geram eventos rastreáveis;
3. Sara reavalia no momento correto e produz etapa, momento, temperatura, qualidade e próxima ação;
4. corretor executa ou confirma a ação e o sistema atualiza a fila sem fingir sucesso;
5. visita é agendada, realizada e recebe feedback estruturado;
6. gerente enxerga pendências, cobra o corretor e acompanha a resolução;
7. CRM e Meu Dia funcionam em desktop e celular com identidade visual coerente;
8. permissões falham fechadas e efeitos externos possuem controle e evidência;
9. cada fatia publicada possui teste automatizado, validação em navegador e rollback identificável.

Financeiro integral, portal do proprietário, captação completa, esteira contratual inteira, provisionamento para outras imobiliárias e saneamento total do banco/repositório permanecem no mapa integral. Só entram na entrega de domingo na extensão em que seus fluxos possam ser fechados e comprovados sem sacrificar as jornadas P0 acima.

## Ordem das fatias verticais

### F0 — controle da base e colheita segura

- comparar cada branch candidata com o `main` publicado;
- separar correções independentes de dependências de banco;
- manter uma única fila de promoção e um registro de evidências;
- não remover código, tabela ou aplicativo ativo sem mapa de uso, substituição e rollback.

### F1 — CRM + Sara determinísticos

- confirmar ação operacional pelo corretor com ownership e revisão otimista;
- enfileirar um único evento durável para Sara;
- manter ações D-API como confirmação automática;
- definir janela de silêncio para conversas e evitar reclassificação a cada mensagem;
- provar idempotência, atraso, erro, repetição e recuperação.

### F2 — visitas + cobrança gerencial

- agenda, reagendamento, cancelamento e realização;
- feedback estruturado por texto ou áudio;
- pendência insistente para corretor;
- fila de cobrança do gerente por corretor e por cliente;
- aceite de perda/cancelamento pelo gestor quando aplicável;
- histórico preservado e carteira de acompanhamento.

### F3 — entrada, duplicidade e distribuição

- Meta/Make/site -> entrada canônica;
- deduplicação por telefone/e-mail e apoio por nome;
- preservação do corretor quando houver visita ou negociação protegida;
- nova distribuição nos demais casos;
- abordagem enviada pela instância correta;
- reconciliação e auditoria de falhas.

### F4 — CRM, Meu Dia e gestão visual

- pipeline configurável sem autoridades duplicadas;
- informação essencial, estados claros e redução de poluição;
- Meu Dia dirigido pela próxima ação calculada;
- painéis distintos para corretor, gerente e direção;
- design system único aplicado a desktop e mobile.

### F5 — proposta, contrato, venda e financeiro essencial

- esteira de documentação, contrato, assinatura e pagamento;
- lançamento de venda, recebimentos, comissões e repasses;
- visão do corretor limitada ao próprio resultado;
- visão gerencial com trilha de auditoria;
- sem integração de pagamento real até autorização específica.

### F6 — imóveis, captação e publicação

- proprietário, imóvel, materiais e pipeline de captação;
- validação de completude e qualidade;
- aprovação interna separada da aprovação para o site;
- integrações externas protegidas por feature flag e reconciliação.

### F7 — consolidação e endurecimento

- eliminar autoridades duplicadas somente após cobertura e migração;
- marcar legado em uso, legado substituído e candidato à remoção;
- consolidar migrations, RLS, RPCs, jobs, Edge Functions e observabilidade;
- executar regressão completa, segurança, acessibilidade, responsividade e performance;
- produzir runbook de publicação, rollback, backup e suporte.

## Gate obrigatório por fatia

Uma fatia só pode ser chamada de pronta quando houver, conforme aplicável:

- regra operacional escrita e contrato canônico;
- autorização server-side e isolamento por perfil/organização;
- persistência comprovada e nenhuma resposta de sucesso falsa;
- idempotência, concorrência e auditoria/outbox;
- testes de domínio, API, banco, autorização e interface;
- navegador real em desktop e celular, incluindo loading, vazio, erro, negado, conflito e sucesso;
- build reproduzível;
- publicação identificada por commit;
- smoke test em produção e plano de rollback.

## Publicação e banco

- Publicar cedo e em fatias pequenas quando o gate passar, sem esperar domingo.
- Aplicação e banco não avançam separadamente quando o contrato for incompatível.
- Toda migration passa antes por inspeção, teste isolado, compatibilidade, backup e rollback.
- Nenhuma exclusão estrutural acompanha a primeira substituição; primeiro deprecar, observar e só depois remover com autorização.
- Efeitos pagos ou externos permanecem desligados até teste e autorização específicos.

## Checkpoint ao usuário

Cada atualização deve informar apenas:

1. fatia atual;
2. o que foi provado;
3. o que foi publicado e em qual commit;
4. bloqueios reais;
5. próximo passo imediato.

Checkpoint não é pausa e não é gatilho para começar a próxima atividade.
