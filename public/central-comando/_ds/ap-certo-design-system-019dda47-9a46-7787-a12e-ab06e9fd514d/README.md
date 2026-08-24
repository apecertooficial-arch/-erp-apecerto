# ApêCerto — Design System

> **ApêCerto** is a real-estate brokerage focused on **ready-to-move-in, furnished and decorated apartments in the Moema region of São Paulo, Brazil.**
> The name plays on Brazilian Portuguese: *apê* (short for *apartamento*) + *certo* ("the right one"). The brand promise is essentially **"the right apartment — already done."**

This repo is the visual + verbal design system that powers the brand: marketing site, Instagram social posts, listing materials, and any future product surface.

---

## Brand at a glance

| | |
|---|---|
| **Name** | ApêCerto |
| **Sector** | Real estate brokerage (imobiliária) |
| **Niche** | Pronto para morar (ready-to-move-in), furnished + decorated apartments |
| **Region** | Moema, São Paulo — SP |
| **Language** | Brazilian Portuguese (pt-BR) |
| **Personality** | Modern, jovial, confident, warm. Instagram-native. |
| **Audience** | Young professionals, couples and investors looking for low-friction, lifestyle-ready apartments in a premium SP neighborhood. |

The brand condenses into one image: a friendly **house outline with a checkmark inside** — *the right one, confirmed.* Orange is the **apê** (the home itself, warmth); purple is the **certo** (the confirmation, the seal).

---

## Sources & resources provided

All raw materials live in `/uploads/` (originals, untouched). Working copies live in `/assets/` and `/fonts/`.

- **Logos** — color, white, black variants, both lockup and standalone symbol versions, plus on-orange and on-purple background variants. (`uploads/logo_apecerto_*.png`, `uploads/logo_apecerto_simbolo_*.png`)
- **Grafismo** (brand pattern) — a geometric line motif derived from the house+check shape. Available in orange, purple, faded ("desbotado"), and black. Provided as both PNG and PDF, plus an Illustrator source `apecerto_grafismo.ai`. (`uploads/apecerto_grafismo_*`)
- **Typography** — full Quicksand family (Light/Regular/Medium/SemiBold/Bold) provided as TTF. (`uploads/Quicksand-*.ttf`)
- **No codebase / Figma provided** — the system below is derived from the brand assets and the brief: *"Design moderno jovial e que esteja bem conectado ao Instagram."*

---

## Index — what's in this repo

```
ApêCerto Design System/
├── README.md                  ← you are here
├── SKILL.md                   ← agent skill entrypoint
├── colors_and_type.css        ← CSS vars: colors, type, spacing, radii, shadows, motion
├── erp.css                    ← product surface (ERP): dense tables, KPIs, nav, forms, tabs, toolbar
├── assets/                    ← logos, grafismos, brand patterns
│   ├── logo-cores.png         ← full color lockup (default)
│   ├── logo-branco.png        ← white lockup (for dark/brand bg)
│   ├── logo-preto.png         ← black lockup (1-color print)
│   ├── logo-fundo-laranja.png ← variant designed to sit on orange
│   ├── logo-fundo-roxo.png    ← variant designed to sit on purple
│   ├── simbolo-*.png          ← symbol-only versions
│   └── grafismo-*.png         ← geometric pattern motif
├── fonts/                     ← Quicksand TTF, 5 weights
├── preview/                   ← Design System tab cards
│   ├── colors-primary.html
│   ├── colors-neutrals.html
│   ├── colors-semantic.html
│   ├── type-display.html
│   ├── type-scale.html
│   ├── spacing.html
│   ├── radii-shadows.html
│   ├── buttons.html
│   ├── form-fields.html
│   ├── cards-listing.html
│   ├── badges-chips.html
│   ├── logo-lockups.html
│   ├── grafismo.html
│   ├── table.html             ← Product / ERP
│   ├── kpi.html
│   ├── nav-sidebar.html
│   ├── form-dense.html
│   ├── tabs.html
│   └── toolbar.html
└── ui_kits/
    ├── website/               ← real-estate listings marketing site
    │   ├── README.md
    │   ├── index.html         ← interactive demo
    │   └── *.jsx              ← components (Hero, ListingCard, etc.)
    └── instagram/             ← Instagram post templates
        ├── README.md
        ├── index.html         ← all templates side-by-side
        └── *.jsx              ← Feed, Carousel, Story templates
```

