# Fechamento técnico de Produtos — 27/08/2026

## 1. Resumo executivo e decisão

**Decisão: `BLOQUEADO`.**

O código local de Produtos, a integração local ERP → site e os controles estáticos de autorização foram corrigidos e passaram nas suítes relevantes. O bloqueio não é uma falha conhecida de compilação: é a ausência de uma instância Supabase local ou de homologação isolada, com schema real e três identidades sintéticas, necessária para provar RLS, grants, concorrência e a matriz autenticada pelo navegador.

Também não foi possível estimar com dados reais o lock e a duração do backfill de `midias`. A etapa de contração dos privilégios diretos de `public.proprietarios` foi preparada separadamente e, corretamente, não foi aplicada. Esses itens envolvem segurança, privacidade e integridade; por isso não podem ser convertidos em “apto” apenas com testes estáticos.

Nenhuma migration externa, deploy, push, merge, alteração de conta, alteração de dado real ou chamada de IA foi executada. Nenhuma foto ou dado de imóvel foi enviado a provedor externo.

### Resultado objetivo

- Produtos: **76/76 testes aprovados**.
- Frontend completo do ERP: **290/290 testes aprovados**.
- TypeScript do fluxo oficial de CI: **aprovado**.
- Lint do ERP: **aprovado**.
- Build do ERP: **aprovado**.
- Site: **91/91 testes e build/verificadores aprovados**.
- Suíte final renderizada do ERP: build aprovado e **6/7 testes aprovados**; a única falha é uma asserção antiga de CSS da Esteira/CRM, fora do escopo de Produtos e já ausente no commit-base.
- Navegador local: login e shell não autenticado carregaram com configuração sintética. A ficha autenticada de Produtos não foi alegada como validada, pois não existe banco/seed local seguro.

## 2. Repositórios, branches, commits e árvores

### Cópia canônica do ERP

| Campo | Valor |
|---|---|
| Caminho | `/private/tmp/apecerto-produtos-inteligente-erp2-20260826` |
| Remoto | `https://github.com/apecertooficial-arch/-erp-apecerto.git` |
| Branch | `codex/produtos-inteligente-20260826` |
| HEAD da branch | `0dd1182393a7a49124fef6085871e7a0a4e67f5c` |
| `origin/main` verificado | `764283c658dad852734d50790dc5f86d054cc470` |
| Divergência atual | `origin/main` contém um commit posterior, somente de Agenda mobile (`764283c`) |
| Estado | árvore modificada, sem commit, push ou merge |

A cópia foi escolhida porque contém conjuntamente a implementação de Produtos descrita no relatório anterior, a migration editorial/mídia/rascunhos, os testes novos e o histórico/remoto oficial. As outras cópias inspecionadas não reuniam esse conjunto.

Arquivos modificados ou não rastreados no ERP:

- `app/api/capture/route.ts`
- `app/api/product/route.ts`
- `app/features/products/CaptureWizard.tsx`
- `app/features/products/MoneyInput.tsx`
- `app/features/products/PendingMediaClassifier.tsx`
- `app/features/products/ProductDetail.tsx`
- `app/features/products/UnitWizard.tsx`
- `app/features/products/media-editorial.ts` (novo)
- `app/features/products/product-domain.ts`
- `app/features/products/quality.ts`
- `app/globals.css`
- `app/lib/supabase/database.types.ts`
- `supabase/migrations/20260826193000_produtos_editorial_midias_rascunhos.sql` (novo)
- `supabase/hardening/produtos_proprietarios_pos_deploy.sql` (novo, manual)
- `tests/produtos-arquitetura-v2.test.mjs`
- `tests/produtos-editorial-galeria.test.mjs` (novo)
- `tests/produtos-integridade.test.mjs`
- documentos em `docs/`.

### Cópia canônica do site

| Campo | Valor |
|---|---|
| Caminho | `/private/tmp/apecerto-produtos-inteligente-site-20260826` |
| Remoto | `https://github.com/apecertooficial-arch/apecerto-site.git` |
| Branch | `codex/produtos-seo-site-20260826` |
| HEAD e `origin/main` | `24c66a9299550b71635ac2d6285d6f8ba2dcb824` |
| Estado | quatro arquivos modificados, sem commit, push ou merge |

