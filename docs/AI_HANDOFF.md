# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `97244582`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: uma versão nova do PWA não recarrega por cima de texto ainda não salvo em editores inline sem `aria-modal`.
- Decisão: qualquer evento real de `input` ou `change` troca a recarga automática pelo aviso com botão; perder um rascunho é pior que pedir a recarga depois de salvar.
- Arquivos: `app/components/RegistroPwa.tsx`, `tests/pwa.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o contrato falhou primeiro; no navegador real, um rascunho inline permaneceu após `controllerchange` e o aviso “Versão nova já instalada” apareceu; testes dirigidos e lint passaram.
- Limitação visual: o controlador desta sessão manteve viewport fixo em 1280 px e recusou emulação móvel; a lógica validada é independente de layout.
- Produção: `97244582` publicado e confirmado antes desta fatia.
- Risco: baixo; depois de qualquer edição o aplicativo pode esperar um clique adicional para recarregar, mesmo que aquela edição já tenha sido persistida.
- Próximo passo: executar o build final, publicar esta fatia, validar a aplicação real sem mutações e seguir para a próxima falha P0/P1 comprovada.
