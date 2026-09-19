# Plano de ação — reestruturação do ERP ApeCerto

Atualizado em: 2026-09-19
Prazo operacional deste ciclo: 2026-09-20, 18:00, America/Sao_Paulo
Ambiente de implementação: worktree local isolada; publicação de código somente após os gates
Worktree: `/private/tmp/apecerto-erp-crm-visual`
Branch: `codex/erp-crm-visual-concept`
Base: `e478030e4eaf33d17562ceb5ac2b3bef34fd677a`

## Resultado deste ciclo

O objetivo final permanece reestruturar o ERP inteiro: CRM, Sara, visitas,
automações, aplicativo/PWA, produtos, captação, vendas, financeiro, banco,
integrações, segurança, observabilidade, identidade visual e implantação
repetível. O marco de domingo não reduz esse escopo; ele limita apenas o que
pode ser honestamente certificado e publicado dentro desta janela.

Até o marco, estabelecer uma base verificável e entregar o máximo de fatias
operacionais críticas que atravessem todos os gates, com interface aprovada,
contratos rastreados, testes comportamentais e evidência no navegador.

Este ciclo não chamará o ERP inteiro de pronto ou vendável sem evidência. O
prazo de domingo é usado para fechar o baseline, corrigir o maior número de
P0/P1 que atravesse todos os gates e publicar somente fatias comprovadas. Não é
uma promessa de reescrever e certificar todos os módulos em menos de dois dias;
qualquer área sem evidência permanece explicitamente no roadmap.

## Compromisso real de entrega

O trabalho não é executado em lotes de duas horas. Ele permanece contínuo e
cada fatia avança assim que atravessa os gates. O compromisso deste ciclo é:

- manter todo o escopo funcional descrito neste plano, sem esquecer decisões
  da conversa;
- corrigir e publicar somente o que estiver comprovado por código, banco,
  autorização, testes, build e navegador real;
- informar objetivamente o que ficou pronto, parcial, bloqueado ou ainda não
  iniciado;
- nunca trocar abrangência aparente por uma publicação insegura;
- continuar pelas fatias seguintes sem aguardar um horário artificial.

Isso não equivale a garantir a reconstrução e certificação integral de CRM,
Sara, visitas, aplicativo, produtos, captação, vendas, financeiro, banco,
automações, observabilidade e provisionamento em menos de dois dias. A garantia
possível é de método, rastreabilidade e evidência para cada item declarado
pronto. O restante continua no backlog vivo até atravessar os mesmos gates.

O contrato funcional completo das decisões do usuário está em
`docs/erp-reestruturacao/REQUISITOS_CANONICOS_OPERACAO.md`. Nenhuma fatia pode
ser considerada concluída se contradizer esse contrato.

## Restrições

- não trabalhar diretamente em `main`;
- preservar todas as alterações existentes;
- deploy e publicação de código estão autorizados somente depois dos gates da
  fatia; confirmar build e validar produção após cada publicação;
- migrations de produção continuam exigindo confirmação específica; quando
  necessárias, preparar somente opções aditivas, reversíveis e com rollback;
- não fazer cutover de produto ou alteração destrutiva de schema/dados;
- não excluir dados, rotacionar credenciais, enviar mensagens externas ou efetuar pagamentos;
- não consultar nem registrar PII; usar metadados e dados sanitizados;
- não considerar uma função pronta porque existe rota, card, modal ou teste estático.

## Método obrigatório

Cada fatia segue:

1. inspecionar código, contrato, banco e autorização;
2. reproduzir o comportamento ou a falha;
3. escrever ou ajustar o teste que demonstra o resultado;
4. fazer a menor correção reversível;
5. rodar testes direcionados;
6. validar no navegador real;
7. registrar evidência, risco e próximo passo;
8. rodar gate ampliado antes da publicação;
9. publicar, confirmar `/api/build` e repetir o fluxo em produção;
10. fazer rollback seguro se a validação publicada falhar.

Não existe intervalo artificial de duas horas. A execução é contínua:
`inspecionar → testar → corrigir → testar → validar → publicar → revalidar`.
Uma fatia pronta antes disso avança imediatamente; uma fatia insegura não é
publicada apenas porque o relógio chegou a um horário.