---

## CONTENT FUNDAMENTALS

### Voice

ApêCerto talks like a **trusted, modern friend who knows Moema** — confident, warm, never stiff. The brand never sounds like a 90s realtor and never sounds like a luxury developer trying too hard. It sounds like someone you'd actually text.

- **Tone:** jovial, direct, optimistic. Light wordplay is welcome, never cringe.
- **Person:** *você* (informal "you") — never *o senhor / a senhora*. The brand is on first-name terms with everyone.
- **Voice POV:** first-person plural for the brand ("a gente acha", "selecionamos"), second-person for the reader ("você se muda esse mês").
- **Language:** Brazilian Portuguese. Carioca/paulistano colloquialisms ok in moderation (*"ape"*, *"morar gostoso"*, *"chave na mão"*).

### Copywriting rules

- **Sentence case** for almost everything. No Title Case Like This. Headlines are short and declarative.
- **Short headlines, short paragraphs.** A scrollable Instagram-native rhythm.
- **Lead with the outcome, not the asset.** "Mude esse mês" beats "Apartamento de 2 dormitórios disponível".
- **Numbers stay specific.** "67 m²", "R$ 4.200/mês", "5 min do metrô Eucaliptos". Never vague.
- **Cut filler.** No "Estamos felizes em apresentar…". Get to the apartment.
- **Address pain quickly.** The audience hates: empty apartments, surprise fees, slow brokers, weekend visits that go nowhere.

### Casing

- **Brand name:** always one word, lowercase, with the *ê*: **apêcerto**. In logo form, *apê* is orange and *certo* is purple. In running text, lowercase is fine; never "ApêCerto" inside body copy, although it's acceptable as a Title Case node in this README.
- **Headlines:** sentence case.
- **Buttons / labels:** sentence case ("Ver apê", "Agendar visita"), not ALL CAPS. Eyebrows / pre-titles are the only place small-caps tracking is used.
- **Bairro / metro names:** proper case ("Moema", "Vila Mariana", "metrô Eucaliptos").

### Emoji

- **Yes** — emoji are part of the Instagram-native voice, used **sparingly and on purpose**. One per post / caption / button label, max.
- Preferred set: 🔑 ✅ 🏡 🛋️ 📍 ☀️ 🌳 (Moema is full of trees) — feel-good, home-coded.
- Avoid emoji walls (🌟💫✨🔥💯). Avoid generic finance emoji (📈💰) — we're not a fintech.
- Never use emoji in formal docs (contracts, financial breakdowns).

### Examples — say this, not that

| ✅ Say | ❌ Don't say |
|---|---|
| "67 m² mobiliados, prontos pra chave na mão." | "Excelente apartamento totalmente mobiliado disponível para locação." |
| "Tá no Instagram? A gente também." | "Siga nossos perfis nas redes sociais." |
| "Mude esse mês 🔑" | "Mude-se já! 🔥🔥🔥" |
| "5 min do metrô Eucaliptos" | "Próximo a estação de metrô" |
| "Visita amanhã às 10h?" | "Estamos à disposição para agendar uma visita." |
| "Ver apê" (button) | "Saiba mais" (button) |

### Sample copy in the brand voice

> **Hero, marketing site**
> *Mude esse mês. Sem caixa, sem pintor, sem dor.*
> Apartamentos prontos pra morar em Moema. A gente entrega a chave, você só leva a escova de dente.

> **Listing teaser**
> *Apê na Pavão.* 67 m², 2 dorms, mobiliado por uma designer que sabe o que tá fazendo. 5 min do metrô Eucaliptos. R$ 4.200/mês, condomínio incluso.
> [Ver apê →]

> **Instagram caption**
> A gente acha que mudar de casa devia ser leve. Por isso, escolhemos um por um — só apê pronto, decorado, e com brokers que respondem no mesmo dia. 🔑
> Link na bio.

---

## VISUAL FOUNDATIONS

### Color

