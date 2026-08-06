# apêcerto — Design Tokens (cole isso onde precisar)

Documento único e portátil — copie tudo abaixo e cole no chat do Canva, Figma, Claude Code, ou onde for. Não depende de fetch nem de URL.

---

## 1. Marca

- **Nome:** apêcerto (sempre minúsculo, uma palavra, com **ê**)
- **Setor:** imobiliária — apartamentos prontos pra morar, mobiliados, em Moema (SP)
- **Lockup:** *apê* em laranja + *certo* em roxo
- **Símbolo:** casa com check dentro
- **Padrão gráfico ("grafismo"):** versão geométrica da casa+check, repetida — disponível em laranja, roxo, desbotado, preto

---

## 2. Cores (hex)

### Marca — primárias
| Token | Hex | Uso |
|---|---|---|
| `--ape-orange` | `#FF7000` | apê, CTA primário, energia |
| `--ape-orange-700` | `#CC5800` | pressionado / texto sobre tint |
| `--ape-orange-600` | `#E66200` | hover |
| `--ape-orange-300` | `#FF9A4D` | ilustrativo |
| `--ape-orange-100` | `#FFE4D1` | tint de fundo, tag |
| `--ape-orange-50` | `#FFF3EA` | acento sutil |
| `--ape-purple` | `#8B00CC` | certo, ação secundária, selo |
| `--ape-purple-700` | `#66009A` | pressionado |
| `--ape-purple-600` | `#7A00B3` | hover |
| `--ape-purple-300` | `#B24DDD` | ilustrativo |
| `--ape-purple-100` | `#EBD1F5` | tint, tag |
| `--ape-purple-50` | `#F7ECFC` | acento sutil |

### Neutros (tom quente, levemente fora do cinza)
| Token | Hex |
|---|---|
| `--neutral-0`   | `#FFFFFF` |
| `--neutral-50`  | `#FAF8F6` (fundo de página) |
| `--neutral-100` | `#F2EFEC` |
| `--neutral-200` | `#E4DFD9` (borda padrão) |
| `--neutral-300` | `#C9C2BA` |
| `--neutral-400` | `#9A938B` (placeholder) |
| `--neutral-500` | `#6E6760` |
| `--neutral-600` | `#4D4842` (corpo) |
| `--neutral-700` | `#332F2B` |
| `--neutral-800` | `#1F1C1A` (títulos) |
| `--neutral-900` | `#100E0D` |

### Semânticas
| Token | Hex | Uso |
|---|---|---|
| `--success` | `#1FA85A` | "Disponível" |
| `--success-bg` | `#E4F6EC` | |
| `--warning` | `#F2A82C` | "Reservado" |
| `--warning-bg` | `#FDF1D9` | |
| `--danger` | `#D93E3E` | "Alugado/Vendido" |
| `--danger-bg` | `#FBE5E5` | |
| `--info` | `#8B00CC` (= purple) | |

### Regra crítica
- Nunca laranja direto encostado em roxo. **Sempre separar com neutro.**
- Sem gradientes roxo→rosa estilo Instagram 2018.

---

## 3. Tipografia

