# Auditoria estrutural do ERP ApêCerto

Data: 14/08/2026  
Escopo: rotas, telas, componentes, APIs, estilos e banco Supabase de produção.

## Progresso executado em 14/08/2026

- `/crm` consolidado no Funil 2.0 para todos os perfis autorizados.
- Interfaces CRM Nova Era e CRM 3, gates de piloto, CSS e testes órfãos excluídos.
- 21 endpoints administrativos/de tela do NCRM sem consumidores excluídos.
- `CrmWorkspace` monolítico excluído; Esteira de vendas isolada em módulo próprio e conversa F2 ligada somente a `/api/funil2/conversa`.
- `/api/crm/chat` excluída após ficar sem consumidores; envio operacional continua centralizado no Chat ao Vivo/WhatsApp.
- Endpoints ainda ligados a ingestão, fila, notificações, agenda, push e Sara operacional preservados até o desacoplamento.
- Base histórica de recall preservada como fonte de “Pescar um lead”, fora da carteira ativa até a pesca.

## Conclusão executiva

O ERP ainda não possui uma única camada por responsabilidade. A limpeza de Configurações foi concluída, mas o restante do sistema conserva gerações paralelas, sobretudo no CRM. A principal sobreposição é:

1. CRM original (`CrmWorkspace`, `/api/crm`, `leads`, `negocios`, `pipeline_stages`);
2. CRM Nova Era/NCRM (`crm-nova-era`, `/api/ncrm/*`, `ncrm_*`);
3. CRM Nova Era 3 (`crm-nova-era-3`, também consumindo `/api/ncrm/*` e `/api/crm`);
4. Funil 2.0 (`funil-2`, `/api/funil2*`, `f2_*`).

Essas quatro superfícies compartilham lead, conversa, visita, fila, etapa, momento, Sara e experiência mobile. Portanto, hoje ainda é possível alterar uma regra em uma camada e outra tela continuar usando uma implementação diferente.

O banco é a principal fonte de dados, mas nem tudo exibido vem dele. Há rótulos, listas, cadências, cores, horários e regras auxiliares definidos em TypeScript/TSX. Existem 485 ocorrências de estilo inline, 19 folhas adicionais e um `globals.css` de 661.553 bytes.

## Dimensão encontrada

| Camada | Quantidade |
|---|---:|
| Rotas ERP | 23 |
| Rotas de API | 75 |
| Arquivos em `app/features` | 129 |
| Folhas em `app/styles` | 19 |
| Migrações Supabase | 100 |
| Estilos inline em TSX | 485 |
| Tabelas de leads | 13.553 linhas |
| Tabelas de negócios | 13.859 linhas |
| Estados NCRM | 2.037 linhas |
| Carteira F2 | 677 linhas |

## Levantamento aba por aba

