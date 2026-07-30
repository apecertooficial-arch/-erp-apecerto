# CRM Nova Era — auditoria do plano original × estado real

Levantada em 29/07/2026 sobre produção `diaegvfveqezispcthwk`, com `main = c62fa402f5d9d40e4cb3142e47a06798f8632b2b`.
Cada linha foi verificada no banco ou no código, não no relatório de fases anteriores.

## Matriz

| # | Requisito | Situação | Evidência | Correção |
|---|---|---|---|---|
| 1 | Entrada do lead | **Funcionando** | `leads`/`negocios` recebem de DataCrazy (cron 15/15 min) e do aquário | — |
| 2 | Distribuição escolhe o corretor | **Funcionando, intacto** | `distribuir_leads_orfaos` (cron 15 min), `aquario_pescar`, `pescar_lead_aquario`, `trg_negocio_herda_corretor` | Não alterar |
| 3 | Primeira abordagem automática | **Funcionando — e é o que sai nesta rodada** | trigger `motor_evento_etapa` → `motor_fila` → cron `motor-fila` (1 min) → `motor_processar_fila` → `motor_rodar` → `motor_envia_abordagem` | Bloqueio seletivo em `motor_envia_abordagem` |
| 4 | Criação do `ncrm_estado` | **Diferente do combinado** | nasce só quando a mensagem automática do motor é reconciliada (`ncrm_registrar_msg_automatica`); sem mensagem, não existe card | Nascer na distribuição |
| 5 | Distinção Nova Era × legado | **Ausente** | `ncrm_piloto` com 0 ativos; a reconciliação aceita qualquer negócio pós-corte | `ncrm_entrada_config` fail-closed |
| 6 | Quatro momentos | **Funcionando** | `ncrm_estado_etapa_check` = novo / tentando_contato / em_atendimento / em_acompanhamento | — |
| 7 | Cadência | **Funcionando** | `ncrm_cadencia_config` + `ncrm_private.ajustar_para_janela` | Reaproveitada na primeira abordagem humana |
| 8 | Meu dia | **Funcionando, mas técnico demais** | chips "Fase 4", ingest, runner, lote, observer visíveis ao corretor | PR B |
| 9 | Kanban | **Funcionando, denso** | 4 colunas corretas; card expõe "Automação enviou", múltiplas datas, 4 indicadores sem legenda | PR B |
| 10 | Ficha | **Funcionando, sobrecarregada** | mistura orientação, atraso, 6 ações, conversa e histórico | PR B |
| 11 | Chat interno | **Funcionando** | `LeadChatDrawer` reaproveitado do CRM antigo; sem `wa.me` | — |
| 12 | Sara | **Observer apenas** | `ncrm_sara_config.modo = observer`; `execute` bloqueado na RPC | Modo `assist` |
| 13 | Próxima ação | **Funcionando** | `ck_ativo_tem_proxima` obriga tipo+título+prazo | — |
| 14 | Notificações | **Ausente no Nova Era** | só existe a Central de atenção global (1.144 itens, contador histórico) | Modelo próprio |
| 15 | Fiscalização / justificativa | **Funcionando** | `ncrm_justificativa` | — |
| 16 | Gestão | **Parcial** | tabela por corretor; SLA negativo observado (`-336 min`) | PR B |
| 17 | Visitas | **Funcionando e intacto** | `ncrm_agendar_visita_e_encaminhar` só com data/hora reais | Não alterar |
| 18 | Propostas / Esteira | **Funcionando e intacto** | `ncrm_registrar_proposta_esteira`; proposta ≠ venda | Não alterar |
| 19 | Treinamento | **Funcionando** | `ncrm_treinamento` + 14 temas | — |
| 20 | Migração assistida | **Implementada, não executada** | prévia somente leitura; 0 migrados | Fora desta rodada |
| 21 | Kill-switch | **Funcionando** | desligar entrada/leitura no painel de Saúde | — |
| 22 | Segurança e auditoria | **Funcionando** | RLS em todas as `ncrm_*`; `anon` sem privilégio (PR #34); `search_path` fixo | — |

## Fluxo da primeira abordagem — antes

```
lead entra → negocios INSERT (stage_id)
  → trigger motor_evento_etapa → motor_fila
  → cron motor-fila (1 min) → motor_processar_fila → motor_rodar
  → motor_envia_abordagem → D-API → WhatsApp do cliente
  → wa_mensagens (raw.origem = 'motor')
  → cron ncrm_reconciliar → ncrm_registrar_msg_automatica → NASCE o ncrm_estado
```

O card dependia da mensagem automática. Sem envio, não havia atendimento.

## Fluxo da primeira abordagem — depois

```
lead entra → negocios INSERT/UPDATE com corretor_id (distribuição inalterada)
  → cron ncrm_reconciliar → ncrm_private.entrada_por_distribuicao()
  → NASCE o ncrm_estado em 'novo', com prazo de primeira abordagem
  → motor_envia_abordagem é BLOQUEADO para o negócio elegível
  → corretor abre o chat interno e envia a mensagem
  → cron ncrm_reconciliar detecta a outbound humana
  → 'novo' → 'tentando_contato', SLA real registrado
```

## Ponto exato do bloqueio

`public.motor_envia_abordagem`, logo após a leitura de `distribuicao_config` e antes de qualquer
resolução de instância ou chamada HTTP. Mesmo padrão dos guardas já existentes
(anti-duplicidade de 7 dias e de 30 min): registra em `motor_execucoes` e retorna.

O bloqueio só ocorre quando **as duas** condições valem:
1. `ncrm_entrada_config.modo_primeira_abordagem = 'humana'`; e
2. o negócio é elegível ao Nova Era segundo `ncrm_private.negocio_elegivel_nova_era`.

Com o escopo padrão `nenhum`, nenhum lead é elegível e o comportamento do legado é
byte a byte o de hoje. A ativação é uma decisão administrativa auditada, não um deploy.
