// Anonim kullanım istatistiği: yerelde göndermez; kişisel veri yok; olay adları temiz; her olay oturumda bir kez;
// gün sayısı ve aralık kovaları; kapatınca hiçbir şey gitmez; çevrimdışı kuyruk
const mem={}; global.__mem=mem; global.__ls={getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v);}, removeItem:k=>{delete mem[k];}};
const sent=[]; global.__sent=sent; global.Image=function(){ return {set src(u){ sent.push(u); }}; };
require("./harness")(String.raw`
  if(!window.USAGE && typeof USAGE==="undefined") throw new Error("USAGE yok");
  // dosyadan açılışta (test ortamı) hiçbir şey gitmemeli
  if(USAGE.live()) throw new Error("yerelde canlı sanıldı");
  if(globalThis.__sent.length) throw new Error("yerelde istek gitti: "+globalThis.__sent[0]);

  window.__usageLive=true;
  // olay adı temizlenir, Türkçe harf sadeleşir
  USAGE.event("bolum/İstatistik Şöyle");
  let last=globalThis.__sent.at(-1)||"";
  const u=new URL(last);
  console.log("istek:", last);
  if(u.origin!=="https://obd-takip.goatcounter.com" || u.pathname!=="/count") throw new Error("adres yanlış");
  if(u.searchParams.get("p")!=="bolum/istatistik-soyle" || u.searchParams.get("e")!=="true") throw new Error("olay adı yanlış: "+u.searchParams.get("p"));
  // oturumda bir kez
  const n=globalThis.__sent.length; USAGE.event("bolum/istatistik-soyle"); if(globalThis.__sent.length!==n) throw new Error("aynı olay iki kez gitti");

  // kişisel veri yok: bağlan ve bak
  settings.fuel="benzin";
  const d=new DemoLink(); await start(d); await wait(2500);
  const all=globalThis.__sent.join("\n");
  console.log("olaylar:", globalThis.__sent.map(x=>new URL(x).searchParams.get("p")).join(" | "));
  if(!/p=baglanti%2Fdeneme/.test(all)) throw new Error("bağlantı olayı yok");
  if(/marka|yakit/.test(all)) throw new Error("deneme bağlantısında araç bilgisi gitti");
  const bad=[S.vin, "lat", "lon", "P0301", "VF1"].filter(x=>x && all.includes(x));
  if(bad.length) throw new Error("kişisel/araç verisi gitti: "+bad);
  stop(); await wait(500);

  // günlük sayım: ilk gün, sonra aralık ve gün kovaları
  delete globalThis.__mem["obdTakip.usage"];
  const t0=Date.parse("2026-09-01T10:00:00");
  let r=USAGE.daily(t0); if(r[0]!=="kullanim/ilk-gun" || r.length!==1) throw new Error("ilk gün yanlış: "+r);
  if(USAGE.daily(t0+3600e3)!==null) throw new Error("aynı gün iki kez sayıldı");
  r=USAGE.daily(t0+86400e3); if(r.join()!=="kullanim/gun-2,kullanim/ara-1-gun") throw new Error("ikinci gün yanlış: "+r);
  USAGE.daily(t0+2*86400e3); USAGE.daily(t0+3*86400e3);
  r=USAGE.daily(t0+13*86400e3); if(r.join()!=="kullanim/gun-4-7,kullanim/ara-8-30-gun") throw new Error("kova yanlış: "+r);
  console.log("günlük:", r.join(", "));

  // kapalıyken hiçbir şey gitmez, kuyruk da boşalır
  settings.usageStats=false; const m=globalThis.__sent.length;
  USAGE.event("deneme/kapali"); if(globalThis.__sent.length!==m) throw new Error("kapalıyken gitti");
  settings.usageStats=true;
  // çevrimdışı: kuyruğa, çevrimiçi olunca gider
  Object.defineProperty(navigator,"onLine",{value:false,configurable:true});
  USAGE.event("deneme/cevrimdisi"); if(globalThis.__sent.length!==m) throw new Error("çevrimdışı gitti");
  if(!JSON.parse(globalThis.__mem["obdTakip.usage"]).queue.length) throw new Error("kuyruğa girmedi");
  Object.defineProperty(navigator,"onLine",{value:true,configurable:true});
  USAGE.flush(); if(!globalThis.__sent.at(-1).includes("deneme%2Fcevrimdisi")) throw new Error("kuyruk gönderilmedi");
  window.__usageLive=false;
  console.log("kullanım istatistiği: yerelde sessiz, temiz ad, tek sefer, kişisel veri yok, gün kovaları, kapatma, kuyruk tamam");
`);
