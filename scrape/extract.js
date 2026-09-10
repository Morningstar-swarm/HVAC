const puppeteer=require('puppeteer');
const fs=require('fs');
(async()=>{
const b=await puppeteer.launch({headless:'shell',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
await p.goto('https://bestcomforthvac.hcshvac.com/',{waitUntil:'networkidle2',timeout:60000});
await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,70));}window.scrollTo(0,0);});
await new Promise(r=>setTimeout(r,2500));

const data=await p.evaluate(()=>{
  const S = v => (typeof v === 'string' ? v.replace(/\s+/g,' ').trim() : '');
  const T = el => S(el && el.textContent);
  const out={};
  out.title=S(document.title);
  out.phones=[...new Set((T(document.body).match(/\(?\d{3}\)?[-. ]\d{3}[-.]\d{4}/g)||[]))];
  out.headings=[...document.querySelectorAll('h1,h2,h3,h4')].map(h=>h.tagName+': '+T(h)).filter(x=>x.length<170);

  const leaves = sel => [...document.querySelectorAll(sel)].filter(el=>el.children.length===0);

  out.products = leaves('*').map(el=>{
      const t=T(el), par=el.parentElement;
      if(!/^\$[\d,]+(\.\d\d)?$/.test(t)) return null;
      const card = par && par.parentElement ? par.parentElement : par;
      const name = S(card && card.textContent).split('$')[0].slice(0,70);
      return {price:t, name:name};
    }).filter(Boolean).slice(0,40);

  out.accordions=[...document.querySelectorAll('button,[role="button"],[aria-expanded]')]
    .map(x=>T(x)).filter(t=>/Install|Servic|Repair|Areas|Brands/i.test(t)&&t.length<120)
    .filter((v,i,a)=>a.indexOf(v)===i);

  out.partners=[...new Set(leaves('*').map(el=>T(el))
    .filter(t=>t.length>6&&t.length<44&&/(Plumbing|Heating|HVAC|Insulation|Climate|Energy|Water Treatment|Air|Home)/.test(t)&&!/^$/.test(t)))].slice(0,24);

  out.offers=[...new Set(leaves('*').map(el=>T(el)).filter(t=>/^\$?\d*\s*(OFF|Free)/i.test(t)||/FREE/i.test(t)).filter(t=>t.length<60))].slice(0,12);

  const cs=getComputedStyle(document.body);
  out.palette={bodyBg:cs.backgroundColor,bodyColor:cs.color,font:cs.fontFamily};
  const colors={};
  document.querySelectorAll('button,a,section,div,span').forEach(el=>{
    const c=getComputedStyle(el);
    [c.backgroundColor,c.color].forEach(v=>{ if(v&&v!=='rgba(0, 0, 0, 0)') colors[v]=(colors[v]||0)+1; });
  });
  out.topColors=Object.entries(colors).sort((a,b)=>b[1]-a[1]).slice(0,18);

  const foot=document.querySelector('footer');
  out.footer=foot?S(foot.textContent).slice(0,1200):'';
  out.sections=[...document.querySelectorAll('section')].map(s=>T(s).slice(0,150)).filter(Boolean).slice(0,30);
  out.bodyStart=T(document.body).slice(0,2600);
  out.links=[...new Set([...document.querySelectorAll('a')].map(a=>S(a.getAttribute('href'))).filter(h=>h&&h!=='#'))].slice(0,60);
  return out;
});
fs.writeFileSync('/home/user/rebuild/scrape/reference-data.json',JSON.stringify(data,null,2));
console.log('TITLE:',data.title);
console.log('PHONES:',data.phones.join('  |  '));
console.log('\nHEADINGS:'); data.headings.slice(0,40).forEach(h=>console.log('   '+h));
console.log('\nPRODUCTS:'); data.products.slice(0,28).forEach(x=>console.log('   '+(x.price||'').padEnd(12)+' '+(x.name||'')));
console.log('\nACCORDIONS:'); data.accordions.slice(0,24).forEach(a=>console.log('   '+a));
console.log('\nOFFERS:'); data.offers.forEach(o=>console.log('   '+o));
console.log('\nPARTNERS:'); console.log('   '+data.partners.join(' | '));
console.log('\nPALETTE:',JSON.stringify(data.palette));
console.log('\nTOP COLORS:'); data.topColors.forEach(c=>console.log('   '+String(c[1]).padStart(5)+'x  '+c[0]));
console.log('\nFOOTER:',data.footer.slice(0,700));
await b.close();
})();
