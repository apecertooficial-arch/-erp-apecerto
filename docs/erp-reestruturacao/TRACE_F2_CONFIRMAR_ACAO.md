# Trace — confirmação operacional e reavaliação Sara

Data: 2026-09-21

Estado: aplicação, Edge e contrato SQL validados localmente; publicação bloqueada até ensaio do banco em ambiente isolado.

## Falha reproduzida

- a produção bloqueia `confirmarAcao`, portanto a ação manual executada pelo corretor não atualiza o prazo nem acorda a Sara;
- aceitar uma origem D-API informada pelo navegador falsificaria evidência de envio;
- publicar apenas a interface produziria uma ação visual sem persistência compatível.

## Correção local

- o servidor calcula `pode_confirmar_acao` pelo corretor dono;
- momentos D-API continuam exclusivos da confirmação automática;
- momentos manuais exigem confirmação explícita e revisão otimista;
- a RPC proposta cria evento `acao_confirmada`, prazo provisório e uma fila idempotente `lead.action_confirmed`;
- o worker Sara aceita o novo evento sem confundi-lo com evento de prazo;
- desktop e aplicativo usam o mesmo componente e mostram erro de persistência sem fingir sucesso.

Commits da fatia:

- `c6691411` — contrato de aplicação, UI, Edge e draft SQL;
- `123bf8ea` — navegador desktop/mobile, acessibilidade e plano contínuo;
- `2860e2ef` — correção de sintaxe do ensaio SQL e teste de regressão.

## Evidência local

- 978 testes do repositório: aprovados;
- 10 verificações de HTML renderizado e paridade CRM: aprovadas;
- TypeScript, lint direcionado e `git diff --check`: aprovados;
- build Vinext de produção: aprovado;
- navegador sanitizado desktop: ação visível, confirmação explícita, sem overflow;
- navegador sanitizado 390x844: sem overflow; controles novos com 48–84 px;
- mutação bloqueada pelo harness: um `PATCH /api/funil2`, erro visível e nenhum erro de console.

## Baseline remoto somente leitura

Projeto: `diaegvfveqezispcthwk`.

- `f2_confirmar_acao`: hash esperado confirmado;
- `motor_enfileirar`: hash esperado confirmado;
- automação Sara 49: hash esperado, versão publicada 130 e versão lógica máxima 6;
- um gatilho Sara; `lead.action_confirmed` ainda ausente;
- os dois índices novos ainda ausentes;
- `authenticated` pode executar a RPC atual; `anon` não pode;
- branch disponível: somente `main`, marcada `MIGRATIONS_FAILED` no catálogo de branches.

Nenhum lead, mensagem, telefone, e-mail ou linha operacional foi consultado.

## Gate de publicação

O draft não deve ser executado diretamente em produção para validação, pois cria índices, substitui a RPC, versiona a automação e adquire locks mesmo terminando em `ROLLBACK`.

Próximo gate seguro:

1. criar ou disponibilizar ambiente Supabase isolado compatível;
2. executar o draft completo, que sempre termina em `ROLLBACK`;
3. validar concorrência, idempotência, ACL/RLS, fila e rollback;
4. transformar o contrato aprovado em migration aditiva;
5. publicar banco, Edge e aplicação na ordem compatível;
6. executar smoke test autenticado e confirmar o build.

O custo informado pela Supabase para uma branch de desenvolvimento é US$ 0,01344 por hora. Nenhuma branch foi criada e nenhum custo foi aceito.