A antiga automação de duas horas está `PAUSED` e existe apenas como registro.
Ela não agenda, limita ou desacelera a execução. Checkpoints são escritos quando
há mudança material, conclusão, falha ou decisão necessária — não por relógio.

## Revalidação integral do escopo de 2026-09-19

O plano foi confrontado novamente com todas as decisões da conversa e preserva
estas frentes obrigatórias:

1. entrada Meta/site, Make, deduplicação, proteção por visita/negociação e
   distribuição auditável;
2. Sara com etapa, momento, próxima ação, temperatura e qualidade, acionada por
   eventos e janelas determinísticas;
3. Meu Dia, Central de foco, Kanban e pipelines configuráveis sem autoridades
   paralelas ocultas;
4. visita, feedback estruturado/áudio, qualidade, cobrança corretor → gerente e
   definição explícita do cliente;
5. aplicativo/PWA específico para corretor, gerente e CEO, incluindo agenda,
   notificações, WhatsApp, desempenho, offline e conflitos;
6. produtos, captação, proprietário, aprovação interna e publicação no site;
7. esteira de venda, documentos, contrato, assinatura e pagamento;
8. financeiro completo, comissões, aportes, despesas, caixa, impostos e futuro
   adapter do banco de pagamentos;
9. automações versionadas, idempotentes, observáveis e testadas para atraso,
   duplicidade, reordenação, falha e resposta parcial;
10. consolidação de repositório, banco, Edge Functions, RLS, Auth, Storage,
    integrações e legado, sem apagar histórico ativo;
11. identidade visual única e acessível em desktop e celular;
12. provisionamento repetível para outras imobiliárias, sem forks artesanais.

Nenhuma dessas frentes é retirada do roadmap. A ordem é por risco e dependência:
primeiro corrigir a autoridade e o comportamento real; depois aplicar a camada
visual; por último remover o legado cuja substituição já tenha sido provada.

## Estratégia de economia de tokens

- usar `rg`, inventários e leituras em lote, evitando reler arquivos já catalogados;
- manter `docs/AI_HANDOFF.md` curto e factual;
- executar uma única fatia de maior prioridade por ciclo;
- reutilizar componentes, contratos e tokens visuais existentes;
- rodar testes direcionados durante a correção e suíte ampla somente em marcos;
- produzir uma captura por estado relevante, não por ajuste cosmético;
- não instalar componentes do 21st.dev; usar apenas padrões públicos como referência;
- interromper loops após três tentativas sem progresso e registrar o bloqueio;
- não abrir frentes paralelas que disputem os mesmos arquivos.

## Gate 0 — provar a base canônica

Saída obrigatória:

- remoto, branch, commit e árvore registrados;
- cópias plausíveis comparadas;
- produção atualmente servida e build identificados sem alteração externa;
- Supabase `diaegvfveqezispcthwk` reconciliado por metadados somente leitura;
- migrations, Edge Functions, workers e integrações catalogados;
- divergências código × banco × documentação × produção listadas;
- ownership da worktree e arquivos alterados preservados.

Aceite: nenhuma correção estrutural fora do protótipo visual antes de a base ser
confirmada e as divergências críticas estarem explícitas.

## Gate 1 — inventário integral e matriz de rastreabilidade

Inventariar rotas, páginas, abas, modais, drawers, tabelas, formulários,
dashboards, perfis, entidades, APIs, jobs, webhooks, Storage, Auth, RLS,
policies, RPCs, Edge Functions e integrações.

Matriz mínima:

`tela/jornada → função → domínio → contrato → banco → API/comando → autorização → estados de UI → teste → E2E → evidência → classificação`

Classificações:

1. comprovado;
2. parcial;
3. interface sem consequência real;
4. quebrado ou bloqueado;
5. duplicado ou conflitante;
6. legado ativo;
7. obsoleto candidato à remoção;
8. ausente e necessário.

## Gate 2 — fundação visual e navegação

Entregas:

- tokens visuais e componentes-base consolidados;
- Central de foco como início inteligente do CRM;
- Kanban como visão operacional complementar;
- KPIs somente quando houver métrica, interpretação e ação;
- loading, vazio, filtro vazio, erro, negado, offline, conflito e sucesso;
- acessibilidade, redução de movimento e responsividade;
- nenhuma dependência do catálogo 21st.dev instalada sem revisão de licença.