Arquivos modificados no site:

- `design/Site ApeCerto.dc.html`
- `supabase/functions/site-seo/index.ts`
- `tests/site-erp-feed.test.mjs`
- `tests/site-seo.test.mjs`

### Dependência de pasta temporária

As duas entregas ainda estão apenas em árvores de trabalho sob `/private/tmp`. Nada está publicado ou protegido por commit. Antes de qualquer homologação, o conjunto deve ser reaplicado sobre o `origin/main` atual, revisado e commitado em branches persistentes. O commit posterior do ERP é restrito a Agenda e não mostrou colisão de arquivo, mas a integração ainda precisa ser refeita e testada.

## 3. Alegação anterior × evidência atual

| Alegação anterior | Evidência atual | Resultado |
|---|---|---|
| Testes de Produtos estavam verdes | suíte específica repetida e ampliada para 76 casos | Confirmada e atualizada: 76/76 |
| Site tinha 91 testes verdes | suíte integral do site repetida | Confirmada: 91/91 |
| Builds passavam | builds oficiais do ERP e site repetidos | Confirmada |
| Unidade pronta é produto independente | ficha ativa usa `renderFocusedUnitDesign`, preço/mídia/aprovação da unidade e condomínio apenas como referência | Confirmada por código/testes; navegador autenticado pendente |
| Fotos privativas não herdam capa do condomínio | site e ERP usam galeria da unidade; áreas comuns aparecem separadas | Confirmada por contrato e testes |
| Captador edita AP0356/classe equivalente | autorização passou a usar `captador_corretor_id`, não o marcador legado `de_terceiros` | Confirmada estaticamente e por teste sintético; AP0356 real não foi acessado |
| Proprietário não vaza | payload público foi reduzido e leitura privada migrou para RPC autorizada | Confirmada estaticamente; RLS real pendente |
| Rascunho é privado | tabela `private`, revokes, RPC por `auth.uid()`, expiração e versão otimista | Confirmada estaticamente e por testes; concorrência DB real pendente |
| Preço suspeito não é corrigido em massa | RPC é somente leitura e restrita à gestão ativa | Confirmada |
| Suíte integral tinha duas falhas externas | a asserção de CSS do CRM foi reproduzida; a migration de funil ausente não foi reproduzida e os arquivos atuais existem | Parcialmente desatualizada; uma falha externa atual |
| Validação pública equivalia à homologação | não prova RLS nem os três perfis | Rejeitada como evidência suficiente |

## 4. Achados novos por severidade

### Bloqueadores

| Arquivo/área | Cenário | Impacto | Evidência/ação |
|---|---|---|---|
| Ambiente Supabase | não há seed, schema local completo, CLI Supabase, Docker ou Postgres utilizável nesta cópia | impossível provar RLS/RPC/grants e três sessões sem tocar em ambiente externo | inspeção do repositório e ferramentas; matriz preparada no Portão A |
| Migration de `midias` | volume, bloat e locks reais desconhecidos | backfill, constraints e índice podem ultrapassar 60 s ou bloquear escrita | migration possui `lock_timeout=5s` e `statement_timeout=60s`; preflight obrigatório |

### Altos corrigidos localmente

| Arquivo | Cenário | Impacto anterior | Correção/evidência |
|---|---|---|---|
| `app/api/product/route.ts` e migration | API carregava `proprietarios (*)` e rotas escreviam diretamente na tabela | risco de PII chegar a usuário não autorizado ou de regra divergir entre API/RLS | leitura e gravação por RPC com gestão ativa ou captador; outro corretor recebe dados redigidos |
| API, migration e Storage | edição/exclusão dependiam de `de_terceiros` | captador legítimo podia perder edição de fotos/unidade, caso AP0356 | autoridade canônica por `captador_corretor_id`; teste cobre marcador legado incorreto |
| Migration de mídia | troca de capa em duas operações | falha parcial podia deixar zero ou múltiplas capas | RPC atômica `produto_midia_definir_capa` |
| Rascunho | último autosave sobrescrevia edição concorrente | perda silenciosa de dados | campo `versao`, comparação otimista e HTTP 409 com mensagem humana |

