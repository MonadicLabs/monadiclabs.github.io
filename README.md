# Monadic Labs

Portfolio + blog site for Monadic Labs, built with [Astro](https://astro.build) and Tailwind CSS v4.

## Structure

```text
/
├── design/                  # source logo/brand PNGs
├── public/assets/logo/      # logo files used by the site
├── src/
│   ├── components/          # Header, Footer, PlaceholderBadge, page components
│   ├── content/              # Work (case studies) and Notes (blog) collections
│   │   ├── work/*.md
│   │   └── notes/*.md
│   ├── content.config.ts    # collection schemas
│   ├── i18n/ui.ts           # EN/FR nav, footer, and shared UI strings
│   ├── layouts/Layout.astro
│   ├── pages/                # English routes (default locale, no prefix)
│   └── pages/fr/              # French routes for the localized core pages
└── astro.config.mjs
```

## i18n

The site is bilingual (English default at `/`, French at `/fr/`), using Astro's
built-in i18n routing. Only the core pages (home, services, products, pricing,
contact) currently have French versions — blog posts and case studies are
English-only for now. Shared nav/footer strings live in `src/i18n/ui.ts`.

## Content that needs your input before launch

Several things were built as clearly-flagged placeholders — grep for
`placeholder: true` in `src/content/` and search the codebase for `hello@monadiclabs.com`,
`your-form-id`, and `PlaceholderBadge` to find everything that needs real content:

- 2 case studies (`src/content/work/`) and 3 blog posts (`src/content/notes/`)
- Contact email and social links (`src/components/Footer.astro`)
- Contact form endpoint (`src/pages/contact.astro` / `ContactPage.astro` — currently a placeholder Formspree URL)
- SPU product specs and pricing (`src/pages/products.astro` / `ProductsPage.astro`)
- Pricing numbers (`src/pages/pricing.astro` / `PricingPage.astro`)
- Legal pages (`privacy.astro`, `terms.astro`, `accessibility.astro`) — generic boilerplate, have a lawyer review

## Commands

All commands are run from the root of the project, from a terminal:

| Command                | Action                                      |
| :---------------------- | :------------------------------------------- |
| `npm install`           | Install dependencies                         |
| `npm run dev`            | Start the local dev server at `localhost:4321` |
| `npm run build`          | Build the production site to `./dist/`       |
| `npm run preview`        | Preview the production build locally          |

Per this repo's `AGENTS.md`/`CLAUDE.md`, start the dev server in the background
with `astro dev --background` (manage with `astro dev stop/status/logs`).
