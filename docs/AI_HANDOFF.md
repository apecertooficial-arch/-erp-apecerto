# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `e5aaa1e0`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a edição de dados do lead não confirma mais sucesso quando o servidor responde HTTP 200 sem devolver a identidade persistida e sua versão.
- Decisão: exigir `lead.nome` e `lead.atualizado_em` antes de atualizar o estado local; resposta incompleta preserva o formulário e usa o alerta já existente.
- Arquivos: `app/features/funil-2/LeadDataEditor.tsx`, `tests/crm-funcoes-canonicas.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu o falso sucesso com `200 {}`; o teste falhou primeiro; depois da correção, a resposta incompleta mostra erro e a resposta completa confirma o nome devolvido.
- Produção: `e5aaa1e0` publicado e confirmado; o agendamento real abriu a seleção de data e horário sem erro e nenhuma visita foi confirmada.
- Risco: baixo; a validação de escrita ocorreu apenas no harness local, sem alterar dados reais.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
