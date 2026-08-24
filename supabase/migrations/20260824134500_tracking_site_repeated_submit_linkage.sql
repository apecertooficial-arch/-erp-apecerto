-- Submissoes repetidas do mesmo telefone apontam para o mesmo lead apenas
-- quando existe exatamente um candidato CRM, evitando associacao ambigua.

with candidates as (
  select s.id site_lead_id,min(l.id) lead_id
    from public.site_leads s
    join public.leads l
      on right(regexp_replace(l.telefone,'\D','','g'),11)
       = right(regexp_replace(s.telefone,'\D','','g'),11)
   where s.crm_lead_id is null
   group by s.id
  having count(distinct l.id)=1
)
update public.site_leads s
   set crm_lead_id=c.lead_id,crm_synced_at=coalesce(s.crm_synced_at,now()),
       crm_sync_error=null
  from candidates c
 where s.id=c.site_lead_id;
