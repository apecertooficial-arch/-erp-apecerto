-- Catálogo oficial inicial: 5 templates visuais distintos por formato (20 total).
-- Seguro para bases novas e existentes: somente cria slugs ausentes.
do $$
declare
  v_org uuid := '00000000-0000-4000-8000-000000000001';
  v_format text;
  v_variant integer;
  v_slug text;
  v_name text;
  v_template_id uuid;
  v_version_id uuid;
  v_width integer;
  v_height integer;
  v_manifest jsonb;
begin
  foreach v_format in array array['feed','carousel','story','reel'] loop
    v_width := 1080;
    v_height := case when v_format in ('story','reel') then 1920 else 1350 end;
    for v_variant in 1..5 loop
      v_slug := v_format || '-oficial-' || v_variant;
      v_name := case v_format
        when 'feed' then 'Feed · ' || case v_variant when 1 then 'Editorial premium' when 2 then 'Imóvel em foco' when 3 then 'Guia do bairro' when 4 then 'Prova social' else 'Chamada comercial' end
        when 'carousel' then 'Carrossel · ' || case v_variant when 1 then 'Tour do imóvel' when 2 then 'Diferenciais' when 3 then 'Comparativo' when 4 then 'Guia e objeções' else 'Storytelling' end
        when 'story' then 'Stories · ' || case v_variant when 1 then 'Tour rápido' when 2 then 'Enquete' when 3 then 'Captação' when 4 then 'Bastidores' else 'Educação' end
        else 'Reel · ' || case v_variant when 1 then 'Tour 30s' when 2 then 'Bairro' when 3 then 'Especialista' when 4 then 'Dica prática' else 'Prova social' end
      end;
      insert into public.social_templates (organization_id, slug, nome, formato, ativo)
      values (v_org, v_slug, v_name, v_format, true)
      on conflict (organization_id, slug) do update set nome = excluded.nome, formato = excluded.formato, ativo = true
      returning id into v_template_id;
      if v_template_id is null then
        select id into v_template_id from public.social_templates where organization_id = v_org and slug = v_slug;
      end if;
      v_manifest := jsonb_build_object(
        'schema_version', 1, 'slug', v_slug, 'nome', v_name, 'formato', v_format,
        'width', v_width, 'height', v_height, 'source', jsonb_build_object('type','design_system'),
        'fonts', jsonb_build_array('Quicksand'), 'assets', jsonb_build_array(),
        'slots', jsonb_build_array(
          jsonb_build_object('key','imagem_principal','type','imagem','required',true),
          jsonb_build_object('key','headline','type','texto','required',true),
          jsonb_build_object('key','cta','type','texto','required',true),
          jsonb_build_object('key','logo','type','logo','required',true)
        ), 'layout_variant', v_variant
      );
      insert into public.social_template_versions (organization_id, template_id, versao, status, origem, manifesto, manifesto_checksum, publicado_em)
      values (v_org, v_template_id, 1, 'publicada', 'design_system', v_manifest, encode(extensions.digest(v_manifest::text, 'sha256'), 'hex'), now())
      on conflict (template_id, versao) do nothing
      returning id into v_version_id;
      if v_version_id is null then
        select id into v_version_id from public.social_template_versions where template_id = v_template_id and versao = 1;
      end if;
      insert into public.social_template_slots (organization_id, template_version_id, slot_key, tipo, obrigatorio)
      values
        (v_org, v_version_id, 'imagem_principal', 'imagem', true),
        (v_org, v_version_id, 'headline', 'texto', true),
        (v_org, v_version_id, 'cta', 'texto', true),
        (v_org, v_version_id, 'logo', 'logo', true)
      on conflict (template_version_id, slot_key) do nothing;
    end loop;
  end loop;
end $$;
