# CRM Nova Era — Mapa de Integração de Interface (FASE 1.0)

> Protótipo navegável, **isolado da produção** e **sem persistência** (dados em memória).
> Base de branch: `feat/crm-nova-era-fase-1` a partir de `main` = `0e7845e8e9a2e6c34a0b65895b95608cde0ed841`.
> Esta fase **não** cria migration, **não** altera banco/Supabase/Render/produção, **não** faz deploy/commit/push/merge.

---

## 1. Resumo executivo

O CRM Nova Era foi construído como um **workspace paralelo** dentro do mesmo shell do ERP, acessível por um
**seletor "Funil atual / CRM Nova Era — Experimental"** que **começa sempre no CRM atual** (produção inalterada).
Todo o código novo vive em `app/features/crm-nova-era/` e `docs/crm-nova-era/`. A única alteração em arquivo
existente é **uma linha** em `ProductCatalog.tsx` (embrulhar o branch "CRM" com o seletor). Nenhuma rota, API,
tabela ou comportamento existente foi modificado.

O objetivo é validar, com o cliente/corretores: arquitetura de telas, nomes de estágio, experiência do corretor,
"central de trabalho", ações obrigatórias, **cadência FORA das colunas**, e as transições conceituais para
**Pipeline de Visitas** e **Esteira de Vendas** — sem qualquer risco à operação.

---

## 2. O que foi REUTILIZADO (baixo acoplamento)

| Item reutilizado | Como | Risco |
|---|---|---|
| Shell/menu (`ProductCatalog` + `AppShell`) | O Nova Era é montado dentro do branch "CRM" já existente. Herda login, sessão e sidebar. | Baixo — 1 linha alterada, reversível. |
| Sistema visual (paleta ApeCerto, laranja `#ff7000`) | CSS próprio com prefixo `nova-crm-*`, mesma linguagem visual. | Nulo — classes namespaced, sem colisão global. |
| Convenção de componentes (`"use client"`, React 19) | Mesmos padrões do ERP. | Nulo. |

**Não foram reutilizados por chamada de código** (apenas conceitualmente): `GET /api/crm`, `/api/live-chat`,
`esteira.ts`, `CrmWorkspace.tsx`. O protótipo **não importa nem chama** nenhum deles.

---

## 3. O que ficou 100% ISOLADO (sem copiar/alterar)

- **`CrmWorkspace.tsx`** (2145 linhas) — intocado. O Nova Era é um componente novo (`CrmNovaEraWorkspace`).
- **Régua fixa 24/48/72** (`AttentionCenter.corPorMinutos`, `CrmWorkspace.alertColorByDays`) — **não copiada**.
  A severidade do Nova Era é **configurável** via `SeveridadeConfig` (limiares em horas, default 0/4/24 — ajustável).
- **Listas hardcoded de nome de etapa** (`STAGE_TERMINAL`/`STAGE_AVANCADA`) — não reaproveitadas; o Nova Era
  deriva coluna por **estado de relacionamento**, não por nome de etapa do banco.
- **Classes CSS do CRM atual** (`crm-v2`, `crm-kanban-v2`, …) — não usadas; tudo sob `nova-crm-*`.
- **APIs de escrita** (`PATCH /api/crm`, `/api/crm/sales`, `/api/live-chat`) — **nenhuma** é chamada.

---

## 4. Ponto de entrada e wiring

```
app/page.tsx → ProductCatalog (shell, switch por estado activeModule)
   └─ activeModule === "CRM"  ──►  <CrmNovaEraGate current={<CrmWorkspace .../>} />
                                        │
                        ┌───────────────┴────────────────┐
              variante "atual" (DEFAULT)          variante "nova-era"
              renderiza {current} =               renderiza <CrmNovaEraWorkspace/>
              CrmWorkspace INALTERADO             (protótipo em memória)
```

