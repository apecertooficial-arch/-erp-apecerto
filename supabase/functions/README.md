# Edge Functions de envio — proveniência

Este diretório versiona os **sources ativos** das três Edge Functions de envio do
projeto Supabase `diaegvfveqezispcthwk`. Elas tinham sido deployadas direto pelo
painel e nunca existiram no Git. O que está aqui é um **espelho fiel** do que estava
rodando em produção no momento da captura — nenhuma linha de comportamento foi
alterada.

Captura em 2026-07-31, pela API de gerenciamento do Supabase.

## Tabela de proveniência

| função | versão ativa | verify_jwt | ezbr_sha256 | o que faz | quem chama |
| --- | --- | --- | --- | --- | --- |
| `dapi-enviar` | 13 | `false` | `90b4a70364e2dcf8b4680d01ef4902e8383b5a8154c43c0cd7faa38f4685ddce` | Envio real de WhatsApp pela D-API — texto, áudio, imagem, vídeo e documento. Resolve qual instância usar, tenta as duas formas do 9º dígito e registra a mensagem em `wa_mensagens`. | `enviar-produto` (máquina). No repo: `app/api/crm/chat/route.ts`, `app/api/live-chat/route.ts`, `app/features/crm/CrmWorkspace.tsx`, `public/legacy-runtime.html`, `public/legacy/CRM_ApeCerto_FINAL.html`, `public/_test-runtime.html`. |
| `enviar-produto` | 6 | `false` | `ce7225e4065e310e3a357e65be3496f09f5203137d2f998c52c0a7030b10ee39` | Envia o pack de um empreendimento numa única chamada — fotos ordenadas (capa, fachada, decorado, lazer, planta, sala) mais o book em PDF. Delega cada envio a `dapi-enviar`. Aceita `dry_run` para conferir o plano sem disparar nada. | Nenhum caller no repositório. Só automações externas, em modo máquina. |
| `enviar-whatsapp` | 4 | `true` | `9ac27c04a524118786c4841f62f866ce1434ba6eaaef775571303c6e61e624fe` | Envio simples de texto pela D-API a partir de `instancia_id`, `to` e `text`. Versão antiga, sem nenhuma das proteções que `dapi-enviar` ganhou depois. | Nenhum caller conhecido — nem no repositório, nem em outra Edge Function. |

O `ezbr_sha256` identifica o **bundle publicado** (o eszip que a plataforma executa),
não o texto do arquivo. Ele serve para afirmar "esta é exatamente a build que estava
ativa", e não para ser recalculado a partir do `index.ts`.

## Como estas funções decidem quem pode enviar

### `dapi-enviar` e `enviar-produto`

Exigem uma identidade explícita. Duas são aceitas:

1. **Máquina** — header `x-envio-interno` com o token de serviço.
2. **Pessoa** — `Authorization: Bearer <JWT de usuário real>`. A anon key **não**
   serve: ela está em texto puro nos HTML legados públicos e não representa usuário
   nenhum. Só `dapi-enviar` aceita este modo; `enviar-produto` é exclusivamente
   máquina.

O token de serviço vive no Vault do Supabase sob o nome **`ncrm_envio_interno_token`**.
As funções nunca leem o segredo: elas repassam o que receberam para a RPC
`ncrm_envio_token_valido`, que compara dentro do banco e responde apenas sim ou não.
O valor esperado não sai do Vault nem trafega pela rede.

> O valor do token não está neste repositório e não deve estar em lugar nenhum fora
> do Vault. Aqui consta apenas o **nome** do segredo.

`verify_jwt` está `false` nas duas de propósito: o modo máquina não usa JWT, então a
porta de entrada foi implementada no código, e não delegada à plataforma. Antes das
versões v12/v13 estas funções eram endpoints públicos de envio de WhatsApp — qualquer
POST na internet disparava mensagem pelas instâncias da empresa.

Em `dapi-enviar`, quando quem chama é uma pessoa, a instância é resolvida **no
servidor** por `ncrm_resolver_envio_autorizado`, a partir de quem o usuário realmente
é. O `instancia_id` que vier no body é tratado como pedido, não como ordem — foi assim
que a v13 fechou o IDOR. A autoridade do piloto (`ncrm_pode_enviar_pelo_erp`) é
consultada sempre, inclusive no modo máquina.

### `enviar-whatsapp`

`verify_jwt = true`: a plataforma exige um JWT válido antes de a função rodar. Não há
verificação adicional no corpo e não foram encontrados callers. É candidata natural a
remoção, mas nada foi mexido nela nesta versionagem.

## Aviso sobre deploy

Estes arquivos são um espelho, não uma fonte de deploy automático. Antes de qualquer
`supabase functions deploy` a partir daqui, confirme que o source ainda é idêntico ao
que está ativo no painel — outras alterações podem ter sido feitas pelo painel desde a
captura.
