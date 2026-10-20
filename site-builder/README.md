# Think Different Visuals Studio — website builder module

Design websites from inspiration, optimise them, and launch them with hosting and domain connection, all in one app.

```
npm install
npm run dev        # studio on http://localhost:5173 + hosting/API server on :8787
npm test           # unit tests
npm run build && npm start   # production: one Node process on :8787 serves the studio, the API and published sites
```

Node 18+ is required. The server has no runtime dependencies.

## Look & feel

The studio carries the **Think Different Visuals** brand. The logo is redrawn as a vector (`src/brand/BrandLogo.tsx`) so it stays sharp at any size. Brand colours are taken from the supplied artwork:

| Colour | Hex | Used for |
| --- | --- | --- |
| Brand blue | `#1B4374` | the D, “Different”, primary buttons |
| Brand orange | `#E8983F` | the stem, “Think”, accents and highlights |
| Brand navy | `#2F3557` | “VISUALS” |

The colour profile button (the dot in the top bar) switches between **Signature** (blue with orange), **Sunrise** (orange with blue), **Midnight** (navy with orange) and **Noir** (monochrome with brand accents). Each profile works in **Auto / Light / Dark** mode, and your choice is saved in the browser. In dark mode the blues are lifted and link shades are adjusted so text stays readable (WCAG AA). The logo mark itself always keeps its original colours.

Brand files in `public/brand/`: `tdv-mark.svg` (vector mark), `tdv-logo.png` (full logo on a transparent background, for light pages) and `tdv-logo-on-black.jpg` (the original artwork, cropped). For your own website, upload the PNG as the site logo in Back-End → Site settings, and start from the *Think Different Visuals* inspiration or the *TDV* palettes under Design → Theme.

## What's inside

The landing page (`#/`) introduces the module. **Open studio** leads to the projects dashboard, where you create a site from a curated inspiration, from the URL of a site you like, or from a blank page. Each project then opens in three workspaces:

### 1 · Front-End
| Tab | What it does |
| --- | --- |
| **Design** | Section outline, live preview (desktop / tablet / mobile) and inspector. Click any section in the preview to edit it. Includes a rich text editor (headings, lists, links, quotes, clean paste, HTML mode), image and video pickers, repeatable items (features, pricing, FAQ…), section style (background, spacing, alignment, layout, columns) and the global theme (palettes, colours, Google Fonts, radius, width, button style). |
| **Inspiration** | 8 curated layouts (SaaS, agency, restaurant, portfolio, local service, boutique, non-profit, event), plus an analyser that takes any public URL and extracts its palette, fonts, navigation and section order. You can apply just the theme, add its pages, or replace the whole layout. |
| **Pages & Menus** | Add pages from templates (About, Services, Contact, Pricing, Gallery, Privacy, Terms), edit names and URLs, reorder, duplicate. Edit the main and footer menus, including dropdowns. |
| **Media** | Drag-and-drop uploads. Images are resized, converted to WebP and saved in 480/960/1440px variants. Videos get a poster frame. Each file shows its alt text, where it is used, and how much space optimisation saved. |
| **Speed** | Page-weight budget, request count, estimated 4G load time and recommendations. Toggles for WebP, srcset, lazy loading, quality, minification, inline critical CSS and font loading. |
| **Accessibility** | WCAG AA checks for contrast, alt text, heading structure, link text and language. |

### 2 · Back-End
| Tab | What it does |
| --- | --- |
| **Hosting** | Choose the bundled TDV hosting server (self-hosted), Netlify (file-digest deploys) or a ZIP for any host. Also: force HTTPS, security headers, asset cache lifetime, and a Caddy config for automatic HTTPS. |
| **Domains** | Add a domain (the `www` pair is added for you; suffixes like `.co.zw` and `.co.uk` are handled), see the exact DNS records to create, and verify them live over DNS-over-HTTPS. Pick the primary domain. |
| **SEO** | Per page: focus keyword, title and description with length counters, a Google result preview, a social card preview, OG image, canonical, noindex and a live score. Site-wide: title template, structured data (Organization, LocalBusiness or Person, plus FAQ and breadcrumbs), Search Console and Bing verification. A preview of the generated sitemap.xml and robots.txt. |
| **Forms & Integrations** | Contact forms post to the server's inbox, with honeypot and rate limiting, CSV export, or to a custom endpoint (Formspree, Zapier…). Also GA4, Plausible, Meta Pixel, a cookie consent banner that holds tracking until visitors accept, a WhatsApp chat button and custom head/body code. |
| **Site settings** | Logo, favicon, announcement bar, footer, social links, 301/302 redirects, 404 page, maintenance mode and password protection. |

### 3 · Delivery
| Tab | What it does |
| --- | --- |
| **Launch checklist** | Covers placeholder text, empty pages, broken internal links, SEO / speed / accessibility scores, hosting, domain, HTTPS, form delivery, analytics, privacy policy, cookie consent and indexing. Each item has a **Fix** button that jumps to the right tab. |
| **Launch** | One-click publish with a live log and deployment history. Each launch saves a version. |
| **Versions** | Save checkpoints and restore any of them (rollback = restore, then publish). |
| **Post-launch** | Search Console and Bing submission, PageSpeed, Rich Results, Google Business Profile, a LinkedIn card check and share links. |
| **Export & backup** | Static ZIP download, plus a full JSON backup you can restore here or import on another machine. |

## What a published site includes

- Semantic, accessible HTML: one `<h1>` per page, skip link, focus styles, labelled forms, keyboard-friendly mobile menu, reduced-motion support.
- Responsive layouts built with fluid type (`clamp`), grids that collapse on smaller screens, and 48px touch targets.
- `srcset`/`sizes`, explicit image dimensions (no layout shift), lazy loading, a high-priority hero image, click-to-load YouTube embeds and inlined minified CSS.
- Canonical, Open Graph and Twitter tags, JSON-LD, `sitemap.xml`, `robots.txt`, `_headers` and `_redirects` (understood by Netlify and Cloudflare Pages), and a branded `404.html`.

## Hosting server (`server/`)

| Endpoint | Purpose |
| --- | --- |
| `POST /api/publish` | Atomically publishes a site to `data/sites/<slug>/`. Requires `Authorization: Bearer $BUILDER_TOKEN` when the token is set. |
| `GET /sites/<slug>/…` | Serves published sites with Brotli/gzip, ETags, byte ranges for video, cache headers, security headers, redirects, a 404 page and optional HTTP Basic password protection. |
| Host-based routing | Requests whose `Host` is a connected domain are served that site from `/`. |
| `GET /api/domain-allowed?domain=` | Hook for Caddy on-demand TLS, so certificates are only issued for connected domains. |
| `POST /api/forms/<slug>` · `GET /api/forms/<slug>` | Capture form submissions (CORS-enabled, honeypot, rate limit) and list them (token required). |
| `GET /api/inspect?url=` | Inspiration analyser, with an SSRF guard that blocks private and internal addresses. |
| `POST /api/deploy/netlify` | Netlify deploy that uploads only changed files and can set a custom domain. |

Environment variables: `PORT` (8787), `BUILDER_TOKEN` (set this in production), `DATA_DIR` (`./data`), `MAX_UPLOAD_MB` (300).

## Notes and limits

- Projects are stored in the browser (IndexedDB). Use **Export & backup** to move them between machines.
- Uploaded videos are embedded in the project (up to 200 MB). For long videos, use YouTube or Vimeo links, which also load faster.
- Password protection is enforced only by the TDV hosting server.
- The URL analyser copies structure and style, never another site's text or images.
