/**
 * Accessibility + WCAG contrast audit.
 *  - form controls must have an accessible name
 *  - buttons and links must have accessible text
 *  - landmarks + heading order
 *  - computed color-contrast for visible text (WCAG AA: 4.5:1 normal, 3:1 large)
 */
const fs=require('fs'),path=require('path'),http=require('http'),puppeteer=require('puppeteer');
const OUT=path.resolve(__dirname,'site');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.txt':'text/plain','.xml':'application/xml'};
const PORT=8090;

(async()=>{
const server=http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(OUT,u==='/'?'index.html':u);
 if(!fs.existsSync(f)){s.writeHead(404);return s.end();}
 s.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);}).listen(PORT,'0.0.0.0');

const b=await puppeteer.launch({headless:'shell',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
const pages=fs.readdirSync(OUT).filter(f=>f.endsWith('.html')).sort();
let totalIssues=0;

for(const file of pages){
  const p=await b.newPage();
  await p.setViewport({width:1440,height:1000});
  await p.goto(`http://127.0.0.1:${PORT}/${file}`,{waitUntil:'networkidle0'});

  const r=await p.evaluate(()=>{
    const issues=[];
    const text=(el)=>((el.getAttribute('aria-label')||'')+' '+(el.textContent||'')).trim().replace(/\s+/g,' ');

    // 1. Form controls need accessible names
    document.querySelectorAll('input,select,textarea').forEach(el=>{
      if(el.type==='hidden') return;
      const id=el.id;
      const hasLabel = !!(id && document.querySelector(`label[for="${id}"]`)) ||
                       el.closest('label') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
      if(!hasLabel) issues.push('CONTROL no accessible name: '+el.tagName.toLowerCase()+'#'+(id||'?'));
    });

    // 2. Buttons & links need accessible text
    document.querySelectorAll('button').forEach(el=>{
      if(!text(el) && !el.querySelector('img[alt]')) issues.push('BUTTON no accessible text: .'+String(el.className).slice(0,30));
    });
    document.querySelectorAll('a[href]').forEach(el=>{
      if(!text(el)) issues.push('LINK no accessible text: '+el.getAttribute('href'));
    });

    // 3. Landmarks
    ['header','main','footer','nav'].forEach(tag=>{
      if(!document.querySelector(tag)) issues.push('LANDMARK missing <'+tag+'>');
    });
    if(!document.querySelector('[aria-label], [aria-labelledby]')) issues.push('LANDMARK regions unlabelled');

    // 4. Heading order (no skipped levels)
    let prev=0;
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h=>{
      const lvl=+h.tagName[1];
      if(prev && lvl>prev+1) issues.push(`HEADING skip h${prev} -> h${lvl} ("${(h.textContent||'').trim().slice(0,30)}")`);
      prev=lvl;
    });

    // 5. Colour contrast — walk visible text nodes
    const parse=c=>{const m=c.match(/[\d.]+/g);return m?m.slice(0,3).map(Number):null;};
    const alphaOf=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return 1;const p=m[1].split(',');return p.length>3?parseFloat(p[3]):1;};
    const over=(fg,bg)=>fg.map((c,i)=>Math.round(c*1+bg[i]*(1-1))); // opaque text assumed
    const lum=c=>{const s=c.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*s[0]+0.7152*s[1]+0.0722*s[2];};
    const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);const hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+0.05)/(lo+0.05);};
    const bgOf=el=>{let n=el;while(n&&n!==document.documentElement){const cs=getComputedStyle(n);const c=cs.backgroundColor;
      if(c&&alphaOf(c)>0.6&&c!=='rgba(0, 0, 0, 0)') return parse(c); n=n.parentElement;} return [255,255,255];};

    const seen=new Set(); let sampled=0;
    document.querySelectorAll('p,li,span,strong,small,a,h1,h2,h3,h4,h5,td,th,label,blockquote,figcaption,legend,button,option').forEach(el=>{
      if(sampled>520) return;
      const cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return;
      const direct=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim().length>1).map(n=>n.textContent.trim()).join('');
      if(!direct) return;
      const box=el.getBoundingClientRect(); if(box.width<2||box.height<2) return;
      const fg=parse(cs.color); if(!fg) return;
      const bg=bgOf(el);
      // skip gradient/image backgrounds where our flat-colour model does not apply
      const gradish=(()=>{let n=el;while(n&&n!==document.documentElement){const s=getComputedStyle(n);
        if(s.backgroundImage!=='none'||n.hasAttribute('data-over-media')) return true; n=n.parentElement;} return false;})();
      const size=parseFloat(cs.fontSize), weight=parseInt(cs.fontWeight,10)||400;
      const large=size>=24||(size>=18.66&&weight>=700);
      const need=large?3:4.5;
      const cr=ratio(fg,bg);
      if(cr<need){
        const key=cs.color+'|'+bg.join(',')+Math.round(size)+weight;
        if(seen.has(key)) return; seen.add(key); sampled++;
        issues.push(`CONTRAST ${cr.toFixed(2)}:1 (need ${need}) ${Math.round(size)}px w${weight} colour ${cs.color} on rgb(${bg.join(',')})${gradish?' [gradient bg — verify visually]':''} :: "${direct.slice(0,42)}"`);
      }
    });
    return issues;
  });

  const hard=r.filter(x=>!x.includes('gradient bg'));
  const soft=r.filter(x=>x.includes('gradient bg'));
  totalIssues+=hard.length;
  console.log(`${hard.length?'XX':'OK'} ${file.padEnd(20)} hard=${hard.length} soft(gradient)=${soft.length}`);
  hard.slice(0,7).forEach(x=>console.log('     - '+x));
  if(soft.length && process.env.SHOW_SOFT) soft.slice(0,4).forEach(x=>console.log('     ~ '+x));
  await p.close();
}
await b.close();server.close();
console.log(`\nTotal hard accessibility/contrast issues: ${totalIssues}`);
})();
