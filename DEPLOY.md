# Deploying to GitHub Pages

The site is static output built from source by `build.py`. A GitHub Actions
workflow rebuilds it on every push and publishes it to GitHub Pages, so you never
commit generated files and the live site always matches the source.

Live URL when done: **`https://Morningstar-swarm.github.io/HVAC/`**

---

## 1. Configure the existing repository

This workspace is already connected to
<https://github.com/Morningstar-swarm/HVAC>. Keep the repository public so its
free GitHub Pages site is available.

## 2. Turn on Pages (do this before the first push)

* Open the repository → **Settings** → **Pages**
* Under **Build and deployment → Source**, choose **GitHub Actions**

This is also what creates the `github-pages` environment the deploy job runs in —
if you push first, the first run will fail until you set it, and you then re-run it
from the **Actions** tab → *Deploy site to GitHub Pages* → **Run workflow**.

## 3. Commit and push this project

From a terminal, in this folder:

```bash
cd /workspaces/HVAC

git add -A
git commit -m "Prepare HVAC site for GitHub Pages"
git push -u origin main
```

The remote is already configured here, so do not run `git remote add origin`
again. GitHub CLI authentication is already available in this environment.

The only Pages settings that matter are the source above; the workflow requests
the permissions it needs on its own.

> The first commit is authored as *Best Comfort HVAC &lt;noreply@github.com&gt;*. To
> put your own name on it before pushing:
> `git commit --amend --reset-author --no-edit`

## 4. Watch the first deploy

* Open the **Actions** tab → *Deploy site to GitHub Pages* runs automatically after
  the push (about 30 seconds; it rebuilds and runs the QA gate).
* Green tick → open `https://Morningstar-swarm.github.io/HVAC/`
* The deploy job prints the live URL as well.

---

## Updating the site afterwards

```bash
cd /workspaces/HVAC
# 1. edit pages/*.body.html, assets/css/styles.css, assets/js/main.js, assets/images/*
python3 build.py      # optional: rebuild + QA locally first
git add -A
git commit -m "Update services page"
git push
```

The push triggers the same workflow; the site is live in under a minute. Nothing
inside `site/` is ever committed — it is regenerated on every deploy.

## How the subpath is handled

A Pages *project* site is served from `/<repo>/`, not from a domain root. The
workflow passes that automatically:

| what | value in CI |
|---|---|
| `BASE_PATH` | `/<repo>` — roots the links in `404.html` |
| `SITE_URL` | `https://<owner>.github.io/<repo>` — canonical, `og:url`, JSON-LD, `robots.txt`, `sitemap.xml` |

Every ordinary page uses relative links, so it works at any depth without
rewriting. Rename the repo or fork it and the next build adapts on its own.

## Preview the deployed shape locally

```bash
python3 preview-pages.py HVAC # -> http://localhost:8130/HVAC/
```

This builds with the subpath and serves it with GitHub Pages' rules — including
its custom-404 behaviour, so `/some/missing/page` returns the styled 404 page from
the site root. If it works here, it works on Pages.

## Notes specific to GitHub Pages

* **`_headers`, `_redirects` and `.htaccess` are inert here.** They are for
  Netlify/Cloudflare/Apache. Pages does not read them, so the CSP and long-lived
  asset caching they define are *not* applied on Pages. The custom 404, by
  contrast, needs no configuration — Pages serves `404.html` from the site root
  automatically.
* **`robots.txt` and `sitemap.xml`** point at the github.io URL for a Pages build.
  If you later put the site on a real domain, push with `SITE_URL` set — or edit
  the two env values in `.github/workflows/deploy.yml` — and rebuild.
* **A free Pages site is public**, and its URL is indexed by search engines. Add
  `<meta name="robots" content="noindex">` to `partials/header.html` if you want
  the preview hidden while you work on it.
* **Custom domain later?** Settings → Pages → *Custom domain* (this writes a
  `CNAME` file into the deployed output), then set `SITE_URL` in the workflow to
  the domain so canonical URLs match.

## If a deploy fails

| symptom | cause / fix |
|---|---|
| Pages step: "Get Pages site failed" / "Not Found" | Pages source is not set to **GitHub Actions**. Set it (step 2), then Actions → *Run workflow*. |
| Build step fails with `QA FAILED` | the gate caught a broken link, missing anchor, duplicate title, extra/missing `<h1>` or an image without `alt`. The log lists the exact page and element. |
| "Workflow does not exist" on the Actions tab | the `.github/` folder was not uploaded (see the browser-upload note in step 2). |
| Site loads but is unstyled | you are looking at a branch-deploy of the source instead of the built output — set the source back to **GitHub Actions**. |
| 404s on every page except the home page | the repo was set to *Deploy from a branch* with the output at the root; the built site includes `404.html`, so leave the source on **GitHub Actions**. |