| Aba | Componente atual | Fonte principal | Diagnóstico | Decisão proposta |
|---|---|---|---|---|
| Início | `HomeWorkspace` e variações por perfil/mobile | `/api/crm`, `/api/finance`, `/api/catalog`, `/api/dashboard`, `/api/ncrm/*`, `/api/funil2` | Sobreposição alta: painéis antigos, NCRM e F2 convivem | Fazer o Início consumir um único resumo operacional do F2 e APIs específicas para financeiro/estoque |
| CRM | `CrmNovaEraGate` envolvendo `CrmWorkspace`, `Crm3Workspace`, `Funil2Mobile` e `Funil2Workspace` | `/api/crm`, `/api/ncrm/*`, `/api/funil2*` | Sobreposição crítica; quatro experiências no mesmo ponto de entrada | Escolher F2 como operação oficial e separar vendas/esteira do CRM de atendimento |
| Calendário | `CalendarWorkspace` no desktop e `TelaAgendaMobile` no celular | Desktop usa `/api/crm`; mobile usa `/api/ncrm/agenda` | Duas fontes e dois contratos para a mesma agenda | Criar uma API canônica de agenda e manter apenas componentes responsivos sobre o mesmo contrato |
| Notificações | `NotificationsWorkspace` e `TelaAvisosMobile`, além de avisos globais | Desktop combina `/api/crm`, `/api/live-chat` e `erp_auditoria`; mobile usa `/api/ncrm/notificacoes`; globals usam RPC | Três fontes para “avisos” | Centralizar em uma API/RPC de notificações com projeções desktop/mobile |
| Produtos | `ProductsModule`, `ProductDetail`, `CaptureWizard`, `UnitWizard` | `/api/catalog`, `/api/product`, `/api/capture`, tabelas e Storage | Estrutura funcional, mas cliente escreve diretamente em tabelas/Storage e também usa APIs | Escolher API como fronteira de escrita; manter Storage assinado |
| Projetos e Tarefas | `ProjectsWorkspace` | `/api/projects` e Storage | Baixa sobreposição; módulo relativamente coeso | Preservar e retirar estilos inline gradualmente |
| Minha Equipe | `EquipeWorkspace` | `/api/equipe` | Coeso, mas se sobrepõe parcialmente a Usuários e Performance | Definir Equipe como visão operacional, sem edição cadastral |
| Performance | `PerformanceWorkspace` | `/api/performance`, `perf_*` | Coeso, porém possui CSS próprio e cálculos visuais fixos | Preservar; mover pesos/rótulos operacionais para configuração canônica |
| Abordagens | `ApproachesWorkspace` | `/api/approaches`, `abordagens` | Também é consumida por Chat e Disparos | Manter como catálogo único; eliminar criação paralela dentro de Disparos |
| Automações | `AutomationsWorkspaceV2` + explicador | motor, `automacoes`, `motor_*`, agentes | É a central correta, mas ainda coexistem `funil_regra` e `f2_cadencia_regua` aposentadas | Central de Automações deve ser a única autoridade para regras acionáveis |
| Agentes de IA | `AgentTrainingWorkspace` | `/api/agentes`, `agentes_ia` e tabelas filhas | Treinamento separado da execução das automações | Manter treinamento/catálogo aqui; vinculação e execução pertencem à Central de Automações |
| Usuários | `TeamWorkspace` | `/api/team`, Edge Functions, Storage | Também administra instâncias de WhatsApp, duplicando Configurações | Remover gestão de QR daqui; deixar cadastro, acesso e documentos |
| Perfis e Permissões | `PermissionsWorkspace` | `/api/permissions`, `perfis` e usuários | Autoridade adequada, mas compartilha domínio com Usuários | Preservar como única fonte de autorização |
| Financeiro | `FinanceWorkspace` | `/api/finance`, `/api/metas`, views e tabelas financeiras | Funcional, porém grande e com submódulos sobrepostos | Separar caixa, comissões, metas e vendas em serviços internos, mantendo uma aba |
| Auditoria | `AuditWorkspace` | leitura direta de `erp_auditoria` | Coeso, mas acesso direto do cliente | Preferir API/RPC paginada e autorizada |
| Chat ao Vivo | `LiveChatWorkspace` | `/api/live-chat`, `/api/crm`, `/api/approaches` | Sobrepõe o chat embutido no CRM e as conversas NCRM/F2 | Escolher um componente e serviço canônicos de conversa |
| Disparos | `CampaignWorkspace` | `/api/campaigns`, `/api/approaches` | Mantém lógica de origem/destino e criação de abordagens dentro da própria tela | Tornar funil/etapa parâmetros do bloco, sem dependência estrutural |
| Financiamento | `LegacyModuleWorkspace` | host legado | Tela ainda depende da aplicação antiga | Migrar ou remover do menu; não manter ponte indefinidamente |
| Base de conhecimento | `LegacyModuleWorkspace` | host legado | Legado explícito | Migrar conteúdo para Agentes/Base canônica ou remover |
| Configurações | `SettingsWorkspace` → `ConnectionsWorkspace` | RPC `wa_v7_painel`, Edge Function `dapi-qr` | Limpeza concluída; uma responsabilidade | Preservar somente conexões |
| Ajuda | `LegacyModuleWorkspace` | host legado | Legado explícito | Recriar ajuda mínima baseada nos módulos oficiais e retirar host legado |
| Cadastro público | página própria | convite/Edge Function | Fluxo isolado | Preservar após auditoria de autorização |
| Fichas/agenda públicas | páginas por token | APIs públicas específicas | Fluxos isolados, dados sensíveis | Preservar com revisão de expiração, escopo e logs |

