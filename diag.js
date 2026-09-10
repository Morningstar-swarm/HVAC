/* Top-bar + header diagnostic: geometry, overlap, wrapping and lost controls. */
const puppeteer = require('puppeteer');
const PORT = process.env.PORT || 8124;
const WIDTHS = [1440,1366,1280,1200,1160,1120,1080,1024,960,900,860,820,768,700,640,568,480,414,390,360];
(async () => {
  const b = await puppeteer.launch({headless:'shell',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
  for (const w of WIDTHS) {
    const p = await b.newPage();
    await p.setViewport({width:w,height:900});
    await p.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'networkidle0'});
    const r = await p.evaluate(() => {
      const box = s => { const e=document.querySelector(s); if(!e) return null;
        const b=e.getBoundingClientRect(); const cs=getComputedStyle(e);
        return {l:Math.round(b.left),r:Math.round(b.right),w:Math.round(b.width),h:Math.round(b.height),
                vis: cs.display!=='none' && b.width>0, txt:(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,22)}; };
      const over = (a,c) => a&&c&&a.vis&&c.vis&&a.r>c.l+1&&c.r>a.l+1;
      /* Element boxes lie: nowrap text can paint past its own flex item and land on a
         neighbour without any box overlapping. Measure real ink instead of boxes:
         a text range's rect must then be clipped by every ancestor that clips paint,
         and anything hidden by clip/clip-path (sr-only labels) is not painted at all. */
      const paintClip = node => {
        let cr = {l:-1e5, r:1e5, t:-1e5, b:1e5};
        for (let n = node.parentElement; n; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.clipPath && cs.clipPath !== 'none') return null;
          if (cs.clip && cs.clip !== 'auto') return null;
          if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
            const r = n.getBoundingClientRect();
            cr = {l:Math.max(cr.l, r.left), r:Math.min(cr.r, r.right),
                  t:Math.max(cr.t, r.top),  b:Math.min(cr.b, r.bottom)};
          }
        }
        return cr;
      };
      const ink = el => {
        const out = [];
        (function walk(n){
          if (n.nodeType === 3 && n.nodeValue.trim()) {
            const clip = paintClip(n);
            if (!clip) return;                       // sr-only: never painted
            const rg = document.createRange(); rg.selectNodeContents(n);
            for (const rc of rg.getClientRects()) {
              const l = Math.max(rc.left, clip.l), r = Math.min(rc.right, clip.r);
              const t = Math.max(rc.top, clip.t),  b = Math.min(rc.bottom, clip.b);
              if (r - l > 3 && b - t > 3) out.push({l, r, t, b});   // 1px sr-only boxes drop out
            }
          } else for (const c of n.childNodes) walk(c);
        })(el);
        return out;
      };
      const auditables = ['.topbar__list li', '.topbar__right > *', '.brand',
                          '.nav__list > li > a', '.nav__list > li > button', '.header-cta > *'];
      const painted = [];
      for (const el of document.querySelectorAll(auditables.join(','))) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || !el.getBoundingClientRect().width) continue;
        const own = el.getBoundingClientRect(), rects = ink(el);
        if (!rects.length) continue;
        painted.push({n:String(el.className).split(' ')[0] || el.tagName, own, rects,
                      txt:(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,26)});
      }
      /* A: painted ink leaving its own box  B: two items painting into the same space */
      const spill = [], collide = [];
      for (const it of painted)
        for (const rc of it.rects)
          if (rc.l < it.own.left - 1 || rc.r > it.own.right + 1)
            spill.push(`${it.n} "${it.txt}"`);
      for (let i=0;i<painted.length;i++) for (let j=i+1;j<painted.length;j++)
        for (const a of painted[i].rects) for (const c of painted[j].rects)
          if (Math.min(a.r,c.r) - Math.max(a.l,c.l) > 1 && Math.min(a.b,c.b) - Math.max(a.t,c.t) > 1)
            collide.push(`"${painted[i].txt}" x "${painted[j].txt}"`);
      const uniq = arr => [...new Set(arr)];
      const tb = document.querySelector('.topbar__in');
      const items = [...document.querySelectorAll('.topbar__list li, .topbar__right > *')]
        .filter(e=>getComputedStyle(e).display!=='none')
        .map(e=>({n:String(e.className).split(' ')[0]||e.tagName, l:Math.round(e.getBoundingClientRect().left), r:Math.round(e.getBoundingClientRect().right)}));
      let tbOverlap = false;
      for (let i=0;i<items.length;i++) for (let j=i+1;j<items.length;j++)
        if (items[i].r > items[j].l + 1 && items[j].r > items[i].l + 1) tbOverlap = true;
      return {
        brand: box('.brand'), nav: box('.nav'), cta: box('.header-cta'),
        bookBtn: box('.header-cta .btn:not(.header-cta__phone)'),
        phoneBtn: box('.header-cta__phone'), burger: box('.burger'),
        topbarH: Math.round(document.querySelector('.topbar').getBoundingClientRect().height),
        headerH: Math.round(document.querySelector('.site-header').getBoundingClientRect().height),
        topbarScrollW: tb.scrollWidth, topbarClientW: tb.clientWidth,
        tbOverlap,
        spill: uniq(spill), collide: uniq(collide),
        navRows: (()=>{const n=document.querySelector('.nav__list'); if(!n||getComputedStyle(n.parentElement).display==='none')return 0;
          const tops=new Set([...n.children].map(c=>Math.round(c.getBoundingClientRect().top))); return tops.size;})(),
        docScrollW: document.documentElement.scrollWidth,
      };
    });
    const flags = [];
    if (r.nav.vis && r.brand.vis && r.nav.l < r.brand.r - 1) flags.push('nav overlaps brand');
    if (r.nav.vis && r.cta.vis && r.cta.l < r.nav.r - 1) flags.push('cta overlaps nav');
    if (r.navRows > 1) flags.push(`nav wrapped to ${r.navRows} rows`);
    if (r.topbarScrollW > r.topbarClientW + 1) flags.push(`topbar clipped (${r.topbarScrollW}>${r.topbarClientW})`);
    if (r.tbOverlap) flags.push('topbar items overlap');
    if (r.spill.length) flags.push('text outside its box: '+r.spill.join(', '));
    if (r.collide.length) flags.push('painted text collision: '+r.collide.join(' | '));
    if (r.headerH > 92) flags.push(`header ${r.headerH}px tall`);
    if (r.topbarH > 56) flags.push(`topbar ${r.topbarH}px tall`);
    if (r.docScrollW > w + 1) flags.push(`page overflow ${r.docScrollW}`);
    const lost = [];
    if (!r.nav.vis) lost.push('nav');
    if (w <= 1080 && !r.bookBtn.vis) lost.push('Book-CTA');
    if (w <= 820 && !r.phoneBtn.vis) lost.push('header-phone');
    console.log(`${flags.length?'XX':'OK'} ${String(w).padStart(4)}px  tb=${String(r.topbarH).padStart(3)}px hdr=${String(r.headerH).padStart(3)}px  brand=${String(r.brand.w).padStart(4)} nav=${r.nav.vis?String(r.nav.w).padStart(4):'  --'} cta=${r.cta.vis?String(r.cta.w).padStart(3):' --'} rows=${r.navRows}  hidden:${lost.join(',')||'none'}${flags.length?'  << '+flags.join(' | '):''}`);
    await p.close();
  }
  await b.close();
})();
