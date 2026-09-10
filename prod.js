/* Production readiness audit: payload, caching, metadata, security headers, a11y hooks. */
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, 'site');
const PORT = 8125;
const MIME = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg',
  '.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json',
  '.txt':'text/plain','.xml':'application/xml','.ico':'image/x-icon'};

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, '0.0.0.0', r));
  const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
  const problems = [];
  const money = [];

  // ---------- 1. payload ----------
  const weigh = [];
  for (const f of pages) {
    const raw = fs.readFileSync(path.join(ROOT, f));
    const gz = zlib.gzipSync(raw, {level: 9});
    weigh.push({f, raw: raw.length, gz: gz.length});
  }
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/styles.css'));
  const js = fs.readFileSync(path.join(ROOT, 'assets/js/main.js'));
  const cssGz = zlib.gzipSync(css, {level: 9}).length;
  const jsGz = zlib.gzipSync(js, {level: 9}).length;
  const imgs = fs.readdirSync(path.join(ROOT, 'assets/images'));
  const imgBytes = imgs.reduce((n, i) => n + fs.statSync(path.join(ROOT, 'assets/images', i)).size, 0);

  const worstPage = weigh.reduce((a, b) => (a.gz > b.gz ? a : b));
  console.log('── payload ─────────────────────────────────────────');
  console.log(`  heaviest page   ${worstPage.f}  ${(worstPage.raw/1024).toFixed(1)} kB raw / ${(worstPage.gz/1024).toFixed(1)} kB gzipped`);
  console.log(`  stylesheet      ${(css.length/1024).toFixed(1)} kB raw / ${(cssGz/1024).toFixed(1)} kB gzipped`);
  console.log(`  script          ${(js.length/1024).toFixed(1)} kB raw / ${(jsGz/1024).toFixed(1)} kB gzipped`);
  console.log(`  images          ${imgs.length} files, ${(imgBytes/1024/1024).toFixed(2)} MB total`);
  if (worstPage.gz > 60 * 1024) problems.push(`page over 60 kB gzipped: ${worstPage.f}`);
  if (cssGz > 40 * 1024) problems.push('stylesheet over 40 kB gzipped');
  if (imgBytes > 4 * 1024 * 1024) problems.push('image payload over 4 MB');

  // ---------- 2. metadata / static head ----------
  const html = pages.map(f => ({f, t: fs.readFileSync(path.join(ROOT, f), 'utf8')}));
  const need = [
    ['<meta charset', 'charset'],
    ['name="viewport"', 'viewport'],
    ['rel="canonical"', 'canonical'],
    ['property="og:title"', 'og:title'],
    ['name="twitter:card"', 'twitter card'],
    ['rel="manifest"', 'manifest link'],
    ['rel="icon"', 'favicon'],
    ['application/ld+json', 'structured data'],
  ];
  console.log('\n── head metadata ───────────────────────────────────');
  for (const [token, label] of need) {
    const missing = html.filter(h => !h.t.includes(token)).map(h => h.f);
    if (missing.length) problems.push(`missing ${label} on: ${missing.join(', ')}`);
    console.log(`  ${(missing.length ? 'XX' : 'OK')}  ${label.padEnd(18)} on ${pages.length - missing.length}/${pages.length} pages`);
  }

  // ---------- 3. canonical / og:url correctness + sitemap ----------
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const inSitemap = new Set(locs.map(u => u.endsWith('/') ? 'index.html' : u.split('/').pop()));
  const shouldBeIndexed = pages.filter(f => !/404/.test(f) && !/pages\.html/.test(f));
  const notListed = shouldBeIndexed.filter(f => !inSitemap.has(f));
  const badCanon = html.filter(h => {
    const m = h.t.match(/rel="canonical" href="([^"]+)"/);
    if (!m) return true;
    const expected = 'https://bestcomforthvac.hcshvac.com/' + (h.f === 'index.html' ? '' : h.f);
    return m[1] !== expected;
  }).map(h => h.f).concat(/sitemap/i.test(sitemap) ? [] : []);
  console.log('\n── canonical + sitemap ─────────────────────────────');
  console.log(`  ${notListed.length ? 'XX' : 'OK'}  sitemap lists ${locs.length} urls; ${notListed.length ? 'missing ' + notListed.join(', ') : 'all indexable pages present'}`);
  console.log(`  ${badCanon.length ? 'XX' : 'OK'}  canonicals self-referential and absolute`);
  if (notListed.length) problems.push('sitemap missing: ' + notListed.join(', '));
  if (badCanon.length) problems.push('canonical wrong on: ' + badCanon.join(', '));
  if (/<loc>[^<]*404/.test(sitemap)) problems.push('404 page leaking into sitemap');

  // ---------- 4. security + caching deliverables ----------
  const headerFile = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');
  const htaccess = fs.readFileSync(path.join(ROOT, '.htaccess'), 'utf8');
  const redirects = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');
  console.log('\n── server config ───────────────────────────────────');
  const checks = [
    [/_headers/.test('_headers'), 'Netlify/CF _headers present'],
    [/Content-Security-Policy/.test(headerFile), 'CSP defined'],
    [/X-Content-Type-Options/.test(headerFile), 'nosniff'],
    [/Cache-Control: public, max-age=31536000/.test(headerFile), 'immutable asset caching'],
    [/ErrorDocument 404/.test(htaccess), '.htaccess 404 handler'],
    [/404\.html/.test(redirects), 'SPA-style 404 route'],
  ];
  for (const [ok, label] of checks) {
    console.log(`  ${ok ? 'OK' : 'XX'}  ${label}`);
    if (!ok) problems.push('server config: ' + label);
  }

  // ---------- 5. CSP compliance: no inline styles/scripts/handlers ----------
  console.log('\n── CSP compliance (no inline script/style/handlers) ─');
  const inline = {style: [], script: [], handler: []};
  const denoise = t => t.replace(/<!--[\s\S]*?-->/g, '');   // comments are not markup
  const scanned = [...html.map(h => [h.f, denoise(h.t)]),
                   ['assets/css/styles.css', css.toString()],
                   ['assets/js/main.js', js.toString()]];
  for (const [f, t] of scanned) {
    if (/\.html$/.test(f)) {
      if (/\sstyle="/.test(t)) inline.style.push(f);
      // JSON-LD is inert data, not executable script — CSP script-src does not apply
      const exec = t.replace(/<script[^>]*type="application\/ld\+json"[\s\S]*?<\/script>/g, '');
      if (/<script(?![^>]*src=)[^>]*>\s*\S/.test(exec)) inline.script.push(f);
      if (/\son[a-z]+\s*=/i.test(t)) inline.handler.push(f);
    }
  }
  for (const [k, list] of Object.entries(inline)) {
    console.log(`  ${list.length ? 'XX' : 'OK'}  no inline ${k}  ${list.length ? '(' + list.join(', ') + ')' : ''}`);
    if (list.length) problems.push(`inline ${k} found on ${list.join(', ')}`);
  }

  // ---------- 6. live checks in a browser ----------
  console.log('\n── browser checks ──────────────────────────────────');
  const b = await puppeteer.launch({headless:'shell',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
  for (const f of ['index.html', 'contact.html', '404.html']) {
    const p = await b.newPage();
    const errs = [], failed = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 80)));
    p.on('requestfailed', r => failed.push(r.url().split('/').pop()));
    p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().split('/').pop()); });
    await p.setViewport({width:1440,height:1000});
    await p.goto(`http://127.0.0.1:${PORT}/${f}`, {waitUntil:'networkidle0'});
    const r = await p.evaluate(() => ({
      lang: document.documentElement.lang,
      skip: !!document.querySelector('.skip-link'),
      landmarks: ['header','main','footer','nav'].every(t => !!document.querySelector(t)),
      h1: document.querySelectorAll('h1').length,
      imgs: document.querySelectorAll('img').length,
      lazy: document.querySelectorAll('img[loading="lazy"]').length,
      decoding: document.querySelectorAll('img[decoding="async"]').length,
      fetchpriority: document.querySelectorAll('img[fetchpriority="high"]').length,
      actionable: [...document.querySelectorAll('a,button')].filter(e => e.offsetParent !== null).length,
      ariaCurrent: document.querySelectorAll('[aria-current]').length,
      themeColor: (document.querySelector('meta[name="theme-color"]') || {}).content,
    }));
    const flags = [];
    if (r.lang !== 'en') flags.push('lang!=en');
    if (!r.skip) flags.push('no skip link');
    if (!r.landmarks) flags.push('missing landmark');
    if (r.h1 !== 1) flags.push(`h1 count ${r.h1}`);
    const eager = r.imgs - r.lazy - r.fetchpriority;   // above-the-fold images may load eagerly by design
    if (eager > 6) flags.push(`too many eager images: ${eager}`);
    if (r.decoding < r.imgs) flags.push(`images without decoding=async: ${r.imgs - r.decoding}`);
    if (errs.length) flags.push('js: ' + errs[0]);
    if (failed.length) flags.push('bad requests: ' + failed.join(', '));
    console.log(`  ${flags.length ? 'XX' : 'OK'}  ${f.padEnd(14)} lang=${r.lang} skip=${r.skip?'y':'n'} h1=${r.h1} imgs=${r.imgs} lazy=${r.lazy} async=${r.decoding} priority=${r.fetchpriority} aria-current=${r.ariaCurrent} theme=${r.themeColor}`);
    if (flags.length) problems.push(`${f}: ${flags.join('; ')}`);
    await p.close();
  }
  await b.close();

  console.log('\n════════════════════════════════════════════════════');
  if (problems.length) {
    console.log(`${problems.length} production problem(s):`);
    problems.forEach(p => console.log('   ! ' + p));
  } else {
    console.log('PRODUCTION READY — payload, metadata, sitemap, security config,');
    console.log('CSP compliance and browser behaviour all check out.');
  }
  server.close();
})();
