# Reconciliação de Edge Functions

Atualizado em: 2026-09-19

## Resultado sanitizado

- projeto remoto confirmado: `diaegvfveqezispcthwk`;
- funções remotas: 53;
- fontes locais antes desta correção: 26;
- funções presentes nos dois lados: 26;
- funções somente remotas: 27;
- funções somente locais: 0;

Isso prova uma deriva de configuração e de fonte: produção executa código que
não pode ser integralmente reproduzido a partir do repositório atual.

## Dependências diretas do ERP sem fonte local

| Função | Consumidor atual | Risco | Estado local |
| --- | --- | --- | --- |
| `dapi-qr` | Conexões e Minha Equipe | credencial de provedor, autorização de instância e webhook | fonte canônica reconstruída com JWT, autorização escopada e segredo somente no ambiente; não implantada |
| `admin-usuarios` | Minha Equipe | criação/remoção de usuário com privilégio administrativo | fonte remota ainda precisa ser reconstruída e testada |
| `cadastro-publico` | `/cadastro` | criação de usuário por token público | fonte remota ainda precisa ser reconstruída e testada |
| `definir-senha` | `/definir-senha` | alteração de credencial por token público | fonte remota ainda precisa ser reconstruída e testada |

## P0 `dapi-qr`

A versão remota foi inspecionada sem registrar seus valores secretos. Foram
encontrados quatro problemas estruturais: segredo de webhook incorporado à
fonte, CORS amplo, resposta de erro técnico ao cliente e autorização duplicada
por papéis. O repositório não continha uma cópia dessa função.

A substituição local:

- exige JWT tanto na configuração quanto no runtime;
- valida a sessão com `auth.getUser`;
- usa `wa_v7_painel`, a mesma autoridade escopada que abastece Conexões, para
  decidir se a instância pedida pertence ao usuário;
- lê credencial privilegiada somente depois dessa autorização;
- recebe o segredo do webhook exclusivamente por variável de ambiente;
- restringe origem e operações;
- não devolve resposta bruta do provedor nem detalhe interno;
- confirma conexão somente depois de configurar o webhook e persistir o estado.

Aceite local atual: 6 testes direcionados e gate frontend 456/456. A ferramenta
`deno` não está disponível nesta máquina, portanto `deno check` e `deno lint`
continuam pendentes. Não houve deploy nem alteração de segredo.

## Demais funções somente remotas

As outras funções foram classificadas provisoriamente por nome e consumidor:
site, tracking/Meta, DataCrazy legado, diagnóstico, limpeza/smoke e operação do
ERP. Nome ou ausência de referência direta no frontend não prova obsolescência;
jobs, webhooks e provedores podem chamá-las externamente.

Nenhuma função será removida até existir, para cada slug, prova de ownership,
chamadores, logs, segredos necessários, substituição, teste e rollback.

## Gate de publicação

Antes de implantar uma função reconstruída:

1. revisar o diff sem copiar segredo remoto;
2. executar testes, lint e typecheck Deno em ambiente adequado;
3. confirmar todos os nomes de secrets, sem exibir valores;
4. publicar um slug por vez;
5. validar o consumidor real e os casos negados;
6. comparar logs sanitizados e reverter imediatamente em caso de regressão.
