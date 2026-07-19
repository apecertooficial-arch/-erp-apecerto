# Direção de Design — ERP apêcerto

Documento para o time de design evoluir o ERP **sem regredir**. A identidade atual (nos prints) está aprovada e deve ser preservada. O objetivo é **refinar, padronizar e dar acabamento**, componente por componente — não reinventar.

---

## 0. Regras de ouro (LER PRIMEIRO — inegociável)

1. **Não diminuir fontes.** O sistema já teve textos pequenos demais (7–9px) que foram corrigidos. Nada abaixo de **11px**. Se for mudar tamanho, é para **aumentar legibilidade**, nunca reduzir.
2. **Manter a identidade dos prints**: laranja `#ff6500` + roxo `#8d2bd1`, fonte **Quicksand**, botões pill, cards arredondados, ícones em "badge" colorido. Evoluir o acabamento, não trocar a cara.
3. **Todo o visual vive em `app/globals.css`** (classes CSS, não Tailwind). Trabalhar lá.
4. **Nunca renomear classes CSS existentes** (ex.: `.home-kpis`, `.finance-kpis`, `.product-card`, `.crm-stage`, `.app-shell`). O HTML referencia pelo nome — renomear quebra a tela. Pode alterar as regras e adicionar novas.
5. **Não mexer em lógica** (`.tsx`, props, fetch, estado, rotas). Só CSS. Se precisar mudar estrutura de HTML, listar exatamente quais `.tsx` e por quê.
6. **Entregar como diff do `globals.css`** + lista do que mudou, para reintegração segura na produção.

---

## 1. O que MANTER (identidade aprovada)

- **Cores da marca**: laranja `#ff6500` (ação/energia) e roxo `#8d2bd1` (destaque/dados).
- **Tipografia**: Quicksand em todo o sistema.
- **Formas**: cantos arredondados, botões pill, cards brancos com sombra suave, ícones em quadrado/círculo colorido.
- **Barra lateral** branca com seções PRINCIPAL / FERRAMENTAS / SISTEMA e item ativo em destaque laranja.
- **Cards de KPI** com ícone colorido + "bolha" decorativa no canto (Início, Financeiro, Analítico).
- **Kanban** com topo colorido por etapa.
- **Cards de produto** com foto em gradiente.

---

## 2. Sistema de tokens a FORMALIZAR (no topo do `:root`)

Hoje as cores/medidas estão espalhadas e repetidas. Consolidar em variáveis e usar em todo lugar. Sugestão de base (ajustar valores finos, manter a lógica):

### Cor
```
--orange:#ff6500; --orange-600:#e65a00; --orange-700:#c94f00; --orange-soft:#fff2e9;
--purple:#8d2bd1; --purple-600:#7a1fb8; --purple-soft:#f5ebfb;
--green:#17874e; --green-soft:#e6f7ed;      /* sucesso / entrada */
--red:#d3443e;   --red-soft:#ffeded;          /* erro / saída */
--blue:#2f6fed;  --blue-soft:#eaf1ff;         /* info */
--yellow:#e5a800;--yellow-soft:#fff6de;       /* atenção */
--page:#faf9f7; --surface:#ffffff; --sunken:#f6f3f0; --line:#eee9e5;
--ink:#2b2723; --ink-soft:#5c554f; --muted:#8b827c;
```

### Tipografia (escala fixa — fim do "cada tela um tamanho")
| Uso | Tamanho | Peso |
|---|---|---|
| Número hero (ex.: VGV R$ 48M) | 28–32px | 800 |
| Título de página (h1) | 22px | 700 |
| Número de KPI | 22–24px | 700 |
| Título de seção (h2) | 16px | 700 |
| Corpo / conteúdo | 13–14px | 400–500 |
| Rótulo / meta | 12px | 500–600 |
| Micro (chips, timestamps) | **11px mínimo** | 600 |

Regra: **nada < 11px**. Rótulos em CAIXA ALTA usam `letter-spacing:.04em`.

### Espaçamento
Escala de 4: `4 · 8 · 12 · 16 · 20 · 24 · 32`. Padding padrão de card: 16px. Gap entre cards: 12–14px.

### Raios
```
--radius-chip:999px; --radius-btn:12px; --radius-input:10px; --radius-card:16px;
```

### Sombras
```
--shadow-xs:0 1px 2px rgba(31,24,19,.04);
--shadow-sm:0 2px 6px rgba(31,24,19,.06);
--shadow-md:0 12px 28px rgba(31,24,19,.08);
--shadow-brand:0 8px 20px rgba(255,101,0,.20);   /* botão/realce laranja */
```

### Estados (aplicar em TODO elemento clicável)
- **hover**: leve `translateY(-1px)` + sombra sobe um nível.
- **focus-visible**: anel `2px` laranja (`outline:2px solid var(--orange); outline-offset:2px`) — acessibilidade.
- **active**: volta ao chão (sem translate).
- **disabled**: `opacity:.55; cursor:default`.

---

## 3. Diretrizes por componente