### Médio corrigido localmente

| Arquivo | Cenário | Impacto anterior | Correção/evidência |
|---|---|---|---|
| `ProductDetail.tsx` | duas fichas antigas, invisíveis com `false &&`, ainda eram compiladas | o build comum passava, mas o typecheck oficial de CI falhava | blocos mortos removidos e testes apontados para a ficha v3 ativa; `tsc` passou |
| upload | falha após Storage e antes do banco | objeto órfão | compensação remove apenas o upload falho |
| valores | colagem em milhares/valor cheio | risco de multiplicar preço por mil | confirmação visual e validação de API testadas em formatos exatos |

### Pendências não corrigidas por restrição

- Branch do ERP está um commit de Agenda atrás do `origin/main`; deve ser integrada antes do commit final.
- Validação visual autenticada em 1440/1024/768/390 e zoom de 200% não foi realizada, pois não há sessão sintética conectada a banco isolado.
- A contração de privilégios diretos de `public.proprietarios` está preparada, mas só pode ocorrer depois de ERP novo implantado e validado.

## 5. Migration, RLS, Storage e contrato público

Migration auditada: `supabase/migrations/20260826193000_produtos_editorial_midias_rascunhos.sql`.

| Item da migration | Evidência | Risco | Verificação executada | Correção | Estado |
|---|---|---|---|---|---|
| Timeouts | `lock_timeout 5s`, `statement_timeout 60s` | abortar em base grande | inspeção estática | manter e medir antes | Pendente de DB isolado |
| Campos editoriais/SEO | colunas em empreendimento e unidade, todas progressivas | clientes antigos precisam tolerar colunas extras | tipos, API, site e testes | view preserva prefixo e acrescenta campos | Aprovado localmente |
| Ordem/alt/categoria de mídia | `ordem`, `alt_text`, categoria e constraints | backfill atualiza todas as linhas de `midias` | revisão linha a linha e testes | ordem determinística com `row_number()` | Pendente de estimativa real |
| Índice da galeria | índice por produto/unidade/ordem | criação não concorrente pode bloquear | inspeção | executar em janela; abortar se relação exceder limite do Gate A | Pendente |
| Capa | `produto_midia_definir_capa` transacional | escalada ou capa inválida | grants/revokes, `search_path=''`, testes | autorização por gestão/captador e escopo produto/unidade | Aprovado estaticamente |
| Reordenação | RPC valida conjunto, duplicatas e pertencimento | ordem forjada por outro usuário | inspeção e teste | captador canônico/gestão ativa | Aprovado estaticamente |
| Rascunho privado | tabela no schema `private`, RLS/revokes e RPC por usuário | isolamento depende do banco real | inspeção/testes de contrato | expiração, limite de payload, versão otimista | Pendente de RLS real |
| Autosave | RPC só grava rascunho | publicação acidental | inspeção API/UI/teste | nenhuma transição de publicação | Aprovado localmente |
| Proprietário de produto | RPCs `ler`, `captacao_resolver`, `salvar` | PII por acesso direto legado | revisão de API e grants | API não seleciona nem grava tabela diretamente | Aprovado localmente |
| Proprietário de unidade | RPC privada filtra por captador ou gestão ativa | outro corretor obter PII | teste sintético e inspeção | resposta redigida fora da autorização | Pendente de RLS real |
| Exclusão canônica | wrapper valida captador e preserva regra de histórico | remoção indevida | inspeção/testes | transação e rollback integral em falha | Aprovado estaticamente |
| Auditoria de preços | `produto_precos_suspeitos()` | correção automática ou acesso de corretor | busca por DML e grants | somente leitura e gestão ativa | Aprovado estaticamente |
| View pública | `site_produtos` com `security_invoker=true` | campos privados ou falta de grants de coluna | inspeção da projeção e site | somente editorial, SEO, disponibilidade e mídia pública | Aprovado estaticamente; DB pendente |
| Grants anônimos | colunas mínimas em empreendimento, unidade e mídia | view falhar ou abrir coluna demais | comparação com colunas usadas pela view | incluída `categoria`; nenhuma PII | Aprovado estaticamente |
| Security definer | todas as funções novas têm `search_path=''`, revokes e grants explícitos | escalada via resolução de nome ou EXECUTE público | auditoria de todas as ocorrências | privilégios mínimos por função | Aprovado estaticamente |
| Storage | políticas de alteração/exclusão por captador/gestão | mídia alheia forjada | inspeção e teste de contrato | retirado o vínculo à flag legada | Pendente de Storage real |
| Contração de `proprietarios` | script manual em `supabase/hardening/` | aplicar antes do ERP novo quebraria versão antiga | revisão da ordem de rollout | etapa pós-ERP revoga acesso direto e habilita RLS | Preparado, não aplicado |
| Rollback | schema é aditivo, mas novas escritas podem usar campos novos | `DROP COLUMN` destruiria dados | análise de compatibilidade | preferir roll-forward; não remover colunas após uso | Definido no runbook |

