// data/tolls.json'ın İstanbul için doğruluğu (gerçek koordinatlarla hayali sürüşler). Beklenen ücretler KGM'nin
// 2026 tarife PDF'lerinden: O-4 Çamlıca→Gebze 49, O-3 Mahmutbey→Çatalca 49, O-7 Odayeri→Paşaköy 480 (YSS dahil),
// 15 Temmuz / FSM 59, Avrasya gündüz 330 (sınıf 1). Ayrıca dosya bütünlüğü: her ızgara n×n, sınıflar, kaynak ve lisans.
const fs=require("fs"), path=require("path");
const D=JSON.parse(fs.readFileSync(path.join(__dirname,"..","data","tolls.json"),"utf8"));
require("./harness")(String.raw`
  const T=TOLLS, D=${JSON.stringify(D)};
  // bütünlük
  if(!D.lisans || !/OpenStreetMap/.test(D.lisans) || !D.kaynaklar.length) throw new Error("kaynak / lisans yok");
  for(const y of D.yollar){
    if(y.tip==="kapali"){ const n=y.gise.length; for(const c in y.m) if(y.m[c].length!==n*n) throw new Error(y.id+" ızgara boyu");
      if(!y.m["1"]) throw new Error(y.id+" sınıf 1 yok"); }
    else if(!y.sabit && !y.saatli) throw new Error(y.id+" ücret yok");
  }
  T.data=D;
  const g=(id,ad)=>{ const y=D.yollar.find(x=>x.id===id); const z=ad?y.gise.find(x=>x.ad===ad):y.gise[0]; if(!z||!z.k.length) throw new Error("konum yok: "+id+" "+ad); return z.k[0]; };
  const via=(pts,t0,step=60000)=>pts.flatMap((p,i)=>[{t:t0+i*step, lat:p[0], lon:p[1]},{t:t0+i*step+1000, lat:p[0]+0.00001, lon:p[1]}]);
  const aug=new Date(2026,7,10,14,0).getTime();
  const one=(pts)=>T.compute(via(pts,aug),{sinif:"1"});
  let r;
  r=one([g("15TEMMUZ")]); if(r.toplam!==59) throw new Error("15 Temmuz: "+JSON.stringify(r.gecis));
  r=one([g("FSM")]); if(r.toplam!==59) throw new Error("FSM: "+JSON.stringify(r.gecis));
  const av=D.yollar.find(x=>x.id==="AVRASYA").gise[0].k;
  r=one([av[0],av[1]]); if(r.toplam!==330) throw new Error("Avrasya: "+JSON.stringify(r.gecis));
  r=one([g("O-4","ANADOLU (ÇAMLICA)"), g("O-4","SAMANDIRA"), g("O-4","KURTKÖY"), g("O-4","GEBZE")]);
  if(r.toplam!==49 || r.gecis.length!==1) throw new Error("O-4 Çamlıca→Gebze: "+JSON.stringify(r.gecis));
  r=one([g("O-3","MAHMUTBEY"), g("O-3","ESENYURT"), g("O-3","ÇATALCA")]);
  if(r.toplam!==49 || !/yaklaşık/.test(r.gecis[0].not||"")) throw new Error("O-3 Mahmutbey→Çatalca: "+JSON.stringify(r.gecis));
  r=one([g("O-7-YSS","Odayeri"), g("YSS-KOPRU"), g("O-7-YSS","Paşaköy")]);
  if(r.toplam!==480 || r.gecis.find(x=>x.yol==="YSS-KOPRU").tl!==0) throw new Error("O-7 Odayeri→Paşaköy (YSS dahil): "+JSON.stringify(r.gecis));
  // TEM Silivri ile Kuzey Marmara Silivri ayrı yerlerde: TEM'den geçen KMO'ya yazılmaz
  r=one([g("O-3","SELİMPAŞA"), g("O-3","SİLİVRİ")]);
  if(r.gecis.some(x=>x.yol.startsWith("O-7"))) throw new Error("TEM sürüşü Kuzey Marmara'ya yazıldı: "+JSON.stringify(r.gecis));
  console.log("ücret verisi (İstanbul): bütünlük, 15 Temmuz, FSM, Avrasya, O-4, O-3 (yaklaşık), O-7 + YSS dahil, TEM/KMO ayrımı tamam");
`);
