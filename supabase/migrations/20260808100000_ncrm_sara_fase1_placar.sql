-- ============================================================================
-- ITEM 1 — TAREFAS DA SARA, FASE 1: destravar a leitura do corretor e criar o
-- placar que autoriza a Fase 2 (Sara atualizando etapa sozinha).
--
-- CONTEXTO DO QUE JÁ EXISTE EM PRODUÇÃO (verificado no schema publicado, não no
-- repo — as migrations do repo estão à frente do que foi aplicado):
--   · ncrm_sara_analise  : 47 linhas, 100% decisao='pendente'. RLS LIGADA,
--                          ZERO policies, ZERO grants para authenticated.
--   · /api/ncrm/fila-operacional JÁ lê ncrm_sara_analise com o JWT do usuário e
--                          projeta o campo `sara_orientacao_curta` no Meu Dia.
--                          Como não há policy, a leitura volta VAZIA e a
--                          orientação da Sara está sempre nula no celular.
--   · ncrm_sara_decidir_analise(id, 'aprovada'|'rejeitada', just) já existe,
--                          é fail-closed via ncrm_private.pode_operar_negocio,
--                          é idempotente e NÃO muta operacional. Não é tocada
--                          por esta migration.
--   · ncrm_sara_acao      : 0 linhas. É log do modo `assist`, escrito só por
--                          ncrm_sara_organizar. Continua fechado — Fase 2.
--
-- O QUE ESTA MIGRATION FAZ
--   A) Policy de leitura por carteira + GRANT POR COLUNA em ncrm_sara_analise.
--   B) ncrm_sara_revisao_fila  — fila de revisão do admin, 1 item por negócio.
--   C) ncrm_sara_decidir_lote  — aprovar/rejeitar em lote, delegando a decisão
--                                unitária à RPC já publicada (sem duplicar regra).
--   D) ncrm_sara_placar        — taxa de acerto vs. meta (85% em 50 sugestões).
--
-- O QUE ESTA MIGRATION NÃO FAZ (proposital)
--   · Não destrava o modo `assist`/`execute`.
--   · Não altera etapa, contato, SLA, tentativas ou tarefa de ninguém.
--   · Não concede INSERT/UPDATE/DELETE a authenticated em nenhuma tabela Sara.
--   · Não altera o CHECK de `decisao` — a fila de revisão resolve a duplicidade
--     por consulta (ver comentário em B), sem mexer em constraint de produção.
--
-- APLICAÇÃO: aplicar SOMENTE esta migration. NÃO usar `supabase db push` — o
-- repo tem migrations à frente cujos objetos já existem no banco.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- A) LEITURA DO CORRETOR
--
-- A tabela continua com RLS ligada e sem grant amplo. Duas travas independentes:
--   1. policy   — escopo de carteira pela MESMA função usada no resto do CRM
--                 (ncrm_private.pode_ver_negocio: dono, gestor ou can_manage_all);
--   2. grant por coluna — metadados internos (context_hash, run_id,
--      versao_prompt, versao_modelo, ator, origem, modo) NUNCA chegam ao
--      navegador do corretor. Vazamento de prompt/modelo é vazamento de IP.
--
-- `decisao <> 'rejeitada'` na policy: sugestão que você reprovou não pode voltar
-- a aparecer no celular do corretor como orientação válida.
--
-- Continua valendo a trava da rota: /api/ncrm/fila-operacional filtra tudo pela
-- interseção com o conjunto autorizado vindo de ncrm_fila_trabalho. A policy é
-- a segunda camada, não a única.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_ncrm_sara_analise_negocio_recente
  ON public.ncrm_sara_analise (negocio_id, analisado_em DESC, id DESC);

DROP POLICY IF EXISTS ncrm_sara_analise_leitura_carteira ON public.ncrm_sara_analise;
CREATE POLICY ncrm_sara_analise_leitura_carteira
  ON public.ncrm_sara_analise
  FOR SELECT
  TO authenticated
  USING (
    decisao <> 'rejeitada'
    AND COALESCE(ncrm_private.pode_ver_negocio(negocio_id), false)
  );

-- Estado limpo antes de conceder: PUBLIC incluso, senão grant herdado sobrevive.
REVOKE ALL ON public.ncrm_sara_analise FROM PUBLIC;
REVOKE ALL ON public.ncrm_sara_analise FROM anon;
REVOKE ALL ON public.ncrm_sara_analise FROM authenticated;

