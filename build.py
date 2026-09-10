#!/usr/bin/env python3
"""
Assembler for the Best Comfort HVAC — Joliet Office website.

Reads partials/ + pages/*.body.html, publishes static/ and sitemap.xml, and
writes the finished HTML into the site root, then runs structural QA:
  * every internal href/src resolves to a file that exists
  * every in-page anchor (#id) exists on the target page
  * unique <title>, one <h1> per page, alt text on every <img>
  * accordions wired (aria-expanded / aria-controls -> existing id)
Run:  python3 build.py
      python3 build.py --base=/my-repo --site-url=https://user.github.io/my-repo
      (or set BASE_PATH / SITE_URL in the environment — that is what CI does)
      --out=DIR writes somewhere other than site/ (used by preview-pages.py)
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

def _opt(flag: str) -> str | None:
    """Read --flag=value from argv, so CI and humans configure the build the same way."""
    for a in sys.argv[1:]:
        if a.startswith(flag + "="):
            return a.split("=", 1)[1]
    return None


ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"          # published output — never edit by hand
PARTIALS = ROOT / "partials"  # header / footer / sprite sources
ASSETS = ROOT / "assets"      # authored CSS / JS / images -> site/assets/
STATIC = ROOT / "static"      # hand-written files copied verbatim into the site
PAGES = ROOT / "pages"        # *.body.html page sources
_out = _opt("--out") or os.environ.get("OUT_DIR") or ""
OUT = ((ROOT / _out) if not os.path.isabs(_out) else Path(_out)) if _out else SITE

PHONE_DISPLAY = "815-556-0660"
PHONE_TEL = "+18155560660"
EMAIL = "ContactUs@bestcomforthvac.com"
STREET = "1504 Essington Rd #3"
CITY = "Joliet"
STATE = "IL"
ZIP = "60435"
# Absolute URL used for canonical/og:url/jsonld/sitemap. Overridden on GitHub Pages
# so the deployed copy points at itself instead of the reference domain.
SITE_URL = (_opt("--site-url") or os.environ.get("SITE_URL")
            or "https://bestcomforthvac.hcshvac.com").rstrip("/")

# Non-empty only when the site is served from a subdirectory, e.g. GitHub Pages
# project sites at /<repo>/. Pages are written with relative links, so they work
# at any depth; only 404.html needs the prefix baked in (see absolutize()).
_base = (_opt("--base") or os.environ.get("BASE_PATH") or "").strip("/")
BASE_PATH = f"/{_base}" if _base else ""

# ---------------------------------------------------------------- page table
# slug, nav label (None = not in nav), <title>, meta description, hero preload
PAGES_META: dict[str, dict] = {
    "index.html": dict(
        label="Home",
        title="Best Comfort HVAC | Heating & Cooling Repair in Joliet, IL",
        desc=("Best Comfort HVAC keeps Joliet homes and businesses comfortable year round. "
              "24/7 emergency AC and furnace repair, installations, maintenance plans and "
              "financing. Call 815-556-0660."),
        hero="assets/images/hero-tech-ac.jpg",
        crumb=None,
    ),
    "services.html": dict(
        label="Services",
        title="HVAC Services in Joliet, IL | AC, Furnace & Boiler Repair",
        desc=("Air conditioning repair, furnace and boiler service, heat pumps, duct cleaning, "
              "maintenance plans and 24/7 emergency HVAC service across Joliet, Plainfield, "
              "Shorewood and the greater Chicago area."),
        hero="assets/images/hero-indoor.jpg",
        crumb="Services",
    ),
    "products.html": dict(
        label="Products",
        title="HVAC Products & Parts | Condensers, Thermostats, Filters",
        desc=("Shop condensers, control boards, thermostats, filters and water heaters stocked by "
              "Best Comfort HVAC in Joliet, IL. Flat prices published up front — call 815-556-0660 "
              "to confirm fit for your system."),
        hero="assets/images/product-condenser.jpg",
        crumb="Products",
    ),
    "product-detail.html": dict(
        label=None,
        title="Bryant 2.5 Ton Condenser | Product Details | Best Comfort HVAC",
        desc=("Bryant 2.5-ton outdoor condenser with a 10-year parts warranty, installed by Best "
              "Comfort HVAC in Joliet, IL. See photos, specs, pricing and financing options."),
        hero="assets/images/product-condenser.jpg",
        crumb="Products",
    ),
    "special-offers.html": dict(
        label="Special Offers",
        title="HVAC Coupons & Special Offers | Joliet, IL | Best Comfort HVAC",
        desc=("Save with current Best Comfort HVAC offers: $50 off any service call, $100 off a "
              "system replacement and free repair estimates. Mention the coupon code when you book."),
        hero="assets/images/gauge-refrigerant.jpg",
        crumb="Special Offers",
    ),
    "financing.html": dict(
        label="Financing",
        title="HVAC Financing, Rebates & Payment Plans | Best Comfort HVAC",
        desc=("New furnace or AC without the sticker shock: 0% programs, low monthly payment plans, "
              "manufacturer rebates and Illinois utility incentives, arranged by Best Comfort HVAC."),
        hero="assets/images/home-visit.jpg",
        crumb="Financing",
    ),
    "residential.html": dict(
        label=None,
        title="Residential HVAC Services | Joliet & Will County | Best Comfort",
        desc=("Whole-home heating and cooling for Joliet-area houses: furnace and AC replacement, "
              "heat pumps, zoning, ductwork and maintenance visits sized to your home."),
        hero="assets/images/furnace-service.jpg",
        crumb="Residential",
    ),
    "commercial.html": dict(
        label=None,
        title="Commercial HVAC & Rooftop Units | Joliet, IL | Best Comfort",
        desc=("Commercial HVAC service for Joliet offices, retail, restaurants and warehouses: "
              "rooftop units, make-up air, boilers, scheduled maintenance and emergency response."),
        hero="assets/images/rooftop-units.jpg",
        crumb="Commercial",
    ),
    "air-quality.html": dict(
        label=None,
        title="Indoor Air Quality, Duct Cleaning & UV Purifiers | Joliet, IL",
        desc=("Breathe easier with MERV-13 filtration, UV-C purifiers, humidifiers, dehumidifiers, "
              "duct cleaning and sealing from Best Comfort HVAC in Joliet, Illinois."),
        hero="assets/images/install-ductwork.jpg",
        crumb="Air Quality",
    ),
    "service-areas.html": dict(
        label=None,
        title="HVAC Service Areas | 256 Towns Across Chicagoland | Best Comfort",
        desc=("Find your town — Best Comfort HVAC dispatches from Joliet to 256 locations across "
              "Will, Cook, DuPage and Kendall counties in Illinois. Call 815-556-0660."),
        hero="assets/images/home-visit.jpg",
        crumb="Service Areas",
    ),
    "about.html": dict(
        label=None,
        title="About Best Comfort HVAC | Licensed Joliet Heating & Cooling Team",
        desc=("Meet Best Comfort Heating & Cooling — a licensed, EPA-certified Joliet contractor "
              "with NATE-trained technicians, flat-rate pricing and a written warranty on every job."),
        hero="assets/images/tech-tablet.jpg",
        crumb="About Us",
    ),
    "gallery.html": dict(
        label=None,
        title="Project Gallery | HVAC Work in Joliet, IL | Best Comfort HVAC",
        desc=("Photos from our installs and service calls around Joliet, Plainfield, Shorewood and "
              "the greater Chicago area — condensers, furnaces, rooftops and boiler rooms."),
        hero="assets/images/hero-indoor.jpg",
        crumb="Gallery",
    ),
    "reviews.html": dict(
        label=None,
        title="Customer Reviews | Best Comfort HVAC, Joliet IL",
        desc=("Read what Joliet-area homeowners and property managers say about Best Comfort HVAC — "
              "punctual technicians, clear pricing and repairs that hold."),
        hero="assets/images/tech-tablet.jpg",
        crumb="Reviews",
    ),
    "faq.html": dict(
        label=None,
        title="HVAC FAQ | Repair Costs, Warranties & Maintenance | Best Comfort",
        desc=("Answers to the questions Joliet customers ask most: how often to service a furnace, "
              "how long an AC lasts, what repairs cost and how warranties work."),
        hero="assets/images/gauge-refrigerant.jpg",
        crumb="FAQ",
    ),
    "contact.html": dict(
        label=None,
        title="Contact Best Comfort HVAC | Joliet, IL | 815-556-0660",
        desc=("Call 815-556-0660, email ContactUs@bestcomforthvac.com or book online. Office at "
              "1504 Essington Rd #3, Joliet, IL 60435 — 24/7 emergency HVAC dispatch."),
        hero="assets/images/hero-tech-ac.jpg",
        crumb="Contact",
    ),
    "404.html": dict(
        label=None,
        title="Page not found — Best Comfort HVAC, Joliet IL",
        desc="That page has moved or never existed. Call 815-556-0660 for heating and cooling service in Joliet and the surrounding counties.",
        hero="assets/images/hero-tech-ac.jpg",
        noindex=True,
    ),
    "pages.html": dict(
        label=None,
        title="All Pages & Sitemap | Best Comfort HVAC, Joliet IL",
        desc="Every page on the Best Comfort HVAC site in one place, plus our service areas, brands and contact details.",
        hero="assets/images/hero-indoor.jpg",
        crumb="All Pages",
    ),
}

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="author" content="Best Comfort HVAC — Joliet Office">
<meta name="theme-color" content="#FF6F61">
<link rel="canonical" href="{site}/{slug_clean}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Best Comfort HVAC — Joliet Office">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{site}/assets/images/hero-tech-ac.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="geo.region" content="US-IL">
<meta name="geo.placename" content="Joliet, Illinois">
<meta name="format-detection" content="telephone=yes">{robots}
<meta name="theme-color" content="#FF6F61">
<meta property="og:url" content="{site}/{slug_clean}">
<meta property="og:image:alt" content="Best Comfort HVAC technician servicing an outdoor condenser in Joliet, Illinois">
<link rel="icon" href="favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Outfit:wght@400;500;600;700&display=swap">
<link rel="preload" as="image" href="{hero}">
<link rel="stylesheet" href="assets/css/styles.css">
<script type="application/ld+json">{jsonld}</script>
</head>
<body data-page="{page}"{noindex}>
<a class="skip-link" href="#main">Skip to main content</a>
{header}
<main id="main">
"""