- **Two-brand-color system, equal weight.** Orange (`#FF7000`) carries energy and warmth — used for primary action, the *apê* word, the house outline, hero CTAs. Purple (`#8B00CC`) carries confirmation and trust — used for the *certo* checkmark, secondary actions, accents, badges. Neither is "primary" over the other — they're a couple.
- **Always allow neutrals to breathe.** A page should be mostly warm-neutral with brand colors as deliberate punctuation. **Never** lay orange on purple or purple on orange directly — always separate with neutral.
- **Warm neutrals**, not gray-blue. The neutral ramp tilts very slightly warm (a sand-white `#FAF8F6` page, charcoal-brown `#1F1C1A` text) to harmonize with the orange.
- **No bluish-purple gradients.** No purple-to-pink Instagram gradients (looks 2018). When we use gradient, it's an honest orange→deeper-orange or purple→deeper-purple radial wash, kept subtle.
- **Semantic colors** stay distinct from brand: green for success, amber for warning, red for danger, purple aliases to info.

### Typography

- **One family — Quicksand**, in five weights. Used for everything: display, body, UI, captions. The roundness of Quicksand mirrors the rounded line-art of the logo and grafismo — it's the brand's voice in type form.
- **Weights:** 300 only for very large display moments; 400 for body; 500 for emphasized labels; 600 for headings and buttons; 700 for hero headlines and the wordmark.
- **Headlines:** tightly-tracked (`-0.02em`), tight leading (1.1).
- **Body:** comfortable leading (1.45–1.6).
- **Eyebrows / pre-headings:** small, 12px, semibold, +0.12em letter-spacing, UPPERCASE, painted in orange. The only place we use UPPERCASE.
- **No serifs ever.** No mixed-family compositions.

### Imagery

- **Real photography of real apartments.** Bright, sunlit interiors. Wide-angle but honest — no fisheye. Warm tones (the orange brand is much friendlier next to warm photos than cold gray ones).
- **People are optional but, when present, candid** — not staged stock. Hands holding keys, a cat on a sofa, a coffee on a balcony.
- **Color grade:** warm, slightly desaturated, +5 highlights. Never high-contrast HDR or fluorescent. No black-and-white.
- **Crop:** generous breathing room. Square (1:1) and 4:5 portrait for Instagram, 3:2 landscape for the web.
- **Stock photos: avoid.** If unavoidable, pick the warmest, most lived-in option and never feature a smiling person handing keys to another smiling person.

### Backgrounds & motifs

- **Mostly clean.** The default page is `--bg-page` (`#FAF8F6`), and cards sit on `--bg-surface` (white).
- **The grafismo** (geometric line pattern derived from the logo) is the signature motif. Use it:
  - **Faded** (`grafismo-desbotado.png`) as a subtle tint behind hero sections, footer washes, or empty states. ~10–20% opacity max.
  - **Orange or purple** as a strong section break or a feature-card backdrop — never both at once.
  - **Black** for print only.
  - Always bleed off at least one edge. Never center it like a logo.
- **Full-bleed photos** are reserved for the marketing site hero and listing detail pages.
- **No repeating textures** (no paper grain, no noise). No mesh gradients. No glassmorphism.

### Animation & motion

- **Quick and warm.** `--dur-base: 200ms` is the default; nothing exceeds 360ms outside of hero moments.
- **Easing is `cubic-bezier(0.2, 0.8, 0.2, 1)`** (a soft ease-out) for almost everything. The spring curve `cubic-bezier(0.34, 1.56, 0.64, 1)` is reserved for tiny celebratory beats (a save heart, a confirm checkmark).
- **Fades + 4px Y-translate** for content appearing. No flashy slides-from-the-side.
- **No bounces on buttons.** No skeuomorphic shadows under the cursor.

### States

- **Hover (interactive elements):** background darkens to the `-600` step (e.g. orange `#FF7000` → `#E66200`), or for ghost buttons, fills in the brand tint. Lift cards a notch via shadow `xs → sm` and a 2px Y rise.
- **Pressed:** background goes to `-700`, transform scales to `0.98`. Quick (`120ms`).
- **Focus:** 3px outline in the brand color at 40% opacity, 2px offset. Never the browser default blue.
- **Disabled:** 40% opacity, no pointer events.

