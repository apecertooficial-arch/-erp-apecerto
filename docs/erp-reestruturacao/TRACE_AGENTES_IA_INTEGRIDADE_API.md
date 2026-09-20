# Trace — integridade e autorização de Agentes de IA

Atualizado em: 2026-09-20
Estado: candidato isolado sobre o `main` publicado em `a25dc829`

## Falhas reproduzidas

`/api/agentes` permitia a qualquer sessão autenticada ler instruções, fontes,
ferramentas, testes, execuções e custos, além de tentar mutações e baterias. A
rota ignorava erros de leituras obrigatórias, repassava respostas externas e
podia confirmar escritas sem linha persistida. A tela expunha detalhes técnicos
e mascarava a falha inicial como loading ou vazio.

## Correção

- leitura e mutação exigem usuário ativo em `supervisao_ia`;
- autenticação, perfil, banco e integração falham fechados e sem payload bruto;
- detalhe verifica todas as fontes obrigatórias;
- modelos, status e paginação são validados no servidor;
- escritas comprovam a linha e parcialidade exige reconciliação, sem retry;
- a tela diferencia loading, vazio real, acesso negado e falha recuperável e
  não monta o editor quando a carga inicial falha.

## Gates

Na árvore ampla: 8/8 contratos próprios, 39/39 no recorte, 677/677 no gate
frontend, typecheck, lint, build e navegador em 1280 × 900 e 390 × 844. O
candidato isolado deve repetir contratos, gate da base, typecheck, lint e build
antes da publicação.

## Limites

Fonte + vínculo e promoção em lote ainda exigem RPC transacional ou compensação
idempotente. RLS/grants e autorização da Edge Function precisam de ensaio em
Postgres isolado; este pacote não inclui migration nem Edge deploy.