Estado atual: conceitos locais da Central de foco e Kanban construídos e
validados em 1600 × 1000; ainda não integrados à tela canônica de produção.

Divergência corrigida localmente em 2026-09-19: o desktop servia
`public/funil-web-sexta.css`, mas os testes validavam
`app/styles/funil.css`; os dois arquivos haviam divergido. O artefato servido
foi sincronizado com a fonte testada e o contrato que exige igualdade voltou a
passar. A base compartilhada do aplicativo continua separada em
`app/styles/funil-2.css` até a integração visual ser validada nos dois formatos.

Primeira integração funcional da direção aprovada: o CRM desktop agora abre em
`Meu Dia`, a fila real priorizada por prazo, e mantém `Negócios`/Kanban como
visão complementar. A mudança foi feita no componente canônico, não no conceito
isolado, e foi validada em navegador nos formatos desktop e aplicativo.

Gate local da fatia: build completo aprovado; suíte frontend 426/426; suíte
selecionada CRM/Funil 104/104; typecheck aprovado; lint sem erros. Quatro
contratos de Produtos permanecem marcados como pendentes pela própria suíte e
não são contabilizados como função concluída nesta fatia.

Gate ampliado mais recente: 469/469 testes frontend aprovados. Isso comprova os
contratos cobertos pela suíte, não o funcionamento integral de módulos que ainda
não passaram por banco isolado, navegador autenticado e produção.

## Fatia vertical 1 — lead até próxima ação confiável

Fluxo:

`Meta/site → Make/webhook → deduplicação → regra de proteção → distribuição → primeira abordagem → conversa → Sara → etapa/momento/temperatura/qualidade/próxima ação → Meu Dia`

Prioridades P0:

- descobrir a autoridade canônica entre CRMs e tabelas duplicadas;
- impedir escrita privilegiada pelo navegador;
- provar deduplicação por telefone, e-mail e nome sem misturar pessoas;
- preservar visita agendada e negociação ao redistribuir reincidência;
- garantir disparo e processamento idempotentes;
- acionar a Sara no encerramento inteligente da conversa, não a cada mensagem;
- persistir os cinco resultados com auditoria e versão;
- refletir a próxima ação no Meu Dia em tempo verificável.

Aceite:

- caminho positivo e negativo sem fixtures;
- autorização fail-closed;
- idempotência e concorrência cobertas;
- teste de domínio, API e UI;
- E2E no navegador com evidência do estado persistido.

## Fatia vertical 2 — visita, feedback e cobrança gerencial

Fluxo:

`agendar → confirmar → realizar/cancelar → feedback estruturado ou áudio → qualidade do feedback → próxima ação → cobrança do corretor → resolução pelo gerente`

Aceite:

- visita nunca fica sem estado explícito;
- corretor recebe cobrança progressiva;
- gerente cobra o corretor, não o cliente;
- tarefa do gerente sai da fila quando o corretor registra feedback válido;
- reabre no prazo correto quando o cliente continuar sem definição;
- perda/cancelamento exige motivo estruturado e aprovação configurável;
- histórico permanece pesquisável e auditável.

## Fatia vertical 3 — aplicativo corretor e gerente

Corretor:

- Meu Dia priorizado;
- WhatsApp e resumo do lead;
- agenda, visita, reagendamento e feedback por texto/áudio;
- busca e cadastro de cliente;
- conexão da instância;
- ganhos e performance autorizados.

Gerente:

- central de notificações insistente;
- visitas sem feedback e ações vencidas;
- cobrança por corretor com resolução rastreada;
- bloqueio de agenda pessoal;
- perguntas operacionais à Sara com resposta baseada em dados autorizados.

## Fatias posteriores

1. produtos, captação, proprietário e publicação;
2. esteira de venda, documentos, contrato, assinatura e pagamento;
3. financeiro contábil-gerencial, comissões e previsões;
4. automações visuais e conectores;
5. provisionamento repetível por imobiliária;
6. migração integral ApeCerto SP → S3, em projeto separado e sem carga neste ciclo.

## Consolidação e remoção de duplicações

Código, banco, rotas, automações e aplicativos sobrepostos serão classificados
como canônico, legado ativo, duplicado, obsoleto ou histórico. Remoção local só
ocorre com prova de dependências, substituição, testes e rollback. Exclusão ou
alteração destrutiva em produção continua exigindo autorização específica.

