-- VARREDURA DE WHATSAPP: PERGUNTAR ANTES DE ENTREGAR
--
-- 11/08/2026. Corretores relataram cerca de dez vezes no mesmo dia que o
-- WhatsApp respondia "este numero nao existe" em leads recem-recebidos.
-- Elizangela descartou os leads. O custo nao foi so o tempo dela: o funil
-- perdeu gente que talvez fosse recuperavel, e a fila perdeu credibilidade com
-- o time -- que e o dano mais caro, porque nao aparece em nenhum relatorio.
--
-- A investigacao provou tres coisas, nesta ordem:
--   1. os numeros no sistema sao byte a byte iguais aos da planilha da Meta --
--      nao houve quebra na importacao;
--   2. 10,3% dos numeros ja chegam fora de formato da propria origem (a pessoa
--      digitou errado no formulario) -- isso a normalizacao pega;
--   3. e o resto -- numero bem formado, plausivel, que simplesmente nao tem
--      WhatsApp -- nenhuma trava de formato jamais pegaria.
--
-- O item 3 e o que esta tabela resolve. A D-API responde direto em
-- POST /api/v1/contacts/check, sem enviar mensagem nenhuma: e consulta pura.
-- A resposta vira veredito gravado aqui, e a carga passa a exigir esse veredito
-- antes de por o lead na mao de alguem.

create table if not exists public.wa_numero_veredito (
  telefone      text primary key,
  tem_whatsapp  boolean not null,
  verificado_em timestamptz not null default now(),
  fonte         text
);

alter table public.wa_numero_veredito enable row level security;

-- A FILA DA VARREDURA. Devolve so quem ainda nao tem veredito -- por isso a
-- funcao e idempotente e pode ser chamada em laco sem controle externo: o que
-- ja foi respondido some da fila sozinho.
create or replace function public.f2_carga_numeros_para_checar(p_lote text, p_limite integer default 60)
returns table(telefone text)
language sql stable security definer set search_path to 'public'
as $function$
  select distinct public.telefone_br_normalizado(c.telefone)
    from public.f2_carga_lead c
   where c.lote = p_lote
     and c.distribuido_em is null
     and c.situacao in ('pendente', 'aguardando_varredura')
     and public.telefone_br_normalizado(c.telefone) is not null
     and not exists (
       select 1 from public.wa_numero_veredito v
        where v.telefone = public.telefone_br_normalizado(c.telefone))
   limit greatest(1, least(coalesce(p_limite, 60), 200));
$function$;

-- GRAVACAO DO VEREDITO.
--
-- Normaliza o numero devolvido pela D-API antes de gravar: ela responde as
-- vezes sem o nono digito, e sem normalizar o veredito nunca casaria com a
-- linha da carga -- a trava existiria e nao pegaria nada.
--
-- Na mesma transacao, bloqueia as linhas ainda nao distribuidas cujo numero
-- acabou de ser reprovado. Bloquear aqui, e nao so na hora da entrega, faz o
-- resultado da varredura aparecer no painel na hora.
create or replace function public.f2_carga_gravar_veredito(p_lote text, p_vereditos jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_grav int := 0; v_bloq int := 0;
begin
  insert into public.wa_numero_veredito (telefone, tem_whatsapp, verificado_em)
  select public.telefone_br_normalizado(x->>'numero'), (x->>'tem')::boolean, now()
    from jsonb_array_elements(p_vereditos) x
   where public.telefone_br_normalizado(x->>'numero') is not null
  on conflict (telefone) do update
    set tem_whatsapp = excluded.tem_whatsapp, verificado_em = now();
  get diagnostics v_grav = row_count;

  update public.f2_carga_lead c
     set situacao = 'sem_whatsapp', distribuido_em = now(),
         motivo = 'a D-API confirmou que este numero nao esta no WhatsApp'
    from public.wa_numero_veredito v
   where c.lote = p_lote and c.distribuido_em is null
     and v.telefone = public.telefone_br_normalizado(c.telefone)
     and v.tem_whatsapp = false;
  get diagnostics v_bloq = row_count;

  return jsonb_build_object('ok', true, 'vereditos', v_grav, 'bloqueados', v_bloq);
end $function$;

-- A varredura precisa correr sozinha, senao a trava da entrega vira uma fila
-- parada esperando alguem lembrar de rodar na mao. A cada 10 minutos e o
-- suficiente para ficar sempre a frente de uma entrega a cada 5.
select cron.schedule('wa-varredura-continua', '*/10 * * * *', $j$
  select net.http_post(
    url := 'https://diaegvfveqezispcthwk.supabase.co/functions/v1/wa-varredura-numeros',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-envio-interno', (select decrypted_secret from vault.decrypted_secrets where name='ncrm_envio_interno_token')
    ),
    body := jsonb_build_object('lote','carinas-ago26','limite',40,'bloco',4,'frentes',6,'espera_ms',30000),
    timeout_milliseconds := 55000
  );
$j$) where not exists (select 1 from cron.job where jobname = 'wa-varredura-continua');
