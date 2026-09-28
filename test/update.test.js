// Yeni sürüm uyarısı: yayındaki sürüm yeniyse görünür, aynı/eskiyse görünmez, bağlıyken bağlantı uyarısı yazar, çevrimdışıyken sessiz
global.__fetchMock=true;
let served='const APP_VERSION = "9.99";';
global.fetch=async(u)=>{ if(String(u).startsWith("index.html")) return {ok:true, text:async()=>served}; throw new Error("ağ yok"); };
require("./harness")(String.raw`
  location.protocol="https:";
  if(!UPDATE.newer("1.15","1.14") || UPDATE.newer("1.14","1.14") || UPDATE.newer("1.9","1.10") || !UPDATE.newer("2.0","1.99")) throw new Error("sürüm karşılaştırma yanlış");
  await UPDATE.check(true);
  if($("updNotice").hidden || !/9\.99/.test($("updText").textContent)) throw new Error("yeni sürüm uyarısı çıkmadı: "+$("updText").textContent);
  await start(new DemoLink()); await wait(800);
  if(!/bağlantısı kesilir/.test($("updText").textContent)) throw new Error("bağlıyken uyarı eksik");
  stop(); await wait(300);
  __setServed('const APP_VERSION = "'+APP_VERSION+'";'); await UPDATE.check(true);
  if(!$("updNotice").hidden) throw new Error("aynı sürümde uyarı çıktı");
  __setServed(null); await UPDATE.check(true);
  if(!$("updNotice").hidden) throw new Error("çevrimdışıyken uyarı değişti");
  console.log("güncelleme uyarısı: karşılaştırma, yeni sürüm, bağlıyken uyarı, aynı sürüm, çevrimdışı tamam");
`);
global.__setServed=v=>{ served=v; if(v===null) global.fetch=async()=>{ throw new Error("ağ yok"); }; };
