# Contrato futuro — portal do proprietário

## Estado preservado agora

O ERP mantém `public.proprietarios.id` como identidade canônica do proprietário
no domínio e `public.empreendimentos.proprietario_id` como vínculo do imóvel. Os
detalhes privados de unidade permanecem em `private.unidade_proprietarios`.

Essas duas tabelas têm RLS habilitado e não concedem acesso direto a `anon` nem
a `authenticated`. O ERP atual lê ou altera PII somente pelas RPCs de Produtos,
que autorizam gestão ou o corretor captador. O catálogo público continua sem
nome, contato, instruções de acesso, captador ou IDs privados.

O vínculo `empreendimentos.proprietario_id` identifica uma pessoa no domínio;
ele não representa uma conta autenticada e não concede acesso por si só.

## Fora do escopo desta fase

- rota, tela ou API de portal;
- cadastro, convite ou recuperação de senha de proprietário;
- associação inferida entre e-mail/telefone e `auth.users`;
- policy que permita ao papel `authenticated` ler a tabela de proprietários;
- notificações, documentos, extratos, chamados ou edição pelo proprietário;
- preenchimento automático dos 12 vínculos privados legados ausentes.

## Gate obrigatório para uma fase futura

Antes de criar qualquer superfície para proprietário, uma decisão explícita deve
definir identidade, prova de posse/consentimento, vínculo privado com `auth.users`,
convite e revogação, escopo por imóvel/unidade, auditoria e retenção. A entrega
futura também deverá provar RLS com dois proprietários distintos, negar `anon`,
impedir acesso cruzado e manter o catálogo público sem PII.

Até esse gate, a fronteira correta é não existir portal e não existir grant de
tabela para usuários autenticados.
