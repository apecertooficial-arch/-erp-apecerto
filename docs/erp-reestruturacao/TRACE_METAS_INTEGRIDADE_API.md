# Trace — integridade da API de Metas

Atualizado em: 2026-09-20
Estado: pacote de aplicação revalidado para promoção; concorrência banco ainda pendente

## Falhas reproduzidas

`/api/metas` atravessava `error.message` do banco para o navegador, ignorava
falha ao ler o papel do usuário e podia transformar indisponibilidade da lista
em “nenhuma meta”. A procura anterior ao `insert` também ignorava erro: uma
consulta incerta podia seguir como criação e disputar com outra requisição.

Valores vazios eram convertidos silenciosamente em zero, períodos inválidos
eram aceitos e `update`, `insert` ou `delete` podiam confirmar sucesso sem
provar que uma linha havia sido retornada. Na interface, falha de remoção não
era conferida e uma gravação bem-sucedida seguida de falha no reload parecia
erro total, convidando o usuário a repetir o comando.

## Correção local

- falhas técnicas são sanitizadas em `falha_banco`; somente a recusa conhecida
  preserva `403 sem_permissao`;
- logs carregam apenas operação fixa e código do provedor, sem payload, texto
  SQL, usuário ou valor financeiro;
- a leitura do papel falha fechada antes de decidir autorização;
- tipo de período, ano, período, corretor, VGV e quantidade de vendas são
  validados sem coerção de vazio para zero;
- o erro da busca por meta existente interrompe o fluxo;
- toda escrita exige a linha retornada; conflito de atualização é `409` e
  remoção de item inexistente é `404`;
- a tela diferencia `loading`, lista real vazia e indisponibilidade, com ação de
  tentar novamente;
- falha depois de uma escrita confirmada informa que a lista não foi
  atualizada e orienta não repetir a operação.

## Evidência

- 7/7 contratos específicos de Metas;
- 27/27 no recorte Metas + Financeiro;
- 486/486 no gate frontend cumulativo sobre o `main` publicado
  `58c4facf197492b043e7cdb7d4214461347848fd`;
- typecheck, lint focado e build completo aprovados;
- navegador real sanitizado em desktop e 390 × 844: a falha aparece como
  `Indisponível`, oferece `Tentar novamente` com alvo de 44 px e não exibe
  falso estado vazio nem overflow horizontal;
- o cenário visual registrou somente `GET /api/finance` e `GET /api/metas`; o
  harness bloqueia qualquer mutação e qualquer origem externa.

Nenhuma mutation real, migration, escrita remota ou publicação desta fatia foi
feita até este checkpoint.

## Limite ainda aberto

O algoritmo continua sendo `select` seguido de `insert` quando não encontra a
meta. Sem uma constraint única efetiva no banco e um comando atômico
`upsert`/RPC, duas requisições concorrentes ainda podem criar duplicidade ou
receber um conflito do banco. A correção definitiva exige inventariar a
constraint produtiva, preparar comando idempotente, ensaiar em Postgres isolado
e só então solicitar autorização específica para migration.
