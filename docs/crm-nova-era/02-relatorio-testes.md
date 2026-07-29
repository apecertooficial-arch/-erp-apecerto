# CRM Nova Era — Relatório de testes e validações (FASE 1.2)

### Testes (node --test — sem rede)
```
ok 1 - 1. proposta registrada entra na Esteira, sem exigir aceite
ok 2 - 2. proposta não é descrita como pós-venda
ok 3 - 3. visita agendada sai do quadro (não fica em nenhuma coluna)
ok 4 - 4. proposta registrada sai do quadro
ok 5 - 5. visita/proposta/descartado não aparecem na fila
ok 6 - 6. cliente que respondeu não recebe próxima tentativa da cadência
ok 7 - 7. 'pediu retorno' exige data/hora
ok 8 - 8. 'respondeu' exige próxima ação comercial com data/hora
ok 9 - 9. fila prioriza: críticas → responderam/aguardam → previstas agora
ok 10 - 10. próxima ação mostrada é a armazenada, não um recálculo divergente
ok 11 - 11. temperatura (quente/negociando) não muda a coluna
ok 12 - 12. 'Em acompanhamento' não contém lead com visita agendada
ok 13 - 13. leads sem próximo passo válido são rejeitados
ok 14 - validação: sem_interesse exige observação; contato_inadequado exige obs + reagendar/descartar
ok 15 - validação: telefone_invalido exige correção agendada ou descarte
ok 16 - validação de proposta: produto, valor > 0 e data obrigatórios
ok 17 - 1.2-1. mensagem automática não conta como tentativa humana
ok 18 - 1.2-2. lead novo não recebe sugestão de WhatsApp duplicado imediato
ok 19 - 1.2-3. timeline mostra o evento da mensagem automática
ok 20 - 1.2-4. primeira intervenção humana só nasce após o prazo configurado
ok 21 - 1.2-5. horário antes de 09:30 (Brasília) é ajustado para 09:30
ok 22 - 1.2-6. horário depois de 18:00 (Brasília) vai para o próximo dia às 09:30
ok 23 - 1.2-7. cliente que respondeu usa ação comercial, não tentativa
ok 24 - 1.2-8. sem resposta no acompanhamento NÃO reinicia a cadência
ok 25 - 1.2-9. sem resposta no acompanhamento NÃO sugere descarte
ok 26 - 1.2-10. conclusão comercial exige próxima ação com data/hora
ok 27 - 1.2-11. visita e proposta continuam produzindo as saídas corretas
ok 28 - nao_respondeu segue a régua; cadência esgotada vira avaliar_descarte
ok 29 - indicadores refletem as fixtures
ok 30 - filtros: meus/todos, responderam, etapa, origem
ok 31 - descarte estruturado: motivo obrigatório; 'outro' exige detalhe
ok 32 - atraso: níveis configuráveis (não 24/48/72 fixos)
ok 33 - fixtures: telefones obviamente inválidos e sem rede
# tests 33
# pass 33
# fail 0
```

Mapa: testes "1."–"13." = obrigatórios da Fase 1.1; testes "1.2-1"–"1.2-11" = obrigatórios da
Fase 1.2 (mensagem automática, janela operacional e separação tentativa × ação comercial).

### Validações executadas

| Verificação | Resultado |
|---|---|
| Testes de regras puras | **33/33 pass** |
| Type-check `tsc --noEmit` (código novo) | **0 erro** (54 pré-existentes do repo, contagem idêntica sem as alterações → 0 regressão) |
| Lint (`crm-nova-era` + `ProductCatalog.tsx`) | **0 problema** |
| Build `vinext build` | **Sucesso (exit 0)** |
| Scan rede (`fetch/axios/supabase//api//WebSocket`) | **Zero** |
| Scan segredo/webhook/token | **Zero** |
| "Tentativa N" após resposta | Impossível por regra (testes 6, 1.2-7, 1.2-8) |
| Descarte sugerido por não-resposta no acompanhamento | Impossível por validação (teste 1.2-9) |
| "WhatsApp imediato" duplicado p/ lead novo | Eliminado (teste 1.2-2) |
| Telefones | Todos `000000000xx` (obviamente inválidos) |

### Confirmações de isolamento

Zero banco · zero rede · zero WhatsApp · zero produção · zero migration · zero Supabase ·
zero API real alterada · sem commit/push/deploy. `CrmWorkspace.tsx` e `app/api/**` intocados.

### Screenshots (harness isolado dos componentes reais + fixtures — NÃO produção)

1. `01-quadro-sem-visitas-propostas.png` — quadro com badges de automação nos leads novos.
2. `02-novo-aguardando-automacao.png` — lead novo "Aguardando resposta da mensagem automática" (horário do envio + quando agir) e timeline com o evento automático.
3. `03-timeline-automacao-registrar-tentativa.png` — lead sem resposta: fluxo "Registrar tentativa" e régua renomeada (Terceira tentativa).
4. `04-atendido-concluir-acao-atual.png` — cliente atendido: botão "Concluir ação atual" (sem tentativa).
5. `05-sem-resposta-acompanhamento-nova-acao.png` — "Cliente não respondeu ao acompanhamento" exigindo NOVA ação comercial + data (sem descarte, sem cadência).
6. `06-pediu-retorno.png` — retorno combinado com horário.
7. `07-encaminhados-pipeline-visitas.png` — saída Pipeline de Visitas.
8. `08-encaminhados-esteira-vendas.png` — saída Esteira de Vendas.
9. `09-modal-registrar-proposta.png` — modal Registrar proposta.
10. `10-fila-indicadores-categorias.png` — fila com indicadores e categorias.
