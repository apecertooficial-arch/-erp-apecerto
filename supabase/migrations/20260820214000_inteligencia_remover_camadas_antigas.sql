-- A Central de Inteligência passou a ter somente duas leituras canônicas:
-- tracking_360_ceo(integer) e tracking_360_jornada_digital(integer).
-- Estas funções alimentavam a estrutura anterior, já removida do aplicativo.

drop function if exists public.intel_alertas(integer);
drop function if exists public.intel_aquisicao(integer);
drop function if exists public.intel_atendimento(integer);
drop function if exists public.intel_comportamento(integer);
drop function if exists public.intel_conversao(integer);
drop function if exists public.intel_corretores(integer);
drop function if exists public.intel_equipe(integer);
drop function if exists public.intel_financeiro(integer);
drop function if exists public.intel_gerentes(integer);
drop function if exists public.intel_imoveis(integer);
drop function if exists public.intel_privacidade(integer, text, text);
drop function if exists public.intel_proprietarios(integer);
drop function if exists public.intel_qualidade(integer);
drop function if exists public.intel_sara(integer);
drop function if exists public.intel_vendas(integer);
drop function if exists public.intel_visao_ceo(integer);
drop function if exists public.intel_visao_digital(integer);
drop function if exists public.tracking_360_digital_health(integer);
drop function if exists public.tracking_delivery_health(integer);
