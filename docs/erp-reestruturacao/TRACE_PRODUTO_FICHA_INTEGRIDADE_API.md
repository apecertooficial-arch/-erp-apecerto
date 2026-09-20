# Trace — integridade da ficha de Produto

Atualizado em: 2026-09-20
Estado: correção local validada; sem migration, escrita remota ou publicação

## Falhas reproduzidas

- a leitura principal devolvia a mensagem bruta do Postgres ao navegador;
- falhas ao ler perfil, corretor, favoritos, vínculos, leads, corretores e
  proprietários eram convertidas em ausência, lista vazia ou decisão parcial;
- usuário autenticado sem papel de gestão e sem carteira de corretor podia
  montar uma consulta sem filtro para a lista de leads;
- o contrato revertido permitia que não captadores vissem o identificador ou
  os dados do proprietário em parte das fichas;
- gestão não recebia de modo consistente os dados de proprietário que deveria
  revisar.

## Correção local

- falhas técnicas são registradas somente com operação fixa e código, e a
  resposta pública usa mensagem operacional sanitizada;
- produto inexistente permanece 404, enquanto indisponibilidade do banco é
  502 explícito e nunca ficha vazia;
- perfil e vínculo do corretor são lidos antes da carteira; usuário sem ambos
  falha fechado com 403;
- todas as relações obrigatórias da ficha conferem seus erros antes de montar
  a resposta;
- somente gestão ou captador recebem proprietário do produto ou da unidade;
  `proprietario_id`, nome e contato são anulados para os demais;
- o harness ganhou uma ficha sanitizada e bloqueia qualquer escrita ou domínio
  externo durante a validação visual.

## Evidência atual

- falha anterior: 0/5 contratos novos;
- correção: 5/5 contratos próprios;
- contratos da ficha, privacidade e harness: 39/39;
- hardening acumulado: 36/36;
- gate frontend: 679/679;
- typecheck, lint focado e build completo aprovados;
- navegador real com catálogo e ficha sanitizados em 1280 × 900 e 390 × 844:
  ficha aberta, sem overflow, alerta ou console; GET de `/api/product` observado
  e nenhuma mutação emitida.

## Limites e próximo gate

Esta fatia fecha somente a leitura da ficha. As mutações de unidade, mídia,
favorito, vínculo com lead, edição, aprovação e exclusão continuam na mesma
rota e ainda apresentam sequências não atômicas ou mensagens técnicas. Elas
devem formar uma fatia própria antes de qualquer afirmação de Produto completo.
Nenhum dado real foi lido no harness ou alterado por esta validação.