### Borders

- Default border is **1px solid `--border-soft`** (`#E4DFD9`).
- Inputs use `--border-default`. Focus replaces border with `--ape-orange`.
- Cards usually have **no border** — they're defined by shadow and corner radius instead. Bordered cards are an alternate, lighter-weight style for dense listings.

### Shadows

- All shadows are **soft, single-pass, warm-tinted** (`rgba(31, 28, 26, …)`), not pure black.
- 5-step scale: `xs / sm / md / lg / xl`. Default card is `--shadow-sm`; modals and dropdowns use `--shadow-lg`; sticky CTAs use `--shadow-md` plus a slight upward Y.
- Brand-colored shadows (`--shadow-brand`, `--shadow-accent`) on hero CTAs only — used like a "glow" to make a button feel pressable.

### Corner radii

- **Cards / surfaces: 18px (`--radius-lg`).** This is the system signature.
- **Featured / hero cards: 24px (`--radius-xl`).**
- **Inputs: 12px.** Buttons: **pill (`--radius-pill`)** for primary CTAs, **12px** for compact secondary actions.
- **Badges & chips: pill** always.
- The rounded language echoes the rounded terminals of Quicksand and the grafismo.

### Transparency & blur

- Used **only** in sticky overlays: the marketing nav uses `rgba(250, 248, 246, 0.78)` with `backdrop-filter: blur(20px)`.
- Image overlays for caption legibility use a **linear gradient from transparent to `rgba(31, 28, 26, 0.6)`** at the bottom 40% of the image — never a full-image dimmer.
- No frosted-glass cards. No translucent buttons.

### Layout rules

- **Container:** 1200px max-width, 24px horizontal gutter, 32–80px section padding depending on density.
- **Grid:** 12-column on desktop, 4-column on mobile. Generous gaps (24px).
- **Vertical rhythm:** sections breathe with **80–120px** of vertical padding on marketing pages, **24–40px** on product surfaces.
- **Sticky elements:** sticky nav with transparent blur; sticky "Agendar visita" CTA on listing pages on mobile.
- **Asymmetry over centering.** The brand likes things slightly off-axis — headlines align left, photos overlap section edges, the grafismo bleeds.

### Vibe checklist

| Yes | No |
|---|---|
| Warm, rounded, friendly | Cold, sharp, corporate |
| Two-color identity (orange + purple) | Single accent on neutral |
| Sentence case | TITLE CASE |
| Quicksand only | Mixed serif + sans |
| Soft warm shadows | Hard black drop shadows |
| 18–24px corner radius | 4–8px corner radius |
| Grafismo as decoration | Mesh gradients, glassmorphism |
| Real apartment photos | Stock images of handshakes |

---

## ICONOGRAPHY

### Brand iconography
The **house-with-checkmark** in the logo is the master brand glyph and the entire visual personality. The **grafismo** is its extension — the same house+check shape repeated and overlapped to form a geometric line pattern. Both are kept in `/assets/` as PNGs (originals also include SVG-friendly PDFs and an `.ai` source in `/uploads/`).

