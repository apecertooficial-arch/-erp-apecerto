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
