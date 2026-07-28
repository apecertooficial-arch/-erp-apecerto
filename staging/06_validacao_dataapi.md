# Validação via Data API / PostgREST (staging real)

Os smoke tests em `03_smoke_tests.sql` exercitam RLS/RPC no nível do banco emulando o JWT
(`request.jwt.claims` + `SET ROLE`), que é exatamente o contexto que o PostgREST injeta. Abaixo, a
verificação equivalente pela **Data API HTTP**, para rodar **depois** que o projeto de staging existir.
Nenhum segredo é embutido aqui — as chaves vêm do dashboard do staging no momento da execução.

## Pré-requisitos (obter no dashboard do STAGING, nunca de produção)
- `PROJECT_URL` = https://<STAGING_REF>.supabase.co
- `ANON_KEY` (publishable) — para papel `anon`.
- JWT de um usuário autenticado fictício (gerar via Auth do staging para `corretor.a@example.com`).
- `SERVICE_ROLE_KEY` — usar **apenas no backend de testes** (nunca no client).

> Guarde as chaves fora do repositório (variáveis de ambiente locais). Não commitar.

## Checagens (exemplos)

1. **anon não lê ncrm_estado** (espera 200 com `[]` ou 401/permissão, nunca linhas):
```
curl -s "$PROJECT_URL/rest/v1/ncrm_estado?select=negocio_id" -H "apikey: $ANON_KEY"
```

2. **Corretor A só vê a própria carteira** (JWT de A):
```
curl -s "$PROJECT_URL/rest/v1/ncrm_estado?select=negocio_id" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT_A"
# esperado: 10 linhas; negócio 9 ausente
```

3. **Escrita direta negada** (JWT de A, PATCH deve falhar por RLS):
```
curl -s -X PATCH "$PROJECT_URL/rest/v1/ncrm_estado?negocio_id=eq.1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT_A" \
  -H "Content-Type: application/json" -d '{"etapa":"novo"}'
# esperado: 0 linhas afetadas / erro de permissão
```

4. **RPC autorizada** (registrar tentativa; próxima ação vem do banco):
```
curl -s -X POST "$PROJECT_URL/rest/v1/rpc/ncrm_registrar_tentativa" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT_A" \
  -H "Content-Type: application/json" \
  -d '{"p_negocio_id":1,"p_versao":1,"p_canal":"ligacao","p_resultado":"nao_respondeu","p_obs":"t","p_proxima_tipo":null,"p_proxima_titulo":null,"p_proxima_em":null,"p_idem":"http:t1"}'
# esperado: {"ok":true,...,"proxima_acao_tipo":"tentativa_cadencia"}
```

5. **Automação (service_role, só backend)** cria estado:
```
curl -s -X POST "$PROJECT_URL/rest/v1/rpc/ncrm_registrar_msg_automatica" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_negocio_id":5,"p_message_id":"http-auto-5","p_enviado_em":"2026-07-28T12:00:00Z"}'
```

Mapear cada resposta ao mesmo critério do smoke SQL correspondente (S1..S18).
`ncrm_private` **não** deve estar em *Exposed schemas* da Data API (confirmar em Settings → API).
