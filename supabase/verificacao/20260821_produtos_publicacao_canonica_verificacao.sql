-- ============================================================================
-- VERIFICACAO POS-MIGRATION — publicacao canonica ERP -> site
--
-- Execute no SQL Editor SOMENTE DEPOIS de aplicar a migration
-- 20260821190806_produtos_publicacao_canonica.sql.
-- Este arquivo nao altera dados nem estrutura; ele falha no primeiro desvio.
-- ============================================================================

do $verificacao$
declare
  v_n integer;
  v_bool boolean;
  v_txt text;
  v_esperado_empreendimentos bigint;
  v_esperado_unidades bigint;
  v_snapshot_empreendimentos bigint;
  v_snapshot_unidades bigint;
begin
  -- 0. O estado anterior foi preservado de forma privada, completa e sem PII.
  if to_regclass('private.produto_publicacao_snapshot_20260821') is null
     or to_regclass('private.produto_publicacao_snapshot_20260821_controle') is null then
    raise exception 'FALHA 0a: snapshot editorial privado ausente.';
  end if;

  select total_empreendimentos, total_unidades
    into v_esperado_empreendimentos, v_esperado_unidades
  from private.produto_publicacao_snapshot_20260821_controle
  where id;

  if not found then
    raise exception 'FALHA 0b: controle de cobertura do snapshot ausente.';
  end if;

  select count(*) filter (where entidade = 'empreendimento'),
         count(*) filter (where entidade = 'unidade')
    into v_snapshot_empreendimentos, v_snapshot_unidades
  from private.produto_publicacao_snapshot_20260821;

  if v_snapshot_empreendimentos <> v_esperado_empreendimentos
     or v_snapshot_unidades <> v_esperado_unidades then
    raise exception
      'FALHA 0c: snapshot incompleto; esperado %/% e encontrado %/%.',
      v_esperado_empreendimentos,
      v_esperado_unidades,
      v_snapshot_empreendimentos,
      v_snapshot_unidades;
  end if;

  select count(*) into v_n
  from information_schema.columns
  where table_schema = 'private'
    and table_name = 'produto_publicacao_snapshot_20260821'
    and column_name not in (
      'entidade', 'entidade_id', 'empreendimento_id', 'publicado',
      'aprovacao', 'rascunho', 'disponivel', 'capturado_em'
    );

  if v_n <> 0 then
    raise exception 'FALHA 0d: snapshot contém % coluna(s) fora do contrato sem PII.', v_n;
  end if;

  if has_table_privilege('anon', 'private.produto_publicacao_snapshot_20260821', 'SELECT')
     or has_table_privilege('anon', 'private.produto_publicacao_snapshot_20260821', 'INSERT')
     or has_table_privilege('authenticated', 'private.produto_publicacao_snapshot_20260821', 'SELECT')
     or has_table_privilege('authenticated', 'private.produto_publicacao_snapshot_20260821', 'INSERT')
     or has_table_privilege('authenticated', 'private.produto_publicacao_snapshot_20260821', 'UPDATE')
     or has_table_privilege('authenticated', 'private.produto_publicacao_snapshot_20260821', 'DELETE')
     or has_table_privilege('anon', 'private.produto_publicacao_snapshot_20260821_controle', 'SELECT')
     or has_table_privilege('authenticated', 'private.produto_publicacao_snapshot_20260821_controle', 'SELECT')
     or has_table_privilege('authenticated', 'private.produto_publicacao_snapshot_20260821_controle', 'INSERT')
     or has_table_privilege('authenticated', 'private.produto_publicacao_snapshot_20260821_controle', 'UPDATE')
     or has_table_privilege('authenticated', 'private.produto_publicacao_snapshot_20260821_controle', 'DELETE') then
    raise exception 'FALHA 0e: snapshot editorial exposto a anon/authenticated.';
  end if;

  -- 1. O lead publico referencia uma unidade real e o FK esta validado.
  select count(*) into v_n
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'site_leads'
    and column_name = 'unidade_id'
    and data_type = 'uuid';

  if v_n <> 1 then
    raise exception 'FALHA 1a: site_leads.unidade_id uuid ausente.';
  end if;

  select count(*) into v_n
  from pg_constraint
  where conrelid = 'public.site_leads'::regclass
    and conname = 'site_leads_unidade_id_fkey'
    and contype = 'f'
    and convalidated;

  if v_n <> 1 then
    raise exception 'FALHA 1b: FK site_leads -> unidades ausente ou nao validada.';
  end if;

  select count(*) into v_n
  from pg_constraint
  where conrelid = 'public.site_leads'::regclass
    and conname = 'site_leads_context_unidade_consistente'
    and contype = 'c'
    and convalidated;

  if v_n <> 1 then
    raise exception 'FALHA 1c: protecao contra unidade_id adulterada no context ausente.';
  end if;

  select count(*) into v_n
  from public.site_leads
  where (unidade_id is null and context ? 'unidade_id')
     or (unidade_id is not null and context ->> 'unidade_id' is distinct from unidade_id::text);

  if v_n <> 0 then
    raise exception 'FALHA 1d: % lead(s) com unidade_id divergente no context.', v_n;
  end if;

  -- 2. A normalizacao acontece antes da policy RLS e nao e invocavel pelo cliente.
  select count(*) into v_n
  from pg_trigger t
  where t.tgrelid = 'public.site_leads'::regclass
    and t.tgname = 'trg_site_lead_normalizar_unidade'
    and not t.tgisinternal
    and (t.tgtype & 2) = 2;

  if v_n <> 1 then
    raise exception 'FALHA 2a: trigger BEFORE de normalizacao do lead ausente.';
  end if;

  select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) into v_bool
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'site_lead_normalizar_unidade';

  if coalesce(v_bool, false) then
    raise exception 'FALHA 2b: anon pode executar a funcao privada de normalizacao.';
  end if;

  -- 3. Produto/unidade novos nascem fora da vitrine e o estado e coerente.
  select count(*) into v_n
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('empreendimentos', 'unidades')
    and column_name = 'publicado'
    and lower(coalesce(column_default, '')) in ('false', 'false::boolean');

  if v_n <> 2 then
    raise exception 'FALHA 3a0: pai e unidade precisam nascer com publicado=false; encontrados % defaults corretos.', v_n;
  end if;

  select column_default into v_txt
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'unidades'
    and column_name = 'publicado';

  if lower(coalesce(v_txt, '')) not in ('false', 'false::boolean') then
    raise exception 'FALHA 3a: unidades.publicado ainda tem default %, esperado false.', v_txt;
  end if;

  select pg_get_functiondef(p.oid) into v_txt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'produto_validar_preco_unidade';

  if lower(coalesce(v_txt, '')) not like '%tg_op = ''insert''%new.publicado := false%' then
    raise exception 'FALHA 3b: trigger nao força publicado=false em INSERT.';
  end if;

  if lower(coalesce(v_txt, '')) not like '%unit_price_required%'
     or lower(coalesce(v_txt, '')) not like '%new.disponivel is not true%'
     or lower(coalesce(v_txt, '')) not like '%new.aprovacao is distinct from ''aprovado''%' then
    raise exception 'FALHA 3b2: trigger nao trata preco/estado NULL de forma fechada.';
  end if;

  select count(*) into v_n
  from pg_trigger t
  where not t.tgisinternal
    and (
      (t.tgrelid = 'public.empreendimentos'::regclass
        and t.tgname = 'trg_empreendimentos_bloquear_publicacao_direta')
      or
      (t.tgrelid = 'public.unidades'::regclass
        and t.tgname = 'trg_unidades_bloquear_publicacao_direta')
    );

  if v_n <> 2 then
    raise exception 'FALHA 3b2a: esperado bloqueio de publicação direta no pai e unidade; encontrados % triggers.', v_n;
  end if;

  select pg_get_functiondef(p.oid) into v_txt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'produto_bloquear_publicacao_direta';

  if lower(coalesce(v_txt, '')) not like '%new.publicado is true and old.publicado is not true%'
     or lower(coalesce(v_txt, '')) not like '%produto_publicacao_context%'
     or lower(coalesce(v_txt, '')) not like '%auth.uid()%'
     or lower(coalesce(v_txt, '')) not like '%new.publicado := false%' then
    raise exception 'FALHA 3b2b: guard de publicação direta não está fail-closed ou não vincula auth.uid.';
  end if;

  select bool_or(
    has_function_privilege('anon', p.oid, 'EXECUTE')
    or has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) into v_bool
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'produto_bloquear_publicacao_direta';

  if coalesce(v_bool, false) then
    raise exception 'FALHA 3b2c: cliente consegue executar diretamente o guard privado de publicação.';
  end if;

  select pg_get_constraintdef(c.oid) into v_txt
  from pg_constraint c
  where c.conrelid = 'public.unidades'::regclass
    and c.conname = 'unidades_preco_total_reais_check';

  if lower(coalesce(v_txt, '')) not like '%publicado is not true%'
     or lower(coalesce(v_txt, '')) not like '%coalesce(valor_promo, valor_tabela) is not null%' then
    raise exception 'FALHA 3b3: constraint de preco permite publicacao NULL/sem valor.';
  end if;

  select string_agg(lower(pg_get_constraintdef(c.oid)), ' ') into v_txt
  from pg_constraint c
  where (
      c.conrelid = 'public.empreendimentos'::regclass
      and c.conname = 'empreendimentos_publicacao_consistente'
    ) or (
      c.conrelid = 'public.unidades'::regclass
      and c.conname = 'unidades_publicacao_consistente'
    );

  if lower(coalesce(v_txt, '')) not like '%publicado is not true%'
     or lower(coalesce(v_txt, '')) not like '%rascunho is false%'
     or lower(coalesce(v_txt, '')) not like '%disponivel is true%'
     or (
       lower(coalesce(v_txt, '')) not like '%is not distinct from ''aprovado''%'
       -- pg_get_constraintdef normaliza `IS NOT DISTINCT FROM` para a forma
       -- logicamente equivalente `NOT (... IS DISTINCT FROM ...)` no PG 17.
       and lower(coalesce(v_txt, '')) not like '%not (aprovacao is distinct from ''aprovado''%'
     ) then
    raise exception 'FALHA 3b4: constraints editoriais pai/unidade nao sao fechadas a NULL.';
  end if;

  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'produto_unidade_elegivel_site'
    and p.prosecdef;

  if v_n <> 1 then
    raise exception 'FALHA 3b5: helper privado de elegibilidade ausente.';
  end if;

  select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) into v_bool
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'produto_unidade_elegivel_site';

  if coalesce(v_bool, false) then
    raise exception 'FALHA 3b6: anon pode executar o helper privado de elegibilidade.';
  end if;

  select pg_get_functiondef(p.oid) into v_txt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'produto_validacao_publicacao';

  if lower(coalesce(v_txt, '')) not like '%produto_unidade_elegivel_site(u.id)%' then
    raise exception 'FALHA 3b7: validação do pai divergiu do helper de elegibilidade.';
  end if;

  select pg_get_functiondef(p.oid) into v_txt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'produto_definir_publicacao'
    and pg_get_function_identity_arguments(p.oid) =
      'p_empreendimento_id uuid, p_publicado boolean, p_unidade_id uuid';

  if lower(coalesce(v_txt, '')) not like '%produto_unidade_elegivel_site(id)%'
     or lower(coalesce(v_txt, '')) not like '%produto_unidade_elegivel_site(u.id) is not true%' then
    raise exception 'FALHA 3b8: decisão do pai divergiu do helper de elegibilidade.';
  end if;

  select count(*) into v_n
  from public.unidades u
  where u.publicado is true
    and (
      u.disponivel is not true
      or u.aprovacao is distinct from 'aprovado'
    );

  if v_n <> 0 then
    raise exception 'FALHA 3c: % unidade(s) publicada(s) em estado inconsistente.', v_n;
  end if;

  select count(*) into v_n
  from public.unidades u
  join public.empreendimentos e on e.id = u.empreendimento_id
  where u.publicado is true
    and (
      coalesce(u.valor_promo, u.valor_tabela) is null
      or case
        when lower(btrim(coalesce(e.finalidade, ''))) like '%alug%'
          or lower(btrim(coalesce(e.finalidade, ''))) like '%loca%'
          then coalesce(u.valor_promo, u.valor_tabela) not between 500 and 500000
        else coalesce(u.valor_promo, u.valor_tabela) not between 100000 and 100000000
      end
      or (
        u.valor_tabela is not null
        and u.valor_promo is not null
        and u.valor_promo > u.valor_tabela
      )
    );

  if v_n <> 0 then
    raise exception 'FALHA 3d: % unidade(s) publicada(s) com preco fora do contrato.', v_n;
  end if;

  select count(*) into v_n
  from public.empreendimentos e
  where e.publicado is true
    and e.preco is not null
    and case
      when lower(btrim(coalesce(e.finalidade, ''))) like '%alug%'
        or lower(btrim(coalesce(e.finalidade, ''))) like '%loca%'
        then e.preco not between 500 and 500000
      else e.preco not between 100000 and 100000000
    end;

  if v_n <> 0 then
    raise exception 'FALHA 3e: % empreendimento(s) publicado(s) com preco fora do contrato.', v_n;
  end if;

  -- 4. A RPC e transacional, autenticada e fechada para anon.
  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'produto_definir_publicacao'
    and pg_get_function_identity_arguments(p.oid) =
      'p_empreendimento_id uuid, p_publicado boolean, p_unidade_id uuid'
    and p.prosecdef;

  if v_n <> 1 then
    raise exception 'FALHA 4a: RPC produto_definir_publicacao esperada ausente ou sem SECURITY DEFINER.';
  end if;

  if has_function_privilege(
    'anon',
    'public.produto_definir_publicacao(uuid,boolean,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FALHA 4b: anon pode publicar produtos.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.produto_definir_publicacao(uuid,boolean,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FALHA 4c: authenticated nao recebeu EXECUTE na RPC.';
  end if;

  select pg_get_functiondef(p.oid) into v_txt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'produto_definir_publicacao'
    and pg_get_function_identity_arguments(p.oid) =
      'p_empreendimento_id uuid, p_publicado boolean, p_unidade_id uuid';

  if lower(coalesce(v_txt, '')) not like '%auth.uid()%'
     or lower(coalesce(v_txt, '')) not like '%is_product_manager()%'
     or lower(coalesce(v_txt, '')) not like '%set_config(%produto_publicacao_context%' then
    raise exception 'FALHA 4d: RPC nao valida sessao e papel gestor no proprio corpo.';
  end if;

  select pg_get_functiondef(p.oid) into v_txt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'aprovar_empreendimento'
    and pg_get_function_identity_arguments(p.oid) =
      'p_id uuid, p_aprovar boolean, p_motivo text';

  if lower(coalesce(v_txt, '')) not like '%produto_definir_publicacao(p_id, true, null)%' then
    raise exception 'FALHA 4e: RPC legada de aprovacao nao delega para a publicacao canonica.';
  end if;

  select count(*) into v_n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'produto_excluir'
    and pg_get_function_identity_arguments(p.oid) = 'p_empreendimento_id uuid'
    and p.prosecdef;

  if v_n <> 1 then
    raise exception 'FALHA 4f: RPC produto_excluir esperada ausente ou sem SECURITY DEFINER.';
  end if;

  if has_function_privilege('anon', 'public.produto_excluir(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.produto_excluir(uuid)', 'EXECUTE') then
    raise exception 'FALHA 4g: grants de produto_excluir não estão fechados para anon e abertos à sessão autenticada.';
  end if;

  select pg_get_functiondef(p.oid) into v_txt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'produto_excluir'
    and pg_get_function_identity_arguments(p.oid) = 'p_empreendimento_id uuid';

  if lower(coalesce(v_txt, '')) not like '%is_product_manager()%'
     or lower(coalesce(v_txt, '')) not like '%for update%'
     or lower(coalesce(v_txt, '')) not like '%product_has_links%'
     or lower(coalesce(v_txt, '')) not like '%from public.captacoes_portal%'
     or lower(coalesce(v_txt, '')) not like '%insert into public.erp_auditoria%'
     or lower(coalesce(v_txt, '')) not like '%delete from public.empreendimentos%' then
    raise exception 'FALHA 4h: produto_excluir não concentra autorização, locks, vínculos, DELETE e auditoria.';
  end if;

  -- 5. Toda alteracao editorial relevante gera auditoria por trigger.
  select count(*) into v_n
  from pg_trigger t
  where not t.tgisinternal
    and (
      (t.tgrelid = 'public.empreendimentos'::regclass
        and t.tgname = 'trg_empreendimentos_auditar_publicacao')
      or
      (t.tgrelid = 'public.unidades'::regclass
        and t.tgname = 'trg_unidades_auditar_publicacao')
    );

  if v_n <> 2 then
    raise exception 'FALHA 5a: esperado 2 triggers de auditoria, encontrados %.', v_n;
  end if;

  select count(*) into v_n
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'erp_auditoria'
    and column_name = 'usuario_id'
    and is_nullable = 'YES';

  if v_n <> 1 then
    raise exception 'FALHA 5b: erp_auditoria.usuario_id precisa aceitar NULL para operacao service_role.';
  end if;

  -- 6. A vitrine usa security_invoker, inclui UUID e slug unico por unidade.
  select coalesce('security_invoker=true' = any(c.reloptions), false) into v_bool
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'site_produtos'
    and c.relkind = 'v';

  if not coalesce(v_bool, false) then
    raise exception 'FALHA 6a: site_produtos nao esta com security_invoker=true.';
  end if;

  select count(*) into v_n
  from public.site_produtos sp
  cross join lateral json_array_elements(sp.unidades_site) unidade
  where nullif(unidade ->> 'id', '') is null
     or nullif(unidade ->> 'slug', '') is null;

  if v_n <> 0 then
    raise exception 'FALHA 6b: % unidade(s) da vitrine sem id ou slug.', v_n;
  end if;

  select count(*) into v_n
  from (
    select unidade ->> 'slug' as slug
    from public.site_produtos sp
    cross join lateral json_array_elements(sp.unidades_site) unidade
    group by unidade ->> 'slug'
    having count(*) > 1
  ) duplicados;

  if v_n <> 0 then
    raise exception 'FALHA 6c: % slug(s) de unidade duplicado(s).', v_n;
  end if;

  select count(*) into v_n
  from public.site_produtos
  where json_array_length(unidades_site) = 0;

  if v_n <> 0 then
    raise exception 'FALHA 6d: % produto(s) exposto(s) sem unidade visivel.', v_n;
  end if;

  if not has_table_privilege('anon', 'public.site_produtos', 'SELECT') then
    raise exception 'FALHA 6e: visitante nao consegue ler site_produtos.';
  end if;

  -- 7. Tabelas legadas/sensiveis nao ficam expostas ao visitante.
  if has_table_privilege('anon', 'public.anuncios_site', 'SELECT') then
    raise exception 'FALHA 7a: anon ainda le anuncios_site legado.';
  end if;

  if has_table_privilege('anon', 'public.captacoes_portal', 'SELECT') then
    raise exception 'FALHA 7b: anon ainda le captacoes_portal.';
  end if;

  select count(*) into v_n
  from (values
    ('public.anuncios_site'),
    ('public.captacoes_portal'),
    ('public.empreendimentos'),
    ('public.unidades')
  ) as alvo(tabela)
  where has_table_privilege('authenticated', tabela, 'TRUNCATE')
     or has_table_privilege('authenticated', tabela, 'REFERENCES')
     or has_table_privilege('authenticated', tabela, 'TRIGGER');

  if v_n <> 0 then
    raise exception 'FALHA 7c: % tabela(s) ainda concede(m) privilegio estrutural ao authenticated.', v_n;
  end if;

  if has_table_privilege('authenticated', 'public.empreendimentos', 'DELETE') then
    raise exception 'FALHA 7d: authenticated ainda pode apagar empreendimento sem fluxo RLS.';
  end if;

  raise notice 'OK — publicacao canonica ERP -> site validada sem alterar dados.';
end
$verificacao$;

-- Fotografia operacional para registrar junto ao deploy.
select
  (select count(*) from public.empreendimentos where publicado) as empreendimentos_publicados,
  (select count(*) from public.unidades where publicado) as unidades_publicadas,
  (select count(*) from public.site_produtos) as itens_visiveis_no_site,
  (select count(*) from public.site_leads where unidade_id is not null) as leads_com_unidade,
  (select count(*) from public.erp_auditoria
    where entidade in ('empreendimento', 'unidade')
      and criado_em >= now() - interval '24 hours') as auditorias_editoriais_24h;
