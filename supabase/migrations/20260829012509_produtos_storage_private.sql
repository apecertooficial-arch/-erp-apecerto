set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function produtos_authz.pode_gerir_midia_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select produtos_authz.usuario_ativo() and (
    coalesce(public.is_product_manager(), false)
    or exists (
      select 1 from public.midias m
      left join public.unidades un on un.id = m.unidade_id
      left join public.corretores cu on cu.id = un.captador_corretor_id
      left join public.corretores ce on ce.id = (select e.captador_corretor_id from public.empreendimentos e where e.id = m.empreendimento_id)
      where m.storage_path = p_path
        and (cu.usuario_id = (select auth.uid()) or (m.unidade_id is null and ce.usuario_id = (select auth.uid())))
    )
  );
$$;
revoke all on function produtos_authz.pode_gerir_midia_path(text) from public, anon, authenticated;
grant execute on function produtos_authz.pode_gerir_midia_path(text) to authenticated;

update storage.buckets set public = false where id = 'empreendimentos';

drop policy if exists emp_storage_write on storage.objects;
drop policy if exists emp_storage_insert_captador on storage.objects;
drop policy if exists emp_storage_select_captador on storage.objects;
drop policy if exists emp_storage_update_captador on storage.objects;
drop policy if exists emp_storage_delete_captador on storage.objects;

create policy emp_storage_select_captador on storage.objects for select to authenticated
using (bucket_id = 'empreendimentos' and (select produtos_authz.usuario_ativo()));

create policy emp_storage_insert_captador on storage.objects for insert to authenticated
with check (
  bucket_id = 'empreendimentos'
  and (select produtos_authz.usuario_ativo())
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((metadata->>'size')::bigint, 0) between 1 and 52428800
  and lower(coalesce(metadata->>'mimetype','')) = any (array[
    'image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif','image/gif',
    'video/mp4','video/quicktime','video/webm','application/pdf',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ])
);

create policy emp_storage_update_captador on storage.objects for update to authenticated
using (bucket_id = 'empreendimentos' and produtos_authz.pode_gerir_midia_path(name))
with check (bucket_id = 'empreendimentos' and produtos_authz.pode_gerir_midia_path(name));
create policy emp_storage_delete_captador on storage.objects for delete to authenticated
using (bucket_id = 'empreendimentos' and produtos_authz.pode_gerir_midia_path(name));

do $$
begin
  if (select public from storage.buckets where id = 'empreendimentos') is distinct from false then
    raise exception 'STORAGE_POSTCHECK: bucket empreendimentos não ficou privado.';
  end if;
  if has_function_privilege('anon','produtos_authz.pode_gerir_midia_path(text)','execute') then
    raise exception 'STORAGE_POSTCHECK: helper de mídia exposto a anon.';
  end if;
end $$;