Não haverá reescrita total cega. O núcleo será consolidado por domínio e por
fatias verticais, preservando histórico e compatibilidade até o cutover de cada
autoridade.

## Backlog inicial

### P0

- reconciliar a deriva entre commit publicado, migrations remotas e 53 Edge Functions;
- provar e manter `f2_*` + `motor_fila` como autoridade de lead, etapa, momento e próxima ação;
- provar autenticação, RLS e ausência de escrita privilegiada no frontend;
- medir a latência agregada da Sara e da atualização da próxima ação;
- consolidar alertas da Sara por cliente/público: hoje há 344 alertas de gestão
  para 132 clientes, com até 35 abertos para o mesmo cliente;
- reproduzir visita realizada sem feedback e sem escalonamento;
- conectar Central de foco e Kanban a contratos reais apenas após os gates.
- impedir nova divergência entre a fonte visual testada do CRM e o arquivo
  realmente servido ao desktop.

Concluído localmente em 2026-09-19: removida de `/api/funil2` a consulta aos
RPCs `ncrm_sara_*` aposentados que produzia um estado enganoso na interface. A
latência recente de conversa foi medida (p50 6,5 s; p95 10,3 s), separando-a dos
checkpoints de prazo.

Também concluído localmente: APIs e interfaces agora restringem o feedback ao
corretor dono; o contrato aditivo de banco para repetir essa invariável e criar
cobrança pós-visita persistente está preparado fora de `supabase/migrations`,
com push/WhatsApp desligados. Aplicação e validação isolada continuam pendentes.

### P1

- feedback estruturado e por áudio;
- cobrança gerente → corretor;
- carteira de acompanhamento e cessão entre corretores;
- criação rápida de pipelines e etapas configuráveis;
- sistema de captação, proprietário e aprovação do imóvel;
- aplicativo responsivo por papel.

### P2

- portal do proprietário;
- financeiro completo;
- provisionamento de novas imobiliárias;
- importação, backup restaurado, observabilidade e runbooks comerciais.

## Ordem contínua de execução até domingo

1. fechar Gate 0 e registrar divergências;
2. gerar inventário automatizado e esqueleto da matriz;
3. reproduzir o P0 de maior impacto no fluxo lead → Sara → próxima ação;
4. proteger com teste e aplicar a menor correção local;
5. validar a jornada no navegador e no estado persistido permitido;
6. integrar a fundação visual somente na superfície coberta;
7. iniciar visita → feedback → cobrança se a primeira fatia estiver estável;
8. publicar imediatamente cada fatia aprovada e validar navegador desktop e
   PWA/aplicativo, sem esperar janela horária;
9. continuar na fatia seguinte e manter o checkpoint vivo;
10. rodar gate final e publicar o checkpoint de entrega.

## Fronteiras de autorização que afetam a sequência

- código: preparação, testes e commits locais estão autorizados; o envio da
  branch `codex/erp-crm-visual-concept` ao remoto e o deploy do payload completo
  ainda aguardam confirmação explícita, porque a branch contém o ERP e
  documentação interna. Push, merge e deploy são etapas separadas;
- banco: inventário, desenho e testes locais estão autorizados; migration real
  no Supabase exige confirmação específica antes de aplicar;
- legado: pode ser classificado e isolado localmente; remoção destrutiva em
  produção exige prova de não uso, backup, rollback e autorização;
- integrações/mensagens/pagamentos: nenhum efeito externo real sem autorização
  específica;
- aplicativo/PWA: faz parte do escopo de correção e validação; não será apagado
  ou substituído sem equivalência funcional demonstrada.

## Gate final de domingo

- baseline reproduzível;
- inventário e matriz vivos;
- backlog P0/P1/P2 com evidências;
- ao menos uma jornada vertical crítica localmente comprovada;
- identidade visual aplicada apenas ao que estiver funcionalmente coberto;
- testes direcionados e gate ampliado registrados;
- build publicado confirmado e produção validada em desktop e PWA/aplicativo;
- riscos, lacunas e próximos passos explícitos;
- nenhuma declaração de “ERP pronto” ou “vendável” sem cumprir os critérios.

O gate final não converte automaticamente todo o roadmap em entregue. Cada
módulo terá sua própria classificação na matriz, e apenas itens com evidência
positiva serão marcados como concluídos.
