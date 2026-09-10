/* Responsive navigation audit: every breakpoint, plus the drawer and submenus. */
const puppeteer = require('puppeteer');
const fs = require('fs');
const PORT = process.env.PORT || 8124;
const WIDTHS = [1440, 1320, 1200, 1100, 1024, 900, 820, 768, 600, 480, 360];
const PAGES = ['index', 'services', 'contact'];

(async () => {
  const b = await puppeteer.launch({headless:'shell',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
  fs.mkdirSync('/home/user/rebuild/shots/nav', {recursive:true});
  let bad = 0;

  for (const slug of PAGES) {
    for (const w of WIDTHS) {
      const p = await b.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(String(e).slice(0,90)));
      await p.setViewport({width:w, height:900});
      await p.goto(`http://127.0.0.1:${PORT}/${slug}.html`, {waitUntil:'networkidle0'});

      const r = await p.evaluate(() => {
        const vis = el => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
        const header = document.querySelector('.site-header');
        const nav = document.querySelector('.nav');
        const burger = document.querySelector('.burger');
        const box = el => { const b = el.getBoundingClientRect(); return {w:Math.round(b.width), h:Math.round(b.height)}; };
        return {
          vw: document.documentElement.clientWidth,
          scrollW: document.documentElement.scrollWidth,
          navVisible: vis(nav),
          burgerVisible: vis(burger),
          headerH: Math.round(header.getBoundingClientRect().height),
          burgerBox: burger ? box(burger) : null,
          brandBox: box(document.querySelector('.brand')),
          ctaBox: box(document.querySelector('.header-cta .btn:not(.header-cta__phone)')),
        };
      });

      // interaction check: drawer on small screens, submenu on large
      let interact = 'n/a';
      if (!r.navVisible) {
        interact = await p.evaluate(async () => {
          const open = document.querySelector('[data-drawer-open]');
          open.click();
          await new Promise(r => setTimeout(r, 350));
          const drawer = document.getElementById('mobileNav');
          const shown = !drawer.hidden && drawer.getBoundingClientRect().width > 200;
          const scrollLocked = getComputedStyle(document.body).overflow === 'hidden';
          const toggle = document.querySelector('.mnav__toggle');
          let sub = false, aria = false;
          if (toggle) {
            toggle.click();
            await new Promise(r => setTimeout(r, 60));
            const panel = document.getElementById(toggle.getAttribute('aria-controls'));
            sub = panel && !panel.hidden;
            aria = toggle.getAttribute('aria-expanded') === 'true';
          }
          document.querySelector('[data-drawer-close]').click();
          await new Promise(r => setTimeout(r, 350));
          const closed = document.getElementById('mobileNav').hidden;
          return `drawer=${shown} lock=${scrollLocked} submenu=${sub} aria=${aria} closes=${closed}`;
        });
      } else {
        interact = await p.evaluate(async () => {
          const t = [...document.querySelectorAll('.nav__toggle')][0];
          t.click();
          await new Promise(r => setTimeout(r, 60));
          const panel = document.getElementById(t.getAttribute('aria-controls'));
          const open = !panel.hidden && t.getAttribute('aria-expanded') === 'true';
          const links = [...panel.querySelectorAll('a')];
          links[0].focus();
          panel.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true}));
          await new Promise(r => setTimeout(r, 30));
          const moved = document.activeElement === links[1];
          document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}));
          await new Promise(r => setTimeout(r, 30));
          return `submenu=${open} arrows=${moved} esc=${panel.hidden}`;
        });
      }

      const flags = [];
      if (r.scrollW > r.vw + 1) flags.push(`overflow:${r.scrollW}`);
      if (r.navVisible && r.burgerVisible) flags.push('bothNavAndBurger');
      if (!r.navVisible && !r.burgerVisible) flags.push('noNavAccess');
      if (r.burgerVisible && r.burgerBox && r.burgerBox.h < 40) flags.push(`burgerSmall:${r.burgerBox.h}`);
      if (r.headerH > 110) flags.push(`headerTall:${r.headerH}`);
      if (/drawer=false|lock=false|submenu=false|aria=false|closes=false|arrows=false|esc=false/.test(interact)) flags.push('interact:' + interact);
      if (errs.length) flags.push('js:' + errs[0]);
      if (flags.length) bad++;
      console.log(`${flags.length ? 'XX' : 'OK'} ${slug.padEnd(9)} ${String(w).padStart(4)}px  header=${r.headerH}px nav=${r.navVisible?'yes':'no '} burger=${r.burgerVisible?'yes':'no '}  ${interact}${flags.length ? '  << ' + flags.join(' ') : ''}`);

      if (w === 1440 || w === 820) {
        await p.screenshot({path:`/home/user/rebuild/shots/nav/${slug}-${w}.jpg`, clip:{x:0,y:0,width:w,height:Math.min(760,r.headerH+560)}, type:'jpeg', quality:80});
      }
      await p.close();
    }
  }
  await b.close();
  console.log(`\n${PAGES.length * WIDTHS.length} nav renders, ${bad} with problems.`);
})();
