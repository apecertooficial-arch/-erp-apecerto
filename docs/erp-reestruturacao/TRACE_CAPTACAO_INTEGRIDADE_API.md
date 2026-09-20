# Trace — integridade da Captação

Atualizado em: 2026-09-20
Estado: correção local em validação; sem migration, escrita remota ou publicação

## Falhas reproduzidas

- falha técnica de autenticação era apresentada como sessão inválida;
- erro ao ler papel, corretor, produto, mídia, duplicidade ou condomínio podia
  virar 403, 404, lista vazia ou decisão baseada em dado incompleto;
- mensagens brutas do Postgres, Storage e RPC atravessavam para o navegador;
- o payload da aprovação devolvia o objeto bruto da RPC;
- finalizar primeiro alterava o empreendimento e depois reparava as unidades;
  uma falha no segundo passo não distinguia parcialidade;
- criar condomínio/proprietário, empreendimento e unidades é uma sequência
  composta; falha tardia podia deixar apoio ou rascunho sem reconciliação.

## Correção local

- autenticação técnica, ausência de sessão, autorização e regra de domínio são
  estados separados;
- leituras obrigatórias falham fechadas e logs guardam somente operação fixa e
  código técnico;
- aprovação só aceita códigos de domínio conhecidos e devolve campos mínimos;
- update de finalização e inserts comprovam as linhas afetadas;
- falha depois de um efeito confirmado devolve `RECONCILIATION_REQUIRED` e
  orienta a não repetir cegamente;
- a interface trata JSON inválido, não exibe falha arbitrária de banco/Storage
  e preserva mensagens comerciais do próprio contrato;
- upload permanece retomável e identifica o arquivo afetado sem revelar o
  detalhe técnico interno.

## Evidência atual

- falha anterior registrada: 0/5 contratos novos;
- correção: 5/5 contratos próprios;
- recorte de Produtos: 60 contratos executados, 56 aprovados e quatro `todo`
  preexistentes explicitamente ligados ao revert `90b5bd8a`;
- typecheck aprovado;
- lint focado aprovado sem erros ou avisos.
- árvore ampla: gate de hardening acumulado 31/31 e frontend 679/679;
- pacote isolado sobre o `main` publicado: 23/23 no hardening acumulado,
  424/424 no gate da base, typecheck, lint e build aprovados;
- navegador real com o componente de Captação em 1280 × 900 e 390 × 844:
  diálogo e seis etapas visíveis, sem overflow ou console; a única tentativa de
  mutação do cliente Supabase foi bloqueada pelo harness antes de qualquer rede
  externa.

## Limites e gate de publicação

A aplicação agora torna a parcialidade explícita, mas não transforma a criação
em uma transação. O contrato definitivo exige RPC atômica/idempotente para
condomínio/proprietário → empreendimento → unidades e outra para finalização →
reparo. Essas mudanças de banco só podem avançar depois de ensaio em Postgres
isolado e autorização específica.

O pacote isolado está pronto para promoção de código. O navegador não realizou
captação real; os estados de erro e reconciliação foram comprovados por
contrato, não por escrita sintética no banco. Atomicidade definitiva permanece
fora da promoção até o gate específico de Postgres.
