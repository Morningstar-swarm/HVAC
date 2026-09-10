# Best Comfort HVAC — Joliet Office · website

Hand-written static site: HTML + one stylesheet + one script. No frameworks, no
templates, no third-party code in the pages, no AI-generated imagery. Every
photograph is a real photo from the reference site's own asset set.

**The published site is `site/` — open `site/index.html`.**

---

## Colour system

**Neutral canvas, colour as signal.** Roughly 90% of the site is white or one
cool paper tone on deep navy. The brand colours are held back and used with a
job to do, which is what makes it read as established rather than loud.

| role | token | value | job |
|---|---|---|---|
| Deep Navy | `--navy` | `#0B1B3A` | all headings, dark bands, top bar, active nav, footer |
| Ink / body | `--body` | `#46506B` | body copy |
| Muted | `--muted` | `#4F5A76` | captions, metadata |
| Paper | `--paper` | `#F7F9FC` | alternating section ground |
| Paper 2 | `--paper-2` | `#EEF2F9` | icon plates, chips |
| **Electric Salmon** | `--salmon-fill` | `#D6362B` | **the single call-to-action colour** — Book a Service, phone, submit |
| | `--salmon` | `#FF6F61` | small warm marks on navy (ticks, trust-bar icons, ticker dots) |
| | `--salmon-soft` | `#FFDFDA` | warning notes |
| **Rich Blue** | `--blue-fill` | `#1D4ED8` | secondary action, links, focus ring |
| | `--blue-soft` | `#DEE8FF` | informational notes |
| **Hot Pink** | `--pink-fill` | `#D6196E` | promotional surfaces only |
| | `--promo` | `#FFF4F9` | the offers page ground |

Rules the stylesheet follows:

1. **One action colour per view.** Salmon fill marks the primary action;
   everything else is outline or navy. Two competing primary buttons never sit
   side by side.
2. **Navy carries structure, not colour.** Headings, dark bands and the footer
   are navy; there is no black anywhere.
3. **Colour never repeats the gradient trick.** No multi-colour gradients on
   headers, tickers, footers or sections — bands are flat navy, buttons are flat
   fills, icon plates are flat tints.
4. **Hot pink is scoped.** It appears on the promotional surfaces (special
   offers, seasonal specials) and nowhere else.
5. **Shadows are neutral and shallow.** No coloured glow behind buttons or
   cards; hover lifts 2px onto a soft navy shadow.

A previous revision used three loud colours plus gradients on nearly every
surface. It passed every automated check and still looked like a brochure stand.
Restraint — not more colour — is what made it professional.