-- Exatamente as 4 colunas do .select() de /api/ncrm/fila-operacional. Nada além.
-- `id` fica FORA de propósito: com ele o corretor enumeraria os ids das próprias
-- análises via PostgREST e poderia alimentar o placar por conta própria.
-- `decisao` também fica fora — a policy filtra por ela, e expressão de policy
-- não exige privilégio de coluna.
GRANT SELECT (negocio_id, proxima_acao_sugerida, justificativa, analisado_em)
  ON public.ncrm_sara_analise TO authenticated;

COMMENT ON POLICY ncrm_sara_analise_leitura_carteira ON public.ncrm_sara_analise IS
  'Fase 1: corretor lê a orientação da Sara apenas dos negócios da própria carteira, apenas colunas concedidas, e nunca sugestão rejeitada. Escrita segue exclusiva do runner (service_role).';


-- ---------------------------------------------------------------------------
-- B) FILA DE REVISÃO DO ADMIN
--
-- Um item por negócio. Dois cuidados que evitam fila suja:
--
--   1. DISTINCT ON pega a análise mais recente do negócio.
--   2. Descarta pendentes ANTERIORES à última análise já decidida do mesmo
--      negócio. Sem isso, ao decidir a mais nova, a penúltima pendente vira
--      "a mais recente pendente" e o card ressuscita com sugestão velha.
--
-- `classe` separa o que dá para aplicar do que não dá. Na carteira atual:
--   avanco 8 · regressao 8 · nada_a_mudar 7 · sem_sugestao 0.
-- 'regressao' é em_atendimento → tentando_contato: fora da whitelist do banco,
-- e é o grupo que indica ajuste no prompt da Sara, não decisão de UI.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ncrm_sara_revisao_fila(p_limite integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_uid uuid := auth.uid(); v_lim int := LEAST(GREATEST(COALESCE(p_limite,50),1),200);
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;

  RETURN jsonb_build_object('ok', true, 'itens', COALESCE((
    SELECT jsonb_agg(to_jsonb(y) - 'ordem' ORDER BY y.ordem, y.confianca DESC, y.analise_id)
    FROM (
    SELECT * FROM (
      SELECT DISTINCT ON (a.negocio_id)
        a.id                                   AS analise_id,
        a.negocio_id,
        l.nome                                 AS lead_nome,
        e.etapa                                AS etapa_real,
        a.etapa_atual                          AS etapa_na_analise,
        a.etapa_sugerida,
        a.proxima_acao_sugerida,
        a.prazo_sugerido,
        a.justificativa,
        a.evidencias,
        a.confianca,
        a.analisado_em,
        a.versao_modelo,
        (a.etapa_atual IS DISTINCT FROM e.etapa) AS estado_mudou,
        COALESCE(ncrm_private.sara_transicao_permitida(e.etapa, a.etapa_sugerida), false) AS na_whitelist,
        CASE
          WHEN a.etapa_sugerida IS NULL                                              THEN 'sem_sugestao'
          WHEN a.etapa_sugerida = e.etapa                                            THEN 'nada_a_mudar'
          WHEN ncrm_private.sara_transicao_permitida(e.etapa, a.etapa_sugerida)      THEN 'avanco'
          ELSE 'regressao'
        END AS classe,
        CASE
          WHEN a.etapa_sugerida IS NULL                                              THEN 4
          WHEN a.etapa_sugerida = e.etapa                                            THEN 3
          WHEN ncrm_private.sara_transicao_permitida(e.etapa, a.etapa_sugerida)      THEN 1
          ELSE 2
        END AS ordem
      FROM public.ncrm_sara_analise a
      JOIN public.ncrm_estado e ON e.negocio_id = a.negocio_id
      JOIN public.negocios   n ON n.id = a.negocio_id
      LEFT JOIN public.leads l ON l.id = n.lead_id
      WHERE a.decisao = 'pendente'
        AND e.saida IS NULL
        -- Descarta pendente anterior a uma decisão já tomada no mesmo negócio.
        -- Comparação por TUPLA (analisado_em, id): o runner grava várias linhas
        -- com o mesmo timestamp, e `>` puro descartaria pendente legítima no
        -- empate. NOT EXISTS também é imune a analisado_em nulo — `NULL > x`
        -- daria NULL e a linha sumiria em silêncio.
        AND NOT EXISTS (
              SELECT 1 FROM public.ncrm_sara_analise d
               WHERE d.negocio_id = a.negocio_id
                 AND d.decisao <> 'pendente'
                 AND (d.analisado_em, d.id) >= (a.analisado_em, a.id)
            )
      ORDER BY a.negocio_id, a.analisado_em DESC, a.id DESC
    ) x
    -- LIMIT precisa vir ANTES do jsonb_agg: aplicado no nível do agregado ele
    -- cortaria a linha única do resultado, não a lista de itens.
    ORDER BY x.ordem, x.confianca DESC, x.analise_id
    LIMIT v_lim
    ) y
  ), '[]'::jsonb));
END $function$;

COMMENT ON FUNCTION public.ncrm_sara_revisao_fila(integer) IS
  'Fila de revisão da Sara (admin). Um item por negócio, sem ressuscitar pendente anterior a decisão já tomada. Somente leitura.';


-- ---------------------------------------------------------------------------
-- C) DECISÃO EM LOTE
--
-- Não reimplementa regra nenhuma: delega item a item para
-- ncrm_sara_decidir_analise, que já valida decisão, checa
-- ncrm_private.pode_operar_negocio (fail-closed), é idempotente e grava o
-- evento auditável com aplicado=false.
--
-- SECURITY DEFINER aqui não escala privilégio: auth.uid() lê o JWT do request,
-- não o owner da função. Um usuário sem permissão continua recebendo
-- 'sem_permissao' em cada item.
--
-- can_manage_all() na porta, além do pode_operar_negocio de cada item: sem ele
-- o corretor poderia aprovar em massa as sugestões da PRÓPRIA carteira e
-- envenenar exatamente a métrica que autoriza soltar a Sara. Julgar a Sara é
-- trabalho de gestor. A decisão unitária de /api/ncrm/sara/decidir mantém o
-- comportamento que já estava publicado — esta trava vale para o lote.
--
-- Cada item roda em subtransação própria: uma exceção em um id não pode
-- derrubar as decisões já gravadas no mesmo lote.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ncrm_sara_decidir_lote(
  p_ids bigint[], p_decisao text, p_justificativa text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_uid uuid := auth.uid(); v_id bigint; v_r jsonb;
        v_ok int := 0; v_falha int := 0; v_erros jsonb := '[]'::jsonb; v_n int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;
  IF p_decisao NOT IN ('aprovada','rejeitada') THEN
    RETURN jsonb_build_object('ok',false,'erro','decisao_invalida');
  END IF;
  v_n := COALESCE(array_length(p_ids, 1), 0);
  IF v_n = 0   THEN RETURN jsonb_build_object('ok',false,'erro','lote_vazio');   END IF;
  IF v_n > 100 THEN RETURN jsonb_build_object('ok',false,'erro','lote_grande');  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    BEGIN
      v_r := public.ncrm_sara_decidir_analise(v_id, p_decisao, p_justificativa);
      IF COALESCE((v_r ->> 'ok')::boolean, false) THEN
        v_ok := v_ok + 1;
      ELSE
        v_falha := v_falha + 1;
        v_erros := v_erros || jsonb_build_object('analise_id', v_id, 'erro', v_r ->> 'erro');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_falha := v_falha + 1;
      v_erros := v_erros || jsonb_build_object('analise_id', v_id, 'erro', 'excecao', 'sqlstate', SQLSTATE);
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'decisao', p_decisao,
                            'confirmadas', v_ok, 'falhas', v_falha, 'erros', v_erros);
