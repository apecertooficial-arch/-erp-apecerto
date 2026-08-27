# Matriz Claude Design → ERP

Contrato visual: `claude-design/CRM V3.dc.html`
Autoridade funcional: Funil 2.0, `/api/funil2`, Esteira e rotas canônicas do ERP.
Regra: nenhuma ação é considerada concluída por estado local; sucesso depende do retorno canônico.

| Área | Elemento/ação | Comportamento do contrato | Implementação canônica | Permissão | Prova obrigatória |
|---|---|---|---|---|---|
| Shell | Tabs Meu Dia/Negócios/Leads/Atividades/Visitas/Esteira | Trocar área, limpar seleção e manter um shell | Estado do `Funil2Workspace`; rotas canônicas quando a função mora fora | CRM | Navegação desktop |
| Shell | Painel | Abrir visão gerencial | Delegar a `/inteligencia` | Gestor/Admin | Acesso permitido/negado |
| Shell | Configurações | Regras do CRM | `Configuracoes` + actions existentes | Admin | Abrir, editar com retorno API |
| Shell | Matriz | Evidência de validação, não operação | Não publicar como botão operacional | — | Ausência de item decorativo |
| Cabeçalho | Avisos | Abrir central de exceções | `CentralAtencao` | CRM | Abrir/fechar e abrir ficha |
| Cabeçalho | Novo negócio | Criar negócio separado de lead | `salvarNegociacao` com lead escolhido | CRM | Validação + resposta real |
| Meu Dia | Atrasadas | Filtrar por prazo vencido | Derivação `situacaoPrazo` | CRM | Contagem/lista coerentes |
| Meu Dia | Até 2h | Filtrar urgentes | Derivação `situacaoPrazo` | CRM | Contagem/lista coerentes |
| Meu Dia | Hoje | Filtrar prazo do dia | `venceHoje` | CRM | Fuso São Paulo |
| Meu Dia | Leads para chamar | Primeira abordagem | `esperandoPrimeiraChamada` | CRM | Sem falso positivo D-API |
| Meu Dia | Visitas do dia | Compromissos do dia | payload `visitas` | CRM | Abrir lead da visita |
| Meu Dia | Atender agora | Abrir ficha do primeiro | seleção canônica | CRM | Foco inicial/retorno |
| Negócios | Seletor de pipeline | Trocar pipeline | Não há contrato Funil 2.0 múltiplo; ocultar até existir | — | Não mostrar controle falso |
| Negócios | Em andamento | Quadro ativo | `leads` ativos por etapa | CRM | Contagens por coluna |
| Negócios | Ganhos/Perdidos/Triagem | Visões de negócio | Delegar à Esteira/carteira quando houver contrato; não simular no Funil 2.0 | Perfil do módulo | Estado honesto |
| Negócios | Busca | Filtrar nome, telefone, número e interesse | Estado local somente de filtro | CRM | Busca e limpeza |
| Negócios | Temperatura | Todas/Quente/Negociando/Morno/Frio/Aguardando | `temperaturaDoLead` | CRM | Chips e contagem |
| Negócios | Ordenação | Mais urgente | `proxima_acao_em` | CRM | Ordem estável |
| Negócios | Período | Recorte por movimentação | Somente se payload tiver dado; caso contrário ocultar | CRM | Sem filtro decorativo |
| Negócios | Selecionar | Ativar seleção múltipla | Estado de IDs; limpar ao navegar | CRM | Dois cartões + limpeza |
| Negócios | Ação em massa | Mover seleção pelo mesmo motor | `atualizarMomento` por item, com versão e recarga | CRM | Falha parcial explícita |
| Negócios | Drag-and-drop | Mover para etapa | Primeiro momento ativo da etapa via `atualizarMomento` | CRM | Menu/arrasto/massa convergem |
| Negócios | Menu mover | Escolher etapa de destino | Mesmo handler de movimento | CRM | Resposta API e recarga |
| Negócios | Regra de atividade | Bloquear destino quando aplicável | Regra/RPC canônica; frontend não inventa | CRM | Mensagem de bloqueio |
| Negócios | Nova ficha na etapa | Criar negócio vinculado | `salvarNegociacao`; etapa de Esteira canônica | CRM | Form separado |
| Cartão | Abrir conversa | Conversa vinculada | `Funil2ConversationDrawer` | CRM | Sem conclusão por clique |
| Cartão | Abrir ficha | Drawer único | `Detalhe` | CRM | Mouse/teclado |
| Cartão | Temperatura | Mostrar leitura literal e cor | campo canônico `temperatura` | CRM | Quatro temperaturas + aguardando |
| Cartão | Valor | Mostrar valor quando contrato fornecer | negociação/Esteira; ocultar se ausente | CRM | Sem valor inventado |
| Cartão | Próxima ação/prazo | Exibir conduta e situação | `acaoVisivel`/`prazoDaAcao` | CRM | Atrasado/urgente/no prazo |
| Cartão | Mais ações | Menu contextual | ficha, atualizar momento, visita, negócio, descarte | CRM | Cada item funcional |
| Leads | Busca | Nome/telefone | carteira atual e endpoint de carteira antiga | CRM | Dois conjuntos sem duplicar |
| Leads | Ativos/legado | Alternar fonte | `TodosLeads` | CRM | Loading/erro/vazio |
| Leads | Seleção | Selecionar linha | Estado visual; ação somente se canônica | CRM | Teclado e clique |
| Leads | Trazer para o funil | Escolher etapa/momento | `trazerLeadAntigo` | CRM | Retorno API e recarga |
| Atividades | Abrir área | Operação completa de tarefas | Delegar à rota canônica `/tarefas` | CRM/Tarefas | Shell reaparece e rota abre |
| Atividades | Criar/editar/concluir/excluir | CRUD e feedback | Fluxo canônico de Tarefas; não duplicar API | Conforme rota | Testes da Agenda/Tarefas |
| Atividades | Agenda | Dia/semana/mês/lista | Rota canônica de tarefas/agenda | Conforme rota | Navegação real |
| Visitas | Abrir área | Lista/pipe de visitas | `PipeVisitas` | CRM | Normal/vazio/erro |
| Visitas | Nova visita | Lead, produto, unidade, data/hora, gerente | `salvarVisita` + dados canônicos | CRM | Validação completa |
| Visitas | Confirmar | Atualizar status | Só quando existir handler canônico; não simular | CRM | Resultado real ou indisponível |
| Visitas | Feedback | Formulário e saída da fila | Só quando existir contrato canônico; não simular | CRM | Resultado real ou indisponível |
| Esteira | Abrir | Pós-fechamento real | `SalesProcessView` | CRM/Vendas | Carregar dados reais |
| Esteira | Mover venda | Etapa real | `/api/crm/sales` action `move` | Gestor/Admin quando exigido | Resposta API |
| Esteira | Ação em massa | Mover etapa inteira | `/api/crm/sales` `bulkMoveStage` | Gestor/Admin | Gate canônico |
| Ficha | Fechar | Esc e botão; restaurar foco | `Detalhe` com `dialogRef` | CRM | Foco retorna ao card |
| Ficha | Setas nas tabs | Navegar sete áreas | tablist e handler Arrow/Home/End | CRM | Teclado completo |
| Ficha | Atendimento | Ação, prazo, Sara e atualização | `atualizarMomento` | CRM | Resposta e recarga |
| Ficha | Histórico | Eventos humanos/automáticos | GET histórico do lead | CRM | Timeline coerente |
| Ficha | Atividades | Abrir atividades do lead | Deep-link para `/tarefas` com contexto | CRM/Tarefas | Sem dado simulado |
| Ficha | Negócios | Negociações vinculadas | payload `negociacoes`/Esteira | CRM | Lista real ou vazio |
| Ficha | Imóveis | Interesses/produtos relacionados | Tags/interesse e rota de Produtos quando disponível | CRM/Produtos | Sem imóvel inventado |
| Ficha | Arquivos | Documentos canônicos | Delegar à Esteira/arquivos quando houver vínculo | Conforme módulo | Sem upload falso |
| Ficha | Dados do lead | Telefone, responsável, origem, tags | payload canônico | CRM | Read-only correto |
| Ficha | Alterar temperatura | Salvar leitura | `atualizarTemperatura` | CRM | Retorno API |
| Ficha | Chat | Conversa real | `Funil2ConversationDrawer` | CRM | Sem modal sobre modal |
| Ficha | WhatsApp | Abrir destino; conclusão só pelo D-API | link + confirmação canônica | CRM | Clique não conclui |
| Ficha | Agendar visita | Abrir formulário único | `ModalVisita` | CRM | Focus trap |
| Ficha | Gerar negociação | Abrir formulário único | `salvarNegociacao` | CRM | Lead/negócio distintos |
| Ficha | Adicionar tag | Persistir tag | `AssociarTagLead`/`associarTag` | CRM | Retorno real |
| Ficha | Descartar | Motivo fechado e histórico | `descartar` | CRM | Confirmação e recarga |
| Sara/D-API | Concluir ação | Depender de confirmação externa | action canônica; nunca pelo clique humano | CRM | Teste de falso positivo |
| Estados | Carregando | Skeleton/feedback | `carregando` | Todos | Visual e ARIA |
| Estados | Vazio | Mensagem acionável | derivação do payload | Todos | Sem card fantasma |
| Estados | Erro | Falha recuperável | `erro` + recarregar | Todos | Sem esconder conteúdo crítico |
| Estados | Sem conexão | Cache e ações indisponíveis | estado de rede/PWA canônico | Todos | Texto exato móvel |
| Estados | Acesso negado | Não renderizar função protegida | `GuardaModulo` e perfil | Por perfil | Corretor/Gestor/Admin |
| Mobile | Navegação inferior | Meu Dia/Funil/Leads/Agenda/Visitas | `Funil2Mobile`/rotas canônicas | CRM | 390 × 843 |
| Mobile | Chips de etapa | Continuidade/rolagem horizontal | filtro de etapa local | CRM | Sem overflow do documento |
| Mobile | Mais | Esteira/Painel/Configurações | links e permissões canônicas | Perfil | Acesso negado correto |
| Rollback | `CRM_V3_EXPERIENCE=legacy` | Retornar visual legado | flag somente servidor | Operação | Build e rota legado |

## Critério de implementação

- Linhas com contrato existente devem reutilizá-lo diretamente.
- Linhas delegadas devem abrir a superfície canônica, preservando autenticação e permissões.
- Linhas sem contrato devem ficar ausentes ou explicitamente indisponíveis; nunca devem alterar apenas a interface e declarar sucesso.
