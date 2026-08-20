-- A unidade captada por corretor é o imóvel comercial. O condomínio é apenas
-- referência compartilhada e, por isso, não pode ser usado como fonte do captador.
--
-- A base foi auditada antes da validação: todas as unidades de terceiros já
-- possuem captador_corretor_id. Esta constraint impede novas perdas de vínculo,
-- inclusive em inserts diretos que não passem pela API do ERP.

alter table public.unidades
  add constraint unidades_terceiros_exige_captador_check
  check (coalesce(de_terceiros, false) = false or captador_corretor_id is not null)
  not valid;

alter table public.unidades
  validate constraint unidades_terceiros_exige_captador_check;

comment on constraint unidades_terceiros_exige_captador_check on public.unidades is
  'Toda unidade de captação individual deve permanecer vinculada ao corretor captador; o condomínio não substitui esse vínculo.';
