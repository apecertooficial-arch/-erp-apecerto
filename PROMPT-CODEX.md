# Briefing para o Codex — o que falta ligar no app do celular

Estado do repo em 17/08/2026. O desenho está fechado e aprovado; o que falta é **ligar dado** e **construir 4 telas** que hoje só existem no protótipo.

**Protótipo de referência (fonte de verdade visual):** `public/prototipo/index.html` — abre direto no navegador.

---

## 1. Regras que não se negociam

1. **Dado real ou nada.** Se o campo não existe no banco, a linha **não aparece** — nem zerada, nem com traço. Nunca inventar número.
2. **Nenhum vocabulário técnico na tela.** Já aconteceu em produção: `relation "perf_snapshots" does not exist` apareceu no meio da tela do gestor. Mensagem de banco vai para `console.error`, e a tela mostra frase humana + "Tentar novamente".
3. **O app não é o ERP inteiro.** `RotaModulo.mobile` em `app/features/system/erp-routes.ts` decide o que o celular oferece. Módulo sem tela de celular fica `mobile: false` e desaparece da barra, do "Mais" e da Gestão.
4. **A Sara orienta, nunca envia.** Bloco roxo. "Enviar mensagem para o cliente" é trava de produto, não ajuste de gestor.
5. **WhatsApp honesto.** O CTA abre o WhatsApp; o contato fica âmbar em "aguardando sincronização" até a integração confirmar. Só então verde.
6. **Concluir tarefa ≠ contato realizado.** Histórico é somente leitura.
7. Tudo sob `@media (max-width: 900px)`. **O ERP no computador não é tocado.**

---

## 2. O que já está pronto e ligado

| Tela | Arquivo | Dado |
|---|---|---|
| Meu Dia / CRM | `app/features/funil-2/Funil2Mobile.tsx` | `/api/funil2` |
| Avisos | `app/features/notifications/NotificationsWorkspace.tsx` | `/api/notificacoes` |
| Agenda (Dia / Semana / **Mês**) | `app/features/calendar/TelaAgendaMobile.tsx` | `/api/agenda` |
| Tarefas da Sara | `app/features/tasks/SaraTasksMobile.tsx` | `/api/funil2` (aceitar/recusar gravam) |
| Produtos | `.ape-produto-*` | `/api/catalog` |
| Início do gestor (resumo da operação) | `app/features/team/ManagerPanelMobile.tsx` | `/api/performance?periodo=mes` |
| Gestão | `app/features/system/ManagementMobile.tsx` | navegação |

Estilo: `app/styles/app-mobile-aprovado.css` (corretor) e `app/styles/app-mobile-gestor.css` (gestor). Prefixo `.ape-*`, classes — nunca inline.

---

## 3. Falta no banco (bloqueia tela)

1. **`perf_snapshots` não existe.** A RPC `equipe_visao` falha por isso, e a tela "Minha Equipe" só tinha erro para mostrar — por isso está com `mobile: false` em `erp-routes.ts`. Criar a relação e voltar a flag para `true`.
2. **Comissão prevista** e **corretores online** não existem em `/api/performance`. Estavam no desenho do Início do gestor e ficaram de fora pela regra 1. Se entrarem na API, acrescentar duas linhas em `ManagerPanelMobile` (bloco Finanças e bloco Trabalho).

---

## 4. As 4 telas a construir

Estão desenhadas no protótipo (telas 11 a 15) e **não existem no app**. Todas são do gestor, todas entram pela tela de Gestão, todas com o botão "‹ Gestão" no topo.

**Regra desta rodada: sobe como LEITURA.** Onde não houver endpoint de escrita, o controle aparece **desabilitado** e o toque mostra um aviso curto ("ainda não é possível mudar isso pelo celular"). Não simular gravação.

### 4.1 Distribuição de leads
- Topo: a regra em uso, em uma frase, em bloco roxo.
- Lista de corretores: iniciais, nome, leads de hoje, tamanho da carteira, barra de capacidade (verde até 75%, âmbar até 90%, vermelho acima) e um interruptor de plantão.
- Fonte candidata: `/api/team` + `/api/presenca`. O interruptor precisa de endpoint de escrita — sem ele, desabilitado.

### 4.2 Esteira de vendas
- Quatro cartões de etapa (Proposta, Contrato, Assinado, Comissão) com quantidade e valor.
- Lista de negócios em aberto: etapa (pílula), valor, cliente, produto, corretor e etiqueta vermelha quando parado há dias.
- Fonte candidata: `app/api/crm/sales`.

### 4.3 Regras da Sara
- Quatro prazos (primeiro contato, retorno prometido, limite de carteira, reavaliação da fila), cada um com − e + de 36px. Sem campo de texto no celular.
- Três permissões em interruptor; "Enviar mensagem para o cliente" **desligado e travado** por regra de produto.
- Não há endpoint hoje: sobe tudo desabilitado, com a nota explicando a trava.

### 4.4 Cadastro de produtos
- Lista de empreendimentos com status Publicado / Incompleto / Rascunho e, quando incompleto, faixa âmbar dizendo o que falta.
- Ação por item: "Abrir ficha do produto".
- Fonte: `/api/catalog` e `/api/product`. Cadastrar novo continua no computador.

### 4.5 Relatórios (já desenhada, também falta)
- Quatro cartões — Trabalho, Atendimento, Funil, Receita — cada um com o número grande e a variação contra o mês anterior (verde melhor, vermelho pior, cinza estável).
- Fonte: `/api/performance`. A variação exige o mês anterior; se a API não devolver, o cartão sai sem a variação.

---

## 5. Estados de sistema (todas as telas)

- **Carregando** — esqueleto com a forma real do card, não spinner.
- **Vazio** — frase humana e uma saída.
- **Erro** — frase humana + "Tentar novamente".
- **Offline** — faixa escura com a hora dos dados exibidos.
- **Sessão expirada** — tela cheia, com "nenhuma tarefa foi perdida".

---

## 6. Antes do PR

- [ ] As 4 telas novas batem com o protótipo em 390×844
- [ ] Nenhum alvo de toque abaixo de 44px; safe-area respeitada em cima e embaixo
- [ ] Nenhum dado inventado; nenhuma linha zerada de campo inexistente
- [ ] Controle sem endpoint aparece desabilitado, com aviso ao toque
- [ ] Nenhum termo técnico visível; nenhuma mensagem de banco na tela
- [ ] Desktop (`min-width: 901px`) inalterado
