# Trace — apps por papel

Estado: aceite gerencial e CEO publicado; corretor ainda em prova

## Aceite produtivo de 24/09/2026

A validação foi somente leitura, em sessão administrativa existente. Nenhuma
conta foi personificada, nenhum cliente foi alterado e nenhum conteúdo da Sara
foi enviado.

No mobile, a Gestão do Dia carregou dados reais e exibiu ações vencidas,
clientes críticos, visitas sem feedback, pendências por responsável e os atalhos
de cobrança. A Agenda confirmou as filas de resultado pendente e concluído. A
Central de Comando apresentou a visão CEO com fontes reais, recorte, funil e
alertas operacionais. O mesmo painel foi aceito no desktop sem overflow
horizontal.

## Falha encontrada e corrigida

O aviso global de notificações ocupava a mesma faixa do botão flutuante da Sara
no mobile. Embora o botão estivesse desenhado, o alvo real do clique era o aviso.

A PR #297 moveu o aviso para terminar acima da Sara e adicionou uma regressão
direcionada. Depois do deploy `60397410`:

- o endpoint `/api/build` respondeu com o hash publicado;
- o aviso terminou 11 px acima do botão na viewport mobile;
- o centro do botão passou a atingir a própria Sara;
- o painel abriu com saudação, sugestões e campo de pergunta;
- a página permaneceu sem overflow horizontal;
- no desktop, a Central de Comando e o botão da Sara continuaram visíveis.

## Verificações

- teste direcionado: 23/23;
- TypeScript: aprovado;
- ESLint direcionado: aprovado;
- CI da PR #297: testes do frontend, contratos de privacidade, typecheck, lint e
  build aprovados;
- Render: build `6039741033dbe09cebc95a17210388d63539c1a9` confirmado.

## Limite honesto

O aceite do corretor exige uma sessão real desse papel para percorrer Meu Dia,
WhatsApp, busca, visitas e feedback. Uma sessão administrativa não comprova a
restrição nem a experiência do corretor. Criar credencial ou assumir a conta de
outra pessoa apenas para fechar o checklist não é evidência válida.