## Sobreposição funcional comprovada

### Lead e negócio

- `leads` e `negocios` continuam sendo o cadastro/origem histórica.
- `ncrm_estado` mantém um snapshot paralelo 1:1 de negócios.
- `f2_lead` mantém a carteira operacional do Funil 2.0.
- O frontend possui adaptadores diferentes para transformar esses registros em cartões.
- A tela pode mostrar números diferentes conforme a API escolhida.

### Fila e Meu Dia

- Existem `/api/ncrm/fila`, `/api/ncrm/fila-operacional`, `/api/ncrm/painel` e `/api/funil2`.
- Há implementações em `home`, `crm-nova-era`, `crm-nova-era-3` e `funil-2`.
- A operação oficial deve ser uma única consulta/projeção do F2.

### Conversa e WhatsApp

- Existem `/api/live-chat`, `/api/crm/chat`, `/api/ncrm/conversa` e `/api/funil2/conversa`.
- Existem `LiveChatWorkspace`, drawer no CRM original, fichas NCRM e ficha F2.
- O histórico `wa_*` é a base comum, mas a projeção e as permissões estão duplicadas.

### Visitas

- Existem `visitas` e `f2_visita`.
- Calendário desktop usa `/api/crm`; mobile usa `/api/ncrm/agenda`; F2 grava via `/api/funil2`.
- É necessário definir se `visitas` é a agenda corporativa e `f2_visita` apenas vínculo operacional, ou migrar tudo para uma única tabela.

### Sara

- Há widget global, copiloto do CRM, `ncrm_sara_*`, `f2_sara_*`, agentes e Edge Functions distintas.
- Treinamento, análise, decisão e execução não têm hoje uma fronteira única.
- Proposta: Agentes guarda versão/treinamento; Automações decide quando chamar; um único serviço Sara analisa; F2 recebe somente o resultado oficial.

## Sobreposição de design comprovada

- `globals.css` concentra aproximadamente 661 KB.
- Há 19 folhas adicionais carregadas globalmente.
- Existem 485 declarações `style={{...}}`, principalmente nas gerações NCRM e CRM 3.
- A fonte Quicksand é importada em dois lugares.
- Folhas como `meu-dia-filtros.css`, `pescado-sem-prazo.css` e `esteira-rolagem.css` ainda documentam uma antiga injeção `FUNIL2_CSS`, embora o CSS já tenha sido convertido para arquivo estático.
- Classes genéricas como `.active`, `.on`, `.ok`, `.danger`, `.green`, `.orange`, `.wide` aparecem muitas vezes e têm risco alto de colisão global.
- Desktop e mobile usam folhas separadas mais uma camada `mobile-overrides.css`; isso ainda é uma cascata, mesmo após remover três folhas históricas.

## Banco: itens claramente legados ou vazios

### Marcados como aposentados

- `f2_cadencia_regua`: substituída pela automação de cadência.
- `funil_regra`: substituída pela Central de Automações.

As próprias descrições do banco determinam retenção até 19/08/2026. Não devem ser apagadas antes de verificar jobs, funções, gatilhos e histórico.

### Backups dentro do schema público

- `_mig_pipe2_to_funil20_bkp`
- `_view_backup`
- `negocios_dup_backup_20260721`
- `visitas_gerente_backup_20260721`
- `ncrm_funcao_legada_backup`
- `ncrm_operacao_v4_backup`
- `ncrm_saida_humana_continuidade_backup`
- `ncrm_sara_treinamento_backup`

Backups não devem permanecer no schema exposto `public`. Depois de validar dependências e prazo de retenção, devem ser movidos para schema privado ou exportados e removidos.

### Estruturas sem registros que exigem decisão