Não há interpretação nem correção automática de preços históricos. A IA está apenas representada por metadata opcional; não existe chamada externa ativa neste conjunto.

## 6. Resultado por perfil

### Corretor captador

**Validado localmente por funções puras, API/migration e testes:** vínculo por `captador_corretor_id`; edição de ficha e mídia; leitura do próprio proprietário; criação sem condomínio; miniaturas e classificação; validação monetária; bloqueio editorial; rascunho sem publicar; limpeza de órfão.

**Não comprovado:** login real, recarga de rascunho, persistência da ordem/capa após refresh e resposta direta de RLS/Storage em banco isolado.

### Corretor não captador

Regra existente identificada: pode consultar o catálogo e dados operacionais liberados, mas não pode obter proprietário, assumir captação, editar a unidade/mídia do captador ou reordenar por chamada forjada.

**Validado localmente:** `canViewUnitOwner` nega; API redige proprietário; RPCs e policies verificam captador; payload público não contém PII.

**Não comprovado:** tentativa autenticada real via REST/RPC/Storage com JWT sintético de outro corretor.

### Gestor

**Validado localmente:** papel de gestão precisa estar ativo; lê/edita proprietário; pode organizar mídia; auditoria de preços é somente leitura; ações de aprovação/publicação/despublicação são separadas; nenhuma correção em massa.

**Não comprovado:** transições completas em sessão real e confirmação do efeito na view pública após commit do banco.

### Isolamento e concorrência

- Versão otimista impede sobrescrita silenciosa de rascunho e devolve conflito 409.
- Troca de capa é atômica.
- Reordenação rejeita IDs duplicados/fora do escopo.
- Falha após upload remove somente o objeto novo que ficou órfão.
- Persistência e corrida sob transações reais continuam reservadas ao Gate A.

## 7. Validação visual, responsiva e acessibilidade

O design foi comparado com o código real e com o ZIP oficial. A implementação usa Quicksand, neutros quentes, laranja como ação principal, roxo assistivo, grade compacta e ícones SVG funcionais, sem introduzir uma segunda camada de tokens.

Validações executadas:

- build real do ERP com a ficha v3 ativa;
- testes de composição da ficha, galeria, setas, z-index, mobile e alvos de toque;
- login local carregado no navegador com URL/chave sintéticas, sem sessão externa;
- remoção das duas fichas antigas invisíveis que confundiam o compilador e os testes;
- nomes acessíveis para fechar, galeria, edição e modais; foco/touch cobertos pela suíte geral.

Validações ainda obrigatórias no Gate A: Produtos autenticado em 1440, 1024, 768 e 390 px, zoom 200%, teclado, estado vazio, erro parcial, rede instável, upload com retentativa e modais destrutivos. Não há screenshot com dado real neste relatório.

## 8. Arquivos alterados e motivos

