# ApêCerto — Website UI Kit

A click-through marketing site recreation. Demonstrates the brand at full marketing scale: hero with search, listing grid, "como funciona" explainer, neighborhood spotlight, testimonial, sticky CTA, footer.

## What's in here

- **`index.html`** — interactive demo. Click filter chips, listing cards (open a detail view), the search bar, and the bottom-sheet CTA.
- **`Header.jsx`** — sticky transparent-blur nav.
- **`Hero.jsx`** — hero with the *Mude esse mês* headline, search composer, trust strip.
- **`SearchBar.jsx`** — bairro / dorms / preço search pill.
- **`ListingCard.jsx`** — the apartment card. Photo, status badge, price, specs, tags, save button.
- **`ListingGrid.jsx`** — featured grid + filter chips.
- **`HowItWorks.jsx`** — 3-step explainer with grafismo backdrop.
- **`NeighborhoodCard.jsx`** — Moema spotlight strip.
- **`Testimonial.jsx`** — quote card.
- **`ListingDetailSheet.jsx`** — slide-up detail panel (opens when a card is clicked).
- **`Footer.jsx`** — newsletter + nav.

## Caveats

- **Photos are placeholders** (warm CSS gradients). Plug real listing photography in via the `photo` prop on `ListingCard`.
- **Listing data is invented** — addresses, prices, sqm are illustrative.
