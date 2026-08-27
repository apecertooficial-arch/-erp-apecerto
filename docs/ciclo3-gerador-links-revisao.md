# Gerador de links — revisão final local

Status: patch pronto para revisão; **não publicado**.

## Antes

- Aceitava campanha vazia e gerava `campanha-a-definir`, tornando relatórios ambíguos.
- Aceitava qualquer texto em campos de ID, inclusive um ID de GTM no lugar de campanha.
- O botão copiava um link mesmo quando a URL era inválida.
- A regra de geração estava misturada à tela e era difícil testar.

## Depois

- Nome real de campanha obrigatório e normalizado em slug estável.
- IDs opcionais, mas, quando preenchidos, aceitam somente 6–25 dígitos.
- Destino exclusivamente HTTPS e parâmetros válidos já existentes são preservados.
- Botão de copiar fica desabilitado em erro.
- Regra isolada e coberta por testes para Meta, Google, orgânico próprio e parceiros.

## Canais canônicos

| Canal | `utm_source` | `utm_medium` | Uso |
|---|---|---|---|
| Meta | `facebook` | `paid_social` | anúncios Meta |
| Google | `google` | `cpc` | anúncios de pesquisa |
| Instagram | `instagram` | `social` | links do perfil/conteúdo |
| Orgânico próprio | `apecerto` | `organic` | links editoriais controlados pela ApêCerto |
| Parceiro | `parceiro` | `partner` | parceiros e indicações |
| Portal | `portal` | `referral` | portais imobiliários |
| WhatsApp | `whatsapp` | `messaging` | links distribuídos em conversas |
| Formulário Meta | `facebook` | `lead_form` | conclusão do Lead Ads |

Não se deve adicionar UTM aos links naturais indexados pelo Google: a busca orgânica já é classificada automaticamente. O canal “Orgânico próprio” serve apenas para links editoriais que a empresa controla.

## Rollback

Reverter `TrackingLinkBuilder.tsx`, remover `tracking-link.ts` e os testes novos. Nenhum link já emitido é alterado.
