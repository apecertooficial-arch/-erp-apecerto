# Regras para agentes de IA neste repositório

Leia este arquivo inteiro antes de editar qualquer coisa. Ele existe porque o
projeto já acumulou dano de rodadas anteriores de "arruma o visual" feitas sem
contexto, e a maior parte desse dano é irreversível sem retrabalho manual.

---

## 1. O que é este projeto

ERP interno da **ApeCerto**, imobiliária de São Paulo (Moema, Campo Belo,
Vila Mariana). Next.js hospedado no **Render**, backend no **Supabase**.

Quem usa são corretores e gestores, o dia inteiro, no desktop e no celular. Não
é um site para o cliente final — é ferramenta de trabalho. Densidade de
informação vale mais que respiro: o corretor precisa decidir o que oferecer para
um lead em segundos.

Módulos: Início, CRM (funil de leads), Performance, Produtos (catálogo de
empreendimentos e unidades), Financeiro, Chat ao Vivo, Disparos, Agentes de IA,
Projetos e Tarefas.

---

## 2. Comandos

```bash
pnpm install                 # instalar dependências
pnpm dev                     # servidor local
pnpm lint                    # eslint
pnpm test:frontend           # suíte de testes de frontend (node --test)
./node_modules/.bin/tsc --noEmit -p tsconfig.json   # typecheck
```

Sobre o typecheck: o repositório tem **57 erros de tipo pré-existentes** em
arquivos não relacionados a estilo. Não tente corrigi-los junto com uma tarefa
visual — isso mistura escopos e torna a revisão impossível. A régua é: **o
número de erros não pode aumentar**, e nenhum erro novo pode aparecer nos
arquivos que você tocou.

---

## 3. O estado real do `app/globals.css` — leia antes de abrir o arquivo

Todo o visual do sistema vive em um único arquivo: `app/globals.css`. Ele está
assim hoje:

- **5.686 linhas**
- **234 declarações `!important`**
- `.product-card` é redefinido em **4 blocos diferentes**, e o `border-radius`
  muda em cada um:

| Linha | Valor |
|---|---|
| 75 | `border-radius:15px` |
| 627 | (bloco de refinamento sem raio) |
| 1678 | `border-radius:18px !important` |
| 2393 | `border-radius:13px !important` |

Ou seja: quem abrir o arquivo procurando `.product-card`, achar a linha 75 e
editar lá **não vai ver efeito nenhum na tela**, porque duas camadas abaixo
sobrescrevem com `!important`.

Cada rodada anterior de ajuste visual empilhou uma camada nova em vez de
consertar a de baixo. **Não empilhe a quinta.**

### Regra

> Ao alterar um seletor, procure **todas** as ocorrências dele no arquivo
> (`grep -n "\.nome-da-classe" app/globals.css`), consolide em um único bloco e
> remova os `!important` que existiam só para vencer as camadas anteriores.

`!important` novo só é aceitável para sobrescrever estilo de biblioteca de
terceiros, e nesse caso precisa de um comentário explicando qual.

---

## 4. Regras invioláveis

### 4.1 Não renomear classes CSS

O TSX referencia as classes pelo nome. Renomear quebra a tela silenciosamente —
não dá erro de build, a página só perde o estilo. Estas (entre outras) são
intocáveis:

```
.product-card   .product-grid   .product-info   .product-photo
.catalog-controls   .catalog-heading   .filter-row
.home-kpis   .finance-kpis   .crm-stage   .app-shell
.approval-actions   .ap-approve   .ap-reject
.fv2-*   (toda a família da ficha v2)
```

Você pode alterar as **regras** dentro delas e **adicionar** classes novas. Não
pode renomear nem remover as existentes.

### 4.2 Piso de 11px

O sistema já teve textos de 7 a 9px que foram corrigidos. **Nada abaixo de
11px**, em nenhuma tela, em nenhuma condição. Se precisar mudar um tamanho, é
para aumentar a legibilidade — nunca para reduzir.

Rótulo em caixa alta usa `letter-spacing:.04em`.

### 4.3 Cores da marca

```
Laranja  #FF7000
Roxo     #8B00CC
Fonte    Quicksand
```

Os dois tons têm papéis separados:

- **Laranja = ação e preço.** CTA principal, valor de venda, item ativo na
  navegação, barra de progresso de estoque.
- **Roxo = dado derivado.** R$/m², VGV, indicadores calculados, ação secundária
  que gera relatório.

