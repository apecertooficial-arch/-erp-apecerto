# 07 — Matriz de reuso de tabelas (FASE 2.0)

> ⚠️ **SUPERSEDIDO EM PARTE PELA FASE 2.2.** Onde este documento divergir dos docs 14–20, prevalecem os 14–20. Em especial: `ncrm_estado` **não** guarda `corretor_id` nem `lead_id`; **não** há trigger de sincronização em `negocios`; a RLS lê a **posse atual** em `negocios` (doc 17); invariantes bidirecionais no doc 16; ordem transacional no doc 15; ciclo da proposta no doc 18; draft autoritativo `sql-drafts/DRAFT-FASE-2.2-modelo-persistente.sql`.

Legenda de veredicto: **REUSA-FK** (referencia por FK, sem alterar) · **REUSA-LÊ** (só leitura) ·
**NÃO TOCAR** (nem ler no fluxo Nova Era) · **NOVA** (criada pelo Nova Era).
Nenhuma tabela existente é estendida nesta fase.

| Estrutura | Veredicto | Papel no Nova Era | FK usada | Risco / observação |
|---|---|---|---|---|
| `leads` | REUSA-FK | Identidade do contato; nome/telefone/origem | `ncrm_evento.lead_id` (point-in-time); no snapshot deriva via `negocios` (NÃO denormalizado — doc 17) | ALTO acoplamento (10+ leitores); jamais escrever nos blocos de "momento" |
| `negocios` | REUSA-FK | Âncora operacional (1:1 com `ncrm_estado`); **fonte da posse (RLS)** | `ncrm_estado.negocio_id` PK/FK; posse lida ao vivo (doc 17) | Não adicionar colunas; sem trigger de sync (2.2); depende de índice `corretor_id` (doc 20 B3) |
| `corretores` | REUSA-LÊ | Atribuição point-in-time (quem agiu), NÃO base de RLS | `ncrm_proposta.corretor_id`, `ncrm_evento.corretor_id_no_evento` | Posse/visibilidade vêm de `negocios`, não de coluna denormalizada (doc 17) |
| `usuarios` | REUSA-FK | Auditoria (quem executou; uuid) | `ncrm_evento.executado_por` | Dupla identidade documentada (doc 05 §0.4) |
| `pipelines` | REUSA-LÊ | Só p/ shadow-mapping e convivência com CRM atual | — | Acoplamento por NOME (`ilike '%visita ape%'`) já existente; não replicar |
| `pipeline_stages` | REUSA-LÊ | Mapeamento legado↔etapa Nova Era no shadow | — | As 4 etapas Nova Era NÃO viram stages (decisão 12.2) |
| `visitas` | REUSA-FK | Saída A (contrato 10.A cria/reutiliza aqui) | `ncrm_estado.visita_id` | Reuso evita visita duplicada entre CRMs |
| `vendas` / `venda_processos` | REUSA-FK (só na CONVERSÃO) | Venda nasce apenas quando a proposta é aceita/convertida (`ncrm_proposta.venda_id`) | `ncrm_proposta.venda_id` | **Proposta ≠ venda (fechado, doc 13 §1)**; registrar proposta NÃO toca aqui |
| `esteira_etapas` + blocos (`venda_condicoes` etc.) | REUSA-LÊ | Esteira segue dona do pós-proposta | — | Nada muda |
| `wa_contatos`/`wa_conversas`/`wa_mensagens` | REUSA-LÊ | Fonte da primeira resposta e idempotência de webhook | `idempotency_key = 'wa:'||wa_message_id` (conceitual) | Fonte oficial da resposta = decisão 12.3 |
| `wa_instancias`/`instancias`/`corretor_instancias` | REUSA-LÊ | Registrar instância do disparo automático no payload do evento | — | — |
| `wa_eventos` | NÃO TOCAR | Fila do webhook continua do subsistema WA | — | Padrão de idempotência inspirou `ncrm_evento` |
| `crm_atividades` | NÃO TOCAR | Continua servindo o CRM atual | — | Nova Era não escreve nem lê |
| `atendimento_acoes` | NÃO TOCAR | Legado (RPC `registrar_acao`) | — | Consolidação futura (decisão 12.5) |
| `lead_momentos` / `lead_momento_catalogo` | NÃO TOCAR | Legado de "momento" | — | Inspirou o desenho do evento |
| `crm_tarefas` | NÃO TOCAR (fase 2) | Possível reuso futuro p/ tarefas manuais | — | Hoje 0 registros |
| `crm_lead_alertas` / `crm_lead_leituras` | NÃO TOCAR | Alertas/leituras do CRM atual | — | Produtor de alertas não confirmado |
| `distribuicao_*` / `motor_*` / `presenca_*` | NÃO TOCAR | Motor de distribuição/automação segue intocado | — | Nova Era apenas registra `mensagem_automatica` |
| `empreendimentos` / `unidades` / `lead_produtos` | REUSA-LÊ | Produto da proposta/visita via payload/FK existentes | — | — |
| `perfis` + `usuarios.permissoes` | REUSA-LÊ | Base das policies (chaves `crm/leads/pipeline`) | — | Fail-open do código não se repete nas policies (doc 08) |
| `vw_sla_leads` / `sla_*` | NÃO TOCAR | Semáforo do CRM atual; convive no shadow | — | Nova Era deriva urgência do próprio estado |
| `negocio_estagio_historico` | NÃO TOCAR | Histórico do kanban legado (trigger) | — | Usado como referência de paridade no shadow |
| **`ncrm_proposta`** | NOVA | Proposta comercial (≠ venda); `venda_id` só na conversão | `negocio_id`→negocios, `venda_id`→vendas (nullable) | doc 06 §2.G; doc 13 §1 |
| **`ncrm_estado`** | NOVA | Snapshot operacional 1:1 negócio (**sem `lead_id` e sem `corretor_id`** — doc 17) | `negocio_id`, `visita_id`, `proposta_id`, `workflow_config_id` | doc 06 §2.A; correções 1-3 da 2.2 |
| **`ncrm_evento`** | NOVA | Eventos imutáveis + idempotência + FK de config | `negocio_id`, `workflow_config_id`, `executado_por` | doc 06 §2.B; bloqueios 5,6 |
| **`ncrm_workflow_config`** | NOVA | Config versionada IMUTÁVEL (rascunho/publicada/encerrada) | — | doc 06 §2.D/F; bloqueio 8 |
| **`ncrm_workflow_passo`** | NOVA | Passos da cadência por versão (imutáveis se publicada) | `config_id` (RESTRICT) | doc 06 §2.D |
| **schema `ncrm_private`** | NOVO | Lógica privilegiada não exposta à Data API | — | bloqueio 4 |
