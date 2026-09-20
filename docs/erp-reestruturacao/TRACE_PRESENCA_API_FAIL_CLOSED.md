# Trace — Presença fail-closed sem retirada indevida da fila

Atualizado em: 2026-09-20
Estado: pacote de aplicação revalidado para promoção; produção ainda não alterada

## Falha reproduzida

O polling do aplicativo não verificava o status HTTP nem a presença do campo
`no_escritorio_ip`. Uma resposta `401`, `502` ou incompleta era convertida em
`false`; em seguida, o componente chamava a saída da distribuição. Portanto,
uma oscilação de API podia ser interpretada como prova de que o corretor estava
fora do escritório e iniciar uma mutação operacional.

A API também convertia falha de `presenca_ip_confere` em `false`, ignorava erro
ao listar corretores da configuração e devolvia sucesso na saída mesmo quando
`presenca_derrubar` não confirmava `ok: true`.

## Correção local

- o aplicativo só decide dentro/fora quando recebe resposta HTTP válida e um
  booleano explícito;
- erro, ausência do campo ou resposta incompleta permanece estado desconhecido
  e não chama `/api/presenca` com `POST`;
- falha da conferência de IP é propagada como falha técnica sanitizada;
- configuração falha se a RPC ou a lista obrigatória de corretores falhar;
- saída da distribuição exige `ok: true`; qualquer outro resultado vira `409`
  `presenca_nao_alterada`;
- respostas e logs não incluem IP, payload ou mensagem SQL.

## Evidência

- 13/13 testes dirigidos de API, elegibilidade, IP e distribuição nesta base;
- 39/39 contratos das APIs promovidas e 479/479 no gate frontend atual;
- reprodução independente sobre o `main` de Permissões
  `9bea0a83d437dc2289f3d8e7aa245fd5206ccac5`;
- typecheck, lint focado e build completo;
- navegador real sanitizado em 1280 × 720 e 390 × 844: uma resposta `502`
  produziu apenas leituras GET, nenhum `POST /api/presenca`, nenhum erro de
  console e nenhum overflow horizontal.

O POST bloqueado para `wa_v7_minha_presenca` observado no harness pertence à
leitura inicial do cliente Supabase sintético; ele não é o comando de saída.
O comando operacional `/api/presenca` não foi chamado.

## Limites

O teste de navegador usou fixtures sanitizadas e bloqueou toda mutação. Ainda é
necessário validar o mesmo build com sessão real controlada depois da promoção.
Nenhuma RPC, migration, configuração de IP, fila ou dado produtivo foi alterado.

## Gate visual incorporado

Antes desta promoção, a validação real da tela de Permissões encontrou a
navegação lateral comprimindo o conteúdo no celular. O pacote também inclui a
correção responsiva, com navegação e conteúdo empilhados abaixo de 900 px e
controles de nível quebrando em linhas legíveis. O contrato visual foi incluído
na suíte antes da correção e integra o total de 479 testes acima.
