-- Pré-requisito do harness: instala o STUB FIEL de motor_envia_abordagem (assinatura e
-- âncora reais de produção, com envio observável) e registra o checksum dessa versão
-- como auditada — do mesmo jeito que o checksum de produção é registrado na migration.
-- Sem isso, a migration aborta corretamente por não reconhecer a versão da função.
CREATE TABLE IF NOT EXISTS public.distribuicao_config (
  id bigint PRIMARY KEY, failover_envio boolean DEFAULT true, failover_transfere_lead boolean DEFAULT true
);
INSERT INTO public.distribuicao_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.abordagens (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true);
INSERT INTO public.abordagens (id, nome) VALUES (1,'Boas-vindas') ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.motor_execucoes (
  id bigserial PRIMARY KEY, automacao_id bigint, automacao_nome text, bloco_id text,
  evento text, status text, lead_nome text, lead_telefone text, detalhe text,
  criado_em timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.motor_envia_abordagem(p_auto bigint, p_nome text, p_bloco text,
    p_lead jsonb, p_lead_id bigint, p_corretor_id bigint, p_produto_id bigint, p_abordagem_ids jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  _cfg_failover boolean; _cfg_transfere boolean; v_tel text; _conv uuid;
begin
  select failover_envio, failover_transfere_lead into _cfg_failover, _cfg_transfere from distribuicao_config where id=1;
  _cfg_failover := coalesce(_cfg_failover,true); _cfg_transfere := coalesce(_cfg_transfere,true);
  v_tel := regexp_replace(coalesce(p_lead->>'telefone',''),'\D','','g');
  select cv.id into _conv from public.wa_contatos ct join public.wa_conversas cv on cv.contato_id = ct.id
   where ct.lead_id = p_lead_id limit 1;
  if _conv is null then return; end if;
  insert into public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, raw, criado_em)
  values (gen_random_uuid(), 'motor-'||p_lead_id||'-'||extract(epoch from clock_timestamp())::bigint,
          _conv, 'enviada', 'texto', 'Abordagem automatica', '{"origem":"motor"}'::jsonb, now());
  insert into public.motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
  values(p_auto,p_nome,p_bloco,'mensagem','ok',p_lead->>'nome',v_tel,'Abordagem enviada');
end $function$;

CREATE TABLE IF NOT EXISTS public.ncrm_funcao_legada_esperada (
  funcao text NOT NULL, checksum text NOT NULL, origem text NOT NULL, PRIMARY KEY (funcao, checksum)
);
INSERT INTO public.ncrm_funcao_legada_esperada (funcao, checksum, origem)
SELECT 'motor_envia_abordagem', md5(pg_get_functiondef(p.oid)), 'stub fiel do harness local'
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public' AND p.proname='motor_envia_abordagem'
ON CONFLICT DO NOTHING;
