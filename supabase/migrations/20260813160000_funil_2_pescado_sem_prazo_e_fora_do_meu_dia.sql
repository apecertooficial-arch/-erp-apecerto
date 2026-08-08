-- REGRA DO PESCADO (ago/2026)
--
-- O lead pescado nao cobra prazo. Ele nunca aparece no Meu Dia, nem antes nem
-- depois da tentativa de contato. O Meu Dia so vale enquanto tudo que esta nele
-- e obrigacao de verdade -- e lead frio do Aquario nao e obrigacao: e aposta.
--
-- O ciclo passa a ser:
--   1. corretor pesca            -> etapa Pescado, "Chamar o cliente", sem prazo
--   2. corretor chama            -> tentativa marcada, continua sem prazo
--   3. cliente responde          -> vai sozinho para Em atendimento / Conversando
--   4. cliente nao responde      -> fica em Pescado ate o corretor atualizar
--
-- COMO "SEM PRAZO" E EXPRESSADO: f2_lead.proxima_acao_em e NOT NULL e dezenas de
-- funcoes leem dela. Em vez de tornar a coluna anulavel e caçar cada leitura,
-- existe um valor sentinela (f2_sem_prazo) que nenhuma comparacao de data trata
-- como vencido, e a flag cobra_no_meu_dia no momento diz a verdade para a tela.

alter table public.f2_momento_config
  add column if not exists cobra_no_meu_dia boolean not null default true;

comment on column public.f2_momento_config.cobra_no_meu_dia is
  'false = momento sem cobranca: nao entra no Meu Dia, nao conta como atrasado, nao gera prazo. Hoje so o Pescado.';

create or replace function public.f2_sem_prazo()
returns timestamptz
language sql
immutable
as $$ select '2999-12-31 00:00:00+00'::timestamptz $$;

comment on function public.f2_sem_prazo() is
  'Sentinela de "sem prazo" para f2_lead.proxima_acao_em, que e NOT NULL. Nenhuma comparacao de data trata este valor como vencido.';

update public.f2_momento_config
   set cobra_no_meu_dia = false,
       prazo_minutos    = null,
       prazo_rotulo     = 'sem prazo',
       acao_rotulo      = 'Chamar o cliente',
       rotulo           = 'Pescado do Aquário'
 where codigo = 'CADENCIA_PESCADO';
