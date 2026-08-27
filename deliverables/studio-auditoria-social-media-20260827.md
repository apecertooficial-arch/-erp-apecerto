# Auditoria crítica independente — ApêCerto Studio

Data: 27/08/2026  
Escopo: auditoria somente leitura do Studio publicado em `/studio`. Nenhuma campanha, peça, configuração, integração ou publicação foi alterada durante esta auditoria.

## (a) Diagnóstico executivo

O Studio publicado possui uma casca visual consistente e um fluxo inicial compreensível, mas ainda não funciona como uma central profissional de produção e gestão de conteúdo.

- Operador de social media: **2,0/10**
- Gestor de social media: **2,2/10**
- Nota geral: **2,1/10**

Foram observadas duas campanhas DEMO reais no ERP (AP0358 e AP0348), ambas em `Rascunho`, com `0/4 formatos prontos`. No Construtor, Feed, Carrossel, Stories e Reel exibem o mesmo preview-base com foto, logo, headline “Sua próxima campanha começa aqui” e CTA “Agende sua visita”; a revisão informa “Aguardando geração”.

O botão “Gerar pacote com IA” existe, mas a execução depende de configuração e orçamento. Em Configurações, IA aparece ativa, porém Figma está “Não configurada”, Renderização está “Worker externo ainda não ativado” e Instagram está “Não configurada”; o limite OpenAI observado é US$ 0,00. O calendário está vazio (“Calendário livre”).

Conclusão: a estrutura técnica é promissora, mas o valor operacional prometido ainda não está disponível. O usuário percebe corretamente uma experiência próxima de 2/10.

## (b) Notas por dimensão e persona

| Dimensão | Operador | Gestor | Evidência observada |
|---|---:|---:|---|
| Clareza da navegação | 4,0 | 4,5 | Abas Visão geral, Campanhas, Construtor, Calendário e Configurações são claras, mas não há etapa atual nem deep link. |
| Conexão entre etapas | 2,0 | 2,0 | Produto → Criação → Aprovação → Agenda → Publicação é apenas visual; as etapas seguintes estão vazias/bloqueadas. |
| Criação de campanha | 4,0 | 4,0 | É possível usar código do produto/unidade, nome, objetivo e datas. |
| Edição de campanha | 1,5 | 2,0 | Não foi observada edição posterior de briefing, público, datas ou estratégia. |
| Uso de mídia do ERP | 5,0 | 4,5 | AP0358/AP0348 exibem nome, localização, foto e snapshot real. |
| Variedade de formatos | 2,0 | 2,0 | Existem quatro opções nominais: Feed, Carrossel, Stories e Reel. |
| Variedade de modelos | 0,5 | 0,5 | Não existe seletor visual de modelos ou estilos. |
| Biblioteca de formatos | 0,5 | 0,5 | Não existe catálogo navegável com miniaturas. |
| Editor/canvas | 1,0 | 1,0 | Há preview estático, sem edição visual de elementos. |
| Comandos livres para IA | 0,0 | 0,0 | Não há campo de instrução livre no Studio. |
| IA assistida | 2,0 | 2,0 | Botão existe, mas depende de integração/orçamento. |
| Chat/copiloto social | 1,5 | 1,5 | Sara é copiloto geral do Funil 2.0, sem contexto da campanha social. |
| Revisões e variações | 1,0 | 1,0 | APIs preveem versões/comentários, mas a UI só abre após geração. |
| Figma | 1,5 | 1,5 | Só há manifesto JSON; conexão aparece desativada. |
| Canva | 0,0 | 0,0 | Não há integração visível. |
| Importação/exportação | 1,5 | 1,5 | Existe importação técnica de manifesto; exportação de pacote não é clara. |
| Versionamento de templates | 2,5 | 2,5 | Há versões/checksum no modelo, sem biblioteca visual utilizável. |
| Copy | 1,0 | 1,0 | Não há copy gerada visível. |
| Estratégia editorial | 0,5 | 0,5 | Não há pilares, público, funil ou plano temático. |
| Renderização | 1,0 | 1,0 | Ação JPEG/MP4 existe, mas renderer está desativado. |
| Calendário | 1,5 | 1,5 | Tela existe, porém sem publicações. |
| Revisão/aprovação | 1,5 | 2,0 | Estados existem, mas não há peça gerada para validar. |
| Colaboração | 0,5 | 1,0 | Não há responsáveis, menções, comentários por usuário ou governança visível. |
| Publicação Instagram | 0,5 | 1,0 | OAuth previsto tecnicamente; conexão desativada. |
| Métricas | 0,0 | 0,0 | Não há alcance, engajamento, CTR, leads ou conversões. |
| Estados vazios | 3,0 | 3,0 | Mensagens são honestas, mas pouco orientadas à solução. |
| Feedback/bloqueios | 2,5 | 2,5 | Bloqueios são informados, sem caminho guiado de desbloqueio. |
| Responsividade | 3,5 | 3,5 | Há navegação mobile inferior; conteúdo fica comprimido e surge prompt de instalação. |
| Fluxo profissional moderno | 1,5 | 1,5 | Falta briefing → opções → edição → aprovação → publicação → métricas. |

