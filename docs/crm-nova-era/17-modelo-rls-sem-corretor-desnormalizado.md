# 17 — Modelo RLS sem corretor denormalizado (FASE 2.2)

Correções 1-3. O snapshot deixa de guardar `corretor_id`/`lead_id`; a autorização por linha lê a
**posse atual** em `public.negocios`.

## 1. Por que remover a posse do snapshot

Denormalizar `corretor_id` acelera consultas, mas cria duas dívidas: (a) manter o espelho em
sincronia (exigia trigger sobre `negocios`, uma tabela legada crítica) e (b) uma janela em que o
snapshot aponta o corretor antigo após uma transferência — vazamento de RLS. Removendo a coluna,
a posse tem **uma única fonte de verdade**: `negocios.corretor_id`. Transferência no legado passa a
valer imediatamente, sem trigger e sem espelho.

## 2. Helper de posse (fonte da RLS)

```
ncrm_private.negocio_corretor(p_negocio_id) -> bigint      -- SELECT negocios.corretor_id
ncrm_private.pode_ver_negocio(p_negocio_id) -> boolean     -- can_manage_all() OU dono atual OU gestor do dono
ncrm_private.pode_operar_negocio(p_negocio_id) -> boolean  -- pode_ver + has_perm('crm','operar')
```

Propriedades obrigatórias (todas verificadas antes de aplicar — doc 20):

- `SECURITY DEFINER`, `STABLE`, `SET search_path = ''`, referências qualificadas.
- **Owner** = role dona das tabelas, para que a leitura de `negocios` **não reentre na RLS de
  `negocios`** (evita recursão). BLOQUEIO a confirmar: se `negocios` estiver com
  `FORCE ROW LEVEL SECURITY`, o owner precisa de `BYPASSRLS` — decidir na migration real.
- `REVOKE ALL FROM PUBLIC, anon`; `GRANT EXECUTE` a `authenticated` só em `pode_ver_negocio`
  (usada nas policies); `pode_operar_negocio` usada dentro das RPCs.

## 3. Políticas (SELECT-only; escrita só por RPC)

```
CREATE POLICY ncrm_estado_sel   ON public.ncrm_estado   FOR SELECT TO authenticated
  USING (ncrm_private.pode_ver_negocio(negocio_id));
CREATE POLICY ncrm_evento_sel   ON public.ncrm_evento   FOR SELECT TO authenticated
  USING (ncrm_private.pode_ver_negocio(negocio_id));
CREATE POLICY ncrm_proposta_sel ON public.ncrm_proposta FOR SELECT TO authenticated
  USING (ncrm_private.pode_ver_negocio(negocio_id));
CREATE POLICY ncrm_config_sel   ON public.ncrm_workflow_config FOR SELECT TO authenticated USING (true);
CREATE POLICY ncrm_passo_sel    ON public.ncrm_workflow_passo  FOR SELECT TO authenticated USING (true);
```

Sem policies de INSERT/UPDATE/DELETE → escrita negada por default → só via RPC. `anon`: sem grant,
sem policy → nada. Config é pública para leitura (não sensível).

## 4. Comportamento em transferência (substitui o teste de sync da 2.1)

Antes (2.1): trigger sincronizava `ncrm_estado.corretor_id`; havia risco de janela.
Agora (2.2): **nada a sincronizar.** Ao transferir o negócio no legado
(`transferir_negocio`/UPDATE em `negocios.corretor_id`), a próxima avaliação de policy relê
`negocios` e:

1. o corretor **antigo** deixa de satisfazer `pode_ver_negocio` → não vê mais estado/eventos/proposta;
2. o corretor **novo** passa a satisfazer → vê imediatamente;
3. nenhuma linha de `ncrm_*` foi tocada pela transferência.

**Teste obrigatório (staging):** criar negócio+estado do corretor A; transferir para B; assert que
(1) A não lê mais as linhas `ncrm_*` do negócio; (2) B lê; (3) nenhuma escrita ocorreu em `ncrm_*`;
(4) o `corretor_id_no_evento` dos eventos antigos permanece A (atribuição point-in-time, correta).

## 5. Custo e mitigação

Cada avaliação de policy chama `pode_ver_negocio`, que faz um lookup em `negocios` por PK (barato) +
os helpers de papel. Para **listar por corretor**, o filtro efetivo recai sobre `negocios.corretor_id`.

- **Dependência**: índice em `public.negocios(corretor_id)`. É **proibido alterar `negocios`** nesta
  fase, então o índice **não é criado**; fica como pré-requisito da migration real (doc 20). Sem ele,
  listagens por corretor podem varrer `negocios` no pior caso.
- **Nos volumes do shadow** (subconjunto de negócios em `ncrm_estado`), o custo é baixo: o driver das
  consultas do doc 09 são os índices parciais de `ncrm_estado` (por etapa/prazo), com o filtro de
  corretor aplicado no JOIN a `negocios` (PK). A pressão só aparece em visão gestor-geral de grande
  escala — endereçada pelo índice legado agendado.
- **Recursão**: eliminada pelo helper DEFINER (lê `negocios` como owner). Verificar `FORCE RLS`
  (item BLOQUEIO acima).

## 6. Atribuição vs autorização

`ncrm_proposta.corretor_id` e `ncrm_evento.corretor_id_no_evento` continuam existindo como
**atribuição point-in-time** (quem fez), NUNCA como base de RLS. A autorização é sempre a posse
ATUAL derivada de `negocios`. Assim o histórico mostra quem agiu, e a visibilidade acompanha o dono
corrente.
