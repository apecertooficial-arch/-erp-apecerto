-- Autorizacao de envio para chamada de PESSOA (IDOR).
--
-- Hoje dapi-enviar aceita instancia_id vindo do body. Um corretor autenticado
-- pode mandar pela instancia de outro. Esta funcao resolve a instancia no
-- servidor a partir de quem o usuario REALMENTE e, e ignora o que o body pede.
--
-- Papeis reais no banco: corretor (5), admin (2, sem corretor vinculado),
-- diretor (1) e gerente (1). Corretor so usa a propria instancia; admin,
-- diretor e gerente respondem pela operacao e podem usar as demais.
--
-- Entra em vigor em duas etapas: primeiro em modo registro (a Edge consulta,
-- audita e NAO bloqueia), depois em modo bloqueio. Ligar o bloqueio junto com
-- a criacao seria arriscar derrubar o chat sem saber o volume real de casos.

CREATE TABLE IF NOT EXISTS public.ncrm_envio_autorizacao_log (
  id            bigserial PRIMARY KEY,
  user_id       uuid NULL,
  corretor_id   bigint NULL,
  instancia_pedida bigint NULL,
  instancia_resolvida bigint NULL,
  decisao       text NOT NULL,
  motivo        text NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ncrm_envio_aut_quando ON public.ncrm_envio_autorizacao_log (criado_em DESC);
REVOKE ALL ON public.ncrm_envio_autorizacao_log FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_envio_autorizacao_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ncrm_resolver_envio_autorizado(
  p_user_id       uuid,
  p_telefone      text,
  p_instancia_id  bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_role      text;
  v_corretor  bigint;
  v_inst      bigint;
  v_dapi      text;
  v_dono      bigint;
  v_resposta  jsonb;
  v_decisao   text;
  v_motivo    text;
BEGIN
  IF p_user_id IS NULL THEN
    v_decisao := 'negar'; v_motivo := 'sem_usuario';
  ELSE
    SELECT u.role INTO v_role FROM public.usuarios u WHERE u.id = p_user_id;
    SELECT c.id INTO v_corretor FROM public.corretores c
      WHERE c.usuario_id = p_user_id AND coalesce(c.ativo, false);

    IF v_role IS NULL THEN
      v_decisao := 'negar'; v_motivo := 'usuario_desconhecido';

    ELSIF v_role IN ('admin','diretor','gerente') THEN
      -- Responde pela operacao: pode usar a instancia pedida, se ela existir.
      IF p_instancia_id IS NOT NULL THEN
        SELECT i.id, i.instancia_dapi, i.corretor_id INTO v_inst, v_dapi, v_dono
          FROM public.instancias i WHERE i.id = p_instancia_id;
        IF v_inst IS NULL THEN v_decisao := 'negar'; v_motivo := 'instancia_inexistente';
        ELSE v_decisao := 'permitir'; v_motivo := 'papel_de_gestao'; END IF;
      ELSE
        v_decisao := 'permitir'; v_motivo := 'papel_de_gestao_sem_instancia_pedida';
      END IF;

    ELSIF v_corretor IS NULL THEN
      v_decisao := 'negar'; v_motivo := 'usuario_sem_corretor_vinculado';

    ELSE
      -- Corretor: so a propria instancia. O que o body pediu e irrelevante.
      SELECT i.id, i.instancia_dapi INTO v_inst, v_dapi
        FROM public.instancias i
       WHERE i.corretor_id = v_corretor
         AND (coalesce(i.conectada,false) OR i.status_dapi = 'connected')
       ORDER BY i.id LIMIT 1;

      IF v_inst IS NULL THEN
        v_decisao := 'negar'; v_motivo := 'corretor_sem_instancia_conectada';
      ELSIF p_instancia_id IS NOT NULL AND p_instancia_id <> v_inst THEN
        -- Tentou usar instancia de outro. Resolvemos para a dele.
        v_decisao := 'negar'; v_motivo := 'instancia_de_outro_corretor';
      ELSE
        v_decisao := 'permitir'; v_motivo := 'instancia_propria';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.ncrm_envio_autorizacao_log
    (user_id, corretor_id, instancia_pedida, instancia_resolvida, decisao, motivo)
  VALUES (p_user_id, v_corretor, p_instancia_id, v_inst, v_decisao, v_motivo);

  v_resposta := jsonb_build_object(
    'decisao', v_decisao, 'motivo', v_motivo,
    'corretor_id', v_corretor, 'instancia_id', v_inst, 'instancia_dapi', v_dapi, 'papel', v_role);
  RETURN v_resposta;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('decisao','negar','motivo','erro_ao_autorizar');
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_resolver_envio_autorizado(uuid,text,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ncrm_resolver_envio_autorizado(uuid,text,bigint) TO service_role;

COMMENT ON FUNCTION public.ncrm_resolver_envio_autorizado(uuid,text,bigint) IS
  'Resolve no servidor qual instancia o usuario pode usar. Ignora instancia_id do body para corretor. Registra toda decisao em ncrm_envio_autorizacao_log.';
