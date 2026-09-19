# Reconciliação de Edge Functions

Atualizado em: 2026-09-19

## Resultado sanitizado

- projeto remoto confirmado: `diaegvfveqezispcthwk`;
- funções remotas: 53;
- fontes locais antes desta reconciliação: 26;
- fontes locais após as correções e o draft de áudio: 31;
- slugs remotos agora cobertos localmente: 30;
- funções ainda somente remotas: 23;
- funções somente locais: 1 (`f2-feedback-visita-transcrever`, ainda não implantada);

Isso prova uma deriva de configuração e de fonte: produção executa código que
não pode ser integralmente reproduzido a partir do repositório atual.

## P1 áudio do feedback de visita

`f2-feedback-visita-transcrever` foi criada localmente como parte de um
contrato ainda não aplicado. Ela não reutiliza `chat-midia`, pois o bucket de
chat é público. O draft `P1_VISITA_FEEDBACK_AUDIO_DRAFT.sql` cria um bucket
privado próprio, metadado append-only ligado à visita, RLS por corretor/gestão,
SHA-256, tamanho e MIME verificáveis, claim idempotente, timeout e retry com
backoff limitado. A Edge exige JWT no gateway, segredo interno em comparação
constante e service role apenas no runtime; não registra áudio ou transcrição
em log.

O dispatcher do draft repete o padrão canônico cron → Edge → claim, com lote
limitado, lease de despacho, retry devido e recuperação de transcrição travada.
Ele nasce `enabled=false`, é service-only e só lê URL, JWT do gateway e segredo
interno por três nomes no Vault; nenhum valor é criado ou incorporado à fonte.

Aceite local atual: 8/8 contratos da fatia e gate frontend 520/520. A API da
Agenda reserva, calcula SHA-256, envia com o JWT do usuário e consulta o estado;
o componente compartilhado fica invisível até o servidor declarar a capacidade
e exige confirmação humana antes de copiar a transcrição. O harness sanitizado
validou desktop e 390 × 844 somente com GETs locais. A fonte ainda não passou
por `deno check`, o SQL não foi compilado em Postgres isolado, nenhum bucket foi
criado, nenhum áudio real foi carregado e nenhuma chamada externa foi realizada.

## Dependências diretas do ERP sem fonte local

| Função | Consumidor atual | Risco | Estado local |
| --- | --- | --- | --- |
| `dapi-qr` | Conexões e Minha Equipe | credencial de provedor, autorização de instância e webhook | fonte canônica reconstruída com JWT, autorização escopada e segredo somente no ambiente; não implantada |
| `admin-usuarios` | Minha Equipe | criação/remoção de usuário com privilégio administrativo | fonte canônica reconstruída; JWT, papel canônico, convite server-side e erros sanitizados; não implantada |
| `cadastro-publico` | `/cadastro` | criação de usuário por token público | fonte canônica reconstruída; hash, uso único reservado antes do efeito e compensação; não implantada |
| `definir-senha` | `/definir-senha` | alteração de credencial por token público | fonte canônica reconstruída; hash, reserva concorrente e erro sanitizado; não implantada |

## P0 `dapi-qr`

A versão remota foi inspecionada sem registrar seus valores secretos. Foram
encontrados quatro problemas estruturais: segredo de webhook incorporado à
fonte, CORS amplo, resposta de erro técnico ao cliente e autorização duplicada
por papéis. O repositório não continha uma cópia dessa função.

A substituição local:

- exige JWT tanto na configuração quanto no runtime;
- valida a sessão com `auth.getUser`;
- usa `wa_v7_painel`, a mesma autoridade escopada que abastece Conexões, para
  decidir se a instância pedida pertence ao usuário;
- lê credencial privilegiada somente depois dessa autorização;
- recebe o segredo do webhook exclusivamente por variável de ambiente;
- restringe origem e operações;
- não devolve resposta bruta do provedor nem detalhe interno;
- confirma conexão somente depois de configurar o webhook e persistir o estado.

Aceite local atual: 6 testes direcionados e gate frontend 456/456. A ferramenta
`deno` não está disponível nesta máquina, portanto `deno check` e `deno lint`
continuam pendentes. Não houve deploy nem alteração de segredo.

## P0 usuários e convites

As três funções de onboarding foram reconstruídas a partir do contrato real,
sem copiar seus problemas remotos:

- convite de autocadastro deixa de ser criado pelo navegador;
- a decisão administrativa usa o papel canônico do banco, não metadata do JWT;
- novos tokens têm 256 bits e somente o SHA-256 é persistido;
- links legados continuam aceitos provisoriamente até expirarem;
- autocadastro é restrito a `corretor`;
- convite é reservado atomicamente antes de criar conta ou alterar senha;
- falhas fazem compensação condicionada à mesma reserva;
- token sai da URL após a primeira leitura e senhas têm limite 8–72;
- CORS é restrito e respostas não expõem mensagens internas.

O navegador real encontrou e permitiu corrigir uma divergência de hidratação em
`/definir-senha`. Depois da correção, `/cadastro` e `/definir-senha` ficaram sem
erro de console nem overflow em 1280 px e 390 × 844; tokens sintéticos foram
removidos da URL. Nenhum cadastro ou senha real foi criado.

Aceite local: 12 testes da fatia, gate frontend 468/468, transpile sintático das
quatro fontes TypeScript, ESLint sem erro e build completo. O draft de banco
`P0_CONVITES_USUARIOS_DRAFT.sql` está fora de migrations e não foi aplicado.

## Funções críticas que já existiam nos dois lados