FOOT = """</main>
{footer}"""


_DIM_CACHE: dict[str, tuple[int, int]] = {}


def img_dims(name: str) -> tuple[int, int] | None:
    """Real pixel size of a staged asset (cached), so width/height match the file."""
    if name in _DIM_CACHE:
        return _DIM_CACHE[name]
    path = OUT / "assets" / "images" / name.split("/")[-1]
    if not path.exists():
        return None
    import subprocess
    try:
        out = subprocess.run(["identify", "-format", "%w %h", str(path)],
                             capture_output=True, text=True, check=True).stdout
        w, h = (int(x) for x in out.split()[:2])
        _DIM_CACHE[name] = (w, h)
        return (w, h)
    except Exception:
        return None


def normalise_img_dims(text: str) -> str:
    """Force every internal <img> width/height to the true asset dimensions."""
    def fix(m: re.Match) -> str:
        tag = m.group(0)
        src = re.search(r'src="(assets/images/[^"]+)"', tag)
        if not src:
            return tag
        dims = img_dims(src.group(1))
        if not dims:
            return tag
        w, h = dims
        tag = re.sub(r'\swidth="\d+"', f' width="{w}"', tag)
        tag = re.sub(r'\sheight="\d+"', f' height="{h}"', tag)
        return tag
    return re.sub(r"<img\b[^>]*>", fix, text)