END $function$;

COMMENT ON FUNCTION public.ncrm_sara_decidir_lote(bigint[], text, text) IS
  'Aprovar/rejeitar análises da Sara em lote (máx. 100). Delega item a item para ncrm_sara_decidir_analise — mesma autorização fail-closed, mesma idempotência.';


-- ---------------------------------------------------------------------------
-- D) PLACAR DA SARA — o gatilho objetivo da Fase 2
--
-- Meta acordada: 85% de aprovação em 50 sugestões decididas. Enquanto
-- `atingiu_meta` for false, o modo `assist` NÃO deve ser destravado.
--
-- O gatilho olha `taxa_avanco`, NÃO a taxa geral. Motivo aritmético: as
-- regressões (8 de 23 hoje) serão rejeitadas por definição — o banco não
-- permitiria a transição nem com a Sara solta. Amarrar o gatilho à taxa geral
-- cria um teto de ~65% e a Fase 2 nunca destrava, por mais que a Sara acerte.
-- `taxa_avanco` mede a única coisa que a Fase 2 vai deixar a Sara fazer.
--
-- A classificação usa e.etapa (estado REAL de agora), a MESMA base de
-- ncrm_sara_revisao_fila. Usar a.etapa_atual (foto do momento da análise) faria
-- o item aparecer como "avanço" na tela e não entrar em decididas_avanco.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ncrm_sara_placar(
  p_amostra_minima integer DEFAULT 50, p_taxa_minima numeric DEFAULT 0.85)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_uid uuid := auth.uid();
        v_min int := GREATEST(COALESCE(p_amostra_minima, 50), 1);
        v_taxa numeric := LEAST(GREATEST(COALESCE(p_taxa_minima, 0.85), 0), 1);
        v_dec int; v_apr int; v_rej int; v_pend int;
        v_dec_av int; v_apr_av int;
        v_t numeric; v_t_av numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;

  SELECT count(*) FILTER (WHERE a.decisao <> 'pendente'),
         count(*) FILTER (WHERE a.decisao =  'aprovada'),
         count(*) FILTER (WHERE a.decisao =  'rejeitada'),
         count(*) FILTER (WHERE a.decisao =  'pendente'),
         count(*) FILTER (WHERE a.decisao <> 'pendente'
                            AND ncrm_private.sara_transicao_permitida(e.etapa, a.etapa_sugerida)),
         count(*) FILTER (WHERE a.decisao =  'aprovada'
                            AND ncrm_private.sara_transicao_permitida(e.etapa, a.etapa_sugerida))
    INTO v_dec, v_apr, v_rej, v_pend, v_dec_av, v_apr_av
    FROM public.ncrm_sara_analise a
    JOIN public.ncrm_estado e ON e.negocio_id = a.negocio_id;

  v_t    := CASE WHEN v_dec    > 0 THEN round(v_apr::numeric    / v_dec,    4) END;
  v_t_av := CASE WHEN v_dec_av > 0 THEN round(v_apr_av::numeric / v_dec_av, 4) END;

  RETURN jsonb_build_object(
    'ok', true,
    'meta', jsonb_build_object('amostra_minima', v_min, 'taxa_minima', v_taxa),
    'decididas', v_dec, 'aprovadas', v_apr, 'rejeitadas', v_rej, 'pendentes', v_pend,
    'taxa_aprovacao', v_t,
    'decididas_avanco', v_dec_av, 'aprovadas_avanco', v_apr_av, 'taxa_avanco', v_t_av,
    'faltam_para_amostra', GREATEST(v_min - v_dec_av, 0),
    -- O GATILHO. Só transições que a whitelist permite entram na conta.
    'atingiu_meta', (v_dec_av >= v_min AND COALESCE(v_t_av, 0) >= v_taxa),
    'atingiu_meta_geral', (v_dec >= v_min AND COALESCE(v_t, 0) >= v_taxa),
    'modo_sara', (SELECT modo FROM public.ncrm_sara_config WHERE id),
    'assist_operacao', (SELECT operacao FROM public.ncrm_sara_assist_config WHERE id),
    -- prova de contrato: a Fase 1 não pode ter movido nada. Aprovar sugestão
    -- grava evento com aplicado=false; qualquer número aqui acima de zero
    -- significa que alguém destravou o assist sem passar pelo placar.
    'acoes_aplicadas', (SELECT count(*) FROM public.ncrm_sara_acao WHERE aplicado)
  );
