# 09 — Consultas, índices e performance (FASE 2.0 — CONCEITUAL)

> ⚠️ **SUPERSEDIDO EM PARTE PELA FASE 2.2.** Onde este documento divergir dos docs 14–20, prevalecem os 14–20. Em especial: `ncrm_estado` **não** guarda `corretor_id` nem `lead_id`; **não** há trigger de sincronização em `negocios`; a RLS lê a **posse atual** em `negocios` (doc 17); invariantes bidirecionais no doc 16; ordem transacional no doc 15; ciclo da proposta no doc 18; draft autoritativo `sql-drafts/DRAFT-FASE-2.2-modelo-persistente.sql`.

Volumes de referência (evidência P0): 877 leads · 880 negócios · 21 vendas · wa ~7,2k msgs ·
`perf_eventos` 14,8k. Premissa de crescimento: 10× em 18 meses (≈9k negócios ativos históricos,
centenas ativos por corretor). Sem evidência de índices além de PK/FK no banco atual (doc 05 §6)
— os índices abaixo são todos do escopo `ncrm_*` (criados junto com as tabelas no draft).

Princípios: (1) o navegador NUNCA carrega todos os leads — toda consulta é por escopo
(corretor/etapa/dia) com paginação keyset; (2) o quadro/fila leem `ncrm_estado` + JOIN a
`negocios`/`leads` só para o nome/telefone de exibição (o `lead_id` NÃO é denormalizado no estado —
bloqueio 7); (3) histórico é lazy (por negócio, ao abrir a ficha).

> **Atualizado na Fase 2.1**: `lead_id` deixou de existir em `ncrm_estado`; as consultas 1/8/9
> obtêm o lead via `JOIN public.negocios n ON n.id = e.negocio_id JOIN public.leads l ON l.id =
> n.lead_id` (o JOIN a `leads` já era necessário para exibir nome). Os índices únicos parciais de
> saída foram removidos (bloqueio 10).

## Consultas principais

### 1. Quadro por etapa (uma coluna por vez, lazy)
```sql
SELECT e.negocio_id, n.lead_id, l.nome, e.etapa, e.proxima_acao_titulo, e.proxima_acao_em,
       e.resposta_pendente, e.temperatura, e.ultima_interacao_em, e.tentativas_feitas,
       e.aguardando_automacao, e.msg_automatica_em
FROM public.ncrm_estado e
JOIN public.negocios n ON n.id = e.negocio_id
JOIN public.leads    l ON l.id = n.lead_id     -- JOIN já necessário p/ exibir o nome
WHERE e.saida IS NULL AND e.etapa = $1
  AND (e.corretor_id = $2 OR $escopo_gestor)
ORDER BY e.proxima_acao_em NULLS LAST, e.negocio_id
LIMIT 50; -- keyset: WHERE (proxima_acao_em, negocio_id) > ($cursor_em, $cursor_id)
```
Índice: `ix_ncrm_estado_quadro (corretor_id, etapa, proxima_acao_em, negocio_id) WHERE saida IS NULL`.
Seletividade: corretor típico tem dezenas de leads ativos → index-only friendly. Risco de scan: nulo
com o parcial; sem o parcial, saídas acumuladas degradariam o quadro com o tempo.

### 2. Minha fila de hoje
```sql
SELECT e.*, CASE
  WHEN e.proxima_acao_em < now() - interval '24 hours' THEN 1        -- crítica
  WHEN e.resposta_pendente THEN 2
  WHEN e.proxima_acao_em <= now() + interval '60 minutes' THEN 3
  WHEN NOT e.respondeu AND e.tentativas_feitas = 0 THEN 4
  WHEN e.proxima_acao_em::date = (now() AT TIME ZONE cfg.timezone)::date THEN 5
  ELSE 6 END AS categoria
FROM ncrm_estado e JOIN ncrm_workflow_config cfg ON cfg.id = e.workflow_config_id
WHERE e.corretor_id = $1 AND e.saida IS NULL
ORDER BY categoria, e.proxima_acao_em NULLS LAST, e.negocio_id
LIMIT 100;
```
(Os limiares de criticidade vêm da config/severidade, não são hardcoded — expressão ilustrativa.)
Índice: o mesmo `ix_ncrm_estado_quadro` cobre o filtro; ordenação por categoria é computada sobre
dezenas de linhas do corretor → custo desprezível. Paginação raramente necessária (fila é curta
por definição); fallback keyset `(categoria, proxima_acao_em, negocio_id)` materializado no app.

