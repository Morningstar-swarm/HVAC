/** Render the reference SPA and capture EVERY image it requests. */
const fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const OUT='/home/user/rebuild/scrape/found';
if(!fs.existsSync(OUT)) fs.mkdirSync(OUT,{recursive:true});

(async()=>{
const b=await puppeteer.launch({headless:'shell',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
const urls=new Set(), meta=[];
const routes=['/','/about','/services','/products','/gallery','/contact','/reviews','/financing','/service-areas','/faq','/special-offers'];

for(const r of routes){
  const p=await b.newPage();
  await p.setViewport({width:1440,height:1000});
  p.on('response',res=>{
    const u=res.url();
    const ct=(res.headers()['content-type']||'');
    if(ct.startsWith('image/') && !u.includes('favicon.ico')) urls.add(u);
  });
  try{
    await p.goto('https://bestcomforthvac.hcshvac.com'+r,{waitUntil:'networkidle2',timeout:45000});
    await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}window.scrollTo(0,0);});
    await new Promise(r=>setTimeout(r,2500));
    // Harvest in-page references too (src, srcset, inline style backgrounds, <use>)
    const inPage=await p.evaluate(()=>{
      const list=[];
      document.querySelectorAll('img').forEach(i=>{ if(i.currentSrc||i.src) list.push(i.currentSrc||i.src); });
      document.querySelectorAll('[style*="background"]').forEach(el=>{
        const m=(el.getAttribute('style')||'').match(/url\(["']?([^"')]+)["']?\)/g)||[];
        m.forEach(x=>list.push(x.replace(/url\(["']?/,'').replace(/["']?\)$/,'')));
      });
      return {title:document.title, imgs:list, text:document.body.innerText.slice(0,400)};
    });
    meta.push({route:r, title:inPage.title, imgCount:inPage.imgs.length, sample:inPage.text.replace(/\n+/g,' | ').slice(0,180)});
    console.log(`OK  ${r.padEnd(18)} title="${inPage.title.slice(0,48)}" imgs=${inPage.imgs.length}`);
  }catch(e){ console.log(`XX  ${r} -> ${e.message.slice(0,70)}`); }
  await p.close();
}
await b.close();

// Download every image discovered
const list=[...urls];
console.log('\nTotal image URLs captured:', list.length);
const manifest=[];
for(const u of list){
  const name=decodeURIComponent(u.split('/').pop().split('?')[0]);
  try{
    const res=await fetch(u);
    if(!res.ok){ console.log('  skip', res.status, name); continue; }
    const buf=Buffer.from(await res.arrayBuffer());
    if(buf.length<900) { console.log('  tiny skip', name, buf.length); continue; }
    fs.writeFileSync(path.join(OUT,name), buf);
    manifest.push({name,url:u,bytes:buf.length});
    console.log(`  ${String(buf.length).padStart(9)}  ${name}`);
  }catch(e){ console.log('  fail', name, e.message); }
}
fs.writeFileSync('/home/user/rebuild/scrape/manifest.json', JSON.stringify({routes:meta,images:manifest},null,2));
console.log('\nSaved', manifest.length, 'images to', OUT);
})();
