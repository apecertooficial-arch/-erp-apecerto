# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `78cfc83a1eb2e32b2c14c992d0baa3742c9ec2c9`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a Ajuda móvel não oferece mais atalhos para `Agentes de IA`, `Automações` e `Auditoria`, módulos declarados exclusivos do desktop.
- Decisão: manter CRM, Agenda e Configurações no celular e ocultar somente os cartões e o bloco de auditoria incompatíveis abaixo de 900 px.
- Arquivos: `app/features/system/HelpWorkspace.tsx`, `app/styles/tela-suporte-financiamento.css`, `tests/erp-modulos.test.mjs`.
- Verificações: produção em 390 px comprovou os três atalhos indevidos; o teste falhou primeiro sem a classificação; 71 testes direcionados e lint passaram; build Vinext passou.
- Produção: `78cfc83a` publicado e confirmado; `Histórico` fica invisível na ficha de Produtos em 390 px e visível em 1280 px, sem erros de console.
- Risco: os três recursos continuam integralmente disponíveis na Ajuda desktop; o app móvel perde apenas destinos sem interface própria.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
