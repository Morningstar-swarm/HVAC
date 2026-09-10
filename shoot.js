// Full-page viewport slices of the rebuilt site for visual review.
const puppeteer = require('puppeteer');
const fs = require('fs');
const PORT = process.env.PORT || 8124;
const only = process.argv[2] ? [process.argv[2]] : null;
const pages = only || ['index','services','products','product-detail','special-offers','financing',
  'residential','commercial','air-quality','service-areas','about','gallery','reviews','faq','contact','pages'];
(async () => {
  const b = await puppeteer.launch({headless:'shell',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-zygote','--single-process']});
  const out = '/home/user/rebuild/shots';
  fs.mkdirSync(out,{recursive:true});
  for (const slug of pages) {
    const p = await b.newPage();
    await p.setViewport({width:1440,height:1000,deviceScaleFactor:1});
    const errs = [];
    p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,160)); });
    p.on('pageerror', e => errs.push('PAGEERROR: '+String(e).slice(0,160)));
    await p.goto(`http://127.0.0.1:${PORT}/${slug}.html`, {waitUntil:'networkidle2', timeout:45000});
    // trigger every reveal + expand all accordions so nothing is invisible in the capture
    await p.evaluate(async () => {
      document.querySelectorAll('[data-reveal]').forEach(e=>e.classList.add('is-in'));
      document.querySelectorAll('[data-acc-toggle]').forEach(btn=>{
        if (btn.getAttribute('aria-expanded')!=='true') btn.click();
      });
      await new Promise(r=>setTimeout(r,400));
    });
    await new Promise(r=>setTimeout(r,600));
    const h = await p.evaluate(()=>document.body.scrollHeight);
    const w = await p.evaluate(()=>document.documentElement.scrollWidth);
    console.log(`${slug}.html  height=${h}  scrollWidth=${w}  ${w>1440?'*** HORIZONTAL OVERFLOW ***':''}  ${errs.length?'JS ERRORS: '+errs.join(' | '):''}`);
    await p.screenshot({path:`${out}/${slug}-full.jpg`, fullPage:true, type:'jpeg', quality:72});
    // viewport slices every 1700px for detailed review
    const step = 1700;
    for (let i=0, y=0; y < h && i < 12; i++, y += step) {
      await p.evaluate(yy => window.scrollTo(0, yy), y);
      await new Promise(r=>setTimeout(r,150));
      await p.screenshot({path:`${out}/${slug}-sl${String(i).padStart(2,'0')}.jpg`, type:'jpeg', quality:75});
    }
    await p.close();
  }
  await b.close();
})();
