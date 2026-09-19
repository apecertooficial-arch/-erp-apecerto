# Matriz integral — ERP ApeCerto

Estado inicial. `Não comprovado` significa que a superfície existe, mas ainda
não foi exercitada ponta a ponta contra persistência e autorização reais.

| Tela/jornada | Função | Domínio | Contrato/API inicial | Banco/autoridade candidata | Autorização | Teste/E2E | Evidência | Classificação atual |
|---|---|---|---|---|---|---|---|---|
| `/inicio` | Meu Dia e prioridades | operação | `/api/dashboard`, `/api/central-activity`, `/api/funil2` | `f2_lead`, atividades, views/RPCs de operação | perfil e carteira | testes `inicio-mobile`, dashboard a mapear | conceito Central de foco V4 | parcial; integração visual pendente |
| `/crm` | Central de foco, Kanban e carteira | CRM | `/api/funil2`, `/api/funil2/carteira`, `/api/funil2/conversa`, `/api/crm/sales` | famílias `f2_*`, `ncrm_*`, `motor_*`, `leads/negocios` | gestor/corretor e carteira | suíte `funil-2*`, `crm-*`; E2E real pendente | Kanban V5 local | duplicado/conflitante até reconciliação |
| Lead Meta/site | entrada e distribuição | aquisição/CRM | Make/webhook, `entrada`, `distribuir-lead`, `site_lead_ingest` | `site_leads`, `leads`, `negocios`, `f2_lead`, configs de entrada | serviço + regra de dono | testes de distribuição e site; E2E pendente | código/migrations | parcial; autoridade precisa ser provada |
| Conversa → Sara | cinco resultados e próxima ação | IA/CRM | `f2-sara-reclassificar` acionada pela automação 49 e dispatcher | `f2_sara_*`, `f2_lead`, `motor_fila`; `ncrm_sara_*` aposentado | service role no motor; sessão/RLS na leitura | 21 testes direcionados; latência E2E pendente | `TRACE_LEAD_SARA_PROXIMA_ACAO.md` | parcial; autoridade canônica provada e falso status corrigido localmente |
| `/agenda` | disponibilidade e visitas | agenda | `/api/agenda`, RPCs `f2_*visita*` | `f2_visita`, `visitas`, atividades | gestor/corretor | testes `agenda-canonica`; E2E pendente | código/migrations | parcial |
| Pós-visita | feedback e cobrança | CRM/gestão | `/api/agenda`, `/api/funil2`, `f2_registrar_resultado_visita`, `f2_visitas_resultado_pendente` | `f2_visita`, `f2_lead`, eventos, `ncrm_notificacao` | APIs exigem corretor dono; gestão somente acompanha; RPC remota ainda permite admin direto | 63 testes direcionados; 450/450 no gate frontend; 6 testes do draft de banco; navegador desktop/móvel sanitizado | `TRACE_VISITA_FEEDBACK_COBRANCA.md`, `P0_VISITA_OWNER_COBRANCA_DRAFT.sql` | parcial; contrato de ownership/cron/dedupe preparado fora de migrations; execução isolada, advisors e aplicação produtiva pendentes |
| `/notificacoes` | alertas e escalonamento | operação | `/api/notificacoes`, push APIs | `ncrm_notificacao`, `ncrm_push_*`, alertas | usuário autenticado | testes push/avisos; E2E dispositivo pendente | código/migrations | parcial |
| `/automacoes` | editor e execução determinística | automações | `/api/automacoes-operacao`, dispatcher | `automacoes`, versões, `motor_*`, fila | gestor/admin | testes automações/dispatcher | worker + migrations | parcial; conflitos a provar |
| `/produtos` | catálogo, captação e publicação | imóveis | `/api/product`, `/api/catalog`, `/api/capture` | empreendimentos, unidades, produtos, mídias, drafts | captador/gestor | testes produtos | código/migrations | parcial |
| Proprietário | cadastro e portal | imóveis | ficha/portal e RPCs de proprietário | `unidade_proprietarios`, `portal_emails`, captações | gestor/proprietário | testes a criar | requisitos canônicos | ausente/parcial |
| `/financeiro` | caixa, vendas, comissões | financeiro | `/api/finance`, `/api/crm/sales`, negócio | vendas, recebimentos, venda_corretores, negócios | gestor | testes `finance-*`; E2E pendente | reconciliação financeira existente | parcial/conflitante |
| `/negocio/*` | esteira da venda | vendas | comandos de venda e rotas de negócio | vendas, solicitações, documentos, comissões | gestor/corretor escopado | testes venda atômica | código/migrations | parcial |
| PWA corretor | Meu Dia, WhatsApp, visita, feedback | mobile | mesmas APIs canônicas | mesmas autoridades server-side | corretor | testes `app-mobile-*`, PWA | harness móvel anterior | parcial |
| PWA gerente | cobranças, agenda, performance, Sara | mobile/gestão | central, agenda, notificações | views/RPCs de gestão | gerente/CEO | testes mobile + E2E pendente | requisitos canônicos | ausente/parcial |
| Auth/sessão | login, perfil e permissões | segurança | `/api/session`, permissions/team | Auth, perfis, usuários, papéis | fail-closed | testes papéis/permissões | código/migrations | não comprovado remotamente |
| Storage | mídias, documentos e áudios | arquivos | APIs/Edge/TUS | buckets + `storage.objects` | policies por domínio | testes de privacidade parciais | inventário remoto pendente | não comprovado |
| Observabilidade | logs, auditoria, filas e saúde | plataforma | central/comando, auditoria, workers | auditoria, eventos, estados/filas | gestor/admin | checks dispersos | endpoints e migrations | parcial |

## Próxima expansão da matriz

Para cada linha, decompor botões, modais, estados, métodos HTTP/RPC, tabelas,
policies efetivas, testes existentes, lacunas e evidência de navegador. A
classificação muda apenas com prova comportamental e persistência verificada.
