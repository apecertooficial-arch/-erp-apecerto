# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `6b114b7d27486c653807a96a3a51cb663df9d901`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a ficha de Produtos não oferece mais no celular o atalho `Histórico` para a Auditoria exclusiva do desktop.
- Decisão: ocultar somente os dois links de histórico abaixo de 620 px; a Auditoria e o acesso à trilha continuam íntegros no desktop.
- Arquivos: `app/features/products/ProductDetail.tsx`, `app/styles/produtos-v3-detail.css`, `tests/produtos-operacao-10x.test.mjs`.
- Verificações: teste falhou primeiro porque nenhuma ficha distinguia o atalho; 39 testes direcionados e lint passaram; build Vinext passou; produção em 390 px comprovou previamente que a ficha expunha `/auditoria`.
- Produção: `6b114b7d` publicado e confirmado; o Meu Dia móvel não expõe mais `/equipe`, enquanto a navegação desktop de equipe permanece disponível, sem erros de console.
- Risco: no celular, o histórico operacional deixa de ser acionável até Auditoria ganhar interface mobile; no desktop, nada muda.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
