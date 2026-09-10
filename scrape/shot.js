const puppeteer=require('puppeteer');
(async()=>{
const b=await puppeteer.launch({headless:'shell',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
await p.goto('https://bestcomforthvac.hcshvac.com/',{waitUntil:'networkidle2',timeout:60000});
await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,80));}window.scrollTo(0,0);});
await new Promise(r=>setTimeout(r,3000));
const h=await p.evaluate(()=>document.body.scrollHeight);
console.log('page height', h);
await p.screenshot({path:'/home/user/rebuild/scrape/reference-full.jpg',fullPage:true,quality:72,type:'jpeg'});
// section-by-section capture
for(let i=0;i<Math.min(6,Math.ceil(h/1000));i++){
  await p.evaluate(y=>window.scrollTo(0,y), i*1000);
  await new Promise(r=>setTimeout(r,350));
  await p.screenshot({path:`/home/user/rebuild/scrape/ref-${String(i).padStart(2,'0')}.jpg`,quality:80,type:'jpeg'});
}
await b.close(); console.log('screenshots done');
})();