## (c) Inventário funcional

### Existe e funciona

- Navegação principal do Studio.
- Criação por código real do ERP.
- Identificação de AP0358 e AP0348.
- Exibição de nome, localização e mídia real.
- Snapshot factual.
- Quatro opções nominais de formato.
- Preview básico.
- Listagem de campanhas.
- Telas de calendário e configurações.
- Exibição honesta do estado das integrações.
- Abertura da Sara.

### Existe, mas é insuficiente ou bloqueado

- Geração de pacote IA condicionada a orçamento/configuração.
- Peças são rascunhos vazios e sem diferenciação real.
- Revisão/aprovação só fica disponível após geração.
- Renderização depende de worker desativado.
- Calendário não contém conteúdo.
- Instagram não está conectado.
- Figma aceita manifesto JSON, sem sincronização visual.
- Versionamento existe, mas não é operável como biblioteca.
- Sara não é especializada em social media.

### Existe apenas tecnicamente

- Tabelas/funções de campanhas, snapshots, peças, versões e jobs.
- Agente IA governado e roteamento OpenAI.
- Controle de orçamento.
- Jobs de renderização.
- OAuth Meta/Instagram.
- Importação de manifesto Figma.
- Checksum e versionamento.
- Aprovação, ajustes e agendamento via API.

Esses itens não devem ser considerados entregues até haver fluxo visível, configurado e demonstrado de ponta a ponta.

### Não existe

- Chat contextual do Studio.
- Comandos livres para IA.
- Múltiplas gerações e variações.
- Biblioteca real de templates.
- Geradores distintos para Feed, Carrossel, Stories e Reel.
- Editor canvas profissional.
- Integração Canva.
- Figma visualmente conectado.
- Histórico visual de versões.
- Comentários colaborativos e responsáveis.
- Métricas de conteúdo e campanha.
- Vínculo entre publicação, leads e conversões do ERP.
- Planejamento editorial mensal automatizado.

## (d) Causas-raiz de produto, UX e arquitetura

### Produto

- O modelo foi organizado em entidades técnicas, não nas tarefas diárias do operador.
- “Formato” virou registro fixo, não uma experiência de criação distinta.
- A promessa termina em conteúdo aprovado/programado, mas a entrega observada termina no snapshot.
- Não existe MVP operacional demonstrado: gerar, revisar, aprovar e programar uma peça real.
- Estratégia editorial não está incorporada ao produto.

### UX

- O fluxo completo é apresentado como se estivesse disponível, embora várias etapas estejam bloqueadas.
- O botão de geração não explica imediatamente o bloqueio por orçamento/configuração.
- O usuário não sabe se deve começar por campanha, construtor, Figma ou configurações.
- Os quatro formatos parecem iguais antes da geração.
- O preview parece mockup, não editor.
- Não há biblioteca visual nem seleção de modelo.
- Estados vazios não oferecem ação corretiva guiada.
- A Sara não conhece o imóvel/peça atual.
- Não há URL própria para campanha, peça ou etapa.

### Arquitetura

- O backend possui mais capacidade do que a interface expõe.
- A geração depende de integrações externas desativadas.
- Orçamento OpenAI zero torna o fluxo principal inutilizável por padrão.
- Renderer e Instagram impedem a validação final.
- O pipeline atual não trata variantes como objetos de primeira classe.
- Não há orquestração integrada de briefing, estratégia, copy, layout, render e publicação.
- Não há biblioteca robusta de assets, slots e recortes.
- Não há telemetria de funil nem painel de performance.

## (e) Visão de produto 10/10

O usuário deve informar apenas o código do imóvel ou selecionar um produto do ERP. O Studio monta briefing factual com fotos, vídeos, atributos, localização, público e objetivo; sugere estratégia, pilares e calendário; permite escolher campanha completa ou gerador específico; exibe modelos com miniaturas; gera pelo menos três variações por formato; aceita comandos como “mais premium”, “crie versão para famílias”, “carrossel de 7 páginas” e “troque a primeira foto”; oferece canvas editável; preserva tokens, fontes, cores e logos oficiais; usa Figma como biblioteca publicada; permite integração Canva se aprovada; mantém histórico de versões; oferece revisão colaborativa; renderiza JPEG/PNG/MP4; agenda no calendário; publica no Instagram profissional; e devolve métricas vinculadas ao imóvel, campanha, template, versão, copy, responsável e data.

