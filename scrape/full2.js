const puppeteer=require('puppeteer');
(async()=>{
const b=await puppeteer.launch({headless:'shell',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
const p=await b.newPage(); await p.setViewport({width:1440,height:1000,deviceScaleFactor:1.5});
await p.goto('https://bestcomforthvac.hcshvac.com/',{waitUntil:'networkidle2',timeout:60000});
await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,70));}window.scrollTo(0,0);});
await new Promise(r=>setTimeout(r,3000));
const h=await p.evaluate(()=>document.body.scrollHeight);
console.log('clean page height:', h);
// capture in viewport slices for accuracy
const step=1700;
for(let y=0,i=0;y<h;y+=step,i++){
  await p.evaluate(v=>window.scrollTo(0,v),y);
  await new Promise(r=>setTimeout(r,420));
  await p.screenshot({path:`/home/user/rebuild/scrape/sl-${String(i).padStart(2,'0')}.jpg`,type:'jpeg',quality:82});
}
console.log('slices:', Math.ceil(h/step));
await b.close();
})();