def strip_comments(text: str) -> str:
    return re.sub(r"<!--(?!\[if).*?-->", "", text, flags=re.S)


def jsonld_for(slug: str, meta: dict) -> str:
    base = {
        "@context": "https://schema.org",
        "@type": "HVACBusiness",
        "@id": f"{SITE_URL}/#business",
        "name": "Best Comfort HVAC — Joliet Office",
        "image": f"{SITE_URL}/assets/images/hero-tech-ac.jpg",
        "logo": f"{SITE_URL}/assets/images/logo-bestcomfort.jpg",
        "url": f"{SITE_URL}/{'' if slug == 'index.html' else slug}",
        "telephone": PHONE_DISPLAY,
        "email": EMAIL,
        "priceRange": "$$",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": STREET,
            "addressLocality": CITY,
            "addressRegion": STATE,
            "postalCode": ZIP,
            "addressCountry": "US",
        },
        "geo": {"@type": "GeoCoordinates", "latitude": 41.5250, "longitude": -88.0817},
        "areaServed": [
            {"@type": "City", "name": n}
            for n in ("Joliet", "Plainfield", "Shorewood", "Romeoville", "Bolingbrook",
                      "Lockport", "Naperville", "New Lenox", "Frankfort", "Homer Glen")
        ],
        "openingHoursSpecification": [
            {"@type": "OpeningHoursSpecification",
             "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
             "opens": "08:00", "closes": "18:00"},
            {"@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday",
             "opens": "09:00", "closes": "15:00"},
        ],
        "sameAs": [],
        "makesOffer": [
            {"@type": "Offer", "name": "$50 off any HVAC service call", "priceCurrency": "USD"},
            {"@type": "Offer", "name": "$100 off a system replacement", "priceCurrency": "USD"},
        ],
    }
    extra = ""
    if slug == "index.html":
        extra = ""
    elif slug == "faq.html":
        extra = ""
    if extra:
        payload = json.dumps([base, json.loads(extra)])
    else:
        payload = json.dumps(base)
    return html.escape(payload, quote=False)


