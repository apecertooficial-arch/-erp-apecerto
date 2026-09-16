-- Fase 0 (15/09/2026): fecha upload anonimo e leitura/exclusao sem dono nos buckets.
-- Buckets publicos continuam servindo URL publica (o WhatsApp usa isso); o que muda
-- e quem pode listar, enviar e apagar pela API.

-- chat-midia: antes INSERT e SELECT para {public} (inclusive anon), sem limite de tamanho.
drop policy if exists chatmidia_insert on storage.objects;
drop policy if exists chatmidia_read on storage.objects;
create policy chatmidia_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-midia' and public.is_equipe());
create policy chatmidia_read on storage.objects for select to authenticated
  using (bucket_id = 'chat-midia' and public.is_equipe());
update storage.buckets set file_size_limit = 16 * 1024 * 1024 where id = 'chat-midia';

-- esteira-docs: documentos com CPF/RG. So quem enxerga o processo (RLS de venda_processos) ou gestao.
drop policy if exists edocs_select on storage.objects;
drop policy if exists edocs_insert on storage.objects;
drop policy if exists edocs_delete on storage.objects;
create or replace function public.pode_acessar_arquivo_esteira(p_name text)
returns boolean language sql stable security invoker set search_path = public as $$
  select public.is_admin_exec() or public.is_product_manager()
    or (
      (storage.foldername(p_name))[1] = 'esteira'
      and exists (select 1 from public.venda_processos p where p.id::text = (storage.foldername(p_name))[2])
    );
$$;
create policy edocs_select on storage.objects for select to authenticated
  using (bucket_id = 'esteira-docs' and public.pode_acessar_arquivo_esteira(name));
create policy edocs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'esteira-docs' and public.pode_acessar_arquivo_esteira(name));
create policy edocs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'esteira-docs' and public.pode_acessar_arquivo_esteira(name));

-- corretor-docs: documentos e fotos do corretor. Dono do cadastro, o proprio avatar ou gestao.
drop policy if exists corretor_docs_select on storage.objects;
drop policy if exists corretor_docs_insert on storage.objects;
drop policy if exists corretor_docs_update on storage.objects;
create or replace function public.pode_acessar_arquivo_corretor(p_name text)
returns boolean language sql stable security invoker set search_path = public as $$
  select public.can_manage_all()
    or ((storage.foldername(p_name))[1] = 'avatares' and storage.filename(p_name) like (auth.uid())::text || '-%')
    or (
      (storage.foldername(p_name))[1] = 'corretor'
      and exists (select 1 from public.corretores c where c.id::text = (storage.foldername(p_name))[2] and c.usuario_id = auth.uid())
    );
$$;
create policy corretor_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'corretor-docs' and public.pode_acessar_arquivo_corretor(name));
create policy corretor_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'corretor-docs' and public.pode_acessar_arquivo_corretor(name));
create policy corretor_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'corretor-docs' and public.pode_acessar_arquivo_corretor(name));

-- projeto-anexos: so quem enxerga a tarefa (RLS de projeto_tarefas).
drop policy if exists pj_anexos_sel on storage.objects;
drop policy if exists pj_anexos_ins on storage.objects;
drop policy if exists pj_anexos_del on storage.objects;
create or replace function public.pode_acessar_anexo_tarefa(p_name text)
returns boolean language sql stable security invoker set search_path = public as $$
  select public.is_admin_exec()
    or (
      (storage.foldername(p_name))[1] = 'tarefas'
      and exists (select 1 from public.projeto_tarefas t where t.id::text = (storage.foldername(p_name))[2])
    );
$$;
create policy pj_anexos_sel on storage.objects for select to authenticated
  using (bucket_id = 'projeto-anexos' and public.pode_acessar_anexo_tarefa(name));
create policy pj_anexos_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'projeto-anexos' and public.pode_acessar_anexo_tarefa(name));
create policy pj_anexos_del on storage.objects for delete to authenticated
  using (bucket_id = 'projeto-anexos' and public.pode_acessar_anexo_tarefa(name));

revoke execute on function public.pode_acessar_arquivo_esteira(text), public.pode_acessar_arquivo_corretor(text), public.pode_acessar_anexo_tarefa(text) from anon, public;
grant execute on function public.pode_acessar_arquivo_esteira(text), public.pode_acessar_arquivo_corretor(text), public.pode_acessar_anexo_tarefa(text) to authenticated;