### UI iconography
- **System:** **Lucide Icons** ([lucide.dev](https://lucide.dev/)) — chosen because it has the same rounded-stroke language as the ApêCerto logo (consistent 2px stroke, rounded terminals, geometric construction).
- **Why Lucide over Heroicons / Phosphor:** Lucide's `stroke-linecap: round` and `stroke-linejoin: round` mirror the literal construction of the logo. Phosphor is too thin; Heroicons solid is too heavy; Material is too cold.
- **Default stroke width:** `2`. Default size: `20px` inline / `24px` standalone.
- **Color:** icons inherit `currentColor` so they pick up the surrounding text color. In branded contexts use `--ape-orange` or `--ape-purple` directly.
- **Loaded via CDN:**
  ```html
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
  <i data-lucide="home"></i>
  <script>lucide.createIcons();</script>
  ```
- **Note:** No production codebase was provided, so the icon system above is a documented choice, not a documented fact. Flag for the team if they're already using a different set (e.g. Phosphor in the real product).

### Emoji as icons
Emoji are used **sparingly in marketing copy** (Instagram captions, button labels for delight): 🔑 ✅ 🏡 🛋️ 📍. They are **never** used as functional UI icons — for that, Lucide.

### Unicode characters
- Arrows in CTA buttons: `→` (U+2192), e.g. *Ver apê →*. Not `>` or `>>`.
- Bullets in lists where Lucide isn't appropriate: `•` (U+2022).
- The brand never invents ascii ornaments (no `~~~`, `***`).

---

## Product surface (ERP)

The internal brokerage ERP is the same brand at a different density. Brokers and managers live in it 8 hours a day, with a 5-minute SLA on new leads — **density beats breathing room**. Same tokens, same rules (4px grid, 11px text floor, sentence case, eyebrow-only CAPS, Lucide icons, zero emoji, never orange touching purple), one step down the scale everywhere.

All classes live in `erp.css` (prefixed `ape-`: `.ape-table`, `.ape-kpi`, `.ape-nav`, `.ape-field`, `.ape-tabs`, `.ape-toolbar`) and consume only existing tokens. Classes, not inline styles — ERP components must be overridable.

### Type scale — marketing vs ERP

| Role | Marketing | **ERP** |
|---|---|---|
| Page title | `--text-5xl` (60px) | **`--text-xl`** (24px) |
| Section title | `--text-3xl` (38px) | **`--text-lg`** (20px) |
| Card title | `--text-xl` (24px) | **`--text-base`** (16px) |
| Body | `--text-base` (16px) | **`--text-sm`** (14px) |
| Label / meta | `--text-sm` (14px) | **`--text-xs`** (12px) |
| Eyebrow | `--text-xs` +0.12em CAPS | same |

Internal component spacing compresses too: `--space-1`/`--space-2`/`--space-3`, not `--space-6`.

### Shadow rule

`--shadow-brand` (the orange glow) works on a hero with one CTA. On an ERP screen with 20 buttons it turns into orange blur — use `--shadow-xs` or none on list buttons, and reserve `--shadow-brand` for the single CTA of a modal.

### Preview pages

`preview/table.html` · `preview/kpi.html` · `preview/nav-sidebar.html` · `preview/form-dense.html` · `preview/tabs.html` · `preview/toolbar.html` — grouped under **Product / ERP** in the Design System tab.

---

## Substitutions & flags for the user

> 📌 **Open questions / things to confirm with the brand owner before going to production:**
>
> 1. **Icon set.** No production codebase was provided. We're proposing **Lucide** as the UI icon system. If the real product already uses Phosphor / Heroicons / a custom set, let us know and we'll swap.
> 2. **Real apartment photography.** All listing visuals in the UI kits use **placeholder photos**. Plug in real listing photography before any client review.
> 3. **Listing data shape.** The website + Instagram UI kits use **invented listing data** (titles, sqm, prices, addresses). Replace with real listings or feed from your CMS.
> 4. **Secondary brand colors.** We've extended a green / amber / red **semantic palette** that doesn't appear in the provided assets. Let us know if there's an existing one to honor.
> 5. **Logo backgrounds.** `logo-fundo-laranja.png` is meant to **sit on an orange canvas** (the file itself shows just the white+purple components). Similarly `logo-fundo-roxo.png` sits on purple. Don't use these on white — use `logo-cores.png` instead.

---

## How to use this system

In any new page, link the CSS once and you have all the vars:

```html
<link rel="stylesheet" href="../colors_and_type.css">
```

Then reach for the vars:

```css
.cta {
  background: var(--ape-orange);
  color: var(--fg-inverse);
  border-radius: var(--radius-pill);
  padding: var(--space-3) var(--space-6);
  box-shadow: var(--shadow-brand);
  font-weight: var(--weight-semibold);
  transition: background var(--dur-fast) var(--ease-out);
}
.cta:hover { background: var(--ape-orange-600); }
```

For the wordmark inline in text:
```html
<span class="brand-ape">apê</span><span class="brand-certo">certo</span>
```

For the grafismo as a hero backdrop:
```css
.hero {
  background:
    url('../assets/grafismo-desbotado.png') right -100px top -80px / 800px no-repeat,
    var(--bg-tint-orange);
}
```
