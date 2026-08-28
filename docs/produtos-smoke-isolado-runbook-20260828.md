# Produtos — runbook do smoke autenticado isolado

Data: 28/08/2026
Estado: pronto e validado por mocks; não executado contra banco nesta máquina.

## Objetivo

Executar, somente em Supabase local descartável ou preview comprovadamente
isolado, a matriz real de visitante, captador, corretor não captador e gestor.
O smoke cobre proprietário, edição de unidade, edição/capa/ordem de mídia,
rascunho privado, concorrência otimista e acesso negado.

O script `scripts/smoke-products-isolated.mjs` normaliza o hostname e bloqueia
`apecerto-erp.onrender.com`, inclusive com ponto final, antes de qualquer
requisição. Nenhuma chave
de serviço é aceita pelo script; ele recebe somente três sessões sintéticas.

## Estado encontrado em 28/08/2026

- `supabase/config.toml` existe e configura API 54321, banco 54322, Auth e
  Storage locais;
- o CLI Supabase não está instalado nesta máquina;
- Docker não está instalado nesta máquina;
- `supabase/seed.sql` não existe;
- não há `supabase/.temp`, `.supabase`, `.env` local ou serviço respondendo em
  `127.0.0.1:54321`;
- o inventário remoto contém apenas a branch padrão do projeto principal de
  Produtos; não existe preview isolado utilizável.

Logo, criar usuários ou fixtures agora exigiria instalar serviço novo ou tocar
o projeto principal, ambos proibidos nesta execução.

## Pré-condições obrigatórias

Escolher exatamente um ambiente:

1. Supabase local descartável, já instalado e executável; ou
2. preview branch já existente, com project ref, Auth, banco e Storage próprios,
   sem qualquer dado real.

Antes de escrever:

1. executar `supabase --version` e consultar `supabase --help`,
   `supabase start --help`, `supabase db reset --help` e `supabase stop --help`;
2. usar somente a sintaxe apresentada pela versão instalada;
3. confirmar que a origem do ERP não é `https://apecerto-erp.onrender.com`;
4. confirmar que project ref, domínio, Auth e Storage não são os de produção;
5. confirmar por contagens agregadas que o ambiente não contém pessoas,
   proprietários, imóveis ou mídias reais;
6. não prosseguir se qualquer verificação for inconclusiva.

Em preview e localhost, registrar a prova literal
`confirmed-isolated-no-real-data`. Preview também exige a origem exata aprovada.

## Contrato da fixture sintética

Usar um `runMarker` exclusivo no formato
`CODEX_SMOKE_PRODUCTS_<IDENTIFICADOR>`. Todos os e-mails devem terminar em
`.invalid`; nomes, telefones, endereço, proprietário e imagens devem ser
inequivocamente artificiais.

Criar somente:

- um usuário ativo de papel `corretor`, vinculado ao corretor captador;
- outro usuário ativo de papel `corretor`, vinculado a corretor diferente;
- um usuário ativo de papel `gestor`;
- um proprietário sintético;
- um produto sintético, de terceiros, em rascunho e não publicado;
- uma unidade sintética vinculada ao captador e ao proprietário;
- duas imagens sintéticas pequenas, próprias da unidade, com categoria, alt
  text restaurável, uma única capa e ordem contígua iniciada em zero;
- três sessões Auth distintas.

Produto ou unidade deve conter o `runMarker`, o contato do proprietário deve
terminar em `.invalid`, a unidade deve estar pendente e fora do ar, e a lista
de IDs deve conter todas e somente as mídias privativas dessa unidade. O smoke
verifica essas condições antes da primeira escrita.

Não reutilizar UUID, conta, imóvel, proprietário, mídia ou arquivo existente.
Não imprimir senha, JWT, UUID de usuário ou conteúdo privado. A fixture precisa
ser criada pelo mecanismo local/preview já aprovado; nenhuma `service_role`
pode chegar ao navegador, ao relatório ou ao smoke.

