# Trace — permissões, falha fechada e auditoria

Atualizado em: 2026-09-20
Estado: pacote de aplicação revalidado para promoção; atomicidade banco + auditoria pendente

## Falhas reproduzidas

`/api/permissions` apresentava quatro riscos na fronteira que concede acesso:

1. devolvia `error.message` do Postgres ao navegador;
2. ignorava erro ao ler o papel do usuário e podia apresentar falha do banco
   como se fosse apenas um `403` comum;
3. não comprovava que o perfil ou usuário existia nem que a atualização afetou
   uma linha;
4. descartava silenciosamente qualquer falha de `registrar_auditoria` e, mesmo
   assim, devolvia `success: true`.

## Correção local

- falhas técnicas agora usam contrato estável `falha_banco`; bloqueios de RLS
  usam `sem_permissao`, sem texto de tabela, função, policy ou constraint;
- logs contêm somente operação conhecida, código técnico e indicação de efeito
  parcial, sem payload, permissões, nomes ou outros dados pessoais;
- erro na leitura do perfil encerra a autorização como falha de infraestrutura,
  antes de avaliar o grupo canônico `acesso_total`;
- as três mutações leem o estado anterior, recusam alvo ausente, atualizam com
  retorno da linha afetada e tratam desaparecimento concorrente como `409`;
- falha de auditoria não confirma sucesso: a resposta marca
  `reconciliacao_necessaria` e orienta a não repetir a alteração.

## Evidência

- 5/5 contratos específicos de endurecimento;
- 39/39 contratos das APIs promovidas e 473/473 no gate frontend atual;
- reprodução independente sobre o `main` financeiro
  `b87eb5af07f4452586c807def8f029c11f3a80a3`;
- typecheck sem erros;
- lint focado sem erros;
- build completo com a rota `/api/permissions` incluída.

Os testes são locais e sanitizados. Nenhuma permissão real foi modificada,
nenhuma chamada foi enviada ao banco produtivo e nenhum dado pessoal foi lido.

## Limite ainda aberto

A mutação e `registrar_auditoria` ainda são duas chamadas separadas. A resposta
parcial impede falso sucesso, mas não desfaz uma permissão que já tenha mudado
se a auditoria falhar. Para fechar o P0, cada comando deve migrar para uma RPC
única, com lock/controle de concorrência, alteração e auditoria na mesma
transação, e ser ensaiado em Postgres isolado antes de qualquer migration de
produção.

Neste ponto, a branch de promoção ainda não alterou produção.
