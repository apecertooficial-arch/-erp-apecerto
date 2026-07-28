# 18 — Ciclo de vida da proposta e reativação (FASE 2.2)

Correção 6. `ncrm_proposta` é entidade comercial **≠ venda**: registrar proposta nunca cria linha
em `vendas`, nunca marca `negocios.status='ganho'`, nunca infla VGV. `venda_id` só na conversão.

## 1. Estados e transições

```
                 registrada ──► em_negociacao ──► aceita ──► convertida (TERMINAL, cria/reutiliza venda)
                     │                │             │
                     ├────────────────┼─────────────┼──► recusada  (TERMINAL)
                     ├────────────────┼─────────────┼──► expirada  (TERMINAL)
                     └────────────────┴─────────────┴──► cancelada (TERMINAL)
```

Regras (impostas na RPC/trigger, pois dependem do valor anterior — não são CHECK de tabela):

| De | Para permitido |
|---|---|
| `registrada` | `em_negociacao`, `aceita`, `recusada`, `expirada`, `cancelada` |
| `em_negociacao` | `aceita`, `recusada`, `expirada`, `cancelada` |
| `aceita` | `convertida`, `cancelada` |
| `recusada` / `expirada` / `cancelada` / `convertida` | — (terminais) |

- Estados "vivos" (bloqueiam nova proposta do mesmo negócio, via `ux_ncrm_proposta_viva`):
  `registrada`, `em_negociacao`, `aceita`.
- `recusada`/`expirada`/`cancelada` exigem `motivo_encerramento` + `encerrada_em` (CHECK).
- `aceita` exige `aceita_em`; `convertida` exige `venda_id` + `convertida_em` (CHECK).
- `venda_id` só pode existir em `convertida` (CHECK) — separação proposta≠venda garantida no schema.

## 2. Contratos (RPCs; nada criado nesta fase)

| RPC | Efeito (transação única, ordem do doc 15) |
|---|---|
| `ncrm_saida_proposta(p_negocio_id, p_versao, produto, unidade, valor, data, p_idem)` | cria/reutiliza `ncrm_proposta` viva (`registrada`); estado → `saida='esteira_vendas'`, `proposta_id`, zera próxima ação; evento `proposta_registrada`. **NÃO toca `vendas`/Esteira.** |
| `ncrm_proposta_transicao(p_proposta_id, p_versao_prop, p_novo_status, p_motivo?)` | valida transição; grava `aceita_em`/`encerrada_em`+`motivo`; evento `proposta_transicao`. Se encerra (recusada/expirada/cancelada) uma proposta que sustenta a saída → dispara reativação (§3). |
| `ncrm_converter_proposta(p_proposta_id, p_versao_prop, p_idem)` | **só aqui** cria/reutiliza `vendas`+`venda_processos` (aplica a regra oficial de ganho da operação); proposta → `convertida`, `venda_id`; evento `proposta_convertida`. Gatilho (aceite? aprovação?) **decisão aberta** (doc 12/20). |

Não confiar em `p_corretor_id`/`p_lead_id`/`p_origem` do cliente (doc 15 §3). Idempotência por
`idempotency_key` na proposta e no evento.

## 3. Reativação explícita

Reativação nunca "ressuscita" uma proposta terminal — ela **cria um novo ciclo de atendimento** e,
se for o caso, uma nova proposta depois.

Dois gatilhos:

1. **Proposta encerrada** (recusada/expirada/cancelada) que sustentava `saida='esteira_vendas'`:
   `ncrm_proposta_transicao` chama, na MESMA transação, a limpeza da saída:
   estado → `saida=NULL`, `saida_em=NULL`, `proposta_id=NULL`, recomputa `etapa`
   (por `respondeu`/histórico), **re-exige próxima ação** (tipo+título+data obrigatórios — invariante
   a) e evento `reativacao` (payload: `proposta_id`, `motivo`, `origem_saida='esteira_vendas'`).
2. **Descartado/nutrição** de volta ao ativo: `ncrm_reativar(p_negocio_id, p_versao, p_motivo,
   p_proxima_tipo, p_proxima_em, p_idem)` — só a partir de `saida IN ('descartado','nutricao')`;
   limpa `saida`/`saida_em`/`descarte_motivo`/`descarte_detalhe`; re-exige próxima ação; evento
   `reativacao`.

Propriedades:

- **Auditável**: o descarte/recusa permanece nos eventos e (para proposta) na linha terminal de
  `ncrm_proposta`; nada é apagado. A reativação é um novo evento com motivo.
- **Sempre com próximo passo**: reativar sem informar a próxima ação viola o invariante (a) e é
  rejeitado.
- **Idempotente**: `idempotency_key` evita reativação dupla por reenvio.
- **Posse**: como toda operação, a autorização vem da posse atual em `negocios` (doc 17).

## 4. O que permanece aberto

O **momento exato da conversão** proposta → venda (no aceite? na aprovação da gestão? na entrada de
sinal?) fica **explicitamente aberto para validação operacional**. Isso NÃO autoriza reutilizar
`vendas` no registro inicial da proposta (proibido) e não afeta as demais correções. Propostas com
múltiplos imóveis também seguem abertas (hoje 1 proposta = 1 imóvel; N exigiria itens de proposta).
