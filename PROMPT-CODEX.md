# Briefing para o Codex — subir o app mobile apêcerto no sistema

Este arquivo é a instrução completa. Leia inteiro antes de escrever código.

---

## 1. Onde é

- **Repo:** `apecertooficial-arch/-erp-apecerto`
- **Branch:** `main`
- **Protótipo de referência publicado no repo:** `public/prototipo/index.html`
  (abre direto no navegador; carrega `public/prototipo/support.js` e `public/prototipo/_ds/**` por caminho relativo)

O protótipo é a **fonte de verdade visual**. Em caso de divergência entre o que está escrito aqui e o protótipo, vale o protótipo.

---

## 2. O que já está feito (não refazer)

- As telas **Meu Dia** e **CRM no celular** já foram migradas para o layout aprovado:
  - markup: `app/features/funil-2/Funil2Mobile.tsx` (classes próprias `.ape-*`)
  - estilo: `app/styles/app-mobile-aprovado.css`
- Dados reais via `/api/funil2` (Supabase). Nada mocado.
- A camada antiga `app/styles/app-visual-aprovado.css` foi esvaziada e desligada.
- Cabeçalho e barra inferior: `app/features/system/ErpShell.tsx` + `app/styles/app-mobile.css`.

---

## 3. O que você precisa fazer

### 3.1 Migrar as telas que faltam
Trazer para o mesmo padrão `.ape-*` de `app-mobile-aprovado.css`, usando o protótipo como referência tela a tela:

1. **Avisos** — abas `Agora · 4` / `Hoje · 9` / `Histórico`. Um card por aviso, **uma única ação por card**. Badge de não lido na barra inferior.
2. **Agenda** — abas `Dia` / `Semana`. Bloco do próximo compromisso em destaque no topo + lista cronológica do dia abaixo.
3. **Tarefas da Sara** — abas `Atrasadas · 2` / `Agora · 3` / `Hoje · 5` / `Futuras` / `Concluídas`. Cada tarefa mostra: etiqueta de prazo (atrasada/urgente/no prazo), a ação em uma frase, o lead (avatar + nome) e o motivo dado pela Sara. Sugestões da Sara podem ser **aceitas ou recusadas**.
4. **Produtos** — chips `Todos` / `Pronto pra morar` / `Obras` / `Lançamento` / `Favoritos`. Card de empreendimento com foto, título, endereço, preço, dorms/banheiros/m²/vagas e badge de status.
5. **Gestão / Painel (perfil gestor)** — painel da equipe + área restrita. Não aparece na rotina do corretor.

### 3.2 Limpeza pendente
- Remover o bloco de regras `.f2m-*` de `app/styles/app-mobile.css` que virou código morto após a migração (só as regras que não casam mais com nenhum markup — conferir antes de apagar).
- Apagar `app/styles/app-visual-aprovado.css` (já está vazio e desligado).

### 3.3 Barra inferior por perfil
- **Corretor:** Início / CRM / Agenda / Avisos (com badge) / Mais
- **Gestor:** Painel / Equipe / Produtos / Gestão / Mais

Perfis têm navegação separada. Nada de gestão na rotina do corretor.

---

## 4. Regras de estilo (não inventar nada fora disto)

Tudo sob `@media (max-width: 900px)`. **O ERP no computador não é tocado.**

**Cores**

| Uso | Valor |
|---|---|
| Fundo da página | `#FAF8F6` |
| Card | `#fff`, raio `18px`, sombra `0 2px 6px rgba(31,28,26,.06)` |
| Texto | `#1F1C1A` · secundário `#6B635C` · terciário `#9A918A` |
| Ação primária (marca) | laranja `#FF7000` |
| Sara / contexto | roxo `#8B00CC`, bloco tint `#F7ECFC` |
| WhatsApp | verde `#1E9E5A` |
| Semânticas | sucesso `#1E9E5A` · atenção `#E8A317` · perigo `#D93E3E` |
| Borda | `#E4DFD9` |

