# CRM Nova Era — Entrega FASE 1.2 (correção final do motor operacional)

## Status: CONCLUÍDO — aguardando revisão independente. **Nenhum commit foi feito.**

- **Branch:** `feat/crm-nova-era-fase-1`
- **Base (main):** `0e7845e8e9a2e6c34a0b65895b95608cde0ed841`
- Interface da Fase 1.1 preservada (sem refazer); escopo restrito aos 2 pontos da revisão.

## Correção 1 — Contato inicial ≠ ação comercial (fluxos separados)

**A. Lead que ainda não respondeu → botão "Registrar tentativa".**
Usa a cadência de tentativas (resultados: não respondeu / respondeu / telefone inválido /
pediu retorno / sem interesse / contato inadequado), via `aplicarTentativa`.

**B. Cliente que já respondeu → botão "Concluir ação atual".**
Função pura NOVA e separada: `aplicarResultadoAcaoComercial` (não sobrecarrega
`aplicarTentativa`). O modal mostra: ação que estava prevista (read-only), resultado,
observação, próxima ação e data/hora. Resultados: ação concluída · cliente respondeu ·
cliente não respondeu ao acompanhamento · pediu novo retorno · aguardando documento ·
opções enviadas · visita agendada · proposta registrada · sem interesse · outro.

Garantias (testadas): não incrementa tentativa de prospecção; nunca mostra "Tentativa 2/3/4";
nunca reinicia a cadência 1→4 (`respondeu` permanece true); ausência de resposta no
acompanhamento exige NOVA ação/data e **não** sugere descarte (a validação rejeita
`avaliar_descarte` e `tentativa_cadencia` como próxima ação comercial); visita agendada →
Pipeline de Visitas; proposta registrada → Esteira de Vendas; sem interesse → descarte
estruturado obrigatório. Histórico próprio em `acoesComerciais[]` (separado de `tentativas[]`).
A interface escolhe o fluxo automaticamente: `!lead.respondeu` → tentativa; `lead.respondeu` → ação.

## Correção 2 — Mensagem automática + janela operacional

Regra real da operação modelada: ao entrar o lead, o ERP dispara automaticamente o 1º WhatsApp.
- Modelo: `mensagemAutomaticaEnviadaEm`, `aguardandoRespostaAutomacao`.
- Timeline unificada (`montarTimeline`): evento "Mensagem automática enviada" — **não conta como
  tentativa humana** e não gera novo envio.
- Lead novo: coach "Aguardando resposta da mensagem automática" com o horário do envio e quando
  verificar/agir; a 1ª tentativa humana só nasce após `esperaAposAutomacaoHoras` (config).
- Régua humana renomeada: 1. Primeira intervenção humana · 2. Segunda tentativa ·
  3. Terceira tentativa · 4. Tentativa final. "1º contato — WhatsApp imediato" foi eliminado.
- **Configuração provisória e explícita** (`PLANO_CADENCIA_PADRAO`): os intervalos/canais serão
  validados com a operação antes de qualquer integração real — nada vai a banco nesta fase.
- **Janela operacional 09:30–18:00 (Brasília)** para SUGESTÕES (`ajustarParaJanelaOperacional`):
  antes de 09:30 → 09:30 do dia; depois de 18:00 → próximo dia às 09:30. Limitações documentadas:
  feriados não tratados; offset fixo UTC-03 (Brasil sem horário de verão — revalidar na
  integração); horários digitados pelo corretor não são alterados.

## Validação

33/33 testes (os 11 obrigatórios da Fase 1.2 = "1.2-1"…"1.2-11"), lint 0, tsc 0 erros no código
novo (54 pré-existentes inalterados), `vinext build` exit 0, scans zero rede/segredo/webhook.
Detalhes em `02-relatorio-testes.md`; arquivos/diff/status em `04-status.md` e
`03-diff-ProductCatalog.patch` (segue sendo a única alteração em arquivo existente — 2 linhas).

## Confirmações

- [x] Zero banco · zero Supabase · zero APIs reais · zero WhatsApp · zero produção.
- [x] Sem migration, sem commit, sem push, sem deploy.
- [x] Interface não refeita; escopo não ampliado; seletor/colunas/fixtures/branch preservados.
