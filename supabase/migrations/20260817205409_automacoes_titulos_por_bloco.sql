-- Titulo amigavel por bloco da automacao: { "<blocoId>": "Lead novo entra" }.
-- ADITIVA e opcional: nenhuma automacao depende dela para rodar. O motor le
-- mapa->automation->blocks; esta coluna e so rotulo de tela.
-- Fica FORA de mapa de proposito: o compile() do construtor reconstroi
-- mapa.editor.blocks a cada salvamento e apagaria um campo que ele nao conhece.
alter table public.automacoes
  add column if not exists titulos jsonb not null default '{}'::jsonb;

comment on column public.automacoes.titulos is
  'Titulo amigavel por bloco (chave = id do bloco no editor). Apenas rotulo de interface; o motor nao le.';
