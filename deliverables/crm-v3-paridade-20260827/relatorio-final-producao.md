# CRM V3 — relatório final de produção

Data: 27/08/2026

## Resultado

- URL: `https://apecerto-erp.onrender.com/crm`
- Commit e build ativos: `88a7ae24506f0e75f93a775535495f3faf14cb18`
- Branch de trabalho: `codex/crm-v3-paralelo-local-20260827`
- Base incorporada antes do último push: `a6c39974feb9634acef5de4408e8d3d21b1d8184`
- Experiência oficial: CRM V3 em `/crm`.
- Rollback preservado: variável de servidor `CRM_V3_EXPERIENCE=legacy` retorna ao Funil 2.0 visual legado sem excluir o código atual.
- Nenhuma migration, tabela, RLS, RPC, credencial ou cliente real foi alterado nesta entrega.
- Nenhum WhatsApp ou D-API foi disparado durante a validação.

## Correções publicadas

1. O shell interno duplicado do protótipo foi removido; a produção mantém somente o shell oficial do ERP e a navegação horizontal do CRM.
2. O Kanban passou a usar colunas uniformes de 240 px, bordas quentes de 1 px, cartões compactos e rolagem própria.
3. Etapa, momento, temperatura, próxima ação e prazo continuam visíveis com dados canônicos.
4. Busca, temperatura, seleção, arrasto, menu e ação em massa reutilizam o motor de movimento do Funil 2.0.
5. A ficha única possui Atendimento, Histórico, Atividades, Negócios, Imóveis, Arquivos e Dados do lead.
6. A ficha ganhou foco inicial, navegação por setas, `Esc`, focus trap e retorno do foco ao cartão de origem.
7. O CRM mobile ganhou navegação própria Meu Dia/Funil/Leads/Agenda/Visitas; a barra global fica oculta somente nessa superfície, sem duplicação.
8. Filtros móveis têm 44 px e os cinco destinos da barra têm 56 px.
9. O legado continua separado e reversível por flag de servidor.

## Validação visual em produção

| Viewport | Resultado | Evidência |
|---|---|---|
| 1440 × 900 | Passou; documento 1440 px, colunas 240 px, shell único e sem vazamento horizontal | `producao/producao-1440x900.png` |
| 1280 × 800 | Passou; documento 1280 px, quadro com rolagem própria e navegação horizontal preservada | `producao/producao-1280x800.png` |
| 390 × 843 | Passou; documento 390 px, barra CRM correta, filtros 44 px, destinos 56 px e sem vazamento | `producao/producao-390x843.png` |

O laboratório e a produção não são comparados pelo shell externo: a barra preta de laboratório não é produtiva e a produção deve manter o shell autenticado do ERP. Dentro da área do CRM, hierarquia, tokens, densidade, colunas, tabs e comportamento responsivo seguem o contrato corrigido. As ações reais do cartão permanecem mais explícitas que no laboratório para não remover funções canônicas.

## Matriz funcional executada

| Grupo | Produção read-only | Automação | Resultado |
|---|---:|---:|---|
| Navegação desktop | Meu Dia, Negócios, Leads, Visitas, Esteira e Configurações presentes | Coberta | Passou |
| Navegação mobile | Funil, Leads e Visitas acionados; Meu Dia e Agenda preservados como rotas | Coberta | Passou |
| Busca, chips e rolagem | Inspecionados nos três viewports | Coberta | Passou |
| Ficha e sete áreas | Todas abertas sobre dado real sem mutação | Coberta | Passou |
| Foco e teclado | Foco inicial, seta à direita, `Esc` e retorno ao cartão | Coberta | Passou |
| Movimento por menu/arrasto/massa | Não executado em cliente real | Motor único e API canônica cobertos | Passou nos testes |
| Atividade/visita/feedback | Não executado em cliente real | Contratos do Funil 2.0 e Agenda cobertos | Passou nos testes |
| WhatsApp/Sara/D-API | Não acionados | Falso positivo bloqueado pela suíte | Passou nos testes |
| Corretor/Gestor/Admin | Admin validado na sessão real; demais não impersonados | Permissões e navegação cobertas | Passou nos testes; limitação abaixo |
| Loading/vazio/erro/offline | Estado normal inspecionado em produção | Estados cobertos pela suíte frontend/PWA | Passou nos testes; não induzido em produção |

A matriz elemento por elemento permanece em `matriz-claude-producao.md`.

## Gates

- CRM V3 específico: 12/12 testes passaram.
- Integração final após mudanças concorrentes da `main`: 19/19 testes passaram.
- Frontend completo: 303/303 testes passaram.
- TypeScript: passou sem erro.
- Lint dos arquivos alterados: zero erro; a folha CSS não possui regra de lint configurada e foi ignorada pelo linter.
- Build completo: passou; `/crm` presente na saída.
- `git diff --check`: passou.
- Console do navegador em produção: zero erro e zero aviso na passagem final.
- Revisão de diff: nenhuma API, migration, função Supabase, permissão ou segredo foi adicionado pelo CRM V3.

## Rede, dados e segurança

- A navegação produtiva foi deliberadamente read-only.
- Não foi usado registro de cliente como massa de teste mutável.
- As únicas leituras do CRM continuam em `/api/funil2`; as mutações permanecem nos handlers canônicos existentes e dependem da resposta do servidor.
- Não há fixture, sessão sanitizada, adaptador em memória, `localStorage` ou `sessionStorage` no caminho produtivo do V3.
- A ferramenta de inspeção visual disponível registra console e DOM, mas não expõe log de métodos HTTP. A ausência de caminho externo novo foi comprovada por revisão do diff e testes de contrato; nenhuma ação mutável foi clicada na produção.

## Limitações objetivas

1. A sessão real disponível era Admin. Corretor e Gestor foram validados por testes de permissão com reload lógico, não por troca de identidade em produção.
2. Loading, vazio, erro e offline não foram forçados na sessão produtiva para evitar interferência; foram validados pela suíte frontend/PWA.
3. As mutações foram validadas por testes automatizados, porque não havia um registro produtivo de teste claramente seguro e reversível.
4. O ambiente local não possuía as variáveis públicas do Supabase; a inspeção autenticada final foi feita diretamente no build de produção confirmado.

Nenhuma limitação acima cria regressão crítica aberta dentro do código publicado.
