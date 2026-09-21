# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `59a62f1c27d1069b9c07a723041b91d5dac72be2`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Iniciar negociação não habilita mais envio após preparação incompleta da Esteira.
- Decisão: exigir `products`, `solicitacoes` e `processes` como arrays; erro de preparação desabilita explicitamente o submit.
- Arquivos: `app/features/funil-2/IniciarNegociacaoModal.tsx`, `tests/crm-funcoes-canonicas.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `{}` com “Enviar para aprovação” habilitado; o teste falhou primeiro; depois da correção, alerta e botão desabilitado substituem o falso estado, enquanto o contrato válido preserva produto e envio disponível.
- Produção: `59a62f1c` publicado e confirmado; Adicionar cliente real continuou abrindo com responsável selecionado.
- Risco: baixo; nenhum PATCH foi executado no harness ou em produção.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
