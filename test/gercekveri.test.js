// Gerçek araç verisinden çıkan düzeltmeler (docs/YOL-HARITASI.md 2.5): Renault K4M motor dururken devri ~232
// bildiriyor. Yakıt sayılmamalı; ardından gelen kopma "kontak kapatıldı" sayılmalı (kırmızı uyarı yok, yeniden
// bağlanma yok); kırıntı sürüş atılmalı; emme havası sınırı 60 → 70 (kullanıcının değeri korunur); hız aşımı sarı;
// bağlı değilken alınan tanılama paketinde son bağlantının özeti olmalı.
const store={"obdTakip.v1":JSON.stringify({v:2, lim:{"0F":{show:true,min:null,max:60},"05":{show:true,min:null,max:100}}, fuel:"benzin"})};
global.__ls={getItem:k=>store[k]??null, setItem(k,v){ store[k]=String(v); }, removeItem(k){ delete store[k]; }};
require("./harness")(String.raw`
  // 2.5.4: eski varsayılan 60 → 70; kullanıcının su sınırı (100) korunur; yeni kurulumun varsayılanı da 70
  if(settings.lim["0F"].max!==70 || settings.lim["05"].max!==100 || settings.v<3) throw new Error("taşıma: "+JSON.stringify(settings.lim["0F"])+" "+settings.lim["05"].max+" v"+settings.v);
  if(GBY["0F"].max!==70) throw new Error("emme havası varsayılanı");
  const set=(pid,v)=>{ S.g[pid].v=v; S.g[pid].ts=Date.now(); };

  // 2.5.1: devir 232, hız 0, emme basıncı 100 kPa (motor durmuş, kontak açık) → yakıt 0
  settings.fuel="benzin"; settings.disp=1.6;
  set("0C",232); set("0D",0); set("0B",100); set("0F",40); set("06",0); set("07",-5.47);
  if(fuelLH()!==0) throw new Error("motor dururken yakıt sayıldı: "+fuelLH());
  set("0C",800); set("0B",43); if(!(fuelLH()>0.5)) throw new Error("rölantide yakıt yok: "+fuelLH());

  // 2.5.5: hız sınırı aşımı sarı, su sıcaklığı hâlâ kırmızı
  settings.lim["0D"].max=50; for(let i=0;i<3;i++){ set("0D",56); checkLimits(GBY["0D"]); }
  if(!S.alarms.has("g0D") || S.alarms.get("g0D").level!=="warn") throw new Error("hız uyarısı seviyesi: "+JSON.stringify(S.alarms.get("g0D")));
  for(let i=0;i<3;i++){ set("05",125); checkLimits(GBY["05"]); }
  if(S.alarms.get("g05").level!=="crit") throw new Error("hararet kırmızı kalmalı");
  S.alarms.clear(); settings.lim["0D"].max=130;

  // 2.5.2: motor durduktan sonra kopma → kontak kapatıldı (demo bağlantısı "yeniden kullanılabilir"; yine de denenmemeli)
  settings.autoReconnect=true;
  await start(new DemoLink()); await wait(1500);
  set("0C",232); set("0D",0); trackEngine();
  if(S.engineOffAt==null) throw new Error("motorun durduğu anlaşılmadı");
  S.link.onLost();
  await wait(300);
  if(S.active) throw new Error("bağlantı açık kaldı");
  if(S.alarms.has("link")) throw new Error("kontak kapatma kırmızı/sarı uyarı verdi: "+JSON.stringify(S.alarms.get("link")));
  if(!/Kontak kapatıldı/.test($("statusText").textContent)) throw new Error("durum yazısı: "+$("statusText").textContent);
  if(!S.log.some(e=>/Kontak kapatıldı/.test(e.text))) throw new Error("geçmişe yazılmadı");
  await wait(2500);
  if(S.active) throw new Error("yeniden bağlanmaya çalıştı");
  // karşı durum: motor çalışırken kopma → yeniden bağlanma devam eder (background testi ayrıntılı sınar)
  await start(new DemoLink()); await wait(1500);
  if(S.engineOffAt!=null) throw new Error("yeni bağlantıda eski motor durumu kaldı");
  set("0C",1500); trackEngine(); S.link.onLost(); await wait(100);
  if(!S.alarms.has("link")) throw new Error("gerçek kopmada uyarı yok");
  stop(); await wait(400); S.alarms.clear();

  // 2.5.3: 30 sn, 0 km, gerçek sürüş → atılır; 2 dk'lık gerçek sürüş → tutulur
  settings.record=true;
  const keep0=(await getTrips()).length;
  await startRec("test", false); REC.trip.samples=3; REC.trip.end=REC.trip.start+30000; REC.trip.distance=0; await endRec();
  if((await getTrips()).length!==keep0) throw new Error("kırıntı sürüş kaydedildi");
  await startRec("test", false); REC.trip.samples=120; REC.trip.end=REC.trip.start+120000; REC.trip.distance=1500; await endRec();
  if((await getTrips()).length!==keep0+1) throw new Error("gerçek sürüş silindi");

  // 2.5.6: bağlıyken özet saklanır; bağlı değilken pakete girer (deneme bağlantısı saklanmaz)
  DIAGPACK.LOG.first.push({t:Date.now(), ms:5, cmd:"0100", resp:"41 00 BE 3E B8 11"});
  S.supported=new Set(["0C","0D","05"]); const L0=S.link; S.link={}; S.vin="VF1LZB10A44123456";
  DIAGPACK.saveSnap(); S.link=L0; S.supported=null; S.active=false;
  const pk=await DIAGPACK.build();
  if(!pk.sonBaglanti || !pk.sonBaglanti.elmKonusma.ilk.length || pk.sonBaglanti.destekleyenPIDler.join()!=="05,0C,0D") throw new Error("son bağlantı özeti: "+JSON.stringify(pk.sonBaglanti).slice(0,200));
  if(!pk.sonBaglanti.arkaPlan || !pk.sonBaglanti.arkaPlan.ozet) throw new Error("son bağlantıda arka plan kaydı yok");
  if(JSON.stringify(pk).includes("VF1LZB10A44123456")) throw new Error("şase numarası tam hâliyle pakete girdi");

  // 2.5.7: desteklenmeyen gösterge gizli (soluk değil)
  if(!/\.g\.unsup\{display:none\}/.test(require("fs").readFileSync(require("path").join(process.cwd(),"index.html"),"utf8"))) throw new Error("desteklenmeyen gösterge gizlenmiyor");
  console.log("gerçek veri düzeltmeleri: motor durdu (232 d/dk) yakıt 0, kontak kapatma, kırıntı sürüş, emme sınırı taşıma, hız sarı, son bağlantı özeti tamam");
`);