- `erp_settings`, `erp_user_config`, `erp_pipeline_config`
- `automacao_execucoes`, `wa_automacao_fila`, `wa_automacao_fila`
- `ncrm_piloto`, `ncrm_migracao_analise`, `ncrm_migracao_item`
- `ncrm_sara_acao`, `ncrm_whatsapp_intencao`
- `f2_negociacao`, `f2_historico_vinculo`, `f2_fila_decisao`, `f2_soltura_agenda`
- diversas tabelas novas de financeiro/portal ainda sem uso

Tabela vazia não significa automaticamente removível: algumas são filas ou trilhas preparadas para eventos futuros.

## Segurança prioritária

O inventário do Supabase apontou 12 tabelas com RLS desabilitada:

- `ncrm_private.f2_distribuicao_programada`
- `ncrm_private.f2_arquivo_batch`
- `ncrm_private.f2_arquivo_item`
- `ncrm_private.f2_distribuicao_controle`
- `ncrm_private.erp_cleanup_archive`
- `public.ncrm_notificacao_tipos_ativos`
- `public.f2_soltura_represados`
- `public.presenca_diagnostico`
- `public.f2_soltura_agenda`
- `public.f2_fila_decisao`
- `public.f2_sara_fila`
- `public._mig_pipe2_to_funil20_bkp`

Não ativar RLS às cegas: sem políticas, jobs e clientes autenticados podem parar. A correção exige antes classificar acesso por `service_role`, RPC `SECURITY DEFINER` devidamente protegida ou usuário autenticado.

Os advisors oficiais também apontam muitas tabelas com RLS ligada, mas sem policy. Parte delas é corretamente restrita a serviço; parte precisa ser confrontada com o frontend antes de qualquer mudança. Há ainda políticas permissivas duplicadas em objetos como `pipeline_stages`, `pipelines`, `perfis`, `usuarios`, `vendas`, `visitas` e `unidades`.

### Índices fisicamente duplicados confirmados

- `corretor_presencas`: `corretor_presencas_pkey` e `corretor_presencas_uk`.
- `esteira_anexos`: `esteira_anexos_processo_idx` e `idx_esteira_anexos_ref`.
- `instancias_credenciais`: `instancias_credenciais_pkey` e `uidx_instancias_credenciais_instancia`.
- `pagamentos_comissao`: `ix_pagcom_venda` e `pagamentos_comissao_venda_idx`.

