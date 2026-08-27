# Fechamento da fatia Studio — board, calendário e métricas

## Entregue

- `StudioManagerBoard`: filtros controlados por campanha, formato, status e responsável; lista real de peças, prazo, pendência e deep link para o construtor.
- Membros da organização carregados pela API e usados em seletores de responsável/revisor com nome e papel; estado “Sem responsável” explícito.
- `StudioCalendar`: modos mês/semana/lista, eventos arrastáveis, confirmação de mudança, timezone America/Sao_Paulo e ação `moveSchedule` com detecção de conflito 409.
- Comentários versionados no workspace, com contexto de peça/versão e timeline; tarefas de colaboração persistidas.
- `StudioMetricsDashboard`: filtros de campanha/formato, agregação de alcance/impressões/cliques e estado vazio honesto sem Meta.
- Canva: exportação inclui peças, versões, assets autorizados, dimensões e manifest; retorno JSON é validado e salvo como nova versão via `importCanvaPackage`.
- Regressões históricas corrigidas sem relaxar segurança.

## Evidências

- Suíte completa: 487/487 testes verdes.
- Suíte Studio: 18/18 verdes.
- Build Vinext: verde.
- Lint dos arquivos Studio: verde.
- Projeto Supabase principal confirmado pelo conector: `diaegvfveqezispcthwk` (ACTIVE_HEALTHY).
- Sem migration remota, deploy ou publicação nesta rodada, conforme instrução.
- Regressão completa executada novamente: 487/487 verdes; Studio 18/18; build verde.
- Teste visual automatizado foi tentado no servidor local, mas o runtime Playwright/conector de navegador não está disponível neste workspace; nenhum screenshot foi inventado.

## Limitação de validação autenticada

A sessão autenticada de produção permanece no build anterior (`5406cb0`); como não houve deploy, a jornada nova foi validada por contratos, fixture efêmera e build local, sem alegar persistência remota que não foi executada.
