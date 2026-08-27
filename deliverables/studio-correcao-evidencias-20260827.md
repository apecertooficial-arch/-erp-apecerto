# ApêCerto Studio — correção verificável

## Alterações executadas

- Board: filtro visível de template, selects com valores canônicos (`feed`, `carousel`, `story`, `reel` e status persistido), filtros de prazo/responsável/revisor e abertura com `campaign` + `piece` no deep link.
- Comentários: opções geradas pela estrutura da versão (slides/stories/cenas), validação local e no endpoint de formato/índice, persistência com `piece_version_id` e resolução/reabertura escopada por `organization_id`.
- Canva: retorno exige `schema_version`, `piece_id`, `base_version_id`, dimensões compatíveis e assets autorizados pelo snapshot do ERP antes de criar nova versão.
- Testes de dados: filtros do board, agregação dos sete indicadores e validação de índices de slide/cena foram executados com fixtures em memória; não são testes por regex.

## Evidências

- Suíte completa: **491/491 aprovados**, `node --test tests/*.mjs`.
- Suíte Studio/regressões direcionadas: **59/59 aprovados**.
- Build de produção: concluído com sucesso pelo Vinext.
- ESLint dos arquivos alterados: 0 erros; apenas 2 avisos preexistentes de funções legadas ainda declaradas em `StudioModule.tsx`.

## Limitações honestas

- Não foi feito deploy, migration remota ou publicação real nesta rodada.
- Não foi possível executar navegador autenticado/screenshot neste ambiente porque o runtime de automação visual não está disponível; portanto não há afirmação de validação visual de sessão real.
- O fluxo Canva agora valida e persiste retorno; a tela ainda precisa de uma etapa visual explícita de preview/diff antes do clique final de importação para cumprir integralmente esse requisito de UX.

## Homologação da URL atualmente publicada

- URL: https://apecerto-erp.onrender.com/studio
- Sessão autenticada existente abriu o Studio e carregou as campanhas reais de demonstração AP0358 e AP0348.
- AP0358 foi aberto no construtor; foram observados os quatro formatos (Feed, Carrossel, Stories e Reel), seleção de modelo, sandbox determinístico e painel de revisão.
- Evidências visuais: `studio-production-desktop.png` e `studio-production-mobile.png`.
- A URL publicada ainda serve o build `7deaf82535eed2c22db3db5d2ac76be5553419bd`, anterior ao commit local `19dea90`; portanto a homologação publicada não comprova as alterações deste commit.
- Migrations do Studio de catálogo e colaboração aparecem ausentes na lista remota; não foram aplicadas porque o código correspondente ainda não está publicado e o ambiente local não possui as variáveis públicas do Supabase para validação ponta a ponta.

## Atualização de publicação

- As duas migrations aditivas foram aplicadas com sucesso no projeto `diaegvfveqezispcthwk`.
- O commit foi enviado à branch `main` (merge `ef87646`, contendo `19dea90`).
- O serviço Render não atualizou o build após o período de polling; a URL continuou retornando `7deaf82535eed2c22db3db5d2ac76be5553419bd`. O gatilho/controle de deploy do Render não está exposto neste ambiente, portanto não foi possível disparar ou confirmar o deploy.

## Homologação pós-deploy

- Build confirmado na URL: `1360df56e030dd0bfbee89479827d1478a60a55f`.
- Sessão autenticada abriu `/studio` sem erro.
- AP0358 e AP0348 carregaram no construtor; ambos exibem os quatro formatos e a biblioteca visual.
- Board, filtros de template e deep link `campaign + piece` observados em produção.
- Métricas exibiram filtros de imóvel/template/formato/período e estado vazio honesto.
- Calendário exibiu modos mês/semana/lista; Copilot mostrou sandbox sem custo e proteção factual.
- Evidências novas: `studio-production-desktop-new.png` e `studio-production-mobile-new.png`.
- Nenhuma publicação real, aprovação operacional ou chamada paga foi executada.
