-- O Funil 2.0 e a unica carteira operacional. A pesca oficial permanece em
-- public.f2_pescar_negocio(bigint, uuid), que preserva a origem historica e
-- somente cria o card ativo quando o corretor escolhe pescar.
DROP FUNCTION IF EXISTS public.aquario_pescar();
DROP FUNCTION IF EXISTS public.pescar_lead_aquario(bigint);
