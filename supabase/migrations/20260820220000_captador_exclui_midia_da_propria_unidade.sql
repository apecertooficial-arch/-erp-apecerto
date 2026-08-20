-- A unidade captada é um produto independente. O captador precisa conseguir
-- remover uma mídia da própria unidade mesmo quando o arquivo foi enviado
-- originalmente por um gestor e, portanto, está na pasta daquele gestor.

drop policy if exists emp_storage_delete_captador on storage.objects;
create policy emp_storage_delete_captador on storage.objects
for delete to authenticated
using (
  bucket_id = 'empreendimentos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_product_manager()
    or exists (
      select 1
      from public.midias m
      join public.unidades u
        on u.id = m.unidade_id
       and u.empreendimento_id = m.empreendimento_id
      join public.corretores c on c.id = u.captador_corretor_id
      where m.storage_path = storage.objects.name
        and u.de_terceiros
        and c.usuario_id = (select auth.uid())
    )
  )
);