### 3. Respostas pendentes
```sql
SELECT ... FROM ncrm_estado
WHERE resposta_pendente AND saida IS NULL AND (corretor_id = $1 OR $escopo_gestor)
ORDER BY ultima_interacao_em DESC LIMIT 50;
```
Índice parcial dedicado: `ix_ncrm_estado_resp (corretor_id, ultima_interacao_em DESC)
WHERE resposta_pendente AND saida IS NULL` — altíssima seletividade (poucas linhas true).

### 4. Atrasados
```sql
SELECT ... FROM ncrm_estado
WHERE saida IS NULL AND proxima_acao_em < now() AND (corretor_id = $1 OR $escopo_gestor)
ORDER BY proxima_acao_em ASC LIMIT 50;  -- keyset por (proxima_acao_em, negocio_id)
```
Coberto por `ix_ncrm_estado_quadro` (prefixo corretor) e, para visão gestor-geral,
`ix_ncrm_estado_prazo (proxima_acao_em) WHERE saida IS NULL`.

### 5. Leads de um corretor (lista completa da carteira)
```sql
SELECT ... FROM ncrm_estado WHERE corretor_id = $1 AND saida IS NULL
ORDER BY negocio_id LIMIT 50 OFFSET-free (keyset por negocio_id);
```

### 6. Indicadores do dia (contadores, sem carregar linhas)
```sql
SELECT count(*) FILTER (WHERE proxima_acao_em < now())                       AS vencidas,
       count(*) FILTER (WHERE resposta_pendente)                             AS respostas,
       count(*) FILTER (WHERE NOT respondeu AND tentativas_feitas = 0)       AS novos
FROM ncrm_estado WHERE corretor_id = $1 AND saida IS NULL;
-- concluídas hoje / visitas / propostas: agregação em ncrm_evento por dia
SELECT count(*) FROM ncrm_evento
WHERE criado_em >= $inicio_dia_tz AND tipo IN ('tentativa','acao_comercial')
  AND negocio_id IN (SELECT negocio_id FROM ncrm_estado WHERE corretor_id = $1);
```
Índices: quadro (acima) + `ix_ncrm_evento_dia (criado_em, tipo)`. Com 10× volume, considerar
visão materializada diária — registrado como evolução, não necessário nos volumes atuais.

### 7. Histórico de um lead (ficha, lazy)
```sql
SELECT tipo, numero_tentativa, canal, resultado, payload, origem, executado_por, criado_em
FROM ncrm_evento WHERE negocio_id = $1 ORDER BY id ASC LIMIT 200;
```
Índice: `ix_ncrm_evento_negocio (negocio_id, id)`. Seletividade máxima (um negócio).

### 8. Encaminhados para Visitas
```sql
SELECT e.negocio_id, n.lead_id, e.saida_em, v.data, v.hora_inicio, v.status
FROM public.ncrm_estado e
JOIN public.negocios n ON n.id = e.negocio_id
JOIN public.visitas  v ON v.id = e.visita_id
WHERE e.saida = 'pipeline_visitas' AND (e.corretor_id = $1 OR $escopo_gestor)
ORDER BY v.data, v.hora_inicio LIMIT 50;
```
Índice: `ix_ncrm_estado_saida (saida, corretor_id, saida_em) WHERE saida IS NOT NULL`.

### 9. Encaminhados para Esteira (proposta registrada — NÃO venda)
```sql
SELECT e.negocio_id, n.lead_id, e.saida_em, p.status AS proposta_status, p.valor, p.venda_id
FROM public.ncrm_estado e
JOIN public.negocios      n ON n.id = e.negocio_id
JOIN public.ncrm_proposta p ON p.id = e.proposta_id     -- aponta a PROPOSTA, não a venda
WHERE e.saida = 'esteira_vendas' AND (e.corretor_id = $1 OR $escopo_gestor)
ORDER BY e.saida_em DESC LIMIT 50;
```
Mesmo índice do item 8. A venda só aparece (`p.venda_id`) após a conversão; enquanto proposta não
converte, nada existe em `vendas` (proposta ≠ venda, doc 13 §1).

