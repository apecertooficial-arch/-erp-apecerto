# CRM — autoridade visual única e validação real

Data: 2026-09-21
Branch: `codex/crm-sara-determinismo-20260921`

## Falha reproduzida

O CRM possuía duas autoridades visuais concorrentes:

- `app/layout.tsx` importava `app/styles/funil-2.css`, congelada na restauração
  de 29/08;
- `FunilEntry.tsx` injetava em runtime `public/funil-web-sexta.css` somente no
  desktop;
- o arquivo público era uma cópia byte a byte de `app/styles/funil.css`, que
  continuou recebendo as correções posteriores;
- o harness importava a cópia mais nova sem reproduzir a rota `/crm`, portanto
  podia mostrar um CRM melhor que a autoridade declarada pelo layout e com o
  item errado do menu ativo.

Ao validar somente a folha declarada no layout, filtros, rótulos e ações do
Kanban apareceram sem a hierarquia prevista. A folha antiga também não cobria
83 classes presentes no markup atual; `funil.css` deixou apenas 11 classes sem
regra própria, já ausentes da autoridade anterior ou cobertas por folha
específica.

## Correção local e reversível

- `app/layout.tsx` importa diretamente `app/styles/funil.css`;
- a injeção de `/funil-web-sexta.css` foi removida de `FunilEntry.tsx`;
- o harness usa a mesma folha e normaliza a rota para `/crm`;
- as regras das trilhas foram incorporadas à própria `funil.css`, eliminando
  a última cascata paralela do CRM e mantendo rótulos com pelo menos 11 px;
- controles móveis efetivamente acionáveis possuem pelo menos 44 px;
- erro móvel usa `role="alert"`; estados vazios usam `role="status"`;
- textos do seletor de horários não ficam abaixo de 11 px.

`app/styles/funil-2.css`, `app/styles/funil-trilhas.css` e
`public/funil-web-sexta.css` permanecem preservados como legados não
carregados. A remoção física só deve ocorrer depois da validação da fatia
publicada e do rollback identificado.

## Evidência

- testes dirigidos do CRM e mobile: 56/56 e 39/39;
- regressão local completa: 1031/1031;
- TypeScript: sem erro;
- lint dos arquivos alterados: sem erro;
- build Vinext: concluído, rota `/crm` incluída;
- navegador real desktop 1440×900:
  - rota e menu `/crm` coerentes;
  - trilhas visualmente separadas e tipografia computada em 11 px;
  - uma única leitura GET de `/api/funil2`;
  - zero overflow e console limpo;
- navegador real 390×844:
  - zero alvo acionável abaixo de 44 px;
  - zero overflow e console limpo;
  - erro anunciado como alerta;
- vazio desktop: zero cards e contagens zeradas explícitas;
- acesso negado: zero cards e zero requisições ao CRM.

## Rollback

Reverter a troca de import no layout e restaurar o bloco `<style>` em
`FunilEntry.tsx` recompõe o comportamento anterior. Nenhuma API, migration,
dado ou integração externa foi alterada nesta fatia.