def mark_active(doc: str, slug: str) -> str:
    """Flag the current page in the nav, the drawer and the footer."""
    if slug == "404.html":
        return doc
    for match in re.finditer(r'<a\b[^>]*data-nav-link[^>]*>', doc):
        tag = match.group(0)
        if 'href="%s"' % slug in tag:
            doc = doc.replace(tag, tag[:-1] + ' aria-current="page">', 1)
    return doc


def polish_images(doc: str) -> str:
    """Async decode everywhere; the first hero image gets priority hints."""
    doc = re.sub(r'(<img\b(?![^>]*\bdecoding=)[^>]*?)>', r'\1 decoding="async">', doc)
    first = re.search(r'<img\b[^>]*>', doc)
    if first and "fetchpriority" not in first.group(0):
        doc = doc.replace(first.group(0),
                          first.group(0)[:-1] + ' fetchpriority="high">', 1)
    return doc


def absolutize(doc: str) -> str:
    """Root the links in 404.html at the deploy base.

    A custom 404 is served for unknown URLs at any depth, so `assets/css/...`
    would resolve against the junk path and the page would arrive unstyled.
    Absolute links make it correct everywhere, with or without a base path.
    """
    def repl(m: re.Match[str]) -> str:
        attr, url = m.group(1), m.group(2)
        if url.startswith(("http", "mailto:", "tel:", "#", "data:", "/")):
            return m.group(0)
        return f'{attr}="{BASE_PATH}/{url}"'

    return re.sub(r'(href|src)="([^"]+)"', repl, doc)


def copy_assets() -> int:
    """Publish the authored assets/ tree into site/assets/.

    The repo keeps sources only; site/ is disposable output. Without this a fresh
    clone (CI, a new machine) would build pages that reference nothing.
    """
    if not ASSETS.is_dir():
        print("!! assets/ is missing — the built site would have no CSS, JS or images")
        return 0
    n = 0
    for src in sorted(ASSETS.rglob("*")):
        if not src.is_file():
            continue
        dst = OUT / "assets" / src.relative_to(ASSETS)
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(src.read_bytes())
        n += 1
    return n


def copy_static() -> int:
    """Publish static/ into the site root, filling in {{SITE_URL}} / {{BASE_PATH}}."""
    if not STATIC.is_dir():
        return 0
    n = 0
    for src in sorted(STATIC.iterdir()):
        if not src.is_file():
            continue
        data = src.read_bytes()
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            pass
        else:
            filled = text.replace("{{SITE_URL}}", SITE_URL).replace("{{BASE_PATH}}", BASE_PATH)
            data = filled.encode("utf-8")
        (OUT / src.name).write_bytes(data)
        n += 1
    return n


def write_sitemap() -> None:
    """sitemap.xml generated from PAGES_META so it can never drift from the build."""
    today = date.today().isoformat()
    urls = []
    for slug in PAGES_META:
        if PAGES_META[slug].get("noindex"):
            continue
        loc = f"{SITE_URL}/" + ("" if slug == "index.html" else slug)
        urls.append(
            "  <url>\n"
            f"    <loc>{loc}</loc>\n"
            f"    <lastmod>{today}</lastmod>\n"
            "    <changefreq>monthly</changefreq>\n"
            f"    <priority>{'1.0' if slug == 'index.html' else '0.8'}</priority>\n"
            "  </url>"
        )
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )


