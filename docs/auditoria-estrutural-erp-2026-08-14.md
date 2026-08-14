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
- lint global ainda não é um gate: o inventário atual contém 86 erros e 657 avisos históricos, incluindo código legado e bibliotecas minificadas. Essa dívida permanece como frente explícita da limpeza.