- **Arquivo alterado:** `app/features/products/ProductCatalog.tsx`
  - +1 import: `import { CrmNovaEraGate } from "../crm-nova-era/CrmNovaEraGate";`
  - o branch `activeModule === "CRM"` passou de `<CrmWorkspace .../>` para
    `<CrmNovaEraGate current={<CrmWorkspace .../>} />` (mesmas props do CRM atual preservadas).
- **Default garantido:** `CrmNovaEraGate` inicia em `"atual"`. Só troca por clique explícito do usuário.
  A escolha é refletida na query string (`?crm=nova-era`) **apenas como conveniência** — sem banco, sem cookie,
  sem localStorage.

---

## 5. Arquitetura do código (isolada e testável)

```
app/features/crm-nova-era/
├─ CrmNovaEraGate.tsx        # SELETOR (Funil atual / Nova Era). Injeta CSS. Default = atual.
├─ CrmNovaEraWorkspace.tsx   # Workspace do protótipo: estado em memória, colunas, fila, ações simuladas.
├─ styles.ts                 # CSS isolado (todas as classes com prefixo nova-crm-*).
├─ fixtures.ts               # 14 leads fictícios; telefones inválidos (0000000000x); sem rede.
├─ lib/
│  ├─ rules.ts               # MOTOR DE REGRAS — funções PURAS, sem React/rede/relógio implícito.
│  └─ __tests__/rules.test.mjs  # 22 testes (node --test), sem acesso a rede.
└─ components/
   ├─ LeadCard.tsx           # card compacto ("o que preciso fazer agora?")
   ├─ LeadPanel.tsx          # ficha: coach + trilha + saídas; lead em saída = só resumo
   ├─ CadenceTimeline.tsx    # trilha de interações (cadência SÓ antes da resposta)
   ├─ WorkQueue.tsx          # "Minha fila de hoje" (6 categorias com cabeçalhos)
   ├─ OutboundAreas.tsx      # "Encaminhados para Pipeline de Visitas / Esteira de Vendas"
   └─ ActionModals.tsx       # ações simuladas (contato/visita/proposta/descarte)
```

### Modelo do lead (Fase 1.1 — próxima ação explícita)

`respondeu`, `respostaPendenteCorretor`, `ultimaInteracaoEm`, `corretorNome`,
`proximaAcaoTipo`, `proximaAcaoTitulo`, `proximaAcaoEm` (fonte da verdade do card/fila),
`tentativas[]` (resultados: não respondeu / respondeu / telefone inválido / pediu retorno /
sem interesse / contato inadequado), e saídas: `visitaAgendadaEm`, `proposta`
(`{produto, valor, data, observacao}`), `descartadoMotivo`, `nutricao`.

### Funções puras (todas em `lib/rules.ts`, todas testadas)

| Função | Responsabilidade | Configurável? |
|---|---|---|
| `calcularAtraso` | Severidade do atraso da próxima ação ARMAZENADA | **Sim** (`SeveridadeConfig`, não 24/48/72 fixo) |
| `sugerirProximaTentativa` | Próxima tentativa HUMANA (só antes da resposta; base = mensagem automática + prazo; janela 09:30–18:00 BRT) | **Sim** (`CadenciaPlano` + `JanelaOperacional`) |
| `cadenciaEncerrada` | Cadência encerra com resposta efetiva ou esgotamento | Sim |
| `validarConclusaoTentativa` | Exigências por resultado (datas, obs., reagendar/descartar) | — |
| `aplicarTentativa` | Transição de estado imutável; grava a próxima ação APROVADA | Sim |
| `aplicarVisitaAgendada` / `aplicarPropostaRegistrada` | Saídas: lead deixa quadro e fila | — |
| `validarProposta` | Produto, valor > 0 e data obrigatórios | — |
| `saidaDoLead` / `estaNoQuadro` / `deveEstarNaFila` | Visita/proposta/descartado/nutrição fora de colunas e fila | — |
| `leadTemProximoPassoValido` | Rejeita lead sem próximo passo (exceto saídas) | — |
| `ordenarFilaHoje` | Ordem obrigatória em 6 categorias | Sim |
| `calcularIndicadores` | Vencidas, respostas aguardando, novos, concluídas hoje, visitas, propostas | — |
| `filtrarLeads` | Meus/todos, atrasados, responderam, sem resposta, quentes, etapa, origem | — |
| `sugerirProximoPasso` | Coach explicável ("Como atender") | Sim |
| `derivarColuna` | Coluna pelo estágio de relacionamento — **temperatura não entra** | — |
| `determinarSaidaVisitas` / `determinarSaidaEsteira` | Payloads conceituais (`proposta_registrada`) | — |