## Layout

    HVAC/
      build.py            assembler + QA gate            <- run after any edit
      pages/*.body.html   17 page bodies                  <- the pages you edit
      partials/           header.html, footer.html, sprite.html  (shared markup)
      assets/             authored CSS / JS / images      (edit here)
        css/styles.css           the stylesheet
        js/main.js               the behaviour
        images/                  19 photographs + logo
      static/             robots.txt, site.webmanifest, _headers, _redirects,
                          .htaccess, favicon.ico, apple-touch-icon.png,
                          icon-192.png, icon-512.png, .nojekyll
                                                   (published verbatim, site root)
      .github/workflows/deploy.yml   push to main -> rebuild -> publish to Pages
      preview-pages.py    serves the site at /<repo>/ the way GitHub Pages will
      site/               PUBLISHED OUTPUT — 100% generated, gitignored
      scrape/             provenance: harvest tooling + data from the reference site
      shots/              full-page screenshots + shots/nav/ header states
      a11y.js mobile.js navtest.js prod.js shoot.js   audit harnesses
      package.json        audit tooling only — nothing here ships to the browser

Sources of truth: `pages/`, `partials/`, `assets/` and `static/` are written by
hand. **`site/` is disposable output** — every file in it, HTML and assets alike,
is written by `build.py`, which is why it is gitignored and why CI can rebuild the
whole site from a clean clone. Never edit anything inside `site/`; your change
would be overwritten and would not reach GitHub. Edit `assets/css/styles.css`,
`assets/js/main.js`, `assets/images/*`, `pages/*.body.html` or `partials/*`.

`sitemap.xml` is derived from the page table so it can never drift. The build is
deploy-target aware: `--base=/<repo>` (or `BASE_PATH`) roots links for a subpath
deploy and `--site-url` sets canonical/og/sitemap URLs.

## Build & check

```bash
cd /workspaces/HVAC
python3 build.py      # publish site/ and run the QA gate   (needs only Python)
npm install           # once — puppeteer, for the audits below
npm run serve         # http://localhost:8124
npm run check         # build + all audits, in order
npm run preview:pages # build for /<repo>/ and serve it exactly like GitHub Pages
```

| harness | what it proves | current result |
|---|---|---|
| `build.py` | titles, single h1, alts, empty src, accordion wiring, internal links, anchors | **PASS** — 17 pages, 173 toggles, 134 images |
| `a11y.js` | form labels, accessible names, landmarks, heading order, computed contrast | **0 hard issues** |
| `mobile.js` | overflow, drawer leaks, action bar, burger, tap targets at 390 px and 820 px | **34/34 clean** |
| `navtest.js` | nav at 11 widths — 360→1440: burger/drawer swap, scroll lock, submenu open/close, arrow keys, Escape | **33/33 clean** |
| `prod.js` | payload budgets, head metadata, canonical correctness, sitemap coverage, security headers, CSP compliance, browser behaviour | **PRODUCTION READY** |

Payload: heaviest page 19.6 kB gzipped, stylesheet 14.7 kB, script 7.1 kB,
2.35 MB of images across 19 files.

## Navigation

* **≥1141 px** — full inline menu; two dropdowns (Services, Company) with a
  110 ms hover-intent delay on pointer devices, click toggling everywhere,
  ▲/▼ arrow keys inside the menu, Escape to close, click-outside to dismiss.
  The hover capability is evaluated per event, so plugging a mouse into a tablet
  or widening a window starts working without a reload.
* **≤1140 px** — the inline menu is replaced by a burger and a right-hand
  drawer: scroll lock, focus trap, Escape to close, submenus as accordions,
  contact block, and CTAs. Every link closes the drawer before navigating.
* **Sticky header** in both modes, with a compact state after 260 px of scroll
  (64 px tall), a hairline underline, and the current page marked with
  `aria-current="page"` in the header, the drawer, and the footer.
* Navigation is marked at build time, so `aria-current` is present in the
  delivered HTML, not added by script.

## Top bar + header — responsive ladder

Audited by `node diag.js` (`npm run audit:header`) at 20 widths from 1440 down
to 360: no item paints over another, nothing is clipped mid-string, the bar
stays one row, and a primary CTA is reachable at every width.

| width | top bar | header |
|---|---|---|
| ≥1201 | emergency line · hours · address · phone · email · social | brand + full menu + phone + Book a Service |
| ≤1200 | email + social dropped | menu still inline |
| ≤1140 | — | menu → burger; phone CTA sits beside the brand |
| ≤640 | hours dropped, type steps down to .8rem | Book a Service → icon-only phone CTA |
| ≤480 | address dropped | — |
| ≤400 | type .76rem, smaller icons | — |

Two traps worth keeping in mind — both were live defects here, not theory:

* `.topbar__list li` scores 0,1,1, so a plain `.topbar__addr{display:none}`
  (0,1,0) never applies. Hide rules must be written as
  `.topbar__list .topbar__addr`.
* `min-width:0` on a `nowrap` flex item lets its text paint straight over the
  next item while no two boxes overlap — invisible to a geometry test. Only the
  ellipsised address may shrink; every other item keeps its full text width.
  `diag.js` therefore measures painted ink (text ranges clipped by their
  clipping ancestors), not element boxes.

## Pages (17)

| file | nav | what it holds |
|---|---|---|
| index.html | Home | ticker, 3-slide hero, stats, work cards, services accordion, all-seasons split, 8 products, offers, partner accordions, counties accordion, reviews, FAQ, financing split, CTA, trust bar |
| services.html | Services ▾ | 6-item numbered accordion, price table, three maintenance plans, 5-step process, brand clouds (57 install / 138 service) |
| products.html | Products | filterable 8-item catalog, product viewer with 4 thumbnails, categories accordion, ordering timeline |
| product-detail.html | — | Bryant 2.5-ton condenser: gallery, specs, tabs, warranty, related parts, FAQ |
| special-offers.html | Special Offers | SAVE50 / SAVE100 / SAVEALL coupons with print buttons, seasonal accordion, referral rewards, terms |
| financing.html | Financing | three payment plans, payment estimator, 4-step process, rebates accordion, financing FAQ |
| residential.html | Company ▾ | six residential system types, sizing explainer, symptom → repair table, plans |
| commercial.html | Company ▾ | who we serve, services accordion, agreement tiers, P1–P4 response table, project log |
| air-quality.html | Company ▾ | air audit, five IAQ solutions, filter/MERV comparison, humidity and UV-C, pricing |
| service-areas.html | Services ▾ | 174-community search, six county accordions, coverage notes, neighbourhood FAQ |
| about.html | Company ▾ | history, numbers, crew, credentials, warranty and complaint policy, hiring |
| gallery.html | Company ▾ | 18 filterable photos with a keyboard-accessible lightbox |
| reviews.html | Company ▾ | 12 reviews with filters, rating summary, review form |
| faq.html | Company ▾ | 24 answers in five accordions (costs, repairs, maintenance, installation, warranty) |
| contact.html | Contact | four contact cards, service-request form, map slot, hours table |
| pages.html | (footer) | sitemap of every page and section |
| 404.html | — | styled not-found page, `noindex`, excluded from the sitemap |

## Deployment

**GitHub Pages is wired up — see [DEPLOY.md](DEPLOY.md) for the step-by-step.**
Pushing to `main` triggers `.github/workflows/deploy.yml`, which rebuilds the site
from source (failing on a QA error) and publishes `site/` to
`https://<user>.github.io/<repo>/`. The base path and canonical URLs are taken
from the repository name, so a rename or fork needs no edits. `preview:pages`
reproduces that exact shape locally.

The output is plain static files, so any host works. Configuration for the common
ones ships in `static/` and is copied into `site/` on build:

* **Netlify / Cloudflare Pages** — `_headers` (CSP, HSTS, nosniff, referrer
  policy, permissions policy, immutable asset caching) and `_redirects`
  (unmatched routes → `/404.html`).
* **Apache** — `.htaccess` (404 handler, compression, expiry, correct MIME for
  `.webmanifest`).
* **nginx** — add the same headers plus `error_page 404 /404.html;` and
  `try_files $uri $uri.html $uri/ =404;`.

Content-Security-Policy shipped:
`default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; …`
The pages contain **no inline styles, no inline scripts and no inline event
handlers** (`prod.js` fails the build if one appears), and inline SVG icons are
used rather than icon fonts, so this policy needs no `'unsafe-inline'`.

## Editing notes

* **Content lives in `pages/*.body.html`.** Re-run `python3 build.py` afterwards.
  Fonts are the only external request; the site is fully functional without them.
* **Photo slots.** Five slots are labelled `TextPlaceHolder1` … `TextPlaceHolder5`
  (products grid ×3, product-detail thumbnail, Google Maps embed on Contact).
  Drop the file in `assets/images/` and swap the `<img>` in the body file —
  width/height attributes are corrected automatically at build time. The map
  slot has a comment showing exactly where to paste the map `<iframe>`; if you
  use Google Maps, add its origin to `frame-src` in `_headers`.
* **Coupons.** Print buttons call `window.print()`; print styles are in the
  stylesheet so a coupon prints on its own.
* **Styling.** Add utilities rather than inline styles — `prod.js` enforces it.
  The `.text-*`, `.maxw-*`, `.gap-*`, `.round-*` helpers in section 40 are the
  sanctioned escape hatch and carry `!important` deliberately (the only place in
  the file that does).
* **Accessibility** already in place: skip link, landmarks, one h1 per page,
  `aria-current` navigation, focus-visible rings, focus-trapped drawer,
  reduced-motion support, contrast-verified palette.

## Provenance

`scrape/` holds the puppeteer scripts that pulled the original site's content,
their JSON output, the harvested image originals (`found/`), and reference page
captures. Nothing there is used by the build — it documents where the copy,
catalogue and photographs came from.