| Grupo | Arquivos | Motivo |
|---|---|---|
| APIs | `app/api/capture/route.ts`, `app/api/product/route.ts` | perfil ativo, RPC de proprietário, autorização canônica, mídia atômica, conflito de rascunho |
| Cadastro | `CaptureWizard.tsx`, `UnitWizard.tsx`, `MoneyInput.tsx`, `PendingMediaClassifier.tsx` | autosave versionado, confirmação de preço, miniaturas e metadata |
| Ficha | `ProductDetail.tsx` | unidade soberana, custos/mídia próprios, edição por captador/gestão e remoção do legado morto |
| Domínio | `product-domain.ts`, `quality.ts`, `media-editorial.ts` | perfis sintéticos, qualidade editorial e alt text |
| Tipos/estilo | `database.types.ts`, `globals.css` | contrato novo e pequenos estados visuais |
| Banco | migration nova e hardening manual | expansão compatível, RPCs/RLS/grants e contração pós-deploy |
| Testes ERP | três arquivos de Produtos | segurança, integridade, galeria, rascunho e ficha ativa |
| Site | HTML de design, função SEO e dois testes | editorial/SEO da unidade, separação de galerias e contrato público |

## 9. Testes executados

| Verificação | Resultado |
|---|---|
| 10 arquivos de testes de Produtos via `node --test` | **76/76** |
| `pnpm run test:frontend` | **290/290** |
| `pnpm exec tsc --noEmit --incremental false` | aprovado, sem erro |
| `pnpm run lint` | aprovado |
| `pnpm run build` | aprovado |
| `node --test tests/*.test.mjs` no site | **91/91** |
| `scripts/build-site.mjs`, `rotas.mjs`, `verifica-design.mjs` | aprovados; pacote `68c0acc41c074f83`, design `e68c5a7e2bd2`, seis rotas |
| `git diff --check` em ERP e site | aprovado |
| `pnpm test` do ERP | build aprovado; **6/7**, uma falha externa de CRM |

Os comandos foram executados com Node/Pnpm local já disponível no ambiente. Não houve download, rede para dados, banco externo ou IA.

## 10. Baseline externo a Produtos

1. **Reproduzido — CSS da Esteira/CRM.** `tests/rendered-html.test.mjs`, teste “a Esteira preserva fotos, tags e identidade dos cards”, espera `.crm-leads-table-v3 tbody tr.lead-tone-1{border-left-color:#ff6500!important}`. A regra não existe no `app/globals.css` do commit-base e o diff de Produtos não a removeu. Não foi corrigida por restrição de escopo.
2. **Histórico, não reproduzido — migration de funil ausente.** O relatório anterior citava um arquivo referenciado e ausente. Na árvore atual, as migrations referenciadas pelos testes de Funil existem e `pnpm run test:frontend` passou 290/290. Portanto ela não é uma falha atual comprovada e não foi usada para justificar o bloqueio.

## 11. Riscos e pendências remanescentes

1. Falta banco isolado com schema/volume representativo para replay da migration e prova de RLS/Storage.
2. Faltam três contas sintéticas e sessões concorrentes para a matriz autenticada.
3. Impacto do backfill/índice de `midias` não foi medido.
4. Hardening de `public.proprietarios` não pode ocorrer antes do ERP novo; enquanto não ocorrer, o estado do banco existente precisa ser medido no preflight.
5. A branch do ERP deve incorporar o commit atual de Agenda e ser retestada.
6. As alterações ainda não estão em commits persistentes.
7. AP0356 real não foi aberto nem alterado; a classe de falha foi coberta apenas com fixture sintética.
8. A experiência autenticada real nas larguras e estados exigidos continua pendente.

## 12. Runbook por portões

### Portão A — futura autorização de homologação

**Pré-condição:** autorização escrita exclusivamente para homologação e indicação de uma instância Supabase isolada, sem dados reais, com três contas sintéticas.

1. Criar branches persistentes a partir de `origin/main` atual; reaplicar os diffs do ERP e site; revisar conflito e commit final. Não usar diretamente `/private/tmp` como artefato de deploy.
2. Repetir 76 testes de Produtos, 290 testes frontend, typecheck, lint, builds, 91 testes do site e `git diff --check` nos commits exatos.
3. Registrar backup verificável da homologação e responsável pela restauração.
4. Executar preflight somente leitura:
   - versão e ordem das migrations;
   - `count(*)`, `pg_total_relation_size` e estimativa de linhas de `midias`;
   - quantidade de `ordem` nula/duplicada, capas múltiplas e paths órfãos;
   - grants/policies atuais de `proprietarios`, `unidades`, `midias`, Storage e view pública;
   - sessões/locks ativos e espaço disponível.
