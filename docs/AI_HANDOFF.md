# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `63bfc692a2a500f086c8d19d4319abdf0d24a7ed`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Adicionar cliente não fica mais bloqueado sem explicação quando as opções chegam incompletas.
- Decisão: exigir `corretores` como array no limite da API e reutilizar o alerta já presente no modal.
- Arquivos: `app/features/funil-2/AdicionarClienteModal.tsx`, `tests/crm-funcoes-canonicas.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu o responsável vazio e botão bloqueado após `{}`; o teste falhou primeiro; depois da correção, aparece alerta e o contrato válido seleciona o próprio corretor.
- Produção: `63bfc692` publicado e confirmado; o Novo negócio pesquisou clientes reais por “Mar” sem alerta.
- Risco: baixo; lista legitimamente vazia continua válida quando a API devolve `corretores: []`, embora a criação permaneça bloqueada por ausência real de responsável.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
