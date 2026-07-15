# Seguranca antes de expor no dominio publico

FEITO:
- Login restaurado: o app pede e-mail/senha (Supabase Auth). So a equipe entra.
- Chaves ficam como variaveis de ambiente no Render (nao no codigo publico).
- A chave publicavel do Supabase e publica por natureza — seguranca real vem
  das politicas RLS do banco (abaixo).

VERIFICADO NO SEU SUPABASE (14/07):
- 0 erros criticos. As 4 tabelas que estavam abertas no diagnostico antigo ja
  foram corrigidas. Visitante anonimo NAO acessa suas tabelas de negocio.

A FAZER (voce, no painel do Supabase — 2 min):
1. Authentication > Policies (ou Providers) > ative
   "Leaked password protection" (bloqueia senhas vazadas).
2. Storage: o bucket "chat-midia" permite listar arquivos publicamente.
   Se o app nao depender disso, restrinja a leitura a usuarios logados.
3. Revisar depois: existem funcoes executaveis por anonimo. Antes de rodar
   trafego alto/campanha, vale checar quais devem exigir login.

Nada disso impede publicar com login. Sao ajustes de endurecimento.
