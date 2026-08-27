# Camada de desenho do ERP (redesenho apêcerto)

Duas folhas, carregadas em sequência pelo `app/layout.tsx`, antes das folhas
`app-mobile-*`:

1. `redesign-apecerto.css` — shell (sidebar, topbar, abas), Início e CRM / Funil
   2.0.
2. `redesign-apecerto-produtos-financeiro.css` — Produtos (catálogo, ficha,
   captação), Financeiro (visão geral, vendas, caixa, ranking), ficha da venda,
   abas Indicações / Taxas / Marketing / Meus ganhos e Importar extrato.

## Regras de manutenção

- **Só visual.** Cor, tipografia, peso, borda, raio, sombra e respiro sobre
  classes que já existem. Nada de estrutura, dado ou função.
- **Substituição por cascata.** Cada regra reescreve o valor que `globals.css`
  ou `funil.css` definia para o mesmo seletor. Não duplique
  aqui o que já está igual lá.
- **Posição na cascata importa.** Antes de `app-mobile-aprovado.css` e
  `app-mobile-gestor.css`, para que o aplicativo no celular continue com a
  última palavra. Mover estes imports para o fim repinta o app do corretor.
- **Automações está fora do escopo.** Nenhum seletor pode alcançar
  `.automations-v2-shell`, `.original-automation-host` ou as classes internas do
  construtor. Aquela tela deve permanecer idêntica à publicada.
- **Reversão.** Comentar os dois imports no `layout.tsx` devolve o visual
  anterior por inteiro.
