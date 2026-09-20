# Trace — escopo e integridade de Financiamento

Atualizado em: 2026-09-20
Estado: P0 de exposição horizontal e sanitização corrigido localmente; RLS remota ainda requer ensaio isolado

## Falhas reproduzidas

`/api/financiamento` aceitava qualquer sessão autenticada e consultava até 500
fichas com nome, telefone, renda e valores sem aplicar escopo explícito de
gestão ou corretor no servidor. A proteção dependia somente da policy remota,
que ainda não foi reconciliada em ambiente isolado. A rota também devolvia a
mensagem técnica do Supabase diretamente ao navegador.

A interface tentava interpretar toda resposta como JSON e exibia a mensagem da
exceção. Falha de rede, proxy ou resposta inválida podia, portanto, aparecer
como detalhe técnico em vez de um estado operacional estável.

## Correção local

- sessão ausente, falha técnica de autenticação e perfil sem acesso são
  resultados separados e fail-closed;
- o papel é lido da autoridade `usuarios` e gestão é resolvida pelo contrato
  canônico `papelNoGrupo`;
- gestão consulta o conjunto permitido pela RLS; corretor precisa de vínculo
  ativo e a própria query é filtrada por `corretor_id` ou `created_by`;
- somente as colunas necessárias à tela atravessam a API; CPF, RG, endereço,
  dados do cônjuge e e-mail não fazem parte da resposta;
- falhas técnicas são sanitizadas e os logs guardam apenas operação fixa e
  código, sem mensagem, payload ou dado pessoal;
- a interface transforma falha de rede, resposta inválida e erro HTTP em uma
  mensagem operacional única e recuperável.

## Evidência

- 5/5 contratos específicos de Financiamento;
- 29/29 no recorte Financiamento + harness visual;
- 675/675 no gate frontend da reconstrução ampla, além dos 13 contratos novos
  de Usuários/Equipe + Financiamento;
- 424/424 ao reproduzir somente esta fatia sobre o `main` já publicado em
  `a7417407`;
- typecheck, lint sem erros e build completo aprovados;
- navegador real sanitizado em 1280 × 800 e 390 × 844: ficha autorizada,
  valores renderizados, falha explícita, retry com somente um novo GET, zero
  mutação, zero console e nenhum overflow horizontal.

Nenhuma ficha, usuário, link, policy ou dado remoto foi alterado. Não houve
migration, push ou deploy desta fatia.

## Limites ainda abertos

As policies e grants de `financiamento_fichas` continuam precisando de prova em
Postgres isolado para garantir que consultas diretas também respeitem gestão,
corretor e autoria. O token de link público é uma capacidade sensível entregue
somente a usuários autorizados; expiração, rotação, uso único e auditoria estão
no contrato V2 ainda não migrado. A lista permanece limitada a 500 registros e
precisa de paginação canônica antes de crescer além desse volume.
