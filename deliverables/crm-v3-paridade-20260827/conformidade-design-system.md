# Conformidade do CRM V3 com o ApêCerto Design System

Data da auditoria: 27/08/2026
Autoridade: `/Users/samuelnoviski/Downloads/ApêCerto Design System.zip`
Contrato corrigido: `claude-design/CRM V3.dc.html`

| Elemento | Regra oficial | Antes no Claude Design | Correção aplicada | Evidência |
|---|---|---|---|---|
| Shell | O shell do ERP é o dono da navegação | Sidebar própria do CRM somada ao shell real | Sidebar removida; navegação do CRM virou tabs horizontais de módulo | Capturas 1440/1280/390 |
| Tipografia | Quicksand; escala ERP 24/20/16/14/12; piso 11 px | 128 tamanhos fora da escala, inclusive texto menor | Escala normalizada; corpo 14, metadado 12, título 24 | Auditoria do arquivo e captura |
| Cores | Somente tokens semânticos existentes | 24 hex e 5 `rgba()` crus | Valores convertidos para `var(--*)` | Busca final no arquivo |
| Espaçamento | Grade de 4 px | 6/7/9/10/11/13/14/18/22/26 px | Gaps, padding e margens normalizados na grade | Inspeção CSS |
| Bordas | 1 px, `--border-soft/default` | Faixas grossas de 3 px e divisões pesadas | Bordas finas, quentes e sem faixas decorativas | Kanban e ficha |
| Raios | Tokens `--radius-*` | 6/10/14/26 px sem token | Raios oficiais aplicados | Inspeção CSS |
| Sombras | `--shadow-xs/sm`; sem sombra de marca repetida | Sombras próprias e densas em cartões | `ape-lead-card` e sombra discreta | Capturas |
| Botões | Um CTA laranja por contexto; 32 px desktop e 44 px mobile | 12 CTAs laranja e controles de 22–28 px | Um CTA primário por contexto; secundários/ghost; 44 px móvel | Navegação e formulários |
| Ícones | Lucide; não usar glifos funcionais | `⌄ ··· × ✓ ↑ ↓ ← › • ! +` | SVGs Lucide inline com nome acessível | Busca final e testes |
| Tabs | `ape-tabs/ape-tab`, overflow horizontal | Navegações próprias e grupos duplicados | Tabs oficiais; nove áreas no desktop, cinco no mobile + Mais | Capturas |
| Toolbar | `ape-toolbar`, busca, chips, contagem e ações | Controles soltos e proporções inconsistentes | Toolbar oficial compacta, quebra responsiva | Negócios e Leads |
| Kanban | `ape-kanban`, colunas a partir de 200 px | Coluna de 330 px e cartão redesenhado | Coluna de 240 px para preservar os quatro dados operacionais | 1440/1280 |
| Cartão | `ape-lead-card`, compacto, quatro dados essenciais | Texto excessivo e blocos dentro do cartão | Nome, valor, temperatura, ação/prazo e metadados compactos | Capturas |
| Temperatura | Estado semântico com texto e cor | Faixa lateral dominante | Chip textual Quente/Negociando/Morno/Frio/Aguardando | Kanban e mobile |
| Tabelas | `ape-table`, 40 px, estados vazio/loading | Listas sem padrão único | Leads e matrizes usam tabela oficial | Áreas Leads/Matriz |
| Formulários | `ape-field`, `ape-input`, ajuda/erro e grade 2–4 colunas | Campos e cards aninhados | Formulários densos oficiais e feedback explícito | Dialogs e ficha |
| Ficha | Único drawer/dialog; sete áreas; sem modal sobre modal | Cards dentro de cards e hierarquia excessiva | Superfície única com divisores e sete tabs | Teste de foco e captura |
| Timeline | `ape-timeline/ape-tl-*`; humano e automação distintos | Histórico visual próprio | Timeline oficial e origem explícita | Aba Histórico |
| Offline | Mensagem explícita e ações bloqueadas descritas | Banner incompleto no desktop | “Sem conexão — exibindo dados em cache” + indisponibilidades | Estado Sem conexão |
| Responsividade | Sem overflow do documento; Kanban pode rolar; alvo 44 px | Boards rígidos e scroll indevido | Visitas/Esteira em grid responsivo; Kanban com rolagem própria | 390/1280/1440 |
| Acessibilidade | Foco laranja 3 px, contraste, nomes e teclado | Foco e nomes inconsistentes | Anel oficial, SVGs ocultos, labels, tabs e dialog semantics | Smoke de teclado |

## Limitações aceitas no contrato visual

- O laboratório conserva a barra preta de validação; ela não pertence à produção.
- A coluna usa 240 px, acima do mínimo oficial de 200 px, porque o cartão precisa preservar valor, temperatura, próxima ação e prazo.
- O valor literal de 11 px permanece onde o próprio `erp.css` define o piso sem token correspondente.
- O laboratório simula funções sem contrato produtivo. A produção não poderá simular sucesso: deve delegar ao fluxo canônico ou manter a ação indisponível com explicação.