def main() -> int:
    # a fresh clone has no site/ yet — CI builds from a clean checkout
    OUT.mkdir(parents=True, exist_ok=True)
    header = strip_comments((PARTIALS / "header.html").read_text())
    footer = strip_comments((PARTIALS / "footer.html").read_text())
    sprite = (PARTIALS / "sprite.html").read_text().strip()

    bodies = sorted(PAGES.glob("*.body.html"))
    if not bodies:
        print("!! no page bodies found in", PAGES)
        return 1

    written: list[str] = []
    for body_path in bodies:
        slug = body_path.name.replace(".body.html", ".html")
        meta = PAGES_META.get(slug)
        if meta is None:
            print(f"!! {slug}: no metadata registered in PAGES_META")
            return 1
        body = normalise_img_dims(body_path.read_text())

        doc = HEAD.format(
            title=meta["title"],
            desc=meta["desc"],
            robots=('<meta name="robots" content="noindex,follow">'
                    if meta.get("noindex") else '<meta name="robots" content="index,follow,max-image-preview:large">'),
            slug_clean="" if slug == "index.html" else slug,
            site=SITE_URL,
            hero=meta["hero"],
            page=slug.replace(".html", ""),
            noindex=' data-noindex="true"' if meta.get("noindex") else "",
            jsonld=jsonld_for(slug, meta),
            header=sprite + "\n" + header,
        )
        doc += body.strip() + "\n"
        doc += FOOT.format(footer=footer) + "\n"
        doc = polish_images(mark_active(doc, slug))
        if slug == "404.html":
            doc = absolutize(doc)
        (OUT / slug).write_text(doc)
        written.append(slug)

    print(f"build target: {SITE_URL}  base={BASE_PATH or '/'}"
          + ("  (subpath deploy)" if BASE_PATH else "  (domain root)"))
    print(f"wrote {len(written)} pages:")
    for w in written:
        print("   ", w, f"{(OUT / w).stat().st_size / 1024:.1f} kB")

    print(f"published {copy_assets()} asset file(s)")
    write_sitemap()
    print(f"published {copy_static()} static file(s) + sitemap.xml ({len(PAGES_META)} urls)")

    return qa(written)


# ------------------------------------------------------------------- QA pass
def qa(slugs: list[str]) -> int:
    problems: list[str] = []
    titles: dict[str, str] = {}
    ids_by_page: dict[str, set[str]] = {}

    for slug in slugs:
        text = (OUT / slug).read_text()
        ids = set(re.findall(r'\sid="([^"]+)"', text))
        ids_by_page[slug] = ids

        m = re.search(r"<title>(.*?)</title>", text, re.S)
        title = m.group(1) if m else ""
        if not title:
            problems.append(f"{slug}: missing <title>")
        if title in titles.values():
            problems.append(f"{slug}: duplicate <title> ({title})")
        titles[slug] = title

        h1 = re.findall(r"<h1[ >]", text)
        if len(h1) != 1:
            problems.append(f"{slug}: {len(h1)} <h1> elements (expected 1)")

        for img in re.finditer(r"<img\b[^>]*>", text):
            tag = img.group(0)
            if "alt=" not in tag:
                problems.append(f"{slug}: <img> without alt -> {tag[:90]}")
            if 'src=""' in tag:
                problems.append(f"{slug}: <img> with empty src")

        for btn in re.finditer(r'<button[^>]*data-acc-toggle[^>]*>', text):
            tag = btn.group(0)
            ctrl = re.search(r'aria-controls="([^"]+)"', tag)
            if not ctrl:
                problems.append(f"{slug}: accordion toggle without aria-controls")
            elif ctrl.group(1) not in ids:
                problems.append(f"{slug}: accordion controls missing id #{ctrl.group(1)}")
            if "aria-expanded" not in tag:
                problems.append(f"{slug}: accordion toggle without aria-expanded")

    # link + asset integrity
    for slug in slugs:
        text = (OUT / slug).read_text()
        for href in re.findall(r'(?:href|src)="([^"]+)"', text):
            if href.startswith(("http", "mailto:", "tel:", "#", "data:")):
                if href.startswith("#") and len(href) > 1:
                    if href[1:] not in ids_by_page[slug]:
                        # could be a footer/nav anchor to nothing on this page
                        problems.append(f"{slug}: dead in-page anchor {href}")
                continue
            target, _, frag = href.partition("#")
            if BASE_PATH and target.startswith(BASE_PATH + "/"):
                target = target[len(BASE_PATH):]
            target = target.lstrip("/")
            path = OUT / target
            if not path.exists():
                problems.append(f"{slug}: missing file -> {target}")
            elif frag and target.endswith(".html"):
                other = ids_by_page.get(target)
                if other is None:
                    other = set(re.findall(r'\sid="([^"]+)"', path.read_text()))
                if frag not in other:
                    problems.append(f"{slug}: anchor {href} does not exist in {target}")

    # count features for the report
    total_acc = sum(len(re.findall(r"data-acc-toggle", (OUT / s).read_text())) for s in slugs)
    total_img = sum(len(re.findall(r"<img\b", (OUT / s).read_text())) for s in slugs)

    print(f"\nQA — pages {len(slugs)} · accordion toggles {total_acc} · <img> tags {total_img}")
    if problems:
        print(f"QA FAILED with {len(problems)} problem(s):")
        for p in problems[:60]:
            print("   !", p)
        return 1
    print("QA PASS — links, anchors, titles, h1s, alts and accordion wiring all check out.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