## Execução

Na raiz do ERP, com o servidor do ERP apontando para o Supabase isolado, carregar
os valores abaixo por um arquivo temporário fora do repositório ou pelo secret
store do ambiente:

```text
APECERTO_ERP_BASE_URL=<origem isolada>
APECERTO_ISOLATED_APPROVED_ORIGIN=<mesma origem, obrigatório em preview>
APECERTO_ISOLATION_PROOF=confirmed-isolated-no-real-data
APECERTO_SMOKE_CONFIRM_SYNTHETIC=true
APECERTO_CAPTOR_ACCESS_TOKEN=<sessão sintética>
APECERTO_NON_CAPTOR_ACCESS_TOKEN=<sessão sintética>
APECERTO_MANAGER_ACCESS_TOKEN=<sessão sintética>
APECERTO_SMOKE_PRODUCT_ID=<uuid sintético>
APECERTO_SMOKE_UNIT_ID=<uuid sintético>
APECERTO_SMOKE_MEDIA_IDS=<uuid sintético 1>,<uuid sintético 2>
APECERTO_SMOKE_RUN_MARKER=CODEX_SMOKE_PRODUCTS_<IDENTIFICADOR>
```

Executar `pnpm run smoke:products-isolated`. A saída de sucesso contém apenas o
evento, `ok: true` e a quantidade de checks; não contém token, proprietário,
payload ou UUID.

## Critérios de aprovação

Todos os 11 checks devem passar:

1. produção bloqueada por construção;
2. visitante recebe 401 sem proprietário;
3. três perfis sintéticos distintos e ativos;
4. proprietário visível somente a captador e gestão;
5. não captador recebe 403 ao editar unidade;
6. captador e gestor editam e persistem unidade;
7. não captador recebe 403 em mídia; captador/gestão persistem categoria, alt,
   capa e ordem;
8. rascunho do captador é privado;
9. versão obsoleta do rascunho recebe 409;
10. rascunho sintético é removido;
11. título, metadados, capa e ordem originais da fixture são restaurados.

Qualquer owner key em payload do visitante/não captador, qualquer 2xx em edição
forjada ou qualquer resposta diferente de 409 para conflito interrompe o smoke.

## Cleanup obrigatório

O smoke executa cleanup compensatório mesmo após falha intermediária, restaura
os valores da unidade/mídias, apaga o rascunho e relê o estado antes de devolver
o erro original. Depois disso:

- em Supabase local descartável, encerrar e eliminar somente a instância local
  usando a opção de descarte confirmada em `supabase stop --help` da versão
  instalada;
- em preview branch descartável, remover somente a branch preview pelo mecanismo
  oficial, depois de confirmar project ref e nome exatos;
- nunca executar cleanup contra a branch padrão.

Provar o cleanup sem revelar dados:

1. contagem agregada de Auth com domínio `.invalid`: 0;
2. contagem agregada de usuários, corretores, proprietários, produtos, unidades
   e mídias com o `runMarker`: 0;
3. contagem de objetos no prefixo sintético de Storage: 0;
4. em local descartado, endpoint `127.0.0.1:54321` indisponível;
5. guardar somente as contagens e o resultado dos 11 checks.

Se um objeto estiver bloqueado ou o cleanup falhar, parar. Não ampliar o alvo,
não usar conta real e não tentar uma primitiva destrutiva mais forte.

## Validação já concluída por mocks

- smoke mutável isolado: 11/11 cenários;
- matriz autenticada read-only existente: 7/7 cenários;
- contratos de Produtos consolidados: 49/49 (os 45 solicitados e quatro casos
  adicionais de hardening);
- lint dos dois arquivos novos: aprovado;
- `git diff --check`: aprovado.

Os mocks provam a lógica do executor e seu fail-closed, não substituem uma prova
contra Auth/RLS/Storage reais. A nota operacional não deve ser elevada até a
execução neste ambiente isolado.
