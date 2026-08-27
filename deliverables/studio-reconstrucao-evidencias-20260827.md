# Evidências — reconstrução operacional do ApêCerto Studio

Data: 27/08/2026

## Escopo executado

Fatia vertical das Fases 1–6 no módulo nativo /studio, sem deploy nesta rodada e sem publicação no Instagram.

## Implementação

- Deep links por query string: tab, campaign e piece.
- Persistência de briefing versionado em social_briefs.
- Persistência de variações em social_piece_versions, com parent_version_id, checksum e change_scope.
- Leitura de briefs e templates no GET /api/studio.
- Ações saveBrief e createVariant no POST /api/studio.
- Briefing/estratégia editável no workspace.
- Seletor de cinco modelos editoriais.
- Catálogo explícito de geradores: Feed, Carrossel, Stories e Reel.
- Comando livre e comandos rápidos para variações.
- Edição demonstrativa de headline, legenda, CTA, slides e cenas.
- Histórico persistido para variações quando a sessão autenticada executa a ação.
- Sandbox explicitamente rotulado como sem custo e não publicável quando IA externa/orçamento estão bloqueados.

## Arquivos alterados

- app/features/studio/domain.ts
- app/features/studio/StudioModule.tsx
- app/api/studio/route.ts
- app/styles/apecerto-studio.css
- app/studio-visual-test/page.tsx
- tests/apecerto-studio.test.mjs

## Testes

- pnpm run test:studio: 53 testes aprovados.
- pnpm run build: aprovado.
- git diff --check: aprovado.
- Console do navegador: sem erros na validação anterior do Studio publicado.

## Validação visual e comportamental

Fixture /studio-visual-test:

1. Abriu campanha de demonstração.
2. Entrou no Construtor.
3. Selecionou modelo visual.
4. Ativou sandbox.
5. Exibiu briefing, estratégia, headline, legenda, CTA e estrutura do Reel.
6. Gerou variação por comando livre.
7. Validou layout desktop e mobile.

Ambiente publicado usado como referência de navegação: https://apecerto-erp.onrender.com/studio.

## Limitações honestas

- O Figma continua dependente de conexão/manifesto configurado.
- Canva ainda não possui API/credencial autorizada e não foi simulado.
- IA paga, renderer e Instagram permanecem fail-closed quando desativados.
- A persistência real de briefing/variação exige sessão autenticada com permissão editar; o fixture visual usa mutation handler determinístico.
- Esta rodada não fez deploy, migration remota, publicação ou aumento de orçamento.

## Critérios aceitos nesta fatia

- O Studio reconhece deep links.
- Briefing e estratégia têm edição e contrato persistido.
- Variações possuem contrato de versão, pai e checksum.
- Há escolha explícita de modelo e gerador.
- Carrossel e Reel possuem estruturas editoriais próprias.
- O sandbox não é apresentado como IA real nem como peça publicável.