5. **Abortar antes da migration** se: não houver backup restaurável; schema divergir; existir DDL concorrente; `midias` não couber com margem no limite de 60 s; houver PII na projeção pública; ou as três identidades não estiverem prontas.
6. Aplicar somente a migration de expansão `20260826193000_produtos_editorial_midias_rascunhos.sql` na homologação autorizada. Capturar duração e erros sem registrar PII.
7. Verificar constraints, índice, view, grants, funções e contagens; confirmar que nenhum preço/publicação mudou.
8. Implantar o ERP de homologação pelo commit exato. Não aplicar ainda o hardening manual.
9. Executar matriz captador/não captador/gestor pelo navegador e por chamadas diretas autenticadas; testar concorrência, upload parcial, capa, ordem, rascunho, preço, aprovação, publicação e despublicação apenas nos dados sintéticos.
10. Aplicar `supabase/hardening/produtos_proprietarios_pos_deploy.sql` somente depois de provar que nenhuma rota do ERP novo acessa a tabela diretamente. Confirmar que SELECT direto autenticado falha e RPC autorizada funciona.
11. Implantar site de homologação após ERP/banco; validar catálogo, ficha, SEO, canonical, OG, JSON-LD, deep-link, mídia privativa/comum e ausência de PII.
12. Validar 1440/1024/768/390, zoom 200%, teclado, estados de erro/vazio/offline e logs.
13. Registrar aceite ou aborto. Em falha antes de novas escritas, restaurar backup se necessário. Depois de novas escritas, preferir roll-forward; não remover colunas ou tabela de rascunhos com dados. Se for necessário voltar o ERP antigo, reverter temporariamente os grants de `proprietarios` somente com plano explícito e backup, mantendo a expansão aditiva.

### Portão B — futura autorização de produção

Só abrir depois do aceite assinado do Portão A.

1. Fixar commits aprovados, responsáveis, janela, backup do banco, plano de comunicação e critérios de aborto.
2. Repetir preflight com volume de produção. Abortar por backup inválido, lock ativo, divergência de schema, tempo estimado sem margem, PII pública ou CI não verde.
3. Ordem segura: **migration de expansão → ERP novo → matriz/smoke → hardening de proprietário → site novo**.
4. Smoke mínimo: captador, não captador e gestor; criar/editar unidade sintética operacional; fotos/capa/ordem; rascunho; publicar/despublicar; catálogo e ficha pública.
5. Amostrar AP0356 sem alterar conteúdo indevidamente e ao menos um terceiro, lançamento, remanescente, unidade sem condomínio e unidade vinculada.
6. Monitorar erros 4xx/5xx, conflitos 409, latência/locks, Storage órfão, RPCs de proprietário, catálogo, sitemap/SEO e publicação por toda a janela definida.
7. Rollback: antes de escrita nova, restaurar versão/backup conforme incidente; depois de escrita nova, roll-forward de aplicação/policy. Nunca fazer `DROP COLUMN` para reverter rapidamente.

### Portão C — IA, decisão independente

Nenhuma IA foi ativada. Uma futura proposta precisa definir separadamente:

- fornecedor, modelo e região;
- somente bytes/metadata de mídia estritamente necessários;
- finalidade: sugerir categoria, ordem, capa e alt text;
- exclusão garantida de proprietário, contato, endereço privado, acesso, notas e demais PII;
- retenção zero ou prazo explícito, logs minimizados, custo/teto, timeout e circuito de falha;
- revisão humana obrigatória, rejeição e desfazer;
- mocks/fixtures locais antes de qualquer transmissão;
- autorização escrita específica para fornecedor, campos, orçamento e ambiente.

## 13. Próxima autorização mínima necessária

Autorizar **somente o Portão A em uma homologação Supabase isolada**, indicando a instância de teste e permitindo criar/reutilizar três contas exclusivamente sintéticas (captador, não captador e gestor), fazer backup/preflight, aplicar a migration de expansão, implantar ERP/site de homologação e executar a matriz. Essa autorização não inclui produção, dados reais, push em `main` nem IA.

Até essa autorização e a execução comprovada do Portão A, o estado correto permanece **`BLOQUEADO`**.