Se os dois aparecem no mesmo card, o laranja fica no topo (preço) e o roxo no
rodapé (indicador). Nunca disputam a mesma posição.

> **Atenção:** o arquivo `APECERTO_DIRECAO_DESIGN.md` na raiz traz `#ff6500` e
> `#8d2bd1`. **Esses valores estão errados** — são de uma versão antiga da
> marca. Use os de `docs/design/tokens.css`. O documento antigo será corrigido
> em separado; até lá, ignore a paleta dele (o resto do documento continua
> válido).

### 4.4 Nada de estado vazio mentiroso

Quando falta dado, o componente diz o que falta em vez de mostrar zero ou um
placeholder genérico. Isso é regra de produto, não de estilo.

Exemplo real: o card de produto mostrava `0 dorm.` em quase todo o catálogo
porque a coluna `dormitorios` é nula em 47 dos 49 empreendimentos. O corretor
lia "studio" onde havia apartamento de 3 dormitórios. O certo é derivar da
tipologia real ou dizer que o dado não existe.

### 4.5 Estados de interação

Todo elemento clicável precisa dos quatro:

```css
:hover          transform:translateY(-1px) + sombra sobe um nível
:focus-visible  outline:2px solid var(--orange); outline-offset:2px
:active         volta ao chão, sem translate
[disabled]      opacity:.55; cursor:default
```

---

## 5. Escopo por tipo de tarefa

### Tarefa visual (CSS)

Pode tocar: `app/globals.css`, e o JSX **apenas** para adicionar/reorganizar
elementos que o novo layout exige.

Não pode tocar: rotas de API (`app/api/**`), queries do Supabase, lógica de
estado, permissões, `app/lib/**`.

Se o layout exigir um dado que a API ainda não devolve, **não altere a API** —
descreva o que falta no corpo do PR e pare aí.

### Tarefa de lógica

Não misture com estilo. Um PR que muda regra de negócio e visual ao mesmo tempo
é impossível de revisar e de reverter.

---

## 6. Antes de abrir o PR

1. `pnpm lint` sem erro novo
2. `./node_modules/.bin/tsc --noEmit -p tsconfig.json` — sem erro novo nos
   arquivos tocados
3. `pnpm test:frontend` passando
4. Rode `grep -o "!important" app/globals.css | wc -l` antes e depois. **O número não
   pode subir.** Se subiu, você empilhou camada em vez de consolidar.
5. No corpo do PR, liste as classes alteradas e, para cada uma, quantos blocos
   duplicados você consolidou.

Nunca commite direto na `main`: ela dispara deploy automático no Render.
Sempre branch → PR.

---

## 7. A tarefa atual: visual da aba Produtos

A referência aprovada é o arquivo `produtos-proposta.html`, que o usuário anexa
junto com o pedido. Ele é um protótipo standalone com os 49 empreendimentos
reais — abra no navegador e use como especificação visual.

O que o layout novo resolve, e por quê:

| Hoje | Proposto | Razão |
|---|---|---|
| `R$ 403.350` (só o menor valor) | `R$ 402 mil a R$ 945 mil` | O corretor precisa saber se o produto cabe na faixa do lead, não só o piso |
| `21 disp.` solto no rodapé | Badge + barra de estoque `26 de 28 · 93%` | Estoque define urgência de venda |
| `0 dorm · 0 vaga` em quase todo card | Chips com as tipologias reais | `dormitorios` é nulo em 47 dos 49 produtos |
| `30 m²` (área mínima) | `25 – 36,27 m²` | Faixa, não ponto |
| Nenhuma visão de conjunto | Faixa de 5 KPIs no topo | Abrir a aba e já saber o estado do portfólio |
| Ordenação por data de cadastro | Ordenar por estoque / VGV / preço / A–Z | Data de cadastro não é critério comercial |

Arquivos envolvidos:

```
app/globals.css                              o CSS (consolidar as camadas)
app/features/products/ProductsModule.tsx     a grade e os filtros
docs/design/tokens.css                       tokens oficiais → viram o :root
```

Dois detalhes que estão no protótipo e são intencionais:

- Existe um `<input>` decorativo no header do módulo atual
  (`placeholder="Buscar lead, telefone, bairro..."`) **sem `value` e sem
  `onChange`** — ele não faz nada. Remova. O campo que funciona é o de baixo.
- `app/features/products/products.ts` mantém 8 produtos hardcoded como fallback
  (AP Moema, Claris, Key Moema…) com preços de 2025. Se a API falhar, o corretor
  vê preço fictício achando que é real. Substitua por estado de erro explícito.