### Família
**Quicksand** — única fonte do sistema. 5 pesos: 300, 400, 500, 600, 700.
Download: [Google Fonts → Quicksand](https://fonts.google.com/specimen/Quicksand)

Caso o Canva ofereça, importar Quicksand de:
```
https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap
```

### Escala
| Estilo | Tamanho | Peso | Tracking | Leading |
|---|---|---|---|---|
| Display / hero | 64–96px | 700 | −0.03em | 0.98 |
| H1 | 48px | 700 | −0.02em | 1.1 |
| H2 | 32px | 700 | −0.02em | 1.1 |
| H3 | 24px | 600 | −0.01em | 1.25 |
| H4 | 20px | 600 | −0.01em | 1.25 |
| Body | 16px | 400 | 0 | 1.5 |
| Small | 13–14px | 400 | 0 | 1.45 |
| **Eyebrow** | 12px | 600 | **+0.12em UPPERCASE** | 1.45 — **só lugar com CAPS** |

### Wordmark
```
[apê em laranja][certo em roxo]   ← Quicksand Bold 700, tracking −0.03em
```

---

## 4. Espaçamento (base 4px)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128`

- Dentro de componente: 4–12
- Entre irmãos: 8–16
- Entre grupos: 16–24
- Entre seções de marketing: 64–96 vertical

---

## 5. Cantos (border-radius)

- Botão pill, badge, chip, tag: **999px**
- Input, botão pequeno secundário: **12px**
- Card padrão: **18px** (assinatura do sistema)
- Card de destaque / hero: **24px**
- Modal / sheet grande: **32px**

---

## 6. Sombras (sutis, tom quente — `rgba(31, 28, 26, …)`)

| Token | Valor |
|---|---|
| `--shadow-xs` | `0 1px 2px rgba(31,28,26,0.04)` |
| `--shadow-sm` | `0 2px 6px rgba(31,28,26,0.06)` |
| `--shadow-md` | `0 8px 20px rgba(31,28,26,0.08)` |
| `--shadow-lg` | `0 16px 40px rgba(31,28,26,0.10)` |
| `--shadow-xl` | `0 24px 60px rgba(31,28,26,0.14)` |
| `--shadow-brand` | `0 12px 28px rgba(255,112,0,0.28)` |
| `--shadow-accent` | `0 12px 28px rgba(139,0,204,0.24)` |

---

## 7. Movimento

- Easing padrão: `cubic-bezier(0.2, 0.8, 0.2, 1)` (ease-out suave)
- Spring para microinterações: `cubic-bezier(0.34, 1.56, 0.64, 1)`
- Duração: **120ms** rápido (hover/press), **200ms** padrão, **360ms** entrada de seção
- Padrão de entrada: fade + 4px translateY. **Sem bounce em botão.**

---

## 8. Ícones

- Sistema: **Lucide** (monoline, 2px stroke, terminais arredondados — combina com o logo)
- Tamanho padrão: 18–20px inline, 24px standalone
- Cor: `currentColor` (herda do texto). Em destaque, usar `--ape-orange` ou `--ape-purple`
- **Sem emoji em UI funcional.** Emoji só em copy de marketing/Instagram, com moderação.

---

## 9. Voz e tom (copywriting)

### Pessoa
- **Você** (informal). Nunca "o senhor".
- Marca fala em primeira pessoa do plural ("a gente seleciona", "selecionamos").

### Vibe
Jovial, direto, otimista, conectado a Instagram. Como um amigo confiável que conhece Moema. Nunca corporativo.

### Casing
- **Sentence case** em tudo (títulos, botões, labels). Sem TITLE CASE.
- Brand name sempre minúsculo: **apêcerto**.
- Única exceção pra CAPS: eyebrow com tracking +0.12em.

### Exemplos
| ✅ | ❌ |
|---|---|
| "Mude esse mês." | "Mude-se já!" |
| "Apê na Pavão · 67m² · mobiliado" | "Excelente apartamento totalmente mobiliado" |
| "Ver apê →" | "Saiba mais" |
| "5 min do metrô Eucaliptos" | "Próximo a estação de metrô" |
| "Tá no Instagram? A gente também." | "Siga nossos perfis nas redes sociais." |

### Emoji
Usar com parcimônia em caption: 🔑 ✅ 🏡 🛋️ 📍 ☀️ 🌳. **Um por mensagem, no máximo.** Nunca paredão de emoji. Nunca em UI funcional.

---

## 10. Snippet pronto (CSS vars)

Cole isso no início de qualquer projeto:

```css
:root {
  --ape-orange: #FF7000; --ape-orange-600: #E66200; --ape-orange-700: #CC5800;
  --ape-orange-300: #FF9A4D; --ape-orange-100: #FFE4D1; --ape-orange-50: #FFF3EA;
  --ape-purple: #8B00CC; --ape-purple-600: #7A00B3; --ape-purple-700: #66009A;
  --ape-purple-300: #B24DDD; --ape-purple-100: #EBD1F5; --ape-purple-50: #F7ECFC;
  --neutral-0: #fff; --neutral-50: #FAF8F6; --neutral-100: #F2EFEC;
  --neutral-200: #E4DFD9; --neutral-300: #C9C2BA; --neutral-400: #9A938B;
  --neutral-500: #6E6760; --neutral-600: #4D4842; --neutral-700: #332F2B;
  --neutral-800: #1F1C1A; --neutral-900: #100E0D;
  --success: #1FA85A; --warning: #F2A82C; --danger: #D93E3E;
  --font: 'Quicksand', system-ui, sans-serif;
  --radius-card: 18px; --radius-pill: 999px;
  --shadow-card: 0 2px 6px rgba(31,28,26,0.06);
  --shadow-brand: 0 12px 28px rgba(255,112,0,0.28);
}
body { font-family: var(--font); background: var(--neutral-50); color: var(--neutral-800); }
```
