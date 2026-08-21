# Edge Functions de envio — proveniência

Este diretório versiona os **sources ativos** das Edge Functions operacionais do
projeto Supabase `diaegvfveqezispcthwk`. Elas tinham sido deployadas direto pelo
painel e nunca existiram no Git. O que está aqui é um **espelho fiel** do que estava
rodando em produção no momento da captura — nenhuma linha de comportamento foi
alterada.

As três funções de WhatsApp foram capturadas em 2026-07-31. `meta-capi` foi
capturada em 2026-08-21, também pela API de gerenciamento do Supabase. A captura
não fez redeploy.

## Tabela de proveniência

| função | versão ativa | verify_jwt | ezbr_sha256 | o que faz | quem chama |
| --- | --- | --- | --- | --- | --- |
| `dapi-enviar` | 13 | `false` | `90b4a70364e2dcf8b4680d01ef4902e8383b5a8154c43c0cd7faa38f4685ddce` | Envio real de WhatsApp pela D-API — texto, áudio, imagem, vídeo e documento. Resolve qual instância usar, tenta as duas formas do 9º dígito e registra a mensagem em `wa_mensagens`. | `enviar-produto` (máquina) e serviços operacionais autorizados. O frontend usa os contratos canônicos de Chat/Funil 2. |
| `enviar-produto` | 6 | `false` | `ce7225e4065e310e3a357e65be3496f09f5203137d2f998c52c0a7030b10ee39` | Envia o pack de um empreendimento numa única chamada — fotos ordenadas (capa, fachada, decorado, lazer, planta, sala) mais o book em PDF. Delega cada envio a `dapi-enviar`. Aceita `dry_run` para conferir o plano sem disparar nada. | Nenhum caller no repositório. Só automações externas, em modo máquina. |
| `enviar-whatsapp` | 5 | `true` | `7b1f19b92db00d61c4e7c2ebba20e25a66aae5264173717edbfebd2bfdf8434f` | Envio de texto por uma instancia. A instancia e resolvida no servidor por `ncrm_resolver_envio_autorizado`; o `instancia_id` do body virou apenas um pedido. Consulta a autoridade do piloto antes de enviar. | Nenhum caller conhecido no repositorio. Mantida por precaucao, mas fechada. |
| `meta-capi` | 7 | `true` | `e11064a8e58705c870d20c8e4cb20e59f6f62215719b5cab6282533b2b727371` | Encaminha eventos consentidos para a Meta CAPI com o mesmo `event_id` do Pixel, deduplicação, hash de identificadores e trilha de entrega. | Site público, para eventos allowlisted como `schedule_complete`, `owner_cta_click` e `financing_open`. |

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

**v5** — `verify_jwt = true`, `ezbr_sha256 = 7b1f19b92db00d61c4e7c2ebba20e25a66aae5264173717edbfebd2bfdf8434f`

Ate a v4 esta funcao recebia `instancia_id` no corpo da requisicao e enviava por
ela, sem verificar nada. `verify_jwt = true` garantia apenas que havia **um**
usuario logado, nao que aquele usuario tivesse direito aquela instancia:
qualquer corretor podia enviar pela instancia de qualquer outro, e bastava
iterar ids para descobri-las.

**Protecao de posse (v5).** A instancia passou a ser resolvida no servidor, a
partir de quem o usuario realmente e:

1. `Authorization` precisa representar uma **pessoa**. A anon key e um JWT
   valido mas nao tem usuario, entao nao passa.
2. `ncrm_resolver_envio_autorizado(user_id, telefone, instancia_id)` decide qual
   instancia pode ser usada. Corretor so usa a propria; admin, diretor e gerente
   respondem pela operacao. O `instancia_id` do body virou apenas um pedido, e
   pedido negado vira `403 sem_permissao`.
3. `ncrm_pode_enviar_pelo_erp(...)` e consultada em seguida: o ERP nao envia por
   corretor que esta na abordagem humana. Bloqueio devolve `409 envio_bloqueado`.
4. So depois disso a credencial da instancia e lida e a D-API e chamada.

Toda decisao de autorizacao fica registrada em `ncrm_envio_autorizacao_log`.

**Proveniencia.** O `ezbr_sha256` acima e o do bundle publicado em producao,
lido de `list_edge_functions` em 31/07/2026. O arquivo neste repositorio e o
mesmo codigo que esta deployado — foi essa divergencia entre Git e producao que
o PR #41 fechou.