END $function$;

COMMENT ON FUNCTION public.ncrm_sara_placar(integer, numeric) IS
  'Placar da Sara. atingiu_meta=true (85% em 50 decisões SOBRE TRANSIÇÕES DA WHITELIST) é a condição acordada para avaliar o destravamento do modo assist na Fase 2. taxa_aprovacao/atingiu_meta_geral são informativos: a taxa geral é contaminada por regressões que o banco recusaria de qualquer forma.';


-- ---------------------------------------------------------------------------
-- GRANTS DAS NOVAS RPCs — fecha PUBLIC/anon, abre só authenticated.
-- A autorização real (can_manage_all / pode_operar_negocio) está DENTRO de cada
-- função; o grant é só a primeira porta.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ncrm_sara_revisao_fila(integer)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ncrm_sara_decidir_lote(bigint[], text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ncrm_sara_placar(integer, numeric)           FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ncrm_sara_revisao_fila(integer)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_decidir_lote(bigint[], text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_placar(integer, numeric)           TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- ROLLBACK (guardar junto; não executar agora)
--
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.ncrm_sara_placar(integer, numeric);
--   DROP FUNCTION IF EXISTS public.ncrm_sara_decidir_lote(bigint[], text, text);
--   DROP FUNCTION IF EXISTS public.ncrm_sara_revisao_fila(integer);
--   DROP POLICY   IF EXISTS ncrm_sara_analise_leitura_carteira ON public.ncrm_sara_analise;
--   REVOKE ALL ON public.ncrm_sara_analise FROM authenticated;
--   DROP INDEX  IF EXISTS public.ix_ncrm_sara_analise_negocio_recente;
--   COMMIT;
--
-- Efeito do rollback: o Meu Dia volta a não mostrar orientação da Sara (estado
-- de hoje). Nenhum dado operacional é perdido — esta migration não escreve em
-- ncrm_estado, ncrm_evento nem ncrm_sara_acao.
-- ============================================================================
