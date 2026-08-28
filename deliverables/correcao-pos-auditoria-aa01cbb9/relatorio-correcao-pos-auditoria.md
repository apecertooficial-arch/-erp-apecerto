# Correção do CRM após auditoria 5,0/10

Data: 28/08/2026

Base inicial: `aa01cbb9d42c40c2f9e9fa2a9e0a798dc73cf037`

Branch: `codex/crm-v3-paralelo-local-20260827`
Ambiente de implementação: local, seguido de publicação pelo fluxo oficial GitHub/Render e revalidação autenticada em produção.

## Resultado implementado

1. **Fechamento honesto:** Ganho/Perdido deixaram de alterar apenas `f2_negociacao`. A ficha mostra os negócios canônicos e direciona para a Esteira; restauração e Desfazer não são simulados.
2. **Lote protegido:** sem RPC atômica existente, seleção múltipla é bloqueada antes de qualquer PATCH. Movimento individual por menu e arrasto continua no mesmo motor.
3. **Atividades reais:** `GET /api/funil2` consulta `crm_tarefas` sob a sessão/RLS existente e combina tarefas e visitas como objetos distintos.
4. **Conflito humano:** `versao_conflito` não faz retry silencioso; retorna 409 e o estado atual para revisão humana.
5. **Erros honestos:** 401/403/409/422 preservam significado. Falha de tracking após mutação retorna reconciliação necessária. Falhas auxiliares de Sara, canal e configuração não são mascaradas como dado vazio.
6. **Acessibilidade:** o cartão não possui mais controles interativos aninhados; a ação de abrir é um controle irmão com foco visível. Alvos operacionais móveis corrigidos para no mínimo 44 px.
7. **Navegação mobile:** menu Mais reproduz Esteira de vendas, Painel gerencial, Configurações e Matriz de validação, respeitando o papel recebido pelo shell e sem duplicar Meu Dia/Agenda já presentes na barra inferior.
8. **Densidade do Kanban:** colunas de 304 px foram reduzidas para 240 px e o cabeçalho foi consolidado em uma linha, exibindo etapa, contagem, valor e ações sem a repetição anterior.
9. **Cartão acionável:** clique e teclado na superfície do cartão abrem a ficha; conversa, menu e selects continuam independentes, sem botão invisível sobreposto nem `role=button` com controles aninhados.

## Dados e segurança

- Nenhuma migration, tabela, policy, RLS ou RPC foi criada ou alterada.
- Nenhuma credencial, sessão simulada, fixture de produção ou `service_role` foi adicionada.
- Nenhuma mutação ou comunicação externa foi executada durante a validação.
- `crm_tarefas` é consultada com o mesmo cliente autenticado e as policies existentes.
- Os contratos de banco ainda necessários estão documentados separadamente em [especificacao-contratos-banco-pendentes.md](especificacao-contratos-banco-pendentes.md).

## Testes comportamentais adicionados

`tests/crm-pos-auditoria.test.mjs` cobre:

- semântica HTTP;
- ausência de retry automático em conflito humano;
- bloqueio de lote sem RPC atômica;
- combinação de tarefas e visitas;
- estado vazio real;
- vínculo de `crm_tarefas` ao lead original;
- impossibilidade de fechar só a cópia operacional;
- retorno 409 com estado atual;
- reconciliação após falha de tracking;
- falhas auxiliares visíveis.

## Gates locais

| Gate | Resultado |
|---|---|
| Teste pós-auditoria | 13/13 passou |
| `test:frontend` | 320/320 passou |
| Suíte local ampliada | 537/537 passou |
| Lint dos arquivos alterados | passou |
| Build completo | passou |
| `git diff --check` | passou |
| TypeScript global | dois erros preexistentes em `StudioModule.tsx:267-268`; nenhum erro do CRM |

## Limitação local de navegador

A rota local foi aberta no Chrome real, mas o ambiente local não possui a configuração pública do Supabase e exibiu `Configuração pública do Supabase não encontrada`. Não foi criado bypass nem foram copiadas credenciais para contornar essa proteção. A validação autenticada será feita no build publicado, em modo read-only para dados reais; mutações permanecem comprovadas pelos testes seguros.

## Publicação confirmada

- URL: `https://apecerto-erp.onrender.com/crm`
- Commit e build ativos: `337453e67503fc45076b7dadd24d28c74748dc9f`
- Confirmação: `/api/build` devolveu exatamente o hash acima após o último deploy.
- Rollback imediato preservado: `b24e319c0c13ba3ba5adb92b32091856f9342651`.
- Nenhuma migration, mudança de schema/policy/RPC, mutação de cliente real ou comunicação externa foi executada.

## Validação autenticada em produção