Fluxo-alvo:

`Produto ERP → Briefing factual → Estratégia → Geração de opções → Edição → Revisão → Aprovação → Renderização → Calendário → Publicação → Métricas → Aprendizado`

## (f) Plano de execução priorizado

### Fase 0 — Desbloqueio operacional

**Arquivos/componentes prováveis:** `app/features/studio/StudioModule.tsx`, `app/features/studio/domain.ts`, `app/api/studio/route.ts`, configuração de integrações, jobs IA/renderer.

**Entregas:** estados explícitos; CTA corretivo; sandbox sem custo; geração real dos quatro formatos; copy visível; render JPEG/Stories; erros com causa e solução.

**Aceite:** AP0358 gera quatro peças diferentes; cada uma é editável; renderer produz JPEG; nenhum CTA fica sem resposta.

**Testes:** produto válido/inválido, IA sem orçamento, template ausente, renderer falho e repetição idempotente.

### Fase 1 — Fluxo do operador

**Componentes prováveis:** `CampaignBrief`, `GeneratorPicker`, `TemplateLibrary`, `PieceWorkspace`, `CopyEditor`, `VariantRail`, `RevisionComposer`.

**Entregas:** briefing guiado; modelos com miniaturas; geradores independentes; três variações; comandos de revisão; editor de copy; histórico visual.

**Aceite:** campanha completa em menos de 10 minutos; pelo menos cinco modelos por formato; comparação lado a lado; revisão cria versão rastreável.

**Testes:** Feed, carrossel de 5/7 páginas, sequência de Stories, Reel com roteiro, troca de tom e preservação factual.

### Fase 2 — Design System, Figma e canvas

**Componentes prováveis:** `DesignTokens`, `TemplateManifest`, `CanvasEditor`, `FigmaSync`, `AssetSlotEditor`.

**Entregas:** tokens oficiais; slots obrigatórios; templates publicados do Figma; canvas real; bloqueio de fonte/cor indevida; exportação; histórico de templates.

**Aceite:** nenhuma peça usa identidade fora do padrão; template publicado no Figma aparece no Studio; peças antigas não mudam; canvas e render são equivalentes.

**Validação visual:** comparação pixel a pixel em Feed 1:1/4:5, Story 9:16 e Reel 9:16; revisão de logo, margens, contraste e legibilidade.

### Fase 3 — Copiloto e estratégia

**Componentes prováveis:** `StudioCopilot`, `StrategyPlanner`, `CopyGenerator`, `CalendarPlanner` e endpoint contextual de chat.

**Entregas:** chat por campanha; memória do imóvel; estratégia, pilares, legendas, hashtags, roteiros, CTAs e calendário; comandos livres; aplicação com um clique; alertas factuais.

**Aceite:** o copiloto conhece a campanha aberta, não inventa fatos e permite aplicar respostas diretamente à peça.

### Fase 4 — Governança e colaboração

**Componentes prováveis:** `ApprovalBoard`, `CampaignMembers`, `CommentsThread`, `EditorialCalendar`, `ActivityTimeline`, `PermissionMatrix`.

**Entregas:** responsáveis, revisores, comentários, menções, prazos, filtros, calendário mensal/semanal, histórico e permissões.

**Aceite:** gestor identifica pendências; cada peça tem dono e prazo; revisão é contextual; peça aprovada só muda mediante nova versão; conflitos de agenda são visíveis.

### Fase 5 — Publicação e métricas

**Componentes prováveis:** `PublicationQueue`, `RenderWorker`, `MetricsDashboard`, `PostPerformance`, webhooks Meta.

**Entregas:** Instagram profissional conectado; fila; agendamento; retry seguro; estados de publicação; métricas de alcance, engajamento, cliques, leads e conversões.

**Aceite:** peça aprovada renderiza, agenda, publica em conta de teste e retorna métricas à campanha; falhas têm causa, retry e idempotência; nada publica sem aprovação.

### Ordem recomendada

1. Desbloquear geração e renderização em sandbox.
2. Diferenciar Feed, Carrossel, Stories e Reel.
3. Criar biblioteca de modelos.
4. Implementar variações e comandos de revisão.
5. Implementar canvas e Design System.
6. Conectar Figma como fonte de templates.
7. Criar copiloto contextual.
8. Implementar aprovação e colaboração.
9. Ativar calendário operacional.
10. Integrar Instagram.
11. Adicionar métricas e aprendizado.

Cada fase deve ser demonstrada com AP0358 e AP0348, usando evidência visual e critérios de aceite verificáveis.