### Botões (padronizar 4 tipos)
- **Primário (CTA)**: pill laranja, texto branco, `--shadow-brand`. Ex.: "+ Novo lead", "Aplicar filtros".
- **Secundário**: branco, borda `--line`, texto `--ink`. Ex.: "Limpar", "Comparar".
- **Ghost**: transparente, texto `--ink-soft`, hover com fundo `--sunken`. Ex.: "Chat", "Mover" nos cards do kanban.
- **Perigo**: texto/borda vermelho suave. Ex.: "Descartar lead".
- Altura consistente (~40px), padding horizontal 16–18px, `--radius-btn` (pill nos CTAs principais).
- Roxo entra como **CTA secundário de destaque** (ex.: "+ Entrada de comissão" já é roxo — manter esse papel para ações "de dados/relatório").

### Cards de KPI (Início, Financeiro, Analítico)
- Manter ícone em badge colorido + bolha decorativa.
- **Padronizar**: número 22–24px, rótulo 12px, sublabel 11px. Hoje variam entre telas — unificar.
- Alinhar todos à mesma altura e mesmo padding (16px).

### Kanban (Funil, Vendas em processo)
- Manter topo colorido por etapa e badge de contagem.
- Card do lead: avatar, nome (14px), telefone (12px), corretor em roxo (12px), chip de tempo, origem + valor, tags.
- Botões "Chat"/"Mover" como **ghost** padronizados.
- Cuidar do espaçamento vertical entre cards (12px) e do scroll horizontal suave.

### Tabelas (Leads, Vendas & comissões, Ranking)
- Cabeçalho: fundo `--sunken`, texto `--muted` 11px CAIXA ALTA, `letter-spacing:.04em`.
- Linhas: altura confortável (≥52px), hover `--sunken`, borda inferior `--line`.
- Faixa colorida à esquerda por status (já existe) — manter e padronizar as cores com os tokens semânticos.
- Status/etiquetas como **chips** (pill, fundo suave da cor semântica).

### Drawer do lead / venda (painel lateral)
- Manter cabeçalho com gradiente roxo e o box "PRÓXIMA AÇÃO" em destaque (fundo pêssego + botão laranja).
- Grid de "Ações rápidas": ícones laranja, cards quadrados uniformes, hover com leve realce.
- Aumentar levemente a legibilidade dos textos do histórico (mín. 12px).

### Chips / tags (origem, dorms., status)
- Formato pill único, `padding:4px 9px`, fonte 11px 600.
- Cor por categoria via tokens (neutro `--sunken`; sucesso/erro/info conforme o caso).

### Inputs / selects / busca
- Borda `--line`, `--radius-input`, altura consistente (~40px), foco com anel laranja.
- Busca no topo: pill com ícone de lupa, largura confortável.

### Navegação (sidebar)
- Item ativo: destaque laranja (fundo suave + borda), já bom — só padronizar o mesmo tratamento em todos os grupos.
- Badges (CRM 20, Produtos 45): pill laranja pequeno, 11px.
- Rodapé com avatar + nome + papel.

### Cards de produto
- Manter foto em gradiente + selo de status (Pronto/Lançamento/Em obras) no canto.
- Preço em laranja (destaque), specs em chips, `--radius-card`.

---

## 4. Prioridades de melhoria (nesta ordem)

1. **Legibilidade** — subir todos os textos < 11px para a escala do item 2. É o ganho mais visível e imediato.
2. **Consistência** — trocar valores soltos pelos tokens; unificar tamanhos de fonte, paddings e raios entre módulos.
3. **Estados interativos** — hover/focus/active/disabled em todos os botões, cards clicáveis e linhas de tabela.
4. **Hierarquia** — reforçar contraste entre título, número e rótulo nos KPIs e cabeçalhos.
5. **Acabamento** — sombras coerentes (`--shadow-*`), alinhamento de grids, respiro (espaçamento) uniforme.

---

## 5. O que NÃO fazer (anti-regressão)

- ❌ Reduzir fontes / voltar para 7–9px.
- ❌ Renomear ou remover classes existentes.
- ❌ Trocar a paleta ou a fonte da marca.
- ❌ Mexer em `.tsx`, dados, rotas ou lógica.
- ❌ Criar um segundo CSS que ninguém importa (o correto é `app/globals.css`, importado em `app/layout.tsx`).

---

## 6. Checklist de entrega (para o design devolver)

- [ ] `:root` com tokens consolidados (cor, tipografia, espaçamento, raio, sombra).
- [ ] Escala de tipografia aplicada (nada < 11px).
- [ ] 4 tipos de botão padronizados com estados.
- [ ] KPIs, kanban, tabelas, chips, inputs e drawer revisados conforme o item 3.
- [ ] Diff do `globals.css` + lista de classes alteradas.
- [ ] Se tocou algum `.tsx`: lista dos arquivos e o motivo.

---

**Resumo em uma frase:** manter 100% da identidade dos prints, subir a legibilidade, padronizar tudo com tokens e dar acabamento nos estados — evolução, não regressão.
