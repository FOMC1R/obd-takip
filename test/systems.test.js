// Araç sistemleri: bağlanınca şanzıman beyni (7E1) bulunur, adı ve değerleri okunur, başka adreste sistem yoksa eklenmez,
// arama sonrası motor okuması sürer, değerler sürüş kaydına ve CSV'ye girer, vites oranlardan öğrenilir
require("./harness")(String.raw`
  if(typeof SYS==="undefined") throw new Error("SYS yok");
  settings.sysEvery=2;
  await start(new DemoLink());
  for(let i=0;i<60 && !SYS.st.probed;i++) await wait(250);
  if(!SYS.st.probed) throw new Error("arama bitmedi");
  const t=SYS.store()["7E1"];
  if(!t) throw new Error("şanzıman bulunamadı: "+JSON.stringify(SYS.store()));
  if(Object.keys(SYS.store()).length!==1) throw new Error("olmayan sistem eklendi: "+Object.keys(SYS.store()));
  if(Object.keys(settings.systems||{}).length || settings.systemsChecked) throw new Error("deneme sonucu gerçek araç ayarına yazıldı");
  if(t.name!=="Şanzıman" || !/^TCM/.test(t.ecu||"")) throw new Error("ad yanlış: "+t.name+" / "+t.ecu);
  for(const p of ["05","0C","0D","A4"]) if(!t.pids.includes(p)) throw new Error("desteklenen listede yok: "+p+" "+t.pids);
  console.log("bulundu:", t.name, t.ecu, t.pids.join(","));

  // arama sonrası başlık geri yüklendi: motor değerleri güncelleniyor
  const ts0=S.g["0C"].ts; await wait(1500);
  if(!(S.g["0C"].ts>ts0)) throw new Error("aramadan sonra motor okuması durdu");

  // canlı okuma
  for(let i=0;i<40 && !(SYS.live["7E1"] && SYS.live["7E1"]["05"]);i++) await wait(250);
  if(!(SYS.live["7E1"] && SYS.live["7E1"]["05"])) throw new Error("şanzıman değeri okunmadı");
  const v05=SYS.live["7E1"]["05"].v;
  if(!(v05>-40 && v05<215)) throw new Error("şanzıman sıcaklığı anlamsız: "+v05);

  // kayıt: satırlarda s alanı ve sürüş istatistiği
  await wait(3000);
  await flush(REC.trip);
  const trip=REC.trip, smp=await getSamples(trip.id);
  if(!smp.some(s=>s.s && s.s["7E1"] && s.s["7E1"]["05"]!=null)) throw new Error("şanzıman değeri kayda girmedi");
  if(!trip.sysStats || !trip.sysStats["7E1"]) throw new Error("sürüş istatistiği yok");
  const cols=[]; emit("csvCols", cols, smp);
  if(!cols.some(c=>/^Şanzıman · /.test(c.head))) throw new Error("CSV sütunu yok: "+cols.map(c=>c.head));
  emit("tripOpen", trip, smp);

  // vites öğrenme: 4 farklı oranda sabit sürüş → 4 vites, ortadaki oran 2. vites
  S.paused=true; await wait(800);
  SYS.resetGear();
  const R=[120,70,48,34]; let T=1e12;
  for(const r of R) for(let i=0;i<80;i++){ const sp=30+ (i%5); S.g["0D"].v=sp; S.g["0C"].v=sp*r; S.g["0D"].ts=S.g["0C"].ts=Date.now(); T+=1000; SYS.learn(T); }
  const P=SYS.peaks();
  if(P.length!==4) throw new Error("vites sayısı yanlış: "+P.map(x=>x.toFixed(1)));
  if(settings.gear && settings.gear.n) throw new Error("deneme vitesleri gerçek araca öğrenildi");
  SYS.live["7E1"]={};   // şanzıman beyni oranı olmasın; tahmin devirden
  S.g["0D"].v=50; S.g["0C"].v=50*70; S.g["0D"].ts=S.g["0C"].ts=Date.now();
  const g=SYS.gear(); if(g.gear!==2) throw new Error("vites tahmini yanlış: "+JSON.stringify(g));
  S.g["0C"].v=50*95; if(SYS.gear().state!=="gecis") throw new Error("aradaki oran geçiş sayılmadı");
  S.g["0D"].v=0; if(SYS.gear().state!=="duruyor") throw new Error("duruş algılanmadı");
  S.paused=false;
  stop(); await wait(500);
  console.log("sistemler: keşif, ad, motor sürüyor, canlı okuma, kayıt, CSV, vites öğrenme tamam");
`);
