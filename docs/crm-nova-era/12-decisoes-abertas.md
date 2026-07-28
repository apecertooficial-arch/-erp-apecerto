# 12 — Decisões (FASE 2.0 → fechadas/abertas na 2.1)

## FECHADAS na revisão da Fase 2.1 (não reabrir sem novo motivo)

1. **Estado por `negocio_id`** (decisão 1).
2. **Quatro etapas por CHECK** nesta primeira versão (decisão 2).
3. **Resposta híbrida webhook/manual**, com precedência do webhook (decisão 3).
4. **Proposta ≠ venda**: `ncrm_proposta` própria; registrar proposta não cria venda (decisão 11a; doc 13 §1).
5. **Não marcar `ganho` na proposta** — só na conversão/conclusão (decisão 11a).
6. **Humano prevalece sobre Sara** (doc 06 §7; doc 08).
7. **Snapshot + eventos** como espinha dorsal.
8. **Janela `America/Sao_Paulo`** (decisão implícita da 1.2, agora na config).
9. **Fins de semana operacionais** enquanto a config não disser o contrário (`fds_operacional=true`, decisão 6).

## CONTINUAM ABERTAS (bloqueiam partes da migration real)

- Intervalos definitivos da cadência (decisão 5) — v1 usa valores provisórios da 1.2.
- Feriados (decisão 7) — ponto de extensão comentado; sem tabela nesta fase.
- **Momento exato de converter proposta em venda** (aceite? aprovação? sinal?) — contrato B2 pronto,
  gatilho a definir com a operação.
- **Adaptação interna da Esteira** — recomendação C (shadow) → B (leitura unificada); A só se necessário.
- **Propostas com múltiplos imóveis** — hoje 1 proposta = 1 imóvel (vendas/venda_processos são
  single-produto); N exigiria tabela de itens da proposta — não criada nesta fase.

---

## Tabela original (mantida para rastreio; ver status acima)

Nada foi decidido silenciosamente: o draft SQL adota a RECOMENDAÇÃO, marcada como reversível.

| # | Decisão | Opções | Recomendação e porquê | Impacto se mudar |
|---|---|---|---|---|
| 1 | Estado por `lead_id` ou `negocio_id`? | (a) lead_id; (b) negocio_id; (c) ambos | **(b) negocio_id** — o CRM atual opera por negócio (kanban, SLA, alertas, visitas, vendas apontam p/ negócio); lead com 2 negócios teria 2 atendimentos legítimos. `lead_id` fica denormalizado p/ consulta | PK do `ncrm_estado`; consultas do doc 09 |
| 2 | Reutilizar `pipelines/pipeline_stages` p/ as 4 etapas ou catálogo próprio? | (a) stages novos num pipeline "Nova Era"; (b) CHECK fixo no estado; (c) tabela catálogo própria | **(b) CHECK fixo** — as 4 etapas são REGRA do produto (rules.ts), não configuração do cliente; stages legados têm acoplamento por nome e semântica por pipeline. Shadow usa mapa stage↔etapa à parte | Se o cliente exigir etapas configuráveis → migrar CHECK p/ catálogo (c) |
| 3 | Fonte oficial da "primeira resposta efetiva" | (a) webhook WA (`wa_mensagens.direcao='in'` via ingestão); (b) registro manual do corretor; (c) híbrido | **(c) híbrido com precedência do webhook** — automático marca `respondeu/primeira_resposta_em`; o manual (`resultado='respondeu'` na tentativa) também marca, para canais fora do WA (ligação). Evento guarda a origem | Definição de funil de conversão e SLA |
| 4 | Definição operacional de "resposta pendente" | (a) qualquer msg inbound não seguida de outbound; (b) inbound sem AÇÃO registrada do corretor; (c) janela de tempo | **(b)** — alinhado ao protótipo (resposta_pendente zera ao concluir ação/tentativa), não pune conversa em andamento | Regras da RPC de ingestão |
| 5 | Regra definitiva de cadência (intervalos/canais) + o que fazer com `atendimento_acoes`/`lead_momentos` | validar com operação | Config v1 = valores provisórios da Fase 1.2 (2h pós-automação; 2h/3h/24h/48h) **explicitamente a validar**; legados NÃO são migrados nem desligados nesta fase | Seed da config; treinamento |
| 6 | Fins de semana | (a) dias operacionais; (b) não operacionais; (c) janela reduzida | **(a) operacionais** — plantão de imobiliária vende no fim de semana (presença/fds já existe no motor: `fds_exige_presencas`); config permite mudar sem código | Cálculo de janela |
| 7 | Feriados | (a) ignorar; (b) tabela `ncrm_dias_nao_operacionais` | **(a) agora, (b) depois** — ponto de extensão comentado no draft; sem tabela nesta fase | Função de janela ganha um lookup |
| 8 | Reativação de descartado/nutrição | (a) livre; (b) só gestor; (c) qualquer um com evento auditável | **(c)** com exigência de próxima ação imediata (contrato 10.C); gestão pode restringir depois via `has_perm` | Guarda da RPC |
| 9 | Convivência com o CRM atual durante shadow (negócio movido por `ilike`, `status='perdido'` etc.) | (a) Nova Era espelha efeitos legados; (b) Nova Era ignora efeitos legados e mantém estado próprio | **(b) na fase shadow** (estado próprio + job de comparação aponta divergência); efeitos legados só no corte final | Passos 3-4 do doc 11 |
| 10 | Troca de corretor | (a) UPDATE simples no estado; (b) evento próprio `transferencia` + espelho das RPCs legadas | **(b)** — o legado já tem `transferir_negocio/transferencia_status`; Nova Era registra evento e sincroniza `corretor_id` do estado na ingestão | Tipo de evento adicional (cabe no CHECK atual? incluído: `correcao_manual`/payload; se aprovado, adicionar tipo dedicado no draft final) |
| 11 | Proposta: marcar `negocios.status='ganho'`? E proposta com múltiplos imóveis? | ganho: (a) na proposta (legado); (b) só na conclusão. múltiplos: (a) 1 proposta=1 imóvel; (b) N imóveis | **ganho: (b)** — a Fase 1.1/1.2 estabeleceu que Esteira ≠ pós-venda; marcar ganho na proposta infla conversão. **múltiplos: (a)** por ora (vendas/venda_processos são single-produto hoje); N exigiria tabela de itens — não criada | Contrato 10.B (`p_marcar_ganho` default false); Esteira |
| 12 | Precedência Sara × humano — mecanismo de identidade da Sara | (a) claim JWT `app_role='sara'`; (b) usuário de serviço dedicado em `usuarios` | **(a)** — não polui `usuarios`/`corretores` nem herda policies de humano; requer emissão de token dedicado na integração | Guarda da RPC `ncrm_sara_classificar` |

Itens que a REVISÃO deve responder antes da Fase 3: **1, 2, 3, 5, 11** (bloqueiam o DDL final);
os demais podem ser fechados durante o shadow.
