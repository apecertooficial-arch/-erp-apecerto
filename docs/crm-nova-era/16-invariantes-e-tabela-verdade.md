# 16 — Invariantes e tabela-verdade (FASE 2.2)

Correção 4: invariantes **bidirecionais**. Cada um está como CHECK no snapshot (doc DRAFT §B.4).
`⇔` = biconditional (dois CHECKs de implicação); `⇒` = implicação simples.

## 1. Lista de invariantes

| Id | Invariante | Forma | CHECKs |
|---|---|---|---|
| a | ativo (saída nula) `⇔` próxima ação completa (tipo+título+data) | `⇔` | `ck_ativo_tem_proxima`, `ck_saida_sem_proxima` |
| b | `saida` NOT NULL `⇔` `saida_em` NOT NULL | `⇔` | `ck_saida_impl_data`, `ck_data_impl_saida` |
| c | `saida='pipeline_visitas'` `⇔` `visita_id` NOT NULL | `⇔` | `ck_visita_impl_saida`, `ck_saida_impl_visita` |
| d | `saida='esteira_vendas'` `⇔` `proposta_id` NOT NULL | `⇔` | `ck_prop_impl_saida`, `ck_saida_impl_prop` |
| e | `saida='descartado'` `⇔` `descarte_motivo` NOT NULL | `⇔` | `ck_motivo_impl_saida`, `ck_saida_impl_motivo` |
| e' | `descarte_motivo='outro'` `⇒` `descarte_detalhe` não-vazio | `⇒` | `ck_descarte_outro` |
| f | `respondeu` `⇔` `primeira_resposta_em` NOT NULL | `⇔` | `ck_resp_impl_data`, `ck_data_impl_resp` |
| g | `resposta_pendente` `⇒` `respondeu` | `⇒` | `ck_pend_impl_resp` |
| h | `aguardando_automacao` `⇒` `msg_automatica_em` NOT NULL | `⇒` | `ck_auto_impl_msg` |
| i | NÃO (`aguardando_automacao` E `respondeu`) | excl. | `ck_auto_nao_respondeu` |

Consequências implícitas (garantidas pela combinação): `visita_id` e `proposta_id` nunca são
ambos NOT NULL (cada um força um valor diferente e único de `saida`); um estado em saída nunca tem
próxima ação; `descarte_motivo` só existe em descarte.

## 2. Tabela-verdade dos estados válidos do snapshot

Colunas: PA = próxima ação completa? · sd = saída · vis = visita_id · prop = proposta_id ·
mot = descarte_motivo · resp = respondeu · pri = primeira_resposta_em · pend = resposta_pendente ·
aut = aguardando_automacao · msg = msg_automatica_em.

| Situação | PA | sd | vis | prop | mot | resp | pri | pend | aut | msg | Válido? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Novo aguardando automação | sim | – | – | – | – | não | – | não | **sim** | **sim** | ✔ |
| Novo sem automação (ação já definida) | sim | – | – | – | – | não | – | não | não | opc | ✔ |
| Tentando contato (cadência) | sim | – | – | – | – | não | – | não | não | sim | ✔ |
| Respondeu, aguarda corretor | sim | – | – | – | – | **sim** | **sim** | **sim** | não | sim | ✔ |
| Em atendimento/acompanhamento | sim | – | – | – | – | sim | sim | não | não | sim | ✔ |
| Saída: visita agendada | **não** | pipeline_visitas | **sim** | – | – | sim | sim | não | não | sim | ✔ |
| Saída: proposta registrada | não | esteira_vendas | – | **sim** | – | sim | sim | não | não | sim | ✔ |
| Saída: descartado | não | descartado | – | – | **sim** | qq | – | não | não | opc | ✔ |
| Saída: nutrição | não | nutricao | – | – | – | qq | – | não | não | opc | ✔ |
| **Inválido**: ativo sem próxima ação | não | – | – | – | – | – | – | – | – | – | ✘ (a) |
| **Inválido**: visita_id sem saída de visita | qq | – | sim | – | – | – | – | – | – | – | ✘ (c) |
| **Inválido**: proposta_id em saída ≠ esteira | qq | descartado | – | sim | – | – | – | – | – | – | ✘ (d) |
| **Inválido**: primeira_resposta sem respondeu | qq | – | – | – | – | não | sim | – | – | – | ✘ (f) |
| **Inválido**: pendente sem respondeu | qq | – | – | – | – | não | – | sim | – | – | ✘ (g) |
| **Inválido**: aguardando automação já respondeu | qq | – | – | – | – | sim | sim | – | sim | sim | ✘ (i) |

`qq` = qualquer; `opc` = opcional; `–` = nulo/false.

## 3. Onde cada transição respeita os invariantes

As RPCs (doc 15) alteram os campos correlatos **na mesma transação**, de modo que a linha nunca é
gravada num estado inválido:

- registrar tentativa (não respondeu) → mantém ativo + próxima tentativa (a).
- registrar tentativa (respondeu/pediu retorno) → seta `respondeu`+`primeira_resposta_em` (f) e
  próxima ação comercial (a); zera `aguardando_automacao` (i).
- agendar visita → `saida='pipeline_visitas'`, `saida_em`, `visita_id`, zera próxima ação (a,b,c).
- registrar proposta → `saida='esteira_vendas'`, `saida_em`, `proposta_id`, zera próxima ação
  (a,b,d); **sem** criar venda (doc 18).
- descartar → `saida='descartado'`, `descarte_motivo(+detalhe)`, zera próxima ação (a,b,e,e').
- reativar → limpa `saida`/`saida_em`/FK/motivo e re-exige próxima ação (a,b,c,d,e).

## 4. Limite não expresso por CHECK

`tentativas_feitas ≤ config.max_tentativas` é cross-row (depende da config) — garantido pela RPC e
pela validação otimista do cliente (função pura da Fase 1.2), não por CHECK de tabela.
