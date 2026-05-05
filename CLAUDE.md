# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sabor y Cajón** is a single-page marketing website for a traditional Peruvian restaurant in Ventanilla, Callao, Lima. The entire site lives in one file: [sabor-y-cajon.html](sabor-y-cajon.html).

No build tools, package manager, or compilation step — open the HTML file directly in a browser to develop.

## Development

To preview locally, open the file in a browser:
```
open sabor-y-cajon.html
```

Or serve it with any static file server:
```
python3 -m http.server 8080
```

## Architecture

Everything is self-contained in `sabor-y-cajon.html`:

- **`<style>`** — All CSS using custom properties defined in `:root`. Primary brand color is `--terracota: #C4522A`.
- **`<script>`** — Vanilla JS only: Intersection Observer for scroll-reveal animations and scroll-based nav styling.
- **No external JS dependencies** — only Google Fonts loaded via `<link>`.

### Page Sections (in order)
1. Fixed navigation bar with reservation CTA
2. Hero — split layout (text left, image right)
3. Stats band — 4 KPI cards
4. Gallery grid
5. Specialties list
6. Experience features (live music, celebrations, delivery)
7. Menu/carta — 6 category cards
8. Reservations form (submits via WhatsApp link) + contact info
9. Location + embedded Google Maps iframe
10. Footer
11. Floating WhatsApp button (fixed position)

### Responsive Breakpoints
- `@media (max-width: 900px)` — tablet layout
- `@media (max-width: 560px)` — mobile layout

### Key Integration Details
- **WhatsApp**: number `+51997170385`, used in floating button and reservation form submission
- **Google Maps**: embedded iframe for Mz J Lote 31 Coopemar, Ventanilla
- **Images**: loaded from Facebook Graph API with Unsplash fallbacks via `onerror`

## Duplicate File

`sabor-y-cajon (1).html` is a byte-for-byte duplicate — it can be deleted safely.
