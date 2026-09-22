# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `d96fac59`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: leitura, foto e salvamento do perfil só usam a resposta da RPC depois de validar usuário, corretor, instâncias e dados bancários.
- Decisão: compartilhar um validador puro e falhar fechado para `null`, objeto vazio ou coleções fora do contrato.
- Arquivos: `app/components/ProfilePanel.tsx`, `app/components/profile-data.ts`, `tests/profile-panel.test.mjs`.
- Verificações: o teste comportamental falhou primeiro com `{}`; payloads incompletos agora retornam `null`; o painel real de Samuel abriu com todos os campos usando o contrato atual; 13 testes dirigidos passaram e o lint não teve erros (permanece um aviso histórico de `<img>`).
- Produção: `d96fac59` publicado e confirmado antes desta fatia.
- Risco: baixo; resposta antiga ou intermediária fora do contrato deixa de quebrar o painel ou produzir “Perfil salvo com sucesso”.
- Próximo passo: executar o build final, publicar esta fatia, validar a aplicação real sem mutações e seguir para a próxima falha P0/P1 comprovada.