**Princípio testável:** as funções recebem o "agora" (`agoraISO`) explicitamente — nunca leem o relógio —
tornando-as determinísticas. Isso também respeita a restrição do ambiente (sem `Date.now()`/`new Date()` sem
argumento).

---

## 6. Conceitos de produto validados no protótipo (Fase 1.1)

1. **Cadência de contato ≠ acompanhamento comercial.** A sequência Tentativa 1→4 existe SOMENTE
   enquanto o cliente não respondeu. Na primeira resposta efetiva a cadência encerra e o lead passa a
   ser guiado por **próxima ação comercial** explícita (entender necessidade, enviar opções, confirmar
   recebimento, ligar, solicitar docs, agendar visita, preparar proposta, outro) com data/hora
   obrigatórias. "Tentativa 2/3/4" nunca aparece para quem já conversa.
2. **Colunas por estágio de relacionamento.** Novo (nenhuma atuação humana) → Tentando contato
   (atuação sem resposta) → Em atendimento (respondeu; entendendo necessidade) → Em acompanhamento
   (necessidade entendida; ação comercial antes de visita/proposta). Temperatura NÃO define coluna;
   visita e proposta não ficam em coluna nenhuma.
3. **Saídas do CRM.** Visita agendada → "Encaminhados para Pipeline de Visitas"; proposta registrada →
   "Encaminhados para Esteira de Vendas" (a Esteira inicia com o REGISTRO da proposta, sem aceite —
   ela acompanha o processo comercial). Leads em saída não recebem tentativas nem prospecção e não
   entram na fila.
4. **Central de trabalho / "Minha fila de hoje".** Ordem obrigatória: críticas → responderam e aguardam
   o corretor → previstas para agora → novos sem atuação → demais do dia → futuras. Com indicadores e
   filtros demonstrativos sobre as fixtures.
5. **Ações obrigatórias.** Cada resultado de contato tem exigências próprias; nenhuma conclusão deixa o
   lead sem próximo passo válido (exceto visita, proposta, descarte e nutrição formal) — regra
   verificada por `leadTemProximoPassoValido` e testada sobre todas as fixtures.
6. **Próxima ação explícita.** O card e a fila mostram a ação ARMAZENADA no lead (tipo, título,
   data/hora) — a régua sugere, o corretor aprova, o estado grava.

---

## 7. Pontos de integração FUTUROS (fora desta fase)

Cada saída já devolve um **payload conceitual** (`origem: "crm_nova_era"`), pronto para virar integração real
depois — mas **nada é chamado nesta fase**:

| Integração futura | Gatilho no Nova Era | O que faltaria (fases seguintes) |
|---|---|---|
| **Pipeline de Visitas** | `determinarSaidaVisitas` elegível (visita agendada) | Mapear para `createVisit` (`PATCH /api/crm`), que move o negócio p/ funil "Visita ApeCerto". |
| **Esteira de Vendas** | `determinarSaidaEsteira` elegível (**proposta registrada** — gatilho `proposta_registrada`, sem exigir aceite) | Mapear para `/api/crm/sales` action `create` (nasce `venda_processos` etapa "inicio"). A Esteira acompanha o processo comercial iniciado pela proposta. |
| **WhatsApp / Chat** | ação "Registrar tentativa" canal WhatsApp | Reusar modais exportados do LiveChat (`QuickActionModal`), **sem** enviar nesta fase. |
| **Calendário** | visita agendada | Reusar `CalendarWorkspace` (lê o mesmo `GET /api/crm`). |
| **Sara / alertas** | severidade do atraso | Fonte de urgência configurável (ex.: `lead_momento_catalogo.prazo_dias`), **não** a régua fixa. |
| **Permissões** | acesso ao módulo | Herdar chaves `crm/leads/pipeline` (menor atrito) ou criar `crm_nova_era` em `MODULE_CAPABILITIES`. |

