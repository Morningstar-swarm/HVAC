const puppeteer=require('puppeteer');
const fs=require('fs');
(async()=>{
const b=await puppeteer.launch({headless:'shell',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
await p.goto('https://bestcomforthvac.hcshvac.com/',{waitUntil:'networkidle2',timeout:60000});
await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}});
await new Promise(r=>setTimeout(r,1500));
// Expand the "Area's We Service" accordion
await p.evaluate(async()=>{
  const btns=[...document.querySelectorAll('button,[role="button"],[aria-expanded]')];
  for(const btn of btns){
    const t=(btn.textContent||'').replace(/\s+/g,' ');
    if(/"e Service|Area.s We Service|Brands We|Plumbing Types|Boilers We|Water Heaters We/i.test(t)){
      if(btn.getAttribute('aria-expanded')!=='true'){ try{btn.click();}catch(e){} }
      await new Promise(r=>setTimeout(r,120));
    }
  }
  await new Promise(r=>setTimeout(r,1200));
});
const data=await p.evaluate(()=>{
  const S=v=>(typeof v==='string'?v.replace(/\s+/g,' ').trim():'');
  const areas=[...new Set((S(document.body.textContent).match(/[A-Z][A-Za-z' .-]+(?:\(Township\))?,\s*(?:Will|Cook|DuPage|Kendall|Grundy|Kane|Lake|McHenry) County, IL/g)||[]))];
  const brands=[...new Set((S(document.body.textContent).match(/\b[A-Z][A-Za-z&'-]+(?:\s[A-Z][A-Za-z&'-]+){0,2}\b(?=\s{2,}|\d)/g)||[]))].slice(0,200);
  return {areas, brandBlob:S(document.body.textContent).slice(0,0), count:areas.length};
});
fs.writeFileSync('/home/user/rebuild/scrape/areas.json',JSON.stringify(data,null,2));
console.log('areas found:', data.count);
data.areas.slice(0,60).forEach(a=>console.log('  '+a));
// also dump the accordion panel text
const panels=await p.evaluate(()=>{
  const S=v=>(typeof v==='string'?v.replace(/\s+/g,' ').trim():'');
  const out=[];
  document.querySelectorAll('button[aria-expanded="true"],[role="button"][aria-expanded="true"]').forEach(btn=>{
    let n=btn.parentElement, hops=0; while(n&&hops<4){ const t=S(n.textContent); if(t.length>200){ out.push(t.slice(0,1500)); break; } n=n.parentElement; hops++; }
  });
  return out;
});
fs.writeFileSync('/home/user/rebuild/scrape/panels.json',JSON.stringify(panels,null,2));
console.log('\n=== PANEL TEXTS ===');
panels.slice(0,8).forEach((t,i)=>console.log('\n['+i+'] '+t.slice(0,700)));
await b.close();
})();
