# Trace — integridade de leitura do Catálogo

Atualizado em: 2026-09-20
Estado: candidato isolado sobre o `main` publicado em `33309d84`

## Falhas e correção

`/api/catalog` devolvia mensagens do Supabase e ignorava falhas em perfil,
favoritos, corretores, ownership, condomínios, qualidade, origem comercial,
vínculos, aprovação, mídias, captações e proprietários. Isso podia transformar
falha em catálogo, estoque ou fila vazios e alterar a visibilidade calculada.

Agora autenticação técnica é distinta de sessão ausente, todos os conjuntos
obrigatórios falham fechados e resposta/logs não contêm detalhe SQL ou payload.
A interface mantém loading, sessão expirada, erro recuperável e vazio real como
estados diferentes.

## Gates e limites

Na árvore ampla: 5/5 contratos, 31/31 com harness, 678/678 no gate frontend,
typecheck/lint/build e navegador 1280 × 900 + 390 × 844. O candidato isolado
deve repetir contratos, base, typecheck, lint e build antes da publicação.

A consulta segue limitada a 500 empreendimentos. Paginação e RLS/RPCs ainda
precisam de prova isolada. Mutações de `/api/product` e `/api/capture` não fazem
parte deste pacote.