**Código de cor por significado (igual ao CRM desktop):**
laranja = cliente respondeu / ação sua · roxo = lead novo e tudo da Sara · âmbar = aguardando ou retorno prometido · vermelho = vencido · verde = confirmado.

**Nunca** encostar laranja em roxo direto — sempre um neutro no meio.

**Tipografia** — Quicksand apenas (400–700).
Manchete 26px/700 · título de ficha 24px/700 · nome no card 16px/700 · corpo 13–14px/500 · meta 11–12px.
Sobrancelha: 11px, 600, `+0.12em`, UPPERCASE, laranja — **único uso de caixa alta**.

**Formas** — cards 18px · ficha/folha 24px topo · input 12px · botão principal pill (`999px`) · chips pill.

**Toque** — alvos ≥ 44px; CTA principal 48–52px; respeitar `env(safe-area-inset-*)` em cima e embaixo.

**Movimento** — 200ms, `cubic-bezier(.2,.8,.2,1)`. Fade + 4px de Y. Sem bounce em botão.

**Classes, não inline.** Prefixo `.ape-`, seguindo o que já existe em `app-mobile-aprovado.css` (`.ape-card`, `.ape-contexto`, `.ape-prazo`, `.ape-filtros`, `.ape-estado`, `.ape-esqueleto`, `.ape-ficha`…). Reutilize essas classes antes de criar novas.

---

## 5. Regras de produto (não violar)

1. **WhatsApp honesto.** O CTA só abre o WhatsApp. O contato **não** é dado como feito: fica âmbar em "aguardando sincronização" até a integração oficial confirmar a mensagem no histórico — só aí vira verde.
2. **A Sara orienta, nunca envia.** Bloco roxo com lugar fixo no card e na ficha.
3. **Concluir tarefa ≠ contato realizado.** Só a sincronização confirma.
4. **Histórico é somente leitura.**
5. **Sem vocabulário técnico na tela do corretor** — nada de piloto, RPC, ingest, runner, cron, webhook.
6. **Dados reais sempre**, via as APIs existentes. Se um campo não existe no banco, o bloco fica sem esse texto — não invente placeholder. (Exemplo já acordado: o conselho por cliente da Sara não existe no banco; o bloco fica sem ele até a análise real entrar.)
7. Nomes e telefones em qualquer print/demo são fictícios; telefone mascarado no formato `(11) 9 ****-2869`.

---

## 6. Estados de sistema (todos precisam existir)

- **Carregando** — skeleton com a forma real do card (`.ape-esqueleto`), não spinner.
- **Vazio** — "fila zerada", com saída para Tarefas.
- **Erro** — linguagem humana + botão "Tentar novamente". Nunca stack trace.
- **Offline** — faixa escura com a hora dos dados exibidos.
- **Sessão expirada** — tela cheia, com a frase "nenhuma tarefa foi perdida".

---

## 7. Como entregar

- Um commit por tela migrada, mensagem em pt-BR descrevendo a tela.
- Não mexer no ERP desktop (`min-width: 901px`).
- Não adicionar dependência nova sem necessidade real.
- Não criar camada de CSS sobre CSS: se uma regra antiga atrapalha, troque o markup para as classes novas em vez de sobrescrever.
- Rodar o build e conferir as 5 telas em 390×844 antes de subir.

**Checklist antes do PR**

- [ ] As 5 telas migradas batem com o protótipo em `public/prototipo/index.html`
- [ ] Nenhum alvo de toque abaixo de 44px
- [ ] Safe-area respeitada em cima e embaixo
- [ ] Barra inferior correta nos dois perfis
- [ ] Os 5 estados de sistema desenhados em cada tela com lista
- [ ] Nenhum dado mocado
- [ ] Nenhum termo técnico visível ao corretor
- [ ] `app-visual-aprovado.css` apagado e `.f2m-*` morto removido
- [ ] Desktop inalterado

---

## 8. Se faltar informação

Pergunte antes de inventar. Especificamente em aberto:
- Fotos reais dos empreendimentos (os cards ainda usam placeholder).
- Confirmar se o CTA do WhatsApp fica verde (padrão do app) ou laranja (padrão da marca) — hoje está verde.
