-- Onda 0.6 — fixar search_path nas funcoes que estavam sem.
--
-- O linter do Supabase aponta 15 funcoes com search_path mutavel. Conferi uma a
-- uma no catalogo: TODAS sao SECURITY INVOKER (prosecdef = false), entao o risco
-- de escalonamento de privilegio -- que e o motivo classico do alerta -- nao se
-- aplica aqui. Ainda assim, search_path fixo e higiene: garante que a funcao
-- resolva os nomes sempre no mesmo lugar, independente de quem a chama.
--
-- NAO MEXO nas 4 funcoes da extensao unaccent (unaccent, unaccent_init,
-- unaccent_lexize): pertencem a extensao e devem ser tratadas movendo a extensao
-- de schema, nao alterando funcao a funcao.
--
-- TESTADO: as 6 que sao trigger em tabelas centrais (produtos, negocios,
-- abordagens, agentes_ia, projetos, projeto_tarefas) foram exercitadas com
-- UPDATE real dentro de transacao revertida, sem erro.
--
-- REVERSAO: alter function <nome>(<args>) reset search_path;

alter function public.abordagens_herda_empreendimento() set search_path = public, pg_temp;
alter function public.f2_instancia_por_lead() set search_path = public, pg_temp;
alter function public.f2_sem_prazo() set search_path = public, pg_temp;
alter function public.fmt_brl_compact(numeric) set search_path = public, pg_temp;
alter function public.nome_normalizado(text) set search_path = public, pg_temp;
alter function public.pj_touch() set search_path = public, pg_temp;
alter function public.produtos_propaga_empreendimento() set search_path = public, pg_temp;
alter function public.produtos_touch() set search_path = public, pg_temp;
alter function public.sla_cor(text, numeric) set search_path = public, pg_temp;
alter function public.telefone_br_normalizado(text) set search_path = public, pg_temp;
alter function public.tg_agentes_ia_touch() set search_path = public, pg_temp;
alter function public.trg_negocio_estagio_desde() set search_path = public, pg_temp;
alter function central.trava_selo() set search_path = central, public, pg_temp;
alter function portado_do_datacrazy.dc_import_businesses() set search_path = portado_do_datacrazy, public, pg_temp;
alter function portado_do_datacrazy.dc_import_businesses(integer) set search_path = portado_do_datacrazy, public, pg_temp;
