// Geçiş ücretleri: GPS izinden gişe geçişi, kapalı sistem giriş–çıkış çifti, köprü sabit ücreti, saate göre tünel
// ücreti, geçiş sınıfı (araç sınıfından öneri, araç başına), çıkışı bulunamayan giriş, masraf defterine ekleme,
// eski sürüşte geriye dönük hesap (kendiliğinden masrafa eklenmez)
require("./harness")(String.raw`
  const T=TOLLS;
  const D={surum:1, tarifeTarihi:"2026-01-01", yollar:[
    {id:"OT", ad:"Deneme Otoyolu", tip:"kapali", gise:[{ad:"Aköy", k:[[40.0000,29.0000],[40.0003,29.0004]]},{ad:"Bköy", k:[[40.1000,29.2000]]},{ad:"Cköy", k:[[40.2000,29.4000]]}],
      ucret:{"1":{"Aköy|Bköy":50,"Aköy|Cköy":90,"Bköy|Cköy":45},"2":{"Aköy|Bköy":80}}},
    {id:"KP", ad:"Deneme Köprüsü", tip:"kopru", gise:[{ad:"Köprü gişesi", k:[[41.0000,28.0000]]}], sabit:{"1":59,"2":75}},
    {id:"TN", ad:"Deneme Tüneli", tip:"tunel", gise:[{ad:"Tünel gişesi", k:[[41.5000,28.5000]]}], sabit:{"1":200},
      saatli:{gece:{saat:"23:59-05:00","1":100}}}]};
  T.data=D;
  // iz: Aköy'den gir, Cköy'den çık; sonra köprü; ayrıca otoyola Bköy'den girip veri biter
  const day=new Date(2026,9,8,12,0,0).getTime();
  const line=(a,b,t0,n=40)=>Array.from({length:n},(_,i)=>({t:t0+i*1000, lat:a[0]+(b[0]-a[0])*i/(n-1), lon:a[1]+(b[1]-a[1])*i/(n-1)}));
  let S1=[...line([39.999,28.999],[40.0001,29.0001],day,10), ...line([40.15,29.3],[40.2,29.4],day+600000,30), ...line([40.9,27.9],[41.0,28.0],day+1200000,30)];
  let r=T.compute(S1,{sinif:"1"});
  if(r.gecis.length!==2) throw new Error("geçiş sayısı: "+JSON.stringify(r.gecis));
  if(r.gecis[0].giris!=="Aköy" || r.gecis[0].cikis!=="Cköy" || r.gecis[0].tl!==90) throw new Error("kapalı sistem: "+JSON.stringify(r.gecis[0]));
  if(r.gecis[1].ad!=="Deneme Köprüsü" || r.gecis[1].tl!==59) throw new Error("köprü: "+JSON.stringify(r.gecis[1]));
  if(r.toplam!==149) throw new Error("toplam: "+r.toplam);
  // ters yön (Cköy → Aköy) aynı ücret; sınıf 2'de tabloda olmayan çift → ücret yok
  r=T.compute([...line([40.2,29.4],[40.21,29.41],day,5), ...line([40.0005,29.0005],[39.99,28.99],day+900000,20)],{sinif:"1"});
  if(r.gecis[0].tl!==90 || r.gecis[0].giris!=="Cköy") throw new Error("ters yön: "+JSON.stringify(r.gecis));
  if(T.compute(S1,{sinif:"2"}).gecis[0].tl!==null) throw new Error("tabloda olmayan çift ücretli sayıldı");
  // çıkış bulunamadı
  r=T.compute(line([40.1,29.2],[40.12,29.25],day,10),{sinif:"1"});
  if(r.gecis.length!==1 || r.gecis[0].cikis!==null || r.gecis[0].tl!==null || !/çıkış/.test(r.gecis[0].not)) throw new Error("tek giriş: "+JSON.stringify(r.gecis));
  // saatli tünel: gece 100, gündüz 200
  const night=new Date(2026,9,8,2,0,0).getTime();
  if(T.compute(line([41.49,28.49],[41.5,28.5],night,10),{sinif:"1"}).gecis[0].tl!==100) throw new Error("gece ücreti");
  if(T.compute(line([41.49,28.49],[41.5,28.5],day,10),{sinif:"1"}).gecis[0].tl!==200) throw new Error("gündüz ücreti");
  // gişeden uzak iz: geçiş yok
  if(T.compute(line([39.9,28.9],[39.95,28.95],day,20),{sinif:"1"}).gecis.length) throw new Error("uzaktan geçiş sayıldı");
  // geçiş sınıfı: araç sınıfından öneri, elle seçim öncelikli
  settings.gecisSinifi=null; settings.aracSinifi="kamyonet"; if(T.cls()!=="2") throw new Error("kamyonet → sınıf 2");
  settings.aracSinifi="otomobil"; if(T.cls()!=="1") throw new Error("otomobil → sınıf 1");
  settings.gecisSinifi="2"; if(T.cls()!=="2") throw new Error("elle seçim"); settings.gecisSinifi=null;
  // masraf defteri: bir kez, doğru tür
  const n0=settings.expenses.length, trip={id:77, start:day};
  const r1=T.compute(S1,{sinif:"1"}); T.toExpenses(trip, r1); T.toExpenses(trip, r1);
  const added=settings.expenses.slice(n0);
  if(added.length!==2 || added.some(x=>x.type!=="Otopark-Köprü" || x.src!=="gecis" || x.trip!==77) || added[0].amount+added[1].amount!==149) throw new Error("masraf: "+JSON.stringify(added));
  // eski sürüş: açılınca hesaplanır, masrafa kendiliğinden eklenmez
  const old={id:await putTrip({start:day, end:day+1800000, samples:70, distance:30000, stats:{}, events:[], dtcs:[]}), start:day, end:day+1800000, samples:70, distance:30000, stats:{}, events:[], dtcs:[]};
  const n1=settings.expenses.length; emit("tripOpen", old, S1); await wait(300);
  if(!old.tolls || old.tolls.toplam!==149) throw new Error("geriye dönük hesap: "+JSON.stringify(old.tolls));
  if(settings.expenses.length!==n1) throw new Error("eski sürüş masrafa kendiliğinden eklendi");
  console.log("geçiş ücretleri: kapalı sistem, ters yön, köprü, gece/gündüz tünel, çıkışsız giriş, sınıf, masraf, geriye dönük tamam");
`);
