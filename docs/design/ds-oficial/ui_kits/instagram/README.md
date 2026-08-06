# ApêCerto — Instagram UI Kit

The brand brief asked for designs "bem conectado ao Instagram." This kit is the social toolbelt: ready-to-screenshot post templates that match the brand voice and visuals.

## Templates

| Template | Size | Use for |
|---|---|---|
| **ListingPost** | 1080×1350 (4:5) | New apartment announcements, the workhorse |
| **CarouselSlide** | 1080×1080 (1:1) | Multi-slide tours, before/after, "how it works" |
| **QuotePost** | 1080×1350 (4:5) | Testimonials, "say-this-not-that", brand voice moments |
| **StoryPost** | 1080×1920 (9:16) | Daily drops, polls, "novo apê" stickers |

## What's in here

- **`index.html`** — all templates laid out side-by-side at scaled-down size for review. Click any to enter focus view.
- **`ListingPost.jsx`** — apartment-photo feed post
- **`CarouselSlide.jsx`** — generic 1:1 slide with multiple layout variants
- **`QuotePost.jsx`** — large-type quote post (testimonial / brand voice)
- **`StoryPost.jsx`** — 9:16 story post with sticker overlays
- **`templates.css`** — shared Instagram-canvas styling

## Caveats
- Apartment **photos are placeholders** (gradient + grafismo). Replace `.photo` backgrounds with real listing photography.
- All templates render at **design size in CSS** (1080-wide) — scaled via CSS `transform` for the review grid. Screenshot at full size to export.
