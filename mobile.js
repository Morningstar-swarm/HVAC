/** Mobile + tablet audit: overflow, drawer behaviour, action bar, tap-target sizes. */
const fs=require('fs'),path=require('path'),http=require('http'),puppeteer=require('puppeteer');
const OUT=path.resolve(__dirname,'site');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const PORT=8096;
(async()=>{
const server=http.createServer((req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);const f=path.join(OUT,u==='/'?'index.html':u);
 if(!fs.existsSync(f)){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);}).listen(PORT,'0.0.0.0');
const b=await puppeteer.launch({headless:'shell',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
const devices=[{name:'iPhone-390',w:390,h:844},{name:'Tablet-820',w:820,h:1180}];
const pages=fs.readdirSync(OUT).filter(f=>f.endsWith('.html')).sort();
let bad=0;
for(const d of devices){
  for(const file of pages){
    const p=await b.newPage();
    await p.setViewport({width:d.w,height:d.h,isMobile:d.w<500,hasTouch:d.w<500,deviceScaleFactor:1});
    await p.goto(`http://127.0.0.1:${PORT}/${file}`,{waitUntil:'networkidle0'});
    await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=900){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,15));}window.scrollTo(0,0);});
    const r=await p.evaluate(()=>{
      const vw=document.documentElement.clientWidth;
      const clipped = el => {
        for (let n = el.parentElement; n; n = n.parentElement) {
          const o = getComputedStyle(n);
          if (o.overflowX === 'hidden' || o.overflowX === 'auto' || o.overflowX === 'scroll') return true;
        }
        return false;
      };
      const wide=[...document.querySelectorAll('body *')].filter(el=>{
        const b=el.getBoundingClientRect(); const cs=getComputedStyle(el);
        if(cs.position==='fixed'||cs.position==='absolute') return false;
        if(clipped(el)) return false;
        return b.width>vw+2||b.right>vw+3;
      }).slice(0,6).map(el=>el.tagName.toLowerCase()+'.'+String(el.className).split(' ')[0]+'@'+Math.round(el.getBoundingClientRect().width));
      // tap targets inside nav / action bar should be >= 24px tall (WCAG 2.5.8 min)
      const small=[...document.querySelectorAll('a,button')].filter(el=>{
        const b=el.getBoundingClientRect();
        return b.height>0 && b.height<24 && el.offsetParent!==null;
      }).length;
      return {
        scrollW:document.documentElement.scrollWidth, vw, wide, smallTargets:small,
        actionBar:getComputedStyle(document.querySelector('.action-bar')).display,
        burger:getComputedStyle(document.querySelector('.burger')).display,
        nav:getComputedStyle(document.querySelector('.nav')).display,
        leaked:[...document.querySelectorAll('[hidden]')].filter(el=>getComputedStyle(el).display!=='none').length
      };
    });
    const flags=[];
    if(r.scrollW>r.vw+2) flags.push('h-overflow:'+r.scrollW);
    if(r.wide.length) flags.push('wide:'+r.wide.join('|'));
    if(r.leaked) flags.push('hiddenLeak:'+r.leaked);
    if(d.w<500 && r.actionBar!=='flex') flags.push('actionBarMissing');
    if(d.w<500 && r.burger!=='grid') flags.push('burgerMissing');
    // Below 1080px the primary nav intentionally collapses into the drawer
    if(d.w>=820 && r.burger!=='grid' && r.nav==='none') flags.push('noNavAccess:no burger and no nav');
    if(flags.length) bad++;
    console.log(`${flags.length?'XX':'OK'} [${d.name}] ${file.padEnd(20)} smallTap=${String(r.smallTargets).padStart(3)} \u2014 ${flags.join(' ')||'clean'}`);
    await p.close();
  }
}
await b.close();server.close();
console.log(`\n${devices.length*pages.length} renders, ${devices.length*pages.length-bad} clean.`);
})();