---

## 8. Riscos de acoplamento e mitigação

| Risco | Mitigação aplicada |
|---|---|
| CSS global colidir com o CRM atual | Todas as classes sob `nova-crm-*`; CSS injetado via `<style>` local (sem tocar `globals.css`/`layout.tsx`). |
| Alterar comportamento do CRM atual | Default do seletor = "atual"; `current` recebe o `CrmWorkspace` com **as mesmas props**; troca só por clique. |
| Vazar dados reais / disparos | Fixtures fictícias, telefones inválidos, **zero** chamadas de rede/API/Supabase (verificado por scan). |
| Erros de tipo/lint mascarados | `tsc` e `eslint` executados; build `vinext build` completo (ver relatório de testes). |
| Mistura com a contenção P0 (Fase 0.5) | Base = `main`, onde `supabase/` **não existe**; nenhum artefato P0 no diff. |

---

## 9. Limitações conscientes desta fase

- **Sem persistência:** recarregar a página zera as ações (comportamento esperado do protótipo).
- **"Agora" fixo (`AGORA_DEMO`)** para manter a demonstração coerente com as fixtures.
- **Saídas são conceituais:** exibem elegibilidade e payload, mas **não** movem negócio, criam visita ou venda.
- **Screenshots** (em `docs/crm-nova-era/screenshots/`) foram geradas de um **harness isolado** dos componentes
  reais com as fixtures — **não** de produção nem com login real (transparência: ver relatório de testes).

---

## 10. Adendo Fase 1.2 — automação de entrada e fluxos separados

- **Mensagem automática:** todo lead entra com `mensagemAutomaticaEnviadaEm` (o ERP dispara o 1º
  WhatsApp na entrada). O evento aparece na timeline, **não conta como tentativa humana** e não
  gera novo envio. `aguardandoRespostaAutomacao` controla o estado "monitorando resposta".
- **Régua humana (config provisória, `PLANO_CADENCIA_PADRAO`):** Primeira intervenção humana →
  Segunda tentativa → Terceira tentativa → Tentativa final. A 1ª nasce `esperaAposAutomacaoHoras`
  após o envio automático. Intervalos/canais serão validados com a operação antes da integração
  real (nada vai a banco nesta fase).
- **Janela operacional (`ajustarParaJanelaOperacional`):** sugestões sempre entre 09:30 e 18:00
  (Brasília, offset fixo UTC-03). Antes de 09:30 → 09:30; depois de 18:00 → próximo dia 09:30.
  Limitações documentadas: sem tratamento de feriados; revalidar offset se o horário de verão
  voltar; horários digitados pelo corretor não são ajustados.
- **Dois fluxos separados:** `aplicarTentativa` (prospecção, `!respondeu`) e
  `aplicarResultadoAcaoComercial` (acompanhamento, `respondeu`) — este último registra em
  `acoesComerciais[]`, nunca incrementa tentativas, nunca devolve o lead à régua 1→4 e nunca
  sugere descarte por falta de resposta no acompanhamento. Resultados comerciais: ação concluída,
  cliente respondeu, sem resposta no acompanhamento, pediu novo retorno, aguardando documento,
  opções enviadas, visita agendada (→ Pipeline de Visitas), proposta registrada (→ Esteira de
  Vendas), sem interesse (→ descarte estruturado), outro.