Esses índices são peso duplicado comprovado, mas a remoção deve ser feita em migração própria após confirmar constraints e nomes usados por rotinas administrativas. Referências dos advisors: [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [políticas permissivas múltiplas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) e [índice duplicado](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index).

## Arquitetura-alvo

| Responsabilidade | Autoridade proposta |
|---|---|
| Cadastro histórico | `leads`, `negocios` |
| Carteira operacional | `f2_lead` |
| Etapas/momentos/prazos | `f2_etapa_config`, `f2_momento_config` |
| Automação | `automacoes`, `automacao_versoes`, `motor_*` |
| Conversas | `wa_*`, expostas por um único serviço autorizado |
| Agenda | uma API canônica; definir relação entre `visitas` e `f2_visita` |
| Sara | catálogo/treinamento em Agentes; orquestração em Automações; resultado oficial no F2 |
| Design | tokens + componentes base + CSS por módulo, sem seletores globais genéricos |
| Recall | arquivo/carteira histórica fora dos indicadores de lead ativo |

## Ordem segura de limpeza

1. Congelar novas variantes de CRM e design.
2. Criar testes de contrato para as telas oficiais.
3. Unificar Meu Dia/Fila no F2.
4. Unificar conversa/WhatsApp.
5. Unificar agenda e visitas.
6. Retirar o gate e as telas NCRM/CRM 3 que não forem mais alcançáveis.
7. Separar esteira de vendas do CRM de atendimento.
8. Mover backups do schema `public` para arquivo privado.
9. Corrigir RLS após mapear chamadores.
10. Remover tabelas/funções aposentadas somente após prazo e verificação de dependências.
11. Dividir `globals.css`, criar namespaces por módulo e eliminar estilos inline não dinâmicos.
12. Remover APIs órfãs e atualizar tipos/testes/documentação.

## Critério de “operação limpa”

Uma aba só poderá ser declarada limpa quando:

- houver um único componente oficial por formato responsivo;
- desktop e mobile consumirem o mesmo contrato de dados;
- cada informação tiver uma fonte canônica documentada;
- não existir rota/API alternativa escrevendo a mesma regra;
- estilos estiverem isolados por módulo e tokens oficiais;
- objetos aposentados estiverem arquivados fora do schema público;
- testes comprovarem que recall não entra em lead ativo;
- permissões e RLS estiverem fechadas por usuário/serviço.

## Execução — corte de APIs órfãs (14/08/2026)

Foram removidas oito implementações sem consumidor no frontend, no runtime legado ou nas automações versionadas:

- `/api/agenda-link`: duplicava operações que o runtime legado executa diretamente pelas RPCs oficiais;
- `/api/agentes/copiloto-lead`: copiloto antigo, substituído pelo contrato atual de Agentes/Sara;
- `/api/ai-center`: centro de IA genérico sem tela consumidora;
- `/api/distribuicao`: configuração paralela sem uso pelo Funil 2.0;
- `/api/financiamento`: wrapper não utilizado; a ficha pública permanece em `/api/ficha-publica` e o módulo legado usa o contrato próprio;
- `/api/module-summary`: inspetor genérico sem chamada;
- `/api/versao`: devolvia uma versão estática antiga e enganosa;
- `whatsappAberto.ts`: utilitário sem qualquer importador.

Evidências desta tranche:

- busca global sem referências residuais aos caminhos ou ao utilitário;
- `git diff --check` sem erro;
- 159 de 159 testes frontend aprovados;
- build de produção aprovado, sem as sete rotas removidas no manifesto final.

## Execução — consolidação da pesca no Funil 2.0 (14/08/2026)

A auditoria das funções do banco encontrou três implementações concorrentes de pesca. Foram aposentadas `aquario_pescar()` e `pescar_lead_aquario(bigint)`, que movimentavam diretamente o CRM antigo. A ação interna sem consumidor que ainda expunha `aquario_pescar` em `/api/crm` também foi removida.

A autoridade única passa a ser `f2_pescar_negocio(bigint, uuid)`. Ela mantém o cadastro histórico em `leads`/`negocios`, cria o card em `f2_lead` somente no ato voluntário da pesca, grava `corte_conversa_em` e define `historico_completo=false`. Assim, a base de recall não é promovida em massa nem contada como carteira ativa.

No momento da verificação, o banco tinha aproximadamente 13.553 leads históricos, 13.859 negócios e 677 cards no Funil 2.0. Nenhum registro histórico foi excluído nesta consolidação.

Também foram removidos quatro índices redundantes comprovadamente idênticos, mantendo as chaves e índices canônicos: `corretor_presencas_uk`, `idx_esteira_anexos_ref`, `uidx_instancias_credenciais_instancia` e `pagamentos_comissao_venda_idx`.

## Execução — entrada única no Funil 2.0 (14/08/2026)

Foram encontrados três processadores concorrentes para o mesmo evento de distribuição. O NCRM antigo ainda estava ativo e criava registros em `ncrm_estado` ao mesmo tempo que `f2_entrada_por_distribuicao` criava a carteira oficial.

Os jobs `ncrm_reconciliar`, `ncrm_reativar_por_resposta` e `ncrm_entrada_distribuicao` foram removidos do agendador. `ncrm_ingest_config.ativo` foi definido como falso e `ncrm_entrada_config.escopo` como `nenhum`. A chamada duplicada do F2 também foi retirada de `guardiao-entrada`.

Continuam separados e ativos:

- a roleta/distribuição escolhe o corretor sem depender de funil;
- `f2_entrada_distribuicao` transforma a distribuição em carteira operacional;
- `guardiao-entrada` detecta leads presos e gera alerta;
- Sara, notificações e push do F2 permanecem em seus jobs próprios.

A ação `aquarioImportar` e a RPC `aquario_importar(jsonb)` também foram removidas por não possuírem interface ou consumidor. A RPC somente de leitura `aquario_status()` foi preservada porque o endpoint geral ainda a usa para impedir que a base de recall seja carregada como lead ativo.

## Execução — Agenda canônica (14/08/2026)

Desktop e celular agora usam exclusivamente `/api/agenda`. Os comandos `createVisit`, `updateVisit`, `updateVisitStatus` e `gerenteDisponibilidade` foram retirados de `/api/crm` e movidos para a API da Agenda.

O modo workspace acrescenta os catálogos necessários ao calendário desktop, mas a lista para criar uma visita é derivada de `f2_lead` e depois resolvida em `negocios`/`leads`. Assim, os milhares de registros de recall não são carregados nem oferecidos como carteira ativa. A criação também valida novamente no servidor que o negócio possui um card F2 não descartado.

O antigo efeito colateral que tentava mover o negócio para um pipeline legado chamado “Visita ApeCerto” foi eliminado. A visita continua registrada em `visitas` e a movimentação operacional fica sob as regras oficiais do Funil 2.0.

Evidências:

- 163 de 163 testes frontend aprovados, incluindo quatro contratos novos da Agenda;
- build de produção aprovado;
- lint isolado das APIs e do teste alterados sem erro;
- lint global ainda não é um gate: o primeiro inventário encontrou 86 erros e 657 avisos históricos, incluindo código legado e bibliotecas minificadas. Essa dívida permanece como frente explícita da limpeza.

## Execução — saneamento inicial do lint (14/08/2026)

Foram excluídos quatro scripts de screenshot órfãos, presos a caminhos de uma máquina antiga (`/home/claude`, `/opt/pw-browsers` e previews em `/tmp`), além de dois bundles React minificados sem consumidor. Os bundles Opus foram preservados porque `opusMic.ts` os utiliza; por serem dependência vendorizada, `public/_vendor/**` foi corretamente retirado do lint do código-fonte.

Com essa classificação, o ruído caiu de 743 ocorrências para 115: 69 erros e 46 avisos. Os problemas restantes agora pertencem a arquivos reais e podem ser corrigidos por módulo, sem esconder a dívida atrás de bibliotecas minificadas.

Na primeira correção de código real:

- o chat deixou de chamar uma função antes da declaração;
- o portal de modais passou a usar o contrato de hidratação do React sem efeito/setState;
- o drawer de conversa F2 deixou de reiniciar estado sincronicamente no efeito;
- a recuperação de senha passou a derivar o token no estado inicial e usar `Link`;
- textos JSX inválidos foram corrigidos;
- um callback morto do Financeiro que ainda apontava para uma rota CRM antiga foi excluído;
- `AgentTrainingWorkspace` perdeu `@ts-nocheck` e `eslint-disable`, ganhou tipos baseados no contrato de `/api/agentes` e ficou sem erros próprios de TypeScript ou lint.

O lint global caiu para 60 erros e 44 avisos. Os 163 testes e o build continuaram aprovados.

## Execução — contratos reais do Supabase e corte final da criação NCRM (14/08/2026)

O arquivo `database.types.ts` foi regenerado diretamente do projeto Supabase `diaegvfveqezispcthwk`. A versão anterior estava defasada: não conhecia sequer `f2_lead`, aceitava funções já removidas e escondia divergências de nulidade, enums e payloads de escrita.

Após sincronizar o contrato, foram corrigidos todos os erros TypeScript encontrados em Agenda, Agentes, Abordagens, Campanhas, Vendas, Financeiro, Presença, Projetos, notificações e Web Push. A checagem `tsc --noEmit` passou com zero erros.

A auditoria também revelou duas rotas paralelas ainda alcançáveis:

- o chat agendava visita em `/api/crm`, embora os comandos já tivessem sido consolidados em `/api/agenda`; agora ele usa somente a Agenda canônica;
- `/api/crm` ainda aceitava `createLead` e chamava `ncrm_distribuir_lead_novo`, função já aposentada no banco. Esse caminho foi removido, impedindo criação operacional fora do Funil 2.0.

Os erros React reais do aplicativo foram eliminados sem desligar regras: efeitos com renderização em cascata foram assíncronizados, previews de mídia deixaram de mutar refs durante render e cálculos de prazo passaram a usar um instante estável. O lint do código Next.js ficou sem erros; as Edge Functions Deno permanecem como uma verificação separada, pois não devem ser avaliadas como código React/Next.

Evidências desta etapa:

- TypeScript: zero erros;
- frontend: 163 de 163 testes aprovados;
- build de produção aprovado;
- teste de contrato ampliado para impedir que o chat volte a escrever visitas pela API geral do CRM;
- teste de regressão impede o retorno de `createLead`/`ncrm_distribuir_lead_novo` à API geral.

## Execução — isolamento do último código compartilhado com NCRM (14/08/2026)

Os dois recursos ainda utilizados que moravam sob `features/crm-nova-era` foram retirados desse namespace:

- o botão e a normalização do WhatsApp nativo agora pertencem ao Funil 2.0 e a `app/lib`;
- o cliente de Web Push agora pertence ao módulo de Notificações.

Isso evita que funcionalidades oficiais pareçam depender do CRM aposentado. Os imports do aplicativo não apontam mais para `crm-nova-era`.

A inspeção direta das Edge Functions confirmou que `ncrm-sara-observer` ainda está implantada no Supabase, mas não há job `pg_cron` chamando essa função e ela não apareceu no recorte recente de logs. O classificador oficial `f2-sara-reclassificar` está implantado separadamente. A configuração local do observador antigo foi removida para impedir novo deploy acidental.

O lote de arquivos históricos NCRM — incluindo testes SQL antigos, runtime público de teste, código do observer e controle de ingest — foi identificado, porém a exclusão em massa foi bloqueada pela proteção de segurança por conter também evidências históricas do Funil 2/Sara. Ele permanece preservado até autorização específica do lote, sem participação no build operacional.

A suíte oficial também continha expectativas da Home antiga. Os contratos foram atualizados para a Home atual e para o carregamento seguro sem sessão. Resultado: 163/163 testes frontend, 11/11 testes renderizados, TypeScript sem erros e build aprovado.

## Execução — unificação de Notificações e redução da Home (14/08/2026)

Notificações deixou de possuir implementações diferentes para desktop e celular. A página agora monta um único componente responsivo, alimentado exclusivamente por `/api/notificacoes` e pela RPC canônica `ncrm_notificacoes`. Foram removidas da tela as consultas paralelas a `/api/crm`, `/api/live-chat` e `erp_auditoria`.

A Home também deixou de baixar os payloads completos de `/api/crm` e `/api/catalog` sem utilizá-los. O resumo inicial mantém somente a consulta financeira necessária à interface atual. Isso reduz tráfego, tempo de carregamento e acoplamento com o CRM aposentado.

O Chat ao Vivo não possui mais tratamento especial para comandos em `/api/crm`: visitas seguem pela Agenda canônica e conversas pelo serviço próprio de chat. Após esse corte, nenhum componente operacional do aplicativo consome a API geral `/api/crm`; a referência restante está restrita ao adaptador do runtime legado que ainda sustenta Base de Conhecimento, Financiamento e Ajuda. Sua remoção física exige primeiro substituir essas três telas ou autorização destrutiva explícita para desligá-las.

Foi acrescentado um teste de regressão para garantir que desktop e celular não voltem a divergir nem reintroduzam fontes paralelas na tela de avisos.

## Execução — gates de qualidade por runtime e remoção de código morto (14/08/2026)

O lint do aplicativo Next/React foi separado da validação das Edge Functions Deno. Antes, imports remotos, globals e padrões próprios do Deno eram avaliados pelas regras do Next, produzindo 48 erros que não pertenciam ao runtime do aplicativo. O comando `pnpm lint:edge` agora declara o gate correto com `deno lint` e `deno check`; o diretório de funções não é mais avaliado pelo ESLint do Next.

No aplicativo, os avisos objetivos foram reduzidos de 42 para 11, ficando somente imagens deliberadamente externas/dinâmicas e três avisos em testes históricos NCRM. Foram removidos imports, ícones, helpers e componentes sem consumidor, inclusive uma segunda Esteira de Vendas embutida e inalcançável no Funil 2.0. Dependências instáveis de hooks em Agenda, Permissões e Esteira foram corrigidas.

O runtime Deno não está instalado nesta estação; portanto, o gate das Edge Functions está configurado, mas sua execução local ainda depende da instalação controlada do Deno ou de CI específica. Essa pendência permanece explícita e não é tratada como aprovação automática das funções.

## Execução — primeira correção crítica do Supabase (14/08/2026)

O inventário ao vivo encontrou 37 Edge Functions ativas, 37 jobs `pg_cron`, 106 funções públicas com prefixo `ncrm_` e 68 com prefixo `f2_`. Essa diferença confirma que a retirada visual do CRM antigo não equivale à retirada física de toda a infraestrutura; cada objeto precisa ser classificado por consumidor antes da exclusão.

O Security Advisor apontou 15 erros. Sete eram tabelas internas sem RLS e com grants padrão amplos para `anon` e `authenticated`: filas Sara/F2, tabelas de soltura, diagnóstico de presença, tipos de notificação e o backup da migração Pipe 2 → Funil 2.0. A migration `20260814200000_proteger_tabelas_internas_sem_rls.sql` ativou RLS sem política pública nas sete tabelas. Nenhuma linha foi removida; `postgres`, `service_role` e funções privilegiadas continuam operando.

Após aplicação e conferência direta no projeto, os erros do Advisor caíram de 15 para 8. Os oito restantes são views `SECURITY DEFINER`. Elas não serão convertidas em bloco: `vw_ranking_vgv` e `vw_sla_leads` têm consumidores reais, e `site_produtos` atende catálogo público. A troca para `security_invoker` precisa ser feita view por view com teste de RLS e contrato do consumidor.

## Levantamento — cascata móvel e CSS órfão (14/08/2026)

O layout global importa 17 folhas CSS. As duas camadas móveis somam 1.083 linhas: `app-mobile.css` contém a estrutura e os contratos responsivos, enquanto `mobile-overrides.css` aplica acabamento posterior. Foram encontrados 27 seletores repetidos entre elas, incluindo barra inferior, cabeçalho, cards, Agenda e Home. A repetição é hoje intencional, mas confirma o custo de manutenção por cascata: uma mudança no arquivo-base pode ser silenciosamente sobrescrita depois.

Como corte imediato e seguro, foram removidas de `globals.css` as 21 regras do seletor rico `rselect`, cujo único componente havia sido eliminado por não possuir consumidor. Os estilos residuais da Esteira F2 antiga foram identificados em `funil-2.css`; por esse arquivo estar minificado em linhas compostas e também conter o Pipe de Visitas ativo, a remoção deve ocorrer junto de sua formatação/consolidação, sem apagar regras compartilhadas por busca textual ampla.

## Execução — Configurações, Agentes e Central de Automações (14/08/2026)

Configurações está reduzida a uma única responsabilidade: renderizar `ConnectionsWorkspace` para conectar, reconectar e inventariar instâncias de WhatsApp. Regras de funil, IA e operação não são mais configuradas nessa aba.

Agentes concentra missão, prompt, fontes aprovadas, ferramentas, testes e bateria de avaliação. O carregamento inicial possuía duas implementações idênticas e consultava novamente a lista quando selecionava a Sara; agora montagem e atualização usam as mesmas funções canônicas, sem segunda consulta causada pela seleção inicial.

A Central continua montando o construtor operacional oficial e aponta explicitamente o treinamento para `/agentes-ia`. O arquivo React perdeu o sufixo `V2`, pois não existe uma segunda versão ativa. Os assets de 228 KB deixaram de usar `Date.now()` no endereço — que anulava o cache a cada abertura — e passaram a uma versão estável. Também foi removido um extrator órfão, sem script consumidor, que ainda escrevia na antiga estrutura `frontend/public` fora deste aplicativo.