## Resumo de índices propostos (todos no draft)

| Índice | Tipo | Serve |
|---|---|---|
| `ncrm_estado` PK (`negocio_id`) | único | 1:1 negócio; lookup de ficha; **já garante linha única por negócio** |
| `ix_ncrm_estado_quadro (corretor_id, etapa, proxima_acao_em, negocio_id) WHERE saida IS NULL` | parcial | consultas 1, 2, 4, 5, 6 |
| `ix_ncrm_estado_resp (corretor_id, ultima_interacao_em DESC) WHERE resposta_pendente AND saida IS NULL` | parcial | consulta 3 |
| `ix_ncrm_estado_prazo (proxima_acao_em) WHERE saida IS NULL` | parcial | atrasados visão geral (gestor) |
| `ix_ncrm_estado_saida (saida, corretor_id, saida_em) WHERE saida IS NOT NULL` | parcial | consultas 8, 9 |
| `ux_ncrm_proposta_viva (negocio_id) WHERE status IN ('registrada','em_negociacao','aceita')` | único parcial | **anti-duplicação REAL de proposta** (substitui os índices redundantes do estado) |
| `ux_ncrm_proposta_idem (idempotency_key) WHERE idempotency_key IS NOT NULL` | único parcial | idempotência do registro de proposta |
| `ix_ncrm_evento_negocio (negocio_id, id)` | btree | consulta 7, replay |
| `ux_ncrm_evento_idem (idempotency_key) WHERE idempotency_key IS NOT NULL` | único parcial | idempotência de evento |
| `ix_ncrm_evento_ind (criado_em, tipo, negocio_id)` | btree | indicadores 6 (ordem período→tipo→negócio; justificar por EXPLAIN na homologação) |
| `ux_ncrm_passo (config_id, ordem)` | único | integridade da cadência |

**Removidos (bloqueio 10):** `ux_ncrm_estado_saida_visita/esteira` — redundantes porque `negocio_id`
já é PK (a linha do estado já é única por negócio) e eles NÃO impediam duplicação nas tabelas
externas `visitas`/`vendas`. A anti-duplicação efetiva mora em `ncrm_proposta` (viva+idem), em
`ncrm_evento.idempotency_key` e no contrato transacional que reutiliza visita futura existente
(doc 10.A). Também removido `ix_ncrm_estado_lead` (não há mais coluna `lead_id`).

## RLS × Data API (bloqueio 9)

- **RLS e GRANT são camadas distintas**: habilitar RLS NÃO concede acesso; conceder GRANT NÃO
  aplica filtro de linha. Ambos são necessários e explícitos (o draft faz `REVOKE ALL` + `GRANT
  SELECT` + `ENABLE ROW LEVEL SECURITY` + policies).
- **Exposição à Data API não é automática**: criar tabela não a torna acessível via REST — depende
  dos *exposed schemas* do PostgREST. Confirmar na fase de aplicação; `ncrm_private` NUNCA entra em
  exposed schemas. Não presumir REST disponível.
- **UPDATE via RLS exigiria uma SELECT policy** (a checagem `USING` de UPDATE lê a linha), mas nesta
  arquitetura a escrita é só por RPC — logo NÃO criamos policies de escrita, e o navegador não tem
  grant de UPDATE/INSERT/DELETE.
- **Views futuras** (ex.: leitura unificada da Esteira, doc 13) devem usar `security_invoker=true`
  (para herdar a RLS de quem consulta) ou ficar em schema não exposto — nunca uma view `security
  definer` que vaze linhas.
- **Custo dos helpers por linha**: policies que chamam `has_perm()`/`manages_broker()` são avaliadas
  por linha retornada; com escopo por corretor (poucas linhas) o custo é baixo, mas os helpers devem
  ser `STABLE` e sem recursão RLS (doc 08). Medir por `EXPLAIN` na homologação.

## Anti-padrões evitados (presentes no CRM atual)

- `fetchAll` de 30k linhas para o navegador → substituído por escopo+keyset (nunca OFFSET grande).
- Refetch total a cada evento realtime → o Nova Era pode assinar `ncrm_estado` por corretor
  (filtro de realtime por `corretor_id`) e aplicar patch pontual — desenho, não implementação.
- Listas globais com `LIMIT 500` sem filtro (crm_atividades) → histórico sempre por negócio.
