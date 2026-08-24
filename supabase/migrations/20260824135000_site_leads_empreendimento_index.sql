-- Cobre a chave estrangeira usada na leitura de leads por produto.
create index if not exists site_leads_empreendimento_id_idx
  on public.site_leads(empreendimento_id)
  where empreendimento_id is not null;