| Superfície/fluxo | Evidência e resultado |
|---|---|
| Shell do ERP | presente em `/crm`, sem shell duplicado |
| Desktop 1440 × 900 | seis colunas consultadas com 240 px; cinco etapas visíveis na superfície; documento sem vazamento horizontal |
| Desktop 1280 × 800 | colunas com 240 px; documento sem vazamento; faixa de ferramentas mantém uma linha com rolagem horizontal própria |
| Mobile 390 × 843 | documento sem vazamento horizontal; navegação inferior preservada; Sara não sobrepõe cartões/CTAs |
| Menu Mais | quatro destinos: Esteira de vendas, Painel gerencial, Configurações e Matriz de validação; sem duplicação de Meu Dia/Agenda |
| Alvos móveis | nenhum controle operacional medido abaixo de 44 px |
| Cartão → ficha | clique na superfície integral e teclado abrem a ficha; conversa/menu continuam independentes |
| Sete áreas | Atendimento, Histórico, Atividades, Negócios, Imóveis, Arquivos e Dados do lead navegadas individualmente |
| Teclado/foco | setas entre abas, `Esc` e retorno do foco ao cartão passaram |
| Atividades | contagem e estado vazio refletem tarefas + visitas; link para Agenda canônica disponível |
| Ganho/Perdido/Restaurar | nenhuma ação é simulada; a ficha informa a indisponibilidade e direciona à Esteira canônica |
| Lote | ao selecionar dois cartões, a confirmação de movimento é bloqueada antes da rede e explica a ausência de transação atômica |
| Console | passagem final sem erros ou avisos novos |
| Rede/mutações | passagem produtiva foi read-only; não houve POST/PATCH/PUT/DELETE nem disparo de WhatsApp/D-API pela validação. Os caminhos mutáveis foram verificados na suíte segura |

Os estados de erro, 403, conflito humano, fonte auxiliar indisponível e offline/cache foram validados por harness/testes, sem induzir falhas nem impersonar perfis em produção. A sessão produtiva disponível era Admin; a matriz de autorização dos outros papéis ficou coberta pelos contratos e testes existentes, não por impersonação insegura.

## Evidências sanitizadas

- [Desktop 1440 — shell, cabeçalho e estado de carregamento](evidencias/producao-1440-topo-sanitizado.png)
- [Desktop 1280 — shell, cabeçalho e estado de carregamento](evidencias/producao-1280-topo-sanitizado.png)
- [Mobile 390 — topo e chips de etapa](evidencias/producao-390-topo-sanitizado.png)
- [Mobile 390 — menu Mais](evidencias/producao-390-menu-mais.png)

As capturas desktop sanitizadas registram deliberadamente o estado de carregamento para não persistir nomes e dados pessoais reais. A validação pós-carregamento foi feita no DOM autenticado: 205 cartões estavam presentes, a ficha e suas sete áreas foram percorridas e as medidas acima foram coletadas. A extensão de captura manteve um frame anterior ao carregamento no recorte; esse limite de evidência não foi mascarado como captura carregada.

## Reauditoria independente — mesma rubrica

| Dimensão | Peso | Nota |
|---|---:|---:|
| A. Operação comercial e motores canônicos | 2,5 | 1,65 |
| B. Integridade de dados e atividades | 2,0 | 1,65 |
| C. Paridade visual e clareza | 1,7 | 1,35 |
| D. Segurança, RLS e erros honestos | 1,2 | 1,00 |
| E. Testes e engenharia | 1,0 | 0,75 |
| F. Acessibilidade e responsividade | 0,8 | 0,72 |
| G. Desempenho, PWA e observabilidade | 0,8 | 0,40 |
| **Total** | **10,0** | **7,52; nota publicada: 7,5/10,0** |

A evolução defensável é de **5,0 para 7,5**, sem arredondamento para cima. Aplica-se teto de **8,0** enquanto fechamento/restauração, Desfazer persistente e movimento em lote atômico não tiverem contrato canônico transacional. Esses fluxos não foram deixados quebrados nem simulados: estão explicitamente bloqueados/delegados.

## Bloqueios restantes para chegar a 9,5+

1. contrato transacional canônico para Ganho, Perdido e Restaurar, conciliando negócio oficial, Funil, Esteira, totais e histórico;
2. snapshot persistente e auditável para Desfazer, com idempotência e conflito humano;
3. RPC/endpoint transacional para lote atômico;
4. paginação/agregação da carteira grande e telemetria de desempenho;
5. testes renderizados adicionais e validação live por Corretor/Gestor com contas sanitizadas.

A proposta técnica, rollback, segurança e testes dos três contratos de banco estão em [especificacao-contratos-banco-pendentes.md](especificacao-contratos-banco-pendentes.md). Ela é somente especificação e exige autorização separada antes de qualquer migration/RPC.
