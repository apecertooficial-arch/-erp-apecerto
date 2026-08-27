# Patch futuro do Make — atribuição Aratans

Status: preparado, **não publicado**. O cenário ativo não foi alterado.

## Causa comprovada

Os seis registros incompletos já chegaram à Central sem `meta_campaign_id` e `meta_adset_id`. A Central respeitou o contrato e não inventou os valores. O elo faltante é o payload HTTP do Make.

## Patch exato no módulo HTTP após Facebook Lead Ads

Mapear os campos do módulo Facebook Lead Ads que originou o bundle:

```json
{
  "meta_lead_id": "{{4.leadId}}",
  "leadgen_id": "{{4.leadId}}",
  "meta_form_id": "{{4.formId}}",
  "meta_page_id": "{{4.pageId}}",
  "meta_created_time": "{{4.dateCreated}}",
  "meta_is_organic": "{{4.isOrganic}}",
  "meta_campaign_id": "{{4.campaignId}}",
  "meta_campaign_name": "{{4.campaignName}}",
  "meta_adset_id": "{{4.adsetId}}",
  "meta_adset_name": "{{4.adsetName}}",
  "meta_ad_id": "{{4.adId}}",
  "meta_ad_name": "{{4.adName}}",
  "source": "facebook",
  "medium": "lead_ads",
  "platform": "facebook"
}
```

No Make, escolha os tokens **Campaign ID** e **Ad set ID** do mesmo módulo Facebook Lead Ads. Não use nome no campo de ID e não preencha valor fixo. Se a Meta entregar o campo vazio, o lead deve continuar entrando, mas a execução deve registrar aviso de atribuição incompleta; a Central continuará retornando `aplicado: false` quando faltar `meta_lead_id`.

## Teste antes de ativar

1. Execute `Run once` com um bundle de teste sanitizado e sem enviar uma nova pessoa real.
2. Confira no inspetor do módulo HTTP que os três níveis têm IDs numéricos: campanha, conjunto e anúncio.
3. Confirme resposta 2xx da entrada e execução `aplicado: true` do bloco explícito `Registrar rastreamento Meta`.
4. Só então ative a nova versão; rollback é restaurar o mapeamento anterior do módulo HTTP.

O fixture de contrato está em `tests/fixtures/meta-lead-ads-aratans.sanitized.json` e não contém PII.