Quatro funções de runtime foram comparadas arquivo a arquivo com o pacote
implantado, sem registrar valores secretos:

| Função | Versão remota | Resultado da comparação | Estado local |
| --- | ---: | --- | --- |
| `dapi-webhook` | 20 | fonte exatamente igual | canônica e reproduzível |
| `dapi-enviar` | 25 | lógica e helper exatamente iguais; o pacote remoto apenas reescreve o caminho do helper durante o bundle | canônica e reproduzível |
| `f2-sara-reclassificar` | 32 | produção possuía 156 linhas funcionais ausentes localmente | reconciliada exatamente com o pacote implantado |
| `ncrm-web-push` | 14 | produção usava Vault e RPCs públicas restritas; a cópia local ainda usava Edge Secrets e RPCs antigas | reconciliada exatamente com o pacote implantado |

A Sara implantada acrescenta orçamento de IA fail-closed, preservação de
temperatura baseada em evidência, normalização de prazo, filtro da janela de
conversa e proteção contra reanálise de saída sem nova resposta. O push
implantado obtém o par VAPID por `ncrm_push_credenciais`, respeita o kill-switch
do banco e usa `ncrm_push_reservar`/`ncrm_push_resultado` com claim/lease.

Os quatro contratos de banco existem em produção como `SECURITY DEFINER`, mas
`anon` e `authenticated` não possuem `EXECUTE`; somente `service_role` e o
owner possuem acesso. A inspeção das fontes não encontrou credencial literal.

Aceite local desta reconciliação: falha reproduzida antes da mudança; 96/96
testes direcionados, gate frontend 469/469, build Vinext completo, ESLint dos
testes alterados e transpile sintático das duas Edge Functions. O commit
funcional é `2ae7e80e`. Nenhuma função foi implantada e nenhuma configuração
remota foi alterada.

## Demais funções somente remotas

As 23 funções restantes foram inspecionadas por fonte remota, referências no
repositório, chamadores no banco/cron e metadados agregados, sem PII:

| Grupo | Slugs | Evidência | Classificação |
| --- | --- | --- | --- |
| tombstones 410 | `codex-media-upload-once`, `crm-mover`, `dapi-diag`, `dapi-explorar`, `datacrazy-sync`, `dc-dryrun`, `dc-probe`, `dc-scan`, `produtos-smoke-storage-cleanup`, `render-proxy` | a fonte implantada contém somente resposta `410 funcao_desativada`; os quatro crons DataCrazy estão inativos | legado preservado; não copiar para o núcleo nem remover sem logs/rollback |
| unificada | `ia-notas-atendimento` | stub informa que a avaliação foi absorvida por `ia-avaliar-lote` | legado de compatibilidade |
| produto Site | `sara-site`, `site-financing-lead`, `site-media`, `site-seo`, `site-track`, `site-lead` | cinco fontes pertencem ao remoto `apecerto-site`; quatro são idênticas ao implantado e `site-track` remoto acrescenta `consent_prompt`/`prompt_source`; `site-lead` existe somente no runtime | produto separado; manter ownership no Site e contrato de integração com o ERP |
| captação Instagram | `corretores-publicos`, `lead-instagram` | comentários e contrato apontam para o projeto externo `apecerto-instagram`; não há repositório local; tabelas `integracao.ig_*` estão vazias | dependência externa/dormente a confirmar, não absorver por conveniência |
| entrada genérica | `captura-lead` | encaminha para `webhook_captura_lead` e `motor_fila`; não há chamador no código/cron e ela sobrepõe parte da responsabilidade de `site-lead`/`entrada` | duplicada/conflitante até prova do provedor externo |
| conversa D-API antiga | `dapi-chat-history` | nenhum chamador no código/banco e `dapi_chat_cache` possui zero linhas | candidato a legado; pode existir cliente externo antigo |
| DataCrazy | `dc-movimentacao-webhook` | crons do conector estão inativos e a tabela de movimentações possui zero linhas | legado ainda implantado; endpoint público com dívida de segurança |
| Meta audience | `meta-audience-sync` | a Edge ativa chama três RPCs ausentes: `meta_audience_sync_prepare`, `claim` e `finish` | quebrada/bloqueada; não pode ser anunciada como funcional |

O banco confirma atividade histórica do Site: `site_leads` possui 18 linhas e a
última gravação agregada observada foi em 2026-09-08; os recibos de financiamento
possuem três linhas na mesma data. Em contraste, cache D-API, movimentações
DataCrazy e tabelas Instagram observadas possuem zero linhas. Ausência de linha
não prova ausência de um chamador externo, portanto não autoriza exclusão.

No repositório canônico do Site
`apecertooficial-arch/apecerto-site` (cópia
`/Users/samuelnoviski/Documents/ChatGPT/apecerto-Site/repo`), `sara-site`,
`site-financing-lead`, `site-media` e `site-seo` são exatamente iguais aos
pacotes implantados. `site-track` está duas entradas de contrato atrás da versão
remota. `site-lead` precisa ser restaurada no repositório do Site, não copiada
para o núcleo do ERP.

Nenhuma função será removida até existir, para cada slug, prova de ownership,
chamadores, logs, segredos necessários, substituição, teste e rollback.

## Gate de publicação

Antes de implantar uma função reconstruída:

1. revisar o diff sem copiar segredo remoto;
2. executar testes, lint e typecheck Deno em ambiente adequado;
3. confirmar todos os nomes de secrets, sem exibir valores;
4. publicar um slug por vez;
5. validar o consumidor real e os casos negados;
6. comparar logs sanitizados e reverter imediatamente em caso de regressão.
