// Service worker: kendi dosyalarımız önbelleğe sorgusuz tek adresle yazılır (güncelleme kontrolü önbelleği
// şişirmez); ağ yoksa önbellekten verilir; dış servisler (yapay zekâ, harita karosu) önbelleğe girmez
const fs=require("fs"), path=require("path"), vm=require("vm");
const src=fs.readFileSync(path.join(__dirname,"..","sw.js"),"utf8");
const ORIGIN="https://fomc1r.github.io";
const store=new Map(); let online=true;
const keyOf=r=>typeof r==="string"?r:r.url;
const cache={ put:async(k,v)=>{ store.set(keyOf(k),v); }, add:async()=>{},
  match:async(k,o)=>{ const u=keyOf(k); if(store.has(u)) return store.get(u); if(o&&o.ignoreSearch){ const b=u.split("?")[0]; return store.get(b); } } };
const handlers={};
const ctx={ self:{ addEventListener:(t,f)=>handlers[t]=f, skipWaiting(){}, clients:{claim(){}} }, location:{origin:ORIGIN}, URL,
  caches:{ open:async()=>cache, keys:async()=>[], delete:async()=>true, match:(k,o)=>cache.match(k,o) },
  fetch:async(u)=>{ if(!online) throw new Error("çevrimdışı"); const url=keyOf(u); return {ok:true, type:"basic", url, clone(){ return {url, body:"x"}; }}; },
  console };
vm.createContext(ctx); vm.runInContext(src, ctx);
const run=async(url,mode="cors")=>{ let p; handlers.fetch({request:{url, method:"GET", mode}, respondWith:x=>p=x}); return p ? await p : "atlandı"; };
(async()=>{
  for(let i=0;i<20;i++) await run(`${ORIGIN}/obd-takip/index.html?surum=${1790000000000+i}`);
  await new Promise(r=>setTimeout(r,20));
  const own=[...store.keys()].filter(k=>k.includes("index.html"));
  if(own.length!==1 || own[0]!==`${ORIGIN}/obd-takip/index.html`) throw new Error("önbellek şişiyor: "+own.length+" kayıt "+own.slice(0,3));
  online=false;
  const off=await run(`${ORIGIN}/obd-takip/index.html?surum=5`);
  if(!off || off.url!==`${ORIGIN}/obd-takip/index.html?surum=${1790000000019}`) throw new Error("çevrimdışı önbellekten verilmedi: "+JSON.stringify(off));
  online=true;
  if(await run("https://api.anthropic.com/v1/messages")!=="atlandı") throw new Error("yapay zekâ isteği önbelleğe karıştı");
  if(await run("https://a.tile.openstreetmap.org/1/1/1.png")!=="atlandı") throw new Error("harita karosu önbelleğe karıştı");
  console.log("service worker: tek kayıt (20 kontrol → 1), çevrimdışı yanıt, dış servis dışlama tamam");
})().catch(e=>{ console.error("FAIL",e.message); process.exit(1); });
